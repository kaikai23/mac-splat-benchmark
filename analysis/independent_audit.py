#!/usr/bin/env python3
"""Independent, read-only audit of a completed pilot/full performance collection.

This intentionally does not import the runner or reporting implementation. It
never starts a browser, torch, a network request, or a GPU workload. Run only
after the global GPU lock has been released. Model identities are checked
against the complete pre-GPU SHA receipt; 18.5 GB of models are not rehashed.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import socket

ROOT = Path(__file__).resolve().parents[1]
SCENES = ['bicycle', 'flowers', 'garden', 'stump', 'treehill', 'room', 'counter',
          'kitchen', 'bonsai', 'drjohnson', 'playroom', 'truck', 'train']
METHODS = ['visionary', 'spark', 'supersplat']
PINNED = {
    'visionary': ('1.0.1', 'e50f3f6c7200be0516567f0830e5240dfa26d27d'),
    'spark': ('0.1.10', '792d6d193db8b79ed4d1f32ef65cca9ec93f0896'),
    'supersplat': ('2.1.0', '2f23b4b2072da694172faa26ff44fc67f2a01ca2'),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def relative(root, value):
    require(isinstance(value, str), 'Expected relative path')
    path = (root / value).resolve()
    require(path.is_relative_to(root.resolve()), 'Path escapes its root: ' + value)
    return path


def stamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parsed.tzinfo is not None, 'Timestamp lacks timezone')
    return parsed


def finite(value, positive=False):
    require(isinstance(value, (int, float)) and not isinstance(value, bool) and
            math.isfinite(value) and (value > 0 if positive else value >= 0), 'Invalid numeric value: ' + str(value))
    return value


def close(a, b, label):
    require(math.isclose(finite(a), finite(b), rel_tol=1e-8, abs_tol=1e-6), label)


def percentile(values, p):
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    low = math.floor(index)
    high = math.ceil(index)
    return ordered[low] * (high - index) + ordered[high] * (index - low) if low != high else ordered[low]


class Audit:
    def __init__(self, run):
        self.run = run
        self.sources = {}
        self.warnings = Counter()
        self.pose_errors = []
        self.configurations = []
        self.captures = set()
        self.quality = set()
        self.counts = Counter()

    def source(self, path, expected=None):
        path = path.resolve()
        if path not in self.sources:
            self.sources[path] = {'path': os.path.relpath(path, ROOT), 'bytes': path.stat().st_size, 'sha256': sha(path)}
        actual = self.sources[path]['sha256']
        require(expected is None or actual == expected, 'SHA256 mismatch: ' + str(path))
        return actual

    def power(self, sample):
        require("Now drawing from 'AC Power'" in sample['power'], 'Observed non-AC power')
        self.counts['powerReferences'] += 1

    def image(self, path, expected_sha, pixel_sha=None):
        from PIL import Image
        self.source(path, expected_sha)
        with Image.open(path) as image:
            require(image.size == (1280, 720), 'Image dimensions differ: ' + str(path))
            pixels = image.convert('RGB').tobytes()
        actual = hashlib.sha256(pixels).hexdigest()
        require(pixel_sha is None or actual == pixel_sha, 'Lossless RGB receipt mismatch: ' + str(path))
        if not any(pixels):
            self.warnings['all_black_capture_images'] += 1
        return actual


def expected_models(audit):
    lock = read(ROOT / 'config/data-lock.json')
    for item in lock['manifests']:
        audit.source(relative(ROOT, item['path']), item['sha256'])
    original = read(ROOT / 'config/data/manifest.json')
    subsets = read(ROOT / 'config/data/subsets-manifest.json')
    result = {(s['scene'], 1): s['ply'] for s in original['scenes']}
    result.update({(s['scene'], s['stride']): s for s in subsets['subsets']})
    require(len(result) == 52, 'Locked model coverage differs')
    return result, lock


def metadata(raw, method, chip):
    for name in ['initialMetadata', 'metadata']:
        item = raw[name]
        require((item['version'], item['sourceCommit']) == PINNED[method], 'Pinned source version differs')
        require((item['width'], item['height'], item['background'], item['lod']) ==
                (1280, 720, '#000000', False), 'Rendering option differs')
        if method == 'visionary':
            require(item['sortBits'] == 32 and item['shDegree'] == 3 and item['timestampSupported'] and
                    item['timestampWriteCount'] == 6, 'Visionary timestamp/key/SH contract differs')
            gpu = item['gpuAdapter']
            require(gpu['vendor'] == 'apple' and gpu.get('isFallbackAdapter') is not True and
                    chip in gpu['description'], 'Visionary adapter is not expected local Apple hardware')
        else:
            require(item['backend'] == 'WebGL2' and item['maxShDegree'] == 3 and
                    'ANGLE Metal Renderer: ' + chip in item['renderer'], 'Expected local ANGLE Metal hardware')
            if method == 'spark':
                require(item['sortBits'] == 16 and item['sort32'] is False and item['depthBias'] == 1 and
                        item['gpuMetricMode'] == 'separate-pass' and item['modificationId'] == 'spark-0.1.10-timers-v1',
                        'Spark is not the fixed upstream native16 configuration')
            else:
                require(item['engineVersion'] == '2.5.1' and
                        item['engineSourceCommit'] == '362a874c7149ee181ba68f4cc270fc7b664d7f0b', 'PlayCanvas changed')
                if name == 'metadata':
                    require(item['shBands'] == 3, 'Loaded SuperSplat SH degree differs')
        if name == 'metadata':
            require(not item['events'] and item['crossOriginIsolated'] and item['devicePixelRatio'] == 1,
                    'Runtime errors/isolation/DPR contract differs')
    frame = raw['framebuffer']
    require([frame[k] for k in ['width', 'height', 'devicePixelRatio', 'viewportWidth', 'viewportHeight']] ==
            [1280, 720, 1, 1280, 760], 'Actual framebuffer differs')
    require(frame['crossOriginIsolated'] and 'Macintosh' in frame['browserUserAgent'], 'Expected isolated Mac browser')


def stages(sample, method, count, camera, audit):
    if method == 'visionary':
        gpu = sample['gpu']
        values = [finite(gpu[k]) for k in ['prepMs', 'sortMs', 'drawMs']]
        total = finite(gpu['totalMs'], True)
        require(total + 1e-6 >= math.fsum(values) and gpu['timestampWriteCount'] == 6 and
                sample['timingMode'] == 'stages', 'Visionary GPU span/query count differs')
        require([x['stage'] for x in gpu['stageTimings']] == ['prep', 'sort', 'draw'], 'Visionary stage query order differs')
        for actual, expected in zip(gpu['stageTimings'], values):
            close(actual['ms'], expected, 'Visionary individual stage differs')
        require(sample['gaussianCount'] == count and 0 <= sample['visibleSplats'] <= count, 'Visionary counts differ')
        wall = finite(sample['wallMs'], True)
    else:
        require(sample['sortSequence'] > 0, 'Missing fresh sort sequence')
        sign = -1 if method == 'supersplat' else 1
        expected = camera['position'] + [sign * camera['rotation'][axis][2] for axis in range(3)]
        actual = sample['sortedViewOrigin'] + sample['sortedViewDirection']
        require(len(actual) == 6, 'Incomplete worker pose')
        for observed, wanted in zip(actual, expected):
            require(isinstance(observed, (int, float)) and math.isfinite(observed), 'Nonfinite worker pose')
            difference = abs(observed - wanted)
            tolerance = max(1e-5, abs(wanted) * 2e-7) if method == 'supersplat' else 1e-6
            require(difference <= tolerance, 'Worker sorted a different camera')
            audit.pose_errors.append(difference)
        if method == 'spark':
            gpu = math.fsum(finite(sample[k]) for k in ['gpuPrepMs', 'gpuSortMetricMs', 'gpuDrawMs'])
            close(sample['gpuTotalMs'], gpu, 'Spark GPU stage sum differs')
            total = gpu + finite(sample['cpuSortMs'])
            close(sample['stageCostSumMs'], total, 'Spark stage sum differs')
            require(sample['numSplats'] == count and 0 <= sample['sortedSplats'] <= count and sample['sortBits'] == 16,
                    'Spark count/key width differs')
            require(sample['gpuQueryCounts'] == {'prep': 1, 'metric': 1, 'draw': 1}, 'Spark query count differs')
            require(sample['prepareLifecycleCompensated'] is True and sample['prepareAccumulatorRefCount'] == 2 and
                    2 <= sample['accumulatorCount'] <= 5, 'Spark accumulator ownership leaked')
            require('cpuKeyPackingMs' not in sample, 'Unexpected custom FP16 conversion')
            finite(sample['metricReadbackWallMs']); finite(sample['orderingUploadWallMs'])
            require(sample['workerRoundtripMs'] + 1e-5 >= sample['cpuSortMs'], 'Worker RPC span excludes CPU sort')
            wall = finite(sample['viewCompleteWallMs'], True)
        else:
            cpu = math.fsum(finite(sample[k]) for k in ['cpuPrepMs', 'cpuSortMs', 'cpuPostprocessMs'])
            gpu = finite(sample['gpuDrawMs']) + finite(sample['gpuBlitMs'])
            close(sample['cpuWorkerComputeMs'], cpu, 'SuperSplat CPU stages differ')
            close(sample['cpuWorkerSpanMs'], cpu, 'SuperSplat Worker span differs')
            close(sample['gpuTotalMs'], gpu, 'SuperSplat GPU stages differ')
            total = cpu + gpu
            close(sample['stageCostSumMs'], total, 'SuperSplat stage sum differs')
            require(sample['gpuPrepMs'] is None and sample['gpuPrepMode'] == 'fused-into-draw' and
                    sample['gpuSortMs'] == sample['gpuSortMetricMs'] == 0, 'SuperSplat stage boundaries differ')
            bits = min(20, max(10, math.floor(math.log2(count / 4) + .5)))
            require(sample['compareBits'] == bits and sample['bucketCount'] == 2 ** bits + 1 and
                    sample['sortedSplats'] == count and 0 <= sample['activeSplats'] <= count and
                    sample['visible'] == sample['activeSplats'], 'SuperSplat bucket/count contract differs')
            require(sample['sourceOrigin'] == sample['sortedViewOrigin'] and
                    sample['sourceDirection'] == sample['sortedViewDirection'], 'Worker pose aliases differ')
            wall = finite(sample['wallMs'], True)
            close(sample['viewCompleteWallMs'], wall, 'SuperSplat legacy wall alias differs')
            require(wall <= finite(sample['queryReadyWallMs'], True) + 1e-6, 'GPU readiness precedes gl.finish return')
            require(sample['queryReadyWallMs'] <= sample['e2eCompletionMs'] + 1e-5, 'Query completion outside E2E')
    for label, condition in [('stage_exceeds_legacy_wall', total > wall + 1e-6),
                             ('stage_exceeds_e2e', total > sample['e2eCompletionMs'] + 1e-6),
                             ('legacy_wall_exceeds_e2e', wall > sample['e2eCompletionMs'] + 1e-6)]:
        if condition:
            audit.warnings[method + ':' + label] += 1
    return total


def audit_configuration(audit, raw_path, protocol, camera, model, repeats, cycles, warmup_ms):
    raw = read(raw_path)
    method, scene, stride = raw['method'], raw['scene'], raw['stride']
    key = f'{scene}-s{stride}-{method}'
    require(raw_path.stem == key and raw['engine'] == method and raw['status'] == 'complete', 'Raw key/status differs')
    require(raw['protocolId'] == protocol['protocolId'] and raw['runnerSha256'] == protocol['runnerSha256'] and
            raw['experimentHashes'] == protocol['experimentHashes'] and raw['protocol'] == protocol['measurement'], 'Raw source/protocol differs')
    require(raw['browserSha256'] == protocol['browserSha256'] and raw['browserFrameworkIdentity'] == protocol['browserFrameworkIdentity'] and
            raw['browserVersion'] in protocol['browserVersion'] and raw['hostIdentity'] == protocol['hostIdentity'], 'Raw host/browser differs')
    require(raw['cameras'] == camera['views'] and raw['cameraFileSha256'] == camera['sha256'], 'Raw cameras differ')
    fields = ['relative_path', 'bytes', 'sha256', 'gaussian_count']
    require(raw['model'] == {k: model[k] for k in fields}, 'Raw model identity differs')
    require(raw['options'] == dict(protocol['options'], sort32=False), 'Raw render options differ')
    count, views = model['gaussian_count'], camera['views']
    require((raw['loadInfo'].get('gaussianCount') or raw['loadInfo'].get('numSplats')) == count, 'Loaded model count differs')
    metadata(raw, method, protocol['hostIdentity']['hardware']['SPHardwareDataType'][0]['chip_type'])
    require(not raw['errors'] and not raw['powerViolations'], 'Raw contains runtime/power violations')
    require(raw['warmup']['elapsedMs'] >= warmup_ms and raw['warmup']['samples'] >= 128, 'Initial warmup incomplete')
    require(len(raw['rounds']) == repeats, 'Round coverage differs')
    start, end = stamp(raw['startedAt']), stamp(raw['completedAt'])
    previous_time, previous_window, previous_sort, previous_request = start, -math.inf, None, None
    values, durations, stage_values, round_means = [], [], [], []
    for repeat, rd in enumerate(raw['rounds']):
        require(rd['repeat'] == repeat and len(rd['samples']) == rd['sampleCount'] == len(views) * cycles, 'Round sample count differs')
        require(previous_time <= stamp(rd['startedAt']) <= stamp(rd['completedAt']) <= end, 'Round chronology differs')
        previous_time = stamp(rd['completedAt'])
        if repeat:
            require(rd['warmup']['samples'] >= 32 and rd['warmup']['elapsedMs'] >= 1500, 'Inter-round warmup incomplete')
        low, high = finite(rd['windowStartMs']), finite(rd['windowEndMs'])
        require(previous_window <= low < high, 'Browser round windows overlap')
        close(rd['windowElapsedMs'], high - low, 'Round window subtraction differs')
        previous_window, previous_sample = high, low
        measured = []
        for ordinal, sample in enumerate(rd['samples']):
            cycle, order = divmod(ordinal, len(views))
            index = (order + repeat * 7 + cycle * 11) % len(views)
            selected = views[index]
            require([sample[k] for k in ['repeat', 'cycle', 'order', 'cameraIndex', 'cameraId', 'img_name']] ==
                    [repeat, cycle, order, index, selected['id'], selected['img_name']], 'Sample traversal/identity differs')
            first, last, duration = (finite(sample[k], True) for k in ['e2eStartMs', 'e2eEndMs', 'e2eCompletionMs'])
            require(previous_sample <= first < last <= high, 'E2E intervals overlap/outside round')
            close(duration, last - first, 'E2E subtraction differs')
            previous_sample = last
            if method != 'visionary':
                sequence = sample['sortSequence']
                require(isinstance(sequence, int) and (previous_sort is None or sequence > previous_sort), 'Stale sort sequence')
                if ordinal:
                    require(sequence == previous_sort + 1, 'More than one sort per synchronous sample')
                previous_sort = sequence
                if method == 'supersplat':
                    request = sample['requestId']
                    skipped = rd['warmup']['samples'] if repeat and ordinal == 0 else 0
                    require(isinstance(request, int) and (previous_request is None or request == previous_request + 1 + skipped), 'Fresh request sequence differs')
                    previous_request = request
            stage_values.append(stages(sample, method, count, selected, audit))
            measured.append(duration)
        require(math.fsum(measured) <= rd['windowElapsedMs'] + 1e-6, 'Round excludes completed sample time')
        close(rd['completedFramesPerSecond'], 1000 * len(measured) / rd['windowElapsedMs'], 'Round FPS differs')
        audit.power(rd['powerBefore']); audit.power(rd['powerAfter'])
        values.extend(measured); durations.append(rd['windowElapsedMs']); round_means.append(math.fsum(measured) / len(measured))
    summary = dict(sampleCount=len(values), meanMs=math.fsum(values) / len(values), p50Ms=percentile(values, .5),
                   p95Ms=percentile(values, .95), totalWindowMs=math.fsum(durations),
                   completedFramesPerSecond=len(values) * 1000 / math.fsum(durations))
    for field, value in summary.items():
        close(raw['e2eCompletion'][field], value, 'Completion summary differs: ' + field)
    audit.power(raw['powerStart']); audit.power(raw['powerEnd'])
    telemetry = relative(audit.run, raw['telemetryPath'])
    audit.source(telemetry, raw['telemetrySha256'])
    observations = [json.loads(line) for line in telemetry.read_text().splitlines()]
    require(observations and [s['at'] for s in observations] == sorted(s['at'] for s in observations), 'Telemetry chronology differs')
    require(observations[0] == raw['powerStart'] and observations[-1] == raw['powerEnd'], 'Telemetry endpoints differ')
    for observation in observations:
        audit.power(observation)
    audit.counts['powerTelemetryObservations'] += len(observations)
    raf = raw['raf']
    require(len(raf) == (360 if stride == 1 else 0), 'Native rAF coverage differs')
    require(stamp(raw['rafStartedAt']) >= previous_time and stamp(raw['qualityStartedAt']) >= stamp(raw['rafCompletedAt']) and
            stamp(raw['qualityCompletedAt']) <= end, 'Capture/rAF chronology overlaps timing')
    for index, item in enumerate(raf):
        require(item['frame'] == index, 'Native rAF frame sequence differs')
        finite(item['intervalMs'], True); finite(item['cpuSubmitMs'])
    display_indices = list(dict.fromkeys([0, len(views) // 2, len(views) - 1] if stride == 1 else [0]))
    require([x['cameraIndex'] for x in raw['captures']] == display_indices, 'Display capture coverage differs')
    require([x['cameraIndex'] for x in raw['qualityCaptures']] == list(range(len(views))), 'Quality view coverage differs')
    display_pixels = {}
    for capture in raw['captures']:
        index = capture['cameraIndex']
        require(capture['img_name'] == views[index]['img_name'], 'Display capture identity differs')
        file = relative(audit.run, capture['path'])
        require(file.suffix == '.png' and file not in audit.captures, 'Duplicate/non-PNG display capture')
        display_pixels[index] = audit.image(file, capture['sha256'])
        audit.captures.add(file)
    receipt_path = audit.run / 'quality-captures' / (key + '-lossless-receipt.json')
    receipt = read(receipt_path); audit.source(receipt_path)
    lossless = {row['file']: row for row in receipt}
    require(len(lossless) == len(receipt) == len(views), 'Lossless receipt coverage differs')
    for capture in raw['qualityCaptures']:
        index = capture['cameraIndex']; file = relative(audit.run, capture['path'])
        require(capture['img_name'] == views[index]['img_name'] and file.suffix == '.webp' and file not in audit.quality, 'Duplicate/non-WebP quality capture')
        item = lossless[file.name]
        require(item['width'] == 1280 and item['height'] == 720 and item['sha256'] == capture['sha256'], 'Lossless file identity differs')
        pixels = audit.image(file, capture['sha256'], item['pixelRgbSha256'])
        if index in display_pixels:
            require(pixels == display_pixels[index] and capture['source'] == 'reused-formal-display-capture', 'PNG/WebP RGB pixels differ')
            display = next(c for c in raw['captures'] if c['cameraIndex'] == index)
            require(capture['sourcePngSha256'] == display['sha256'], 'Reused PNG provenance differs')
        else:
            require(capture['source'] == 'fresh-post-raf-capture', 'Unexpected quality capture origin')
        audit.quality.add(file)
    audit.source(raw_path)
    audit.counts.update(configurations=1, rounds=repeats, samples=len(values), rafIntervals=len(raf),
                        displayPngs=len(display_indices), qualityWebps=len(views), workerPoseSamples=len(values) if method != 'visionary' else 0)
    audit.configurations.append(dict(key=key, **summary, stageCostMeanMs=math.fsum(stage_values) / len(stage_values),
                                    roundMeanRangeMs=[min(round_means), max(round_means)],
                                    nativeRafCallbackFps=1000 * len(raf) / math.fsum(s['intervalMs'] for s in raf) if raf else None,
                                    sourceRawSha256=sha(raw_path)))


def perform(run, setup, allow_partial=False):
    require(not (ROOT / 'results/gpu-session.lock').exists(), 'A GPU session lock exists; audit waits until GPU work is finished')
    audit = Audit(run)
    protocol_file = run / 'protocol.json'; protocol = read(protocol_file); audit.source(protocol_file)
    pilot = protocol['pilot']
    require(type(pilot) is bool, 'Protocol mode missing')
    require(not (pilot and allow_partial), '--allow-partial is only for an explicitly paused formal run')
    scenes, strides, repeats, cycles, warmup_ms = (['bicycle', 'train'], [1, 8], 1, 1, 1000) if pilot else (SCENES, [1, 2, 4, 8], 5, 3, 10000)
    expected_keys = {f'{s}-s{k}-{m}' for s in scenes for k in strides for m in METHODS}
    require(protocol['methods'] == METHODS and protocol['repeats'] == repeats and protocol['cycles'] == cycles,
            'Protocol method/repetition definition differs')
    require(protocol['expectedConfigurations'] == len(expected_keys) and protocol['expectedSamples'] == (378 if pilot else 68040), 'Expected matrix differs')
    require(protocol['protocolId'] == f"mac-spark0110-three-method-{'pilot' if pilot else 'full'}-v1", 'Unexpected protocol ID')
    require(protocol['options'] == dict(width=1280, height=720, shDegree=3, kernelSize=.3, sortRadial=False, timingMode='stages'), 'Rendering protocol differs')
    require(len(protocol['configurationOrder']) == len(expected_keys) and set(protocol['configurationOrder']) == expected_keys, 'Configuration ordering coverage differs')
    host_path = run / 'environment/host-inventory.json'; audit.source(host_path, protocol['hostInventorySha256'])
    host = read(host_path)
    require(host == protocol['hostIdentity'] and host['platform'] == 'darwin' and host['architecture'] == 'arm64' and
            host['hardware']['SPHardwareDataType'][0]['chip_type'].startswith('Apple ') and host['acLowPowerMode'] in [0, None], 'Wrong host/power mode')
    audit.power(host['power'])
    audit.source(Path(protocol['browserExecutable']), protocol['browserSha256'])
    for framework in protocol['browserFrameworkIdentity']:
        audit.source(Path(framework['path']), framework['sha256'])
    for name, digest in protocol['experimentHashes'].items():
        audit.source(relative(ROOT, name), digest)
    audit.source(ROOT / 'run-experiment.cjs', protocol['runnerSha256'])
    for name in ['spark-native-sort-cpu-validation.json', 'supersplat-worker.json', 'native-prepare-lifecycle-review.json']:
        audit.source(setup / name)
        require(read(setup / name)['passed'] is True, 'CPU validation failed: ' + name)
    spark_check = read(setup / 'spark-native-sort-cpu-validation.json')
    audit.source(ROOT / 'work/spark-v0.1.10/dist/spark.benchmark.js', spark_check['bundleSha256'])
    audit.source(ROOT / 'work/spark-v0.1.10/validate-native-sort.mjs', spark_check['scriptSha256'])
    prepare_check = read(setup / 'native-prepare-lifecycle-review.json')
    audit.source(ROOT / 'work/spark-v0.1.10/dist/spark.module.js', prepare_check['upstreamBundleSha256'])
    audit.source(ROOT / 'work/spark-v0.1.10/validate-native-prepare.mjs', prepare_check['scriptSha256'])
    audit.source(ROOT / 'work/bench-spark/spark-adapter.ts', prepare_check['adapterSha256'])
    ss_check = read(setup / 'supersplat-worker.json')
    for label, name in [('source', 'vendor/engine-source/gsplat-sorter.js'),
                        ('release', 'vendor/playcanvas/build/playcanvas/src/scene/gsplat/gsplat-sorter.js'),
                        ('measured', 'dist/gsplat-sorter.benchmark.js')]:
        audit.source(ROOT / 'work/supersplat-bench' / name, ss_check['hashes'][label])
    gpu_file = setup / 'gpu-probe/gpu-probe-metal.json'; gpu_check = read(gpu_file); audit.source(gpu_file)
    require(gpu_check['passed'] is True and gpu_check['executableSha256'] == protocol['browserSha256'] and
            host['hardware']['SPHardwareDataType'][0]['chip_type'] in gpu_check['capabilities']['webgpu']['info']['description'],
            'GPU probe belongs to a different browser/Apple chip')
    if not pilot:
        prerequisites_path = run / 'validation/prerequisites.json'; prerequisites = read(prerequisites_path)
        audit.source(prerequisites_path, protocol['prerequisitesSha256'])
        require(prerequisites['passed'] and prerequisites['pilotConfigurations'] == 12 and prerequisites['pilotSamples'] == 378,
                'Formal run lacks complete prerequisite coverage')
        for source in prerequisites['sources']:
            audit.source(relative(ROOT, source['path']), source['sha256'])
    models, lock = expected_models(audit)
    integrity_path = run / 'validation/input-integrity.json'; integrity = read(integrity_path)
    audit.source(integrity_path, protocol['inputIntegritySha256'])
    require(integrity['passed'] is True and len(integrity['models']) == 52, 'Pre-GPU model integrity incomplete')
    expected_by_path = {entry['relative_path']: entry for entry in models.values()}
    require(len({r['relative_path'] for r in integrity['models']}) == 52, 'Duplicate pre-GPU model identities')
    for item in integrity['models']:
        entry = expected_by_path[item['relative_path']]
        require(item['bytes'] == entry['bytes'] and item['expectedSha256'] == item['sha256'] == entry['sha256'], 'Model receipt differs from locked identities')
    cameras = {}
    for entry in lock['cameras']:
        file = relative(ROOT, entry['path']); audit.source(file, entry['sha256'])
        views = read(file); require(len(views) == entry['views'], 'Camera count differs')
        require(integrity['cameras'][entry['scene']] == entry['sha256'], 'Preflight camera identity differs')
        cameras[entry['scene']] = dict(views=views, sha256=entry['sha256'])
    files = {p.stem: p for p in (run / 'raw').glob('*.json')}
    require(bool(files) and (set(files) <= expected_keys if allow_partial else set(files) == expected_keys),
            'Raw collection incomplete or contains extra configurations')
    observed_keys = set(files)
    partial = observed_keys != expected_keys
    for key in [k for k in protocol['configurationOrder'] if k in observed_keys]:
        raw = read(files[key]); scene, stride = raw['scene'], raw['stride']
        audit_configuration(audit, files[key], protocol, cameras[scene], models[scene, stride], repeats, cycles, warmup_ms)
    orphan_images = []
    for actual, verified in [(set((run / 'captures').glob('*.png')), audit.captures),
                             (set((run / 'quality-captures').glob('*.webp')), audit.quality),
                             (set((run / 'quality-captures').glob('*.png')), set())]:
        require(verified <= actual, 'An audited capture disappeared')
        for file in actual - verified:
            match = re.fullmatch(r'(.+)-v\d{3}\.(?:png|webp)', file.name)
            require(partial and match and match[1] in expected_keys - observed_keys,
                    'Extra capture is not attributable to an unfinished configuration: ' + file.name)
            orphan_images.append(str(file.relative_to(run)))
    selected_raw = [read(path) for path in files.values()]
    expected = dict(configurations=len(files), rounds=len(files) * repeats,
                    samples=sum(len(r['cameras']) * repeats * cycles for r in selected_raw),
                    displayPngs=sum(3 if r['stride'] == 1 else 1 for r in selected_raw),
                    qualityWebps=sum(len(r['cameras']) for r in selected_raw),
                    rafIntervals=sum(360 for r in selected_raw if r['stride'] == 1),
                    workerPoseSamples=sum(len(r['cameras']) * repeats * cycles for r in selected_raw if r['method'] != 'visionary'))
    for key, value in expected.items():
        require(audit.counts[key] == value, 'Final audit count differs: ' + key)
    runtime_path = run / 'runtime-cleanup.json'; runtime = read(runtime_path); audit.source(runtime_path)
    require(runtime.get('finishedAt') and runtime['gpuLockReleased'] and
            all(not item['alive'] for item in runtime['children']), 'Runner did not finish owned-resource cleanup')
    if partial:
        require(not runtime['complete'] and not runtime['passed'] and runtime.get('signal') in ['SIGINT', 'SIGTERM', 'SIGHUP'],
                'Partial collection must be an explicitly interrupted formal run')
    else:
        require(runtime['complete'] and runtime['passed'], 'Full runner completion was not established')
    recorded = {c['key']: c for c in runtime['configurations']}
    require(set(recorded) == observed_keys and len(recorded) == len(runtime['configurations']), 'Runtime raw inventory differs')
    for key, item in recorded.items():
        audit.source(files[key], item['sha256']); require(item['status'] == 'complete', 'Runtime marks raw incomplete')
    pids = [runtime['runnerPid']] + [item['pid'] for item in runtime['ownedPids']]
    for pid in pids:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        raise ValueError('Recorded PID is present; independently inspect process identity before accepting cleanup: ' + str(pid))
    ports = []
    for port in [8770, 8771, 8772]:
        with socket.socket() as sock:
            sock.settimeout(.25); listening = sock.connect_ex(('127.0.0.1', port)) == 0
        require(not listening, 'Expected owned host port to be closed: ' + str(port)); ports.append(port)
    return dict(schema='independent-mac-three-method-performance-audit-v1', passed=True,
                complete=not partial, partial=partial, fullMatrixComplete=not pilot and not partial,
                auditScope='explicit-complete-configuration-subset' if partial else ('complete-pilot' if pilot else 'complete-formal'),
                coverage=dict(completedConfigurations=len(observed_keys), expectedConfigurations=len(expected_keys),
                              completedKeys=sorted(observed_keys), unmeasuredKeys=sorted(expected_keys - observed_keys)),
                excludedUnfinishedCaptureFiles=orphan_images,
                createdAt=datetime.now(timezone.utc).isoformat(), runDirectory=os.path.relpath(run, ROOT),
                pilot=pilot, protocolId=protocol['protocolId'], counts=dict(audit.counts), expectedCounts=expected,
                sourceFilesVerified=len(protocol['experimentHashes']), modelPolicy='Verified all52 identities against bound pre-GPU full-SHA receipt; no post-run model rehash',
                cameraEvidence={'sparkAndSuperSplat': 'Every worker-produced pose compared with frozen selected camera; sequence proves fresh sorts',
                                'visionary': 'Frozen per-sample setCamera -> original prepareMulti/renderMulti path plus six fresh GPU timestamps; raw schema has no GPU camera-buffer pose readback'},
                maximumWorkerPoseComponentError=max(audit.pose_errors, default=0),
                completionDefinition='Browser-clock sample Promise completion including GPU waits/readback; not physical display',
                fpsDefinition='1000*N/sum(browser round windows); native rAF callback throughput is separate',
                diagnostics=dict(audit.warnings), configurations=audit.configurations,
                resources={'runnerAndOwnedPidsAbsent': pids, 'portsClosed': ports, 'globalGpuLockAbsent': True},
                sourceReceipts=sorted(audit.sources.values(), key=lambda x: x['path']), gpuWorkPerformed=False,
                qualityMetricStatus='This audit validates new render coverage and lossless pixels; PSNR/SSIM/LPIPS need their separate quality measurement/audit')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--validation-root', type=Path, default=ROOT / 'results/setup')
    parser.add_argument('--allow-partial', action='store_true', help='Audit only complete raw configurations in a deliberately paused formal run; never claim full completion')
    args = parser.parse_args()
    run = args.run_dir.resolve()
    output = args.output.resolve() if args.output else run / 'validation/independent-audit.json'
    try:
        result = perform(run, args.validation_root.resolve(), args.allow_partial)
    except Exception as error:
        result = dict(schema='independent-mac-three-method-performance-audit-v1', passed=False,
                      createdAt=datetime.now(timezone.utc).isoformat(), runDirectory=os.path.relpath(run, ROOT),
                      error=str(error), gpuWorkPerformed=False)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
        raise
    result['auditorSha256'] = sha(Path(__file__))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k: result[k] for k in ['passed', 'counts', 'diagnostics', 'maximumWorkerPoseComponentError']}))


if __name__ == '__main__':
    main()
