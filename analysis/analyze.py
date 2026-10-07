#!/usr/bin/env python3
"""Validate and report one complete portable three-method Mac run; never render."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import json
import math
import os
from pathlib import Path
import re
import statistics

from common import ROOT, SCENES, STRIDES, METHODS, LABELS, COMMITS, STAGES, now, read, require, sha, write_csv, write_json
from metrics import summarize, quantile
from completion_metrics import summarize_completion


def within_run(run, value):
    path = Path(value)
    path = (path if path.is_absolute() else run / path).resolve()
    require(path.is_relative_to(run), 'Result path escapes its run directory: ' + str(value))
    return path


class Audit:
    def __init__(self):
        self.sources = {}
        self.issues = []

    def source(self, path, expected=None):
        path = Path(path).resolve()
        if path not in self.sources:
            self.sources[path] = {'path': str(path), 'sha256': sha(path), 'bytes': path.stat().st_size}
        value = self.sources[path]['sha256']
        if expected is not None:
            require(value == expected, 'SHA mismatch: ' + str(path))
        return value


def parse_os(host):
    receipt = host.get('os', {})
    text = receipt.get('stdout', '') if isinstance(receipt, dict) else str(receipt)
    text = text or host.get('osVersion', '')
    fields = dict(re.findall(r'^([^:\n]+):\s*(.+)$', text, re.MULTILINE))
    return {'os_name': fields.get('ProductName', host.get('osName', 'macOS')),
            'os_version': fields.get('ProductVersion', host.get('osVersion', 'unrecorded')),
            'os_build': fields.get('BuildVersion', host.get('osBuild', 'unrecorded'))}


def telemetry_summary(raw, run, audit):
    path = within_run(run, raw['telemetryPath'])
    audit.source(path, raw['telemetrySha256'])
    observations = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    require(observations, 'Empty power telemetry')
    require([r['at'] for r in observations] == sorted(r['at'] for r in observations), 'Telemetry chronology differs')
    batteries, modes, swaps = [], set(), []
    for r in observations:
        power = r.get('power', '')
        source = r.get('powerSource')
        match = re.search(r"Now drawing from '([^']+)'", power)
        if match: source = match.group(1)
        require(source == 'AC Power', 'Every observed performance power state must be AC Power')
        modes.add(source)
        match = re.search(r'\b(\d+)%', power)
        if match: batteries.append(int(match.group(1)))
        match = re.search(r'Swapouts:\s+(\d+)', r.get('memory', ''))
        if match: swaps.append(int(match.group(1)))
    # Desktop Macs have no battery; this is unavailable, not zero percent.
    return {'telemetry_samples': len(observations), 'power_modes': ' | '.join(sorted(modes)),
            'battery_min_percent': min(batteries) if batteries else None,
            'battery_max_percent': max(batteries) if batteries else None,
            'swapouts_counter_delta': swaps[-1] - swaps[0] if swaps else None}


def validate_metadata(raw, method, definition, protocol):
    expected_versions = {'visionary': '1.0.1', 'spark': '0.1.10', 'supersplat': '2.1.0'}
    require(definition['version'] == expected_versions[method] and definition['sourceCommit'] == COMMITS[method],
            'Pinned renderer definition differs: ' + method)
    require(raw['browserVersion'] == protocol['browserVersion'].replace('Google Chrome ', '').strip() and raw['browserSha256'] == protocol['browserSha256'],
            'Browser identity differs within run')
    for phase in ('initialMetadata', 'metadata'):
        meta = raw[phase]
        require(meta['version'] == definition['version'] and meta['sourceCommit'] == definition['sourceCommit'],
                'Renderer metadata differs from pinned definition')
        require(meta['width'] == 1280 and meta['height'] == 720 and meta['background'] == '#000000' and meta['lod'] is False,
                'Framebuffer/black background/LoD contract differs')
        if method == 'visionary':
            adapter = meta['gpuAdapter']
            require(meta['timestampSupported'] is True and meta['timestampWriteCount'] == 6
                    and adapter.get('isFallbackAdapter') is not True and meta['shDegree'] == 3,
                    'Native WebGPU stage timestamps/SH3 required')
            require(not re.search('software|swiftshader|llvmpipe', str(adapter), re.I), 'Software adapter rejected')
            require(meta['sortBits'] == 32, 'Visionary key width differs')
        else:
            require(meta['backend'] == 'WebGL2' and meta['maxShDegree'] == 3
                    and not re.search('software|swiftshader|llvmpipe', meta['renderer'], re.I),
                    'Native WebGL2/SH3 required')
            if method == 'spark':
                require(meta['sortBits'] == definition['sortBits'] and definition['sortBits'] in (16, 32), 'Native Spark sorting width differs')
                require(meta['gpuMetricMode'] == 'separate-pass' and meta['depthBias'] == 1
                        and meta['sort32'] is (definition['sortBits'] == 32), 'Native Spark separate depth-key pass differs')
                require(meta['sortRadial'] is False and meta['preBlurAmount'] == .3 and meta['blurAmount'] == 0,
                        'Explicit Spark benchmark parameters differ')
                require(definition.get('algorithmModified') is False and bool(meta.get('modified', False)) == bool(definition.get('modified')),
                        'Only official Spark algorithms with declared timing instrumentation are in scope')
                if definition.get('modificationId'):
                    require(meta.get('modificationId') == definition['modificationId'], 'Spark modification ID differs')
            else:
                require(meta['engineVersion'] == '2.5.1' and meta['engineSourceCommit'] == '362a874c7149ee181ba68f4cc270fc7b664d7f0b',
                        'SuperSplat PlayCanvas engine changed')
                if phase == 'metadata':
                    require(meta['shBands'] == 3, 'Loaded SuperSplat asset must retain SH3')
        if phase == 'metadata':
            require(meta['devicePixelRatio'] == 1 and not meta.get('events'), 'Final DPR/events contract differs')
    fb = raw['framebuffer']
    require((fb['width'], fb['height'], fb['devicePixelRatio'], fb['viewportWidth'], fb['viewportHeight']) == (1280, 720, 1, 1280, 760),
            'Actual framebuffer/viewport differs')
    require('Macintosh' in fb['browserUserAgent'] and 'Windows' not in fb['browserUserAgent'], 'Expected a local Mac browser')


def validate_quality(run, rows, captures, selection, gt_root, audit):
    directory = run / 'quality/metrics'
    summary_path = directory / 'quality-summary.json'
    summary = read(summary_path)
    require(summary['complete'] is True and summary['referenceType'] == 'ground-truth'
            and set(summary['metrics']) == {'psnr', 'ssim', 'lpips'}, 'Full true-GT quality results missing')
    audit.source(summary_path)
    protocol_path = directory / 'metrics-protocol.json'
    audit.source(protocol_path, summary['protocol_sha256'])
    qp = read(protocol_path)
    require(qp['collection_protocol_sha256'] == audit.source(run / 'protocol.json'), 'Quality belongs to a different run')
    audit.source(ROOT / 'quality/measure_quality.py', qp['script_sha256'])
    numerical_path = run / 'validation/quality-numerical-validation.json'
    audit.source(numerical_path)
    numerical = read(numerical_path)
    require(numerical['complete'] is True and numerical['device'] == 'cpu', 'Full new CPU numerical validation missing')
    audit.source(ROOT / 'quality/validate_metrics.py', numerical['validation_script_sha256'])
    require(numerical['metrics_script_sha256'] == qp['script_sha256'], 'Numerical validation belongs to a different metric implementation')
    checks = numerical['checks']
    require(all(checks[k] is True for k in ('psnr_analytic', 'psnr_identity', 'ssim_identity', 'ssim_independent_scipy'))
            and checks['ssim_abs_error'] < 2e-6 and checks['lpips']['passed'] is True
            and checks['lpips']['checkpoint_sha256'] == qp['vgg_weight_sha256'],
            'PSNR/SSIM/LPIPS numerical validation differs or is incomplete')
    per_view = directory / 'per-view.jsonl'
    audit.source(per_view, summary['per_view_sha256'])
    gt_manifest_path = gt_root / 'ground-truth-manifest.json'
    audit.source(gt_manifest_path, summary['ground_truth_manifest_sha256'])
    gt = read(gt_manifest_path)
    selection_identity = sha(ROOT / 'quality/selection.json')
    require(gt['complete'] is True and gt['selection_file_sha256'] == selection_identity,
            'Ground truth camera selection differs')
    gt_lookup = {(r['scene'], r['camera_index']): r for r in gt['entries']}
    expected_gt = {(r['scene'], i) for r in selection['scenes'] for i in range(len(r['cameras']))}
    require(set(gt_lookup) == expected_gt and len(gt['entries']) == 378, 'Ground truth must cover the 378 exact views')
    expected = {(r['method'], r['scene'], r['stride'], i) for r in rows for i in range(r['views'])}
    lookup = {(r['method'], r['scene'], r['stride']): r for r in rows}
    groups, seen = defaultdict(list), set()
    for line in per_view.read_text().splitlines():
        q = json.loads(line)
        key = q['method'], q['scene'], q['stride'], q['camera_index']
        require(key in expected and key not in seen, 'Unexpected/duplicate quality image')
        seen.add(key)
        require(q['raw_sha256'] == lookup[key[:3]]['raw_sha256'], 'Quality raw lineage differs')
        cap = captures[key]
        require(q['render_sha256'] == cap['sha256'], 'Quality render SHA differs from capture')
        ref = gt_lookup[q['scene'], q['camera_index']]
        require(q['gt_sha256'] == ref['sha256'], 'Quality GT SHA differs')
        audit.source(gt_root / ref['relative_path'], ref['sha256'])
        require(isinstance(q['psnr_infinite'], bool) and ((q['psnr_db'] is None) == q['psnr_infinite']), 'PSNR infinity encoding differs')
        if q['psnr_db'] is not None: require(math.isfinite(q['psnr_db']) and q['psnr_db'] >= 0, 'Invalid PSNR')
        require(math.isfinite(q['ssim']) and -1.00001 <= q['ssim'] <= 1.00001
                and math.isfinite(q['lpips_vgg']) and q['lpips_vgg'] >= 0, 'Invalid SSIM/LPIPS')
        groups[key[:3]].append(q)
    require(seen == expected and len(seen) == 4536, 'Expected exactly 4536 quality views')
    qlookup = {(r['method'], r['scene'], r['stride']): r for r in summary['configurations']}
    require(set(qlookup) == set(lookup) and len(summary['configurations']) == 156, 'Quality configuration coverage differs')
    for key, values in groups.items():
        require(len(values) == qlookup[key]['views'] == lookup[key]['views'], 'Quality view count differs')
        for field in ('psnr_db', 'ssim', 'lpips_vgg'):
            numbers = [v[field] for v in values]
            if any(v is None for v in numbers): require(qlookup[key][field] is None, 'Infinite quality mean differs')
            else: require(math.isclose(qlookup[key][field], statistics.fmean(numbers), rel_tol=1e-8, abs_tol=1e-6), 'Quality mean differs')
        lookup[key].update({f'gt_{field}': qlookup[key][field] for field in ('psnr_db', 'ssim', 'lpips_vgg')})
        infinite_views = sum(v['psnr_infinite'] for v in values)
        require(qlookup[key]['psnr_infinite_views'] == infinite_views, 'PSNR infinity view count differs')
        lookup[key]['gt_psnr_infinite_views'] = infinite_views
    for a in summary['aggregates']:
        group = [q for key, q in qlookup.items() if key[0] == a['method'] and key[2] == a['stride']]
        require(len(group) == a['scenes'] == 13, 'Quality aggregate must weight all 13 scenes equally')
        for field in ('psnr_db', 'ssim', 'lpips_vgg'):
            numbers = [q[field] for q in group]
            if any(v is None for v in numbers): require(a[field] is None, 'Infinite aggregate differs')
            else: require(math.isclose(a[field], statistics.fmean(numbers), rel_tol=1e-8, abs_tol=1e-6), 'Quality scene mean differs')
    require(len(summary['aggregates']) == 12
            and {(a['method'], a['stride']) for a in summary['aggregates']} == {(m, s) for m in METHODS for s in STRIDES},
            'Expected three methods times four unique quality scales')
    require(summary['render_images'] == summary['expected_render_images'] == 4536, 'Quality summary image counts differ')
    audit.source(directory / 'capture-manifest.json', summary['capture_manifest_sha256'])
    independent_path = run / 'validation/independent-quality-qa.json'
    audit.source(independent_path)
    independent = read(independent_path)
    require(independent['passed'] is True and independent['complete'] is True
            and independent['qualitySummarySha256'] == audit.source(summary_path)
            and independent['perViewSha256'] == audit.source(per_view)
            and independent['metricsProtocolSha256'] == audit.source(protocol_path),
            'Independent full PSNR and actual-image quality audit is missing or belongs to different results')
    require(independent['sourceReceipts'], 'Independent quality audit has no bound sources')
    for source in independent['sourceReceipts']:
        value = Path(source['path'])
        audit.source(value if value.is_absolute() else ROOT / value, source['sha256'])
    return summary, gt, qp


def validate_prerequisites(run, protocol, audit):
    path = run / 'validation/prerequisites.json'
    audit.source(path, protocol['prerequisitesSha256'])
    receipt = read(path)
    require(receipt['passed'] is True and receipt['pilotConfigurations'] == 12
            and receipt['pilotSamples'] == 378, 'Complete source-matched pilot prerequisite missing')
    source_paths = set()
    for source in receipt['sources']:
        source_path = (ROOT / source['path']).resolve()
        require(source_path not in source_paths, 'Duplicate prerequisite source')
        source_paths.add(source_path)
        audit.source(source_path, source['sha256'])
    pilot = (ROOT / receipt['pilotDirectory']).resolve()
    pilot_protocol_path = pilot / 'protocol.json'
    pilot_cleanup_path = pilot / 'runtime-cleanup.json'
    require(pilot_protocol_path in source_paths and pilot_cleanup_path in source_paths,
            'Prerequisites do not bind pilot protocol and cleanup')
    pp, cleanup = read(pilot_protocol_path), read(pilot_cleanup_path)
    require(pp['pilot'] is True and pp['expectedConfigurations'] == 12 and pp['expectedSamples'] == 378
            and pp['experimentHashes'] == protocol['experimentHashes']
            and pp['browserSha256'] == protocol['browserSha256']
            and pp['browserFrameworkIdentity'] == protocol['browserFrameworkIdentity']
            and pp['hostIdentity']['osVersion'] == protocol['hostIdentity']['osVersion'],
            'Pilot sources/browser/OS differ from this formal run')
    require(cleanup.get('complete') is True and cleanup.get('passed') is True
            and cleanup.get('gpuLockReleased') is True and all(c['alive'] is False for c in cleanup['children']),
            'Pilot cleanup incomplete')
    samples = 0
    for scene in ('bicycle', 'train'):
        for stride in (1, 8):
            for method in METHODS:
                raw_path = pilot / 'raw' / f'{scene}-s{stride}-{method}.json'
                require(raw_path in source_paths, 'Pilot raw identity missing from prerequisites')
                raw = read(raw_path)
                require(raw['status'] == 'complete' and raw['protocolId'] == pp['protocolId']
                        and raw['experimentHashes'] == pp['experimentHashes'], 'Pilot raw source/protocol differs')
                samples += sum(len(rd['samples']) for rd in raw['rounds'])
    require(samples == 378, 'Pilot sample coverage differs')
    required_checks = {'gpu-probe-metal.json', 'spark-native-sort-cpu-validation.json',
                       'supersplat-worker.json', 'native-prepare-lifecycle-review.json'}
    checks = [p for p in source_paths if p.name in required_checks]
    require(len(source_paths) >= 18 and len(checks) == 4 and {p.name for p in checks} == required_checks,
            'Expected source-bound GPU probe and three CPU prerequisites')
    for check in checks:
        require(read(check)['passed'] is True, 'Prerequisite check did not pass: ' + check.name)
    return receipt


def validate_timer_review(config, protocol, audit):
    configured = Path(config.get('validationRoot', 'results/setup'))
    setup = (configured if configured.is_absolute() else ROOT / configured).resolve()
    path = setup / 'timer-domain-review.json'
    if not path.exists():
        return None
    review = read(path)
    audit.source(path)
    require(review['status'] == 'completed-with-explicit-timer-domain-limitation'
            and review['frozenCaptureSourceChanged'] is False and review['formalProtocolChanged'] is False,
            'Timer diagnostic unexpectedly changed the formal baseline')
    for source in review['localSources']:
        require(protocol['experimentHashes'][source['path']] == source['sha256'],
                'Timer review source differs from formal renderer')
        audit.source(ROOT / source['path'], source['sha256'])
    diagnostic = review['diagnostic']
    for case in diagnostic['cases']:
        require(case['browserVersion'] == protocol['browserVersion'].replace('Google Chrome ', '').strip(),
                'Timer review browser differs from this formal run')
        raw_path = ROOT / case['rawPath']
        audit.source(raw_path, case['rawSha256'])
        raw = read(raw_path)
        chip = protocol['hostIdentity']['hardware']['SPHardwareDataType'][0]['chip_type']
        require(chip in raw['finalMetadata']['renderer'] and raw['status'] == 'complete',
                'Timer diagnostic hardware differs from this formal run')
        audit.source(ROOT / raw['sourceRawPath'], raw['sourceRawSha256'])
    runtime_path = ROOT / diagnostic['runtimeCleanup']['path']
    audit.source(runtime_path, diagnostic['runtimeCleanup']['sha256'])
    cleanup = read(runtime_path)
    require(cleanup['passed'] is True and cleanup['complete'] is True and cleanup['gpuLockReleased'] is True
            and all(c['alive'] is False for c in cleanup['children']), 'Timer diagnostic cleanup incomplete')
    summary_path = setup / 'timer-diagnostic/summary.json'
    audit.source(summary_path)
    summary = read(summary_path)
    require(summary['passed'] is True and summary['runs'] == diagnostic['cases'], 'Timer diagnostic summary differs')
    audit.source(setup / 'timer-domain-review.md')
    review['evidenceFiles'] = [
        {'label': 'Timer API domain review', 'sourcePath': str(path), 'reportPath': 'evidence/timer-domain-review.json'},
        {'label': 'Timer review narrative', 'sourcePath': str(setup / 'timer-domain-review.md'), 'reportPath': 'evidence/timer-domain-review.md'},
        {'label': 'Isolated timer diagnostic summary', 'sourcePath': str(summary_path), 'reportPath': 'evidence/timer-diagnostic/summary.json'},
        {'label': 'Isolated timer cleanup', 'sourcePath': str(runtime_path), 'reportPath': 'evidence/timer-diagnostic/runtime-cleanup.json'}]
    return review


def validate_performance_audit(run, protocol, audit):
    path = run / 'validation/independent-formal-qa.json'
    audit.source(path)
    receipt = read(path)
    require(receipt.get('schema') == 'independent-mac-three-method-performance-audit-v1'
            and receipt.get('passed') is True and receipt.get('complete') is True
            and receipt.get('fullMatrixComplete') is True and receipt.get('partial') is False
            and receipt.get('pilot') is False, 'Complete independent formal performance audit missing')
    require((ROOT / receipt['runDirectory']).resolve() == run
            and receipt['protocolId'] == protocol['protocolId'],
            'Independent performance audit belongs to a different run/protocol')
    expected = {'configurations': 156, 'rounds': 780, 'samples': 68040,
                'displayPngs': 234, 'qualityWebps': 4536, 'rafIntervals': 14040}
    require(all(receipt['counts'].get(key) == value
                and receipt['expectedCounts'].get(key) == value for key, value in expected.items()),
            'Independent performance audit coverage differs')
    sources = receipt.get('sourceReceipts')
    require(isinstance(sources, list) and sources, 'Independent performance audit has no bound sources')
    seen = set()
    for source in sources:
        source_path = (ROOT / source['path']).resolve()
        require(source_path not in seen, 'Duplicate independent performance audit source')
        seen.add(source_path)
        audit.source(source_path, source['sha256'])
        require(source_path.stat().st_size == source['bytes'], 'Independent performance source size differs')
    raw_root = (run / 'raw').resolve()
    raw_paths = {p.resolve() for p in raw_root.glob('*.json')}
    require({p for p in seen if p.parent == raw_root} == raw_paths
            and {(run / 'protocol.json').resolve(), (run / 'runtime-cleanup.json').resolve()} <= seen,
            'Independent performance audit does not bind this complete raw collection')
    return receipt


def collection_timeline(rows, cleanup):
    def stamp(value):
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        require(parsed.tzinfo is not None, 'Configuration timeline needs timezone-aware timestamps')
        require(parsed.utcoffset() == timedelta(0), 'Configuration timeline timestamps must use UTC')
        return parsed
    def key(row):
        return f'{row["scene"]}-s{row["stride"]}-{row["method"]}'
    ordered = sorted(rows, key=lambda row: (stamp(row['started_at']), key(row)))
    lookup = {key(row): row for row in ordered}
    require(all(stamp(row['completed_at']) >= stamp(row['started_at']) for row in ordered),
            'Configuration session ends before its recorded start')
    intervals = [dict(previous_configuration=key(previous), previous_raw_sha256=previous['raw_sha256'],
                      previous_completed_at=previous['completed_at'], next_configuration=key(following),
                      next_raw_sha256=following['raw_sha256'], next_started_at=following['started_at'],
                      gap_seconds=(stamp(following['started_at']) - stamp(previous['completed_at'])).total_seconds())
                 for previous, following in zip(ordered, ordered[1:])]
    resumed = []
    for item in cleanup['configurations']:
        if item.get('resumed') is True:
            require(item['key'] in lookup and item['sha256'] == lookup[item['key']]['raw_sha256'],
                    'Checkpoint-reuse timeline entry differs from a validated raw')
            resumed.append(item['key'])
    require(len(resumed) == len(set(resumed)), 'Duplicate checkpoint-reuse timeline entry')
    require(stamp(cleanup['finishedAt']) >= stamp(cleanup['startedAt']),
            'Latest collector invocation ends before its recorded start')
    first = min(rows, key=lambda row: stamp(row['started_at']))['started_at']
    last = max(rows, key=lambda row: stamp(row['completed_at']))['completed_at']
    return dict(startedAt=first, completedAt=last,
                configurationSessionSpanSeconds=(stamp(last) - stamp(first)).total_seconds(),
                latestRuntimeStartedAt=cleanup['startedAt'], latestRuntimeFinishedAt=cleanup['finishedAt'],
                resumedConfigurationCount=len(resumed), resumedConfigurationKeys=resumed,
                adjacentIntervals=len(intervals), largestAdjacentGap=max(intervals, key=lambda item: item['gap_seconds']),
                negativeAdjacentIntervals=sum(item['gap_seconds'] < 0 for item in intervals),
                definition='Wall-clock configuration session boundaries from raw startedAt/completedAt; not GPU time, measured-loop time, or a continuous thermal steady-state test.'), intervals


def analyze(run, config, out):
    audit = Audit()
    require(not (run / 'gpu-session.lock').exists() and not (ROOT / 'results/gpu-session.lock').exists(), 'GPU collection still locked')
    protocol = read(run / 'protocol.json')
    require(protocol.get('pilot', False) is False, 'Pilot results cannot become formal results')
    cleanup = read(run / 'runtime-cleanup.json')
    require(cleanup.get('complete') is True and cleanup.get('finishedAt')
            and cleanup.get('gpuLockReleased') is True and cleanup.get('passed') is True
            and all(c.get('alive') is False for c in cleanup.get('children', [])), 'Run/owned process cleanup incomplete')
    audit.source(run / 'protocol.json'); audit.source(run / 'runtime-cleanup.json')
    prerequisites = validate_prerequisites(run, protocol, audit)
    timer_review = validate_timer_review(config, protocol, audit)
    host_path = run / 'environment/host-inventory.json'
    audit.source(host_path, protocol['hostInventorySha256'])
    host = read(host_path)
    integrity_path = run / 'validation/input-integrity.json'
    audit.source(integrity_path, protocol['inputIntegritySha256'])
    integrity = read(integrity_path)
    require(integrity['passed'] is True and len(integrity['models']) == 52, 'Full model integrity receipt is missing')
    manifest = read(ROOT / 'config/data/manifest.json')
    subsets = read(ROOT / 'config/data/subsets-manifest.json')
    models = {(r['scene'], 1): r['ply'] for r in manifest['scenes']}
    models.update({(r['scene'], r['stride']): r for r in subsets['subsets']})
    locked_sha = {r['relative_path']: r['sha256'] for r in models.values()}
    require(len(locked_sha) == 52 and {r['relative_path'] for r in integrity['models']} == set(locked_sha)
            and all(r['sha256'] == r['expectedSha256'] == locked_sha[r['relative_path']]
                                        for r in integrity['models']), 'Frozen model integrity differs')
    require(set(protocol['methodDefinitions']) == set(METHODS), 'Expected three method definitions')
    require(set(protocol['scenes']) == set(SCENES) and protocol['strides'] == list(STRIDES)
            and set(protocol['methods']) == set(METHODS) and protocol['repeats'] == 5
            and protocol['cycles'] == 3 and protocol['expectedConfigurations'] == 156
            and protocol['expectedSamples'] == 68040, 'Formal matrix/protocol contract differs')
    for name, expected_sha in protocol['experimentHashes'].items():
        path = (ROOT / name).resolve()
        require(path.is_relative_to(ROOT), 'Protocol source path escapes reproduction repository')
        audit.source(path, expected_sha)
    selection = read(ROOT / 'quality/selection.json')
    audit.source(ROOT / 'quality/selection.json')
    selected = {s['scene']: s for s in selection['scenes']}
    require(set(selected) == set(SCENES) and sum(len(s['cameras']) for s in selected.values()) == 378, 'Frozen selection differs')
    projection = []
    for scene in SCENES:
        cameras = selected[scene]['cameras']
        fx_values = [c['fx'] * 1280 / c['width'] for c in cameras]
        fy_values = [c['fy'] * 720 / c['height'] for c in cameras]
        ratios = [fx / fy for fx, fy in zip(fx_values, fy_values)]
        projection.append({'scene': scene, 'views': len(cameras), 'effective_fx_px': fx_values[0],
                           'effective_fy_px': fy_values[0], 'effective_fx_over_fy_min': min(ratios),
                           'effective_fx_over_fy_max': max(ratios),
                           'intrinsics_constant_within_scene': len(set(zip(fx_values, fy_values))) == 1})
    environment = {**parse_os(host), 'browser_name': 'Google Chrome', 'browser_version': protocol['browserVersion'],
                   'framebuffer_width': 1280, 'framebuffer_height': 720, 'viewport_width': 1280, 'viewport_height': 760,
                   'device_pixel_ratio': 1, 'browser_headless': True}
    rows, rounds, e2e_samples, raf_rows, pngs, capture_map = [], [], [], [], [], {}
    render_parameters = {}
    seen = set()
    for path in sorted((run / 'raw').glob('*.json')):
        raw = read(path)
        key = raw['method'], raw['scene'], raw['stride']
        require(key[0] in METHODS and key[1] in SCENES and key[2] in STRIDES and key not in seen, 'Unexpected/duplicate configuration')
        seen.add(key)
        method, scene, stride = key
        require(raw['engine'] == method, 'Canonical method/engine identity differs')
        require(raw['status'] == 'complete' and not raw.get('error') and not raw.get('errors'), 'Incomplete/error raw: ' + path.name)
        require(raw['protocolId'] == protocol['protocolId'] and raw['experimentHashes'] == protocol['experimentHashes'], 'Raw protocol/source identity differs')
        require(raw['cameras'] == selected[scene]['cameras'] and raw['cameraFileSha256'] == selected[scene]['camera_sha256'], 'Frozen camera identity differs')
        require(raw['model'] == {k: models[scene, stride][k] for k in ('relative_path', 'bytes', 'sha256', 'gaussian_count')},
                'Raw model identity differs from the frozen original/stride model')
        require(raw['powerViolations'] == [], 'Observed power violation')
        validate_metadata(raw, method, protocol['methodDefinitions'][method], protocol)
        parameter_keys = {'visionary': ('kernelSize', 'shDegree', 'precision'),
                          'spark': ('sortBits', 'sort32', 'sortRadial', 'preBlurAmount', 'blurAmount', 'keyEncoding', 'prepareLifecycleAdaptation'),
                          'supersplat': ('nativeProjectionFootprint', 'nativeRasterRules', 'modelCoordinateAdaptation')}[method]
        parameters = {k: raw['metadata'][k] for k in parameter_keys}
        require(method not in render_parameters or render_parameters[method] == parameters,
                'Renderer parameters changed across configurations')
        render_parameters[method] = parameters
        stage, stage_rounds, warnings = summarize(raw, method)
        completion, completion_rounds = summarize_completion(raw)
        raw_sha = audit.source(path)
        identity = {'method': method, 'scene': scene, 'stride': stride}
        row = {**identity, **stage, **completion, **telemetry_summary(raw, run, audit), **environment,
               'dataset': raw['dataset'], 'gaussian_count': raw['model']['gaussian_count'], 'model_sha256': raw['model']['sha256'],
               'raw_path': str(path), 'raw_sha256': raw_sha, 'started_at': raw['startedAt'], 'completed_at': raw['completedAt'],
               'renderer_version': raw['metadata']['version'], 'source_commit': raw['metadata']['sourceCommit'],
               'renderer_identity': raw['metadata'].get('renderer', str(raw['metadata'].get('gpuAdapter'))),
               'diagnostics': dict(warnings)}
        samples = [s for rd in raw['rounds'] for s in rd['samples']]
        if method == 'spark':
            require(all(s['sortBits'] == protocol['methodDefinitions']['spark']['sortBits'] for s in samples),
                    'Per-sample native Spark key width differs')
        row['stage_exceeds_e2e_samples'] = sum((s['gpu']['totalMs'] if method == 'visionary' else s['stageCostSumMs']) > s['e2eCompletionMs'] for s in samples)
        row['max_stage_to_e2e_ratio'] = max((s['gpu']['totalMs'] if method == 'visionary' else s['stageCostSumMs']) / s['e2eCompletionMs'] for s in samples)
        row['round_cv_percent'] = 100 * row['stage_cost_ms_sd'] / row['stage_cost_ms_mean']
        rows.append(row)
        for s, c in zip(stage_rounds, completion_rounds): rounds.append({**identity, **s, **c, **environment})
        for s in samples:
            e2e_samples.append({**identity, **{k: s[k] for k in ('repeat', 'cycle', 'order', 'cameraIndex', 'cameraId', 'img_name', 'e2eStartMs', 'e2eEndMs', 'e2eCompletionMs')}, **environment, 'raw_sha256': raw_sha})
        require(len(raw.get('raf', [])) == (360 if stride == 1 else 0), 'Native rAF coverage differs')
        if raw.get('raf'):
            intervals = [s['intervalMs'] for s in raw['raf']]
            require(all(math.isfinite(v) and v > 0 for v in intervals), 'Invalid native rAF interval')
            raf_rows.append({**identity, 'frames': len(intervals), 'interval_sum_ms': math.fsum(intervals),
                             'callback_throughput_hz': 1000 * len(intervals) / math.fsum(intervals),
                             'interval_p50_ms': quantile(intervals, .5), 'interval_p95_ms': quantile(intervals, .95), **environment})
        expected_pngs = {0, len(raw['cameras']) // 2, len(raw['cameras']) - 1} if stride == 1 else {0}
        require({c['cameraIndex'] for c in raw['captures']} == expected_pngs and len(raw['captures']) == len(expected_pngs), 'Formal PNG coverage differs')
        for c in raw['captures']:
            p = within_run(run, c['path']); digest = audit.source(p, c['sha256'])
            from PIL import Image, ImageStat
            with Image.open(p) as image:
                image.load(); require(image.size == (1280, 720), 'Capture dimensions differ')
                require(max(ImageStat.Stat(image.convert('RGB')).var) > 0, 'Uniform/blank capture')
            pngs.append({**identity, 'camera_index': c['cameraIndex'], 'path': str(p), 'sha256': digest})
        require(len(raw['qualityCaptures']) == len(raw['cameras']) and {c['cameraIndex'] for c in raw['qualityCaptures']} == set(range(len(raw['cameras']))), 'Quality capture coverage differs')
        for c in raw['qualityCaptures']:
            require(c['img_name'] == raw['cameras'][c['cameraIndex']]['img_name'], 'Quality capture camera name differs')
            p = within_run(run, c['path']); digest = audit.source(p, c['sha256'])
            capture_map[(*key, c['cameraIndex'])] = {'path': str(p), 'sha256': digest, 'raw_sha256': raw_sha}
    expected = {(m, s, k) for m in METHODS for s in SCENES for k in STRIDES}
    require(seen == expected and len(rows) == 156 and len(rounds) == 780 and len(e2e_samples) == 68040,
            f'Formal matrix incomplete: {len(rows)}/156 configurations, {len(rounds)}/780 rounds, {len(e2e_samples)}/68040 samples')
    require(len(pngs) == 234 and len(capture_map) == 4536 and len(raf_rows) == 39, 'PNG/all-view/native rAF capture counts differ')
    rows.sort(key=lambda r: (STRIDES.index(r['stride']), SCENES.index(r['scene']), METHODS.index(r['method'])))
    performance_audit = validate_performance_audit(run, protocol, audit)
    timeline, timeline_intervals = collection_timeline(rows, cleanup)
    gt_root = Path(config['groundTruthRoot']).resolve()
    quality, gt_manifest, quality_protocol = validate_quality(run, rows, capture_map, selection, gt_root, audit)
    aggregates = []
    fields = ['stage_cost_ms_mean', 'e2e_completion_mean_ms', 'e2e_completion_p50_ms', 'e2e_completion_p95_ms', 'completed_frames_per_second', 'gt_psnr_db', 'gt_ssim', 'gt_lpips_vgg']
    for stride in STRIDES:
        for method in METHODS:
            group = [r for r in rows if r['stride'] == stride and r['method'] == method]
            aggregates.append({'method': method, 'stride': stride, 'scenes': 13,
                               **{f: statistics.fmean(r[f] for r in group) if all(r[f] is not None for r in group) else None for f in fields}})
    report = {'schema': 'portable-three-method-report-v1', 'complete': True, 'generatedAt': now(),
              'protocolId': protocol['protocolId'], 'protocol': protocol, 'hostInventory': host, 'environment': environment,
              'methodDefinitions': protocol['methodDefinitions'], 'configurations': rows, 'aggregates': aggregates,
              'renderParameters': render_parameters, 'projectionIntrinsics': projection,
              'quality': quality, 'qualityProtocol': quality_protocol, 'prerequisites': prerequisites, 'nativeRaf': raf_rows,
              'independentPerformanceAudit': performance_audit,
              'collectionTimeline': timeline,
              'timerDomainReview': timer_review,
              'captureCount': len(pngs), 'qualityCaptureCount': len(capture_map),
              'roundCount': len(rounds), 'sampleCount': len(e2e_samples),
              'startedAt': min(r['started_at'] for r in rows), 'completedAt': max(r['completed_at'] for r in rows),
              'groundTruthRoot': str(gt_root), 'groundTruthManifest': gt_manifest, 'runRoot': str(run)}
    write_csv(out / 'configurations.csv', rows); write_csv(out / 'round-means.csv', rounds)
    write_csv(out / 'e2e-samples.csv', e2e_samples); write_csv(out / 'aggregates.csv', aggregates)
    write_csv(out / 'native-raf.csv', raf_rows)
    write_csv(out / 'projection-intrinsics.csv', projection)
    write_csv(out / 'collection-timeline.csv', timeline_intervals)
    write_json(out / 'report.json', report)
    qa = {'passed': True, 'complete': True, 'configurations': 156, 'rounds': 780, 'samples': 68040,
          'pngCaptures': 234, 'qualityViews': 4536, 'qualityComplete': True,
          'stageExceedsE2ESamples': sum(r['stage_exceeds_e2e_samples'] for r in rows), 'issues': audit.issues}
    write_json(out / 'analysis-qa.json', qa)
    from reports import build
    build(out, report, qa, pngs)
    (out / 'STATUS.md').write_text('Complete: 156 newly measured configurations; timing, E2E and quality lineage validated.\n')
    outputs = [{'path': str(p.relative_to(run)), 'sha256': sha(p), 'bytes': p.stat().st_size}
               for p in sorted(out.rglob('*')) if p.is_file() and p.name != 'build-receipt.json']
    write_json(out / 'build-receipt.json', {'complete': True, 'generatedAt': now(), 'protocolId': protocol['protocolId'],
               'sources': list(audit.sources.values()), 'outputs': outputs,
               'analysisSources': {p.name: sha(p) for p in sorted(Path(__file__).parent.glob('*.py'))},
               'noGpuWorkInAnalyzer': True, 'noHistoricalPerformanceOrQualityInput': True})
    return qa


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--run-dir', type=Path, required=True)
    ap.add_argument('--config', type=Path, required=True)
    args = ap.parse_args()
    run = args.run_dir.resolve(); out = run / 'analysis'; out.mkdir(parents=True, exist_ok=True)
    config_path = args.config if args.config.is_absolute() else ROOT / args.config
    config = read(config_path)
    value = Path(config['groundTruthRoot'])
    config['groundTruthRoot'] = str((value if value.is_absolute() else ROOT / value).resolve())
    try:
        qa = analyze(run, config, out)
    except Exception as error:
        write_json(out / 'analysis-qa.json', {'passed': False, 'complete': False, 'error': str(error), 'at': now()})
        (out / 'STATUS.md').write_text('INCOMPLETE / INVALID: ' + str(error) + '\nNo current full-matrix claim is valid.\n')
        raise
    print(json.dumps(qa))


if __name__ == '__main__': main()
