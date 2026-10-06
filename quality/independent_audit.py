#!/usr/bin/env python3
"""Independently audit full or explicitly partial quality rows and CPU references.

Run only after performance and MPS quality processes have exited. This program
never imports measure_quality, never requests MPS/CUDA, and never downloads.
PSNR uses exact integer RGB8 squared errors and a float64 MSE/logarithm. SSIM
uses independent float64 SciPy separable correlations. LPIPS uses the official
CPU implementation with the same pinned VGG/calibration bytes as the MPS run.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
from datetime import datetime, timezone
from functools import lru_cache
import gc
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import resource
import time

ROOT = Path(__file__).resolve().parents[1]
METHODS = ['visionary', 'spark', 'supersplat']
STRIDES = [1, 2, 4, 8]
VGG_SHA = '397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0'
PINS = {'visionary': ('1.0.1', 'e50f3f6c7200be0516567f0830e5240dfa26d27d'),
        'spark': ('0.1.10', '792d6d193db8b79ed4d1f32ef65cca9ec93f0896'),
        'supersplat': ('2.1.0', '2f23b4b2072da694172faa26ff44fc67f2a01ca2')}
# Fixed before seeing the formal data; never widened automatically after failure.
TOLERANCES = {'psnr_db_absolute': 1e-10, 'aggregate_absolute': 1e-10,
              'ssim_absolute': 5e-5, 'lpips_absolute': 1e-4, 'lpips_relative': 1e-4}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def resolve(value):
    path = Path(value).expanduser()
    return (path if path.is_absolute() else ROOT / path).resolve()


def within(root, value):
    path = Path(value)
    path = (path if path.is_absolute() else root / path).resolve()
    require(path.is_relative_to(root), 'Image/raw path escapes its declared root')
    return path


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    temporary.replace(path)


def key(row):
    return row['method'], row['scene'], row['stride'], row['camera_index']


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def mean(values):
    return None if any(v is None for v in values) else math.fsum(values) / len(values)


def independent_psnr(a8, b8):
    """Exact integer SSE avoids duplicating the measurement's pixel-float formula."""
    import numpy as np
    difference = a8.astype(np.int16) - b8.astype(np.int16)
    squared = np.square(difference, dtype=np.int32)
    sse = int(np.sum(squared, dtype=np.uint64))
    mse = float(sse) / (a8.size * 255.0 * 255.0)
    return (None if sse == 0 else -10.0 * math.log10(mse)), sse == 0, sse, mse


def independent_ssim(a8, b8):
    """Float64, separable SciPy correlation, exact zero-padding and RGB mean."""
    import numpy as np
    from scipy.ndimage import correlate1d
    offsets = np.arange(-5, 6, dtype=np.float64)
    weights = np.exp(-(offsets * offsets) / 4.5)
    weights /= weights.sum()
    def blur(value):
        horizontal = correlate1d(value, weights, axis=1, mode='constant', cval=0.0)
        return correlate1d(horizontal, weights, axis=0, mode='constant', cval=0.0)
    scores = []
    for channel in range(3):
        a = a8[..., channel].astype(np.float64) / 255.0
        b = b8[..., channel].astype(np.float64) / 255.0
        ua, ub = blur(a), blur(b)
        va, vb = blur(a * a) - ua * ua, blur(b * b) - ub * ub
        covariance = blur(a * b) - ua * ub
        numerator = (2.0 * ua * ub + 0.0001) * (2.0 * covariance + 0.0009)
        denominator = (ua * ua + ub * ub + 0.0001) * (va + vb + 0.0009)
        scores.append(float(np.mean(numerator / denominator, dtype=np.float64)))
    return math.fsum(scores) / 3.0


def rgb(path):
    import numpy as np
    from PIL import Image
    with Image.open(path) as image:
        image.load()
        require(image.size == (1280, 720), 'Quality image dimensions differ: ' + str(path))
        return np.asarray(image.convert('RGB')).copy()


class Audit:
    def __init__(self, run, gt, torch_home):
        self.run, self.gt, self.torch_home = run, gt, torch_home
        self.sources, self.failures = {}, []
        self.package_roots = {}

    def source(self, path, expected=None):
        path = Path(path).resolve()
        if path not in self.sources:
            roots = [(self.run, 'run'), (self.gt, 'ground-truth'), (self.torch_home, 'torch-home'),
                     *[(p, 'python-package:' + name) for name, p in self.package_roots.items()], (ROOT, 'repository')]
            match = next(((base, scope) for base, scope in roots if path.is_relative_to(base)), None)
            require(match is not None, 'Source is outside the declared audit roots')
            base, scope = match
            stat = path.stat()
            self.sources[path] = dict(scope=scope, path=os.path.relpath(path, ROOT), scopePath=str(path.relative_to(base)), bytes=stat.st_size,
                                      sha256=sha(path), mtimeNs=stat.st_mtime_ns)
        value = self.sources[path]['sha256']
        require(expected is None or value == expected, 'SHA256 mismatch: ' + str(path))
        return value

    def compare(self, actual, expected, tolerance, label):
        if actual is None or expected is None:
            passed, error = actual is expected, None
        else:
            require(numeric(actual) and numeric(expected), 'Nonfinite metric at ' + label)
            error = abs(actual - expected)
            passed = error <= tolerance
        if not passed:
            self.failures.append(dict(check=label, actual=actual, expected=expected,
                                      absoluteError=error, tolerance=tolerance))
        return passed, error

    def ensure_sources_stable(self):
        for path, receipt in self.sources.items():
            stat = path.stat()
            require((stat.st_size, stat.st_mtime_ns) == (receipt['bytes'], receipt['mtimeNs']),
                    'Audit input changed during verification: ' + str(path))


def audit(args, state):
    run, gt_root, torch_home = args.run_dir, args.gt, args.torch_home
    for lock in [ROOT / 'results/gpu-session.lock', run / 'gpu-session.lock', run.parent / 'gpu-session.lock']:
        require(not lock.exists(), 'A performance/quality GPU session lock remains; wait for the separate CPU audit phase')
    result_root = args.metrics_dir or run / 'quality/metrics'
    summary_path, per_view_path = result_root / 'quality-summary.json', result_root / 'per-view.jsonl'
    protocol_path, capture_path = result_root / 'metrics-protocol.json', result_root / 'capture-manifest.json'
    summary, protocol = read(summary_path), read(protocol_path)
    require((summary['complete'] is True or args.allow_partial) and summary['referenceType'] == 'ground-truth' and
            summary['expected_render_images'] == 4536 and 0 < summary['render_images'] <= 4536 and
            summary['metrics'] == ['psnr', 'ssim', 'lpips'], 'Formal full quality results are not complete')
    partial = summary['render_images'] != 4536
    require(not partial or (args.allow_partial and summary['complete'] is False), 'Incomplete quality requires explicit partial mode')
    require(partial or summary['complete'] is True, 'Full-count quality still requires a completed summary')
    require(summary['coverage'] == dict(methods=3, scenes=13, strides=STRIDES, heldout_views=378,
                                       expected_captures=4536, actual_captures=summary['render_images']), 'Summary coverage metadata differs')
    require(summary['aggregation'] == protocol['aggregation'], 'Summary aggregation declaration differs')
    require(protocol['schema'] == 'portable-three-method-quality-v1' and protocol['device'] == 'mps' and
            protocol['dtype'] == 'float32', 'This audit expects the completed MPS quality collection')
    collection_path = run / 'protocol.json'; collection = read(collection_path)
    cleanup_path = run / 'runtime-cleanup.json'; cleanup = read(cleanup_path)
    require(collection['pilot'] is False and collection['expectedConfigurations'] == 156 and
            collection['expectedSamples'] == 68040 and collection['methods'] == METHODS, 'Wrong formal collection scope')
    require(cleanup.get('finishedAt') and cleanup['gpuLockReleased'] and
            all(not child['alive'] for child in cleanup['children']), 'Performance resources did not cleanly exit')
    if partial:
        require(not cleanup['complete'] and not cleanup['passed'] and cleanup.get('signal') in ['SIGINT', 'SIGTERM', 'SIGHUP'],
                'Partial quality must belong to an intentionally paused formal performance run')
    else:
        require(cleanup['complete'] and cleanup['passed'], 'Full performance completion is missing')
    runtime_raw = {entry['key']: entry for entry in cleanup['configurations']}
    require(len(runtime_raw) == len(cleanup['configurations']) and 0 < len(runtime_raw) <= 156 and
            (partial or len(runtime_raw) == 156), 'Finalized raw inventory has duplicates/missing configurations')
    require(protocol['collection_protocol_id'] == collection['protocolId'] and
            protocol['method_definitions'] == collection['methodDefinitions'], 'Quality/collection protocols differ')
    for method, identity in PINS.items():
        definition = collection['methodDefinitions'][method]
        require((definition['version'], definition['sourceCommit']) == identity, 'Renderer version/commit differs')
    require(collection['methodDefinitions']['spark']['sortBits'] == 16, 'Spark native default mode differs')
    a = Audit(run, gt_root, torch_home); state['audit'] = a
    bindings = dict(qualitySummarySha256=a.source(summary_path),
                    perViewSha256=a.source(per_view_path, summary['per_view_sha256']),
                    metricsProtocolSha256=a.source(protocol_path, summary['protocol_sha256']))
    state.update(bindings)
    a.source(capture_path, summary['capture_manifest_sha256'])
    a.source(collection_path, protocol['collection_protocol_sha256']); a.source(cleanup_path)
    scope_path = result_root / 'collection-scope.json'; scope = read(scope_path)
    a.source(scope_path, summary['collection_scope_sha256'])
    require(scope['schema'] == 'portable-quality-collection-scope-v1' and
            scope['allow_partial'] is summary['partial_mode'] is partial and
            scope['collection_complete'] is summary['collection_complete'] is cleanup['complete'] and
            scope['full_capture_matrix_complete'] is summary['fullCaptureMatrixComplete'] is (not partial) and
            scope['requested_subset_complete'] is summary['requestedSubsetComplete'] is True and
            scope['configurations'] == len(runtime_raw) and scope['render_images'] == summary['render_images'] and
            scope['expected_configurations'] == 156 and scope['expected_render_images'] == 4536,
            'Explicit quality scope/summary differs from the finalized complete-configuration subset')
    a.source(cleanup_path, scope['cleanup_sha256']); a.source(collection_path, scope['collection_protocol_sha256'])
    a.source(ROOT / 'quality/measure_quality.py', protocol['script_sha256'])
    selection_path = ROOT / 'quality/selection.json'; selection = read(selection_path)
    a.source(selection_path, protocol['selection_file_sha256'])
    canonical = hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
    require(canonical == protocol['selection_sha256'], 'Canonical camera selection changed')
    scenes = {scene['scene']: scene for scene in selection['scenes']}
    cameras = {(name, index): camera for name, scene in scenes.items() for index, camera in enumerate(scene['cameras'])}
    require(len(scenes) == 13 and len(cameras) == 378, 'Frozen camera selection coverage differs')
    for name, scene in scenes.items():
        camera_file = ROOT / 'config/cameras' / name / 'heldout_cameras.json'
        a.source(camera_file, scene['camera_sha256'])
        require(read(camera_file) == scene['cameras'], 'Quality selection differs from performance cameras')
    gt_path = gt_root / 'ground-truth-manifest.json'; gt = read(gt_path)
    a.source(gt_path, protocol['gt_manifest_sha256']); a.source(gt_path, summary['ground_truth_manifest_sha256'])
    require(gt['complete'] and gt['selection_sha256'] == canonical and
            gt['transform'] == protocol['ground_truth_transform'] == summary['ground_truth_transform'], 'GT transform/selection identity differs')
    transform = gt['transform']
    require([transform[k] for k in ['width', 'height', 'channels', 'sample_type', 'pillow_version']] ==
            [1280, 720, 'RGB', 'uint8', '11.3.0'] and
            transform['resize'] == 'Pillow BICUBIC; independent x/y; no crop/pad; no EXIF transpose', 'GT normalization changed')
    a.source(ROOT / 'quality/source-resolution-policy.json', transform['source_resolution_policy_sha256'])
    ground_truth = {(entry['scene'], entry['camera_index']): entry for entry in gt['entries']}
    require(set(ground_truth) == set(cameras) and len(gt['entries']) == 378, 'GT exact coverage differs')
    for identity, entry in ground_truth.items():
        require(entry['img_name'] == cameras[identity]['img_name'] and
                entry['camera_sha256'] == scenes[identity[0]]['camera_sha256'], 'GT image/camera mismatch')
        a.source(within(gt_root, entry['relative_path']), entry['sha256'])
    full_expected = {(method, scene, stride, index) for method in METHODS for scene, index in cameras for stride in STRIDES}
    entries = {}
    raw_files = list((run / 'raw').glob('*.json'))
    require(len(raw_files) == len(runtime_raw), 'Complete raw coverage differs from the finalized runtime inventory')
    scope_raw = {within(run, entry['raw_path']): entry['raw_sha256'] for entry in scope['sources']}
    require(len(scope_raw) == len(scope['sources']) == len(raw_files) and
            set(scope_raw) == {path.resolve() for path in raw_files}, 'Quality collection scope raw inventory differs')
    raw_keys = set()
    for path in raw_files:
        raw = read(path); raw_sha = a.source(path)
        require(scope_raw[path.resolve()] == raw_sha, 'Quality collection scope raw SHA differs')
        method, scene, stride = raw['method'], raw['scene'], raw['stride']
        raw_key = (method, scene, stride)
        require(raw_key not in raw_keys and method in METHODS and scene in scenes and stride in STRIDES, 'Duplicate/out-of-scope raw')
        raw_keys.add(raw_key)
        finalized = runtime_raw[f'{scene}-s{stride}-{method}']
        require(finalized['status'] == 'complete' and finalized['sha256'] == raw_sha,
                'Raw differs from the finalized performance runtime receipt')
        require(raw['status'] == 'complete' and not raw['errors'] and raw['engine'] == method and
                raw['protocolId'] == collection['protocolId'] and raw['cameras'] == scenes[scene]['cameras'] and
                raw['runnerSha256'] == collection['runnerSha256'] and raw['experimentHashes'] == collection['experimentHashes'],
                'Raw render source/selection is not the formal collection')
        require((raw['metadata']['version'], raw['metadata']['sourceCommit']) == PINS[method], 'Raw renderer provenance differs')
        require([c['cameraIndex'] for c in raw['qualityCaptures']] == list(range(len(scenes[scene]['cameras']))), 'Raw capture coverage differs')
        for cap in raw['qualityCaptures']:
            identity = (method, scene, stride, cap['cameraIndex'])
            require(identity in full_expected and identity not in entries and cap['img_name'] == cameras[scene, cap['cameraIndex']]['img_name'], 'Raw capture identity differs')
            entries[identity] = dict(raw=path.resolve(), raw_sha256=raw_sha,
                                     image=within(run, cap['path']), capture=cap)
    expected = {(method, scene, stride, index) for method, scene, stride in raw_keys
                for index in range(len(scenes[scene]['cameras']))}
    require(set(entries) == expected and len(entries) == summary['render_images'] and
            (partial or expected == full_expected), 'Exact complete-configuration render coverage differs')
    checkpoint = per_view_path.read_bytes()
    require(checkpoint.endswith(b'\n'), 'Quality checkpoint has an unterminated final row; audit never repairs it')
    rows = [json.loads(line) for line in checkpoint.splitlines()]
    lookup = {key(row): row for row in rows}
    require(len(rows) == len(lookup) == len(expected) and set(lookup) == expected, 'JSONL has missing/duplicate/additional views')
    captures = read(capture_path)['entries']; capture_lookup = {key(row): row for row in captures}
    require(len(captures) == len(capture_lookup) == len(expected) and set(capture_lookup) == expected, 'Capture manifest coverage differs')
    state['checkedViewCount'] = 0
    for identity, row in lookup.items():
        entry, gt_entry = entries[identity], ground_truth[identity[1], identity[3]]
        require(row['raw_sha256'] == entry['raw_sha256'] and within(run, row['raw_path']) == entry['raw'] and
                within(run, row['path']) == entry['image'] and row['expected_capture_sha256'] == row['render_sha256'] == entry['capture']['sha256'] and
                row['gt_sha256'] == gt_entry['sha256'] and row['img_name'] == gt_entry['img_name'], 'JSONL raw/render/GT lineage mismatch')
        require(row['protocol_id'] == collection['protocolId'] and
                (row['engine_version'], row['engine_source_commit']) == PINS[identity[0]], 'JSONL renderer identity differs')
        manifest = capture_lookup[identity]
        require(all(manifest[k] == row[k] for k in ['img_name', 'path', 'render_sha256', 'render_rgb8_sha256']), 'Capture manifest differs from JSONL')
        require(type(row['psnr_infinite']) is bool and ((row['psnr_db'] is None) == row['psnr_infinite']), 'PSNR infinity encoding differs')
        require(row['psnr_db'] is None or (numeric(row['psnr_db']) and row['psnr_db'] >= 0), 'PSNR is nonfinite or negative')
        require(numeric(row['ssim']) and -1.00001 <= row['ssim'] <= 1.00001 and
                numeric(row['lpips_vgg']) and row['lpips_vgg'] >= 0, 'Invalid SSIM/LPIPS value')
        a.source(entry['image'], row['render_sha256'])
    # Heavy numerical dependencies are deferred until complete lineage has passed.
    import numpy as np
    @lru_cache(maxsize=64)
    def gt_rgb(scene, index):
        entry = ground_truth[scene, index]
        image = rgb(within(gt_root, entry['relative_path']))
        require(hashlib.sha256(image.tobytes()).hexdigest() == entry['rgb8_sha256'], 'GT decoded RGB hash differs')
        return image
    groups, psnr_errors = defaultdict(list), []
    differences_path = args.output.with_name(args.output.stem + '-psnr.jsonl')
    with differences_path.open('x') as output:
        for ordinal, identity in enumerate(sorted(expected)):
            row, entry = lookup[identity], entries[identity]
            rendered = rgb(entry['image']); truth = gt_rgb(identity[1], identity[3])
            require(hashlib.sha256(rendered.tobytes()).hexdigest() == row['render_rgb8_sha256'], 'Render decoded RGB hash differs')
            score, infinite, sse, mse = independent_psnr(rendered, truth)
            require(infinite == row['psnr_infinite'], 'Independent perfect-image flag differs')
            passed, error = a.compare(row['psnr_db'], score, TOLERANCES['psnr_db_absolute'], 'PSNR ' + str(identity))
            if error is not None: psnr_errors.append(error)
            record = dict(method=identity[0], scene=identity[1], stride=identity[2], camera_index=identity[3],
                          img_name=row['img_name'], measuredPsnrDb=row['psnr_db'], independentPsnrDb=score,
                          psnrInfinite=infinite, squaredErrorSum=sse, pixelChannelCount=int(rendered.size),
                          mseFloat64=mse, absoluteErrorDb=error, passed=passed,
                          rawSha256=row['raw_sha256'], renderSha256=row['render_sha256'], groundTruthSha256=row['gt_sha256'])
            output.write(json.dumps(record, allow_nan=False) + '\n')
            groups[identity[:3]].append(dict(psnr_db=score, ssim=row['ssim'], lpips_vgg=row['lpips_vgg'], infinite=infinite))
            state['checkedViewCount'] = ordinal + 1
            if (ordinal + 1) % 250 == 0: print(f'Independent PSNR {ordinal + 1}/{len(expected)}', flush=True)
    a.source(differences_path)
    require(set(groups) == raw_keys, 'Independent configuration grouping differs')
    config_rows = {(r['method'], r['scene'], r['stride']): r for r in summary['configurations']}
    require(set(config_rows) == set(groups) and len(summary['configurations']) == len(groups), 'Configuration summary coverage differs')
    computed = {}
    for identity, group in groups.items():
        supplied = config_rows[identity]
        require(supplied['complete'] and supplied['views'] == len(group) == len(scenes[identity[1]]['cameras']) and
                supplied['dataset'] == scenes[identity[1]]['dataset'] and
                supplied['psnr_infinite_views'] == sum(row['infinite'] for row in group), 'Configuration summary metadata differs')
        computed[identity] = {metric: mean([r[metric] for r in group]) for metric in ['psnr_db', 'ssim', 'lpips_vgg']}
        for metric, value in computed[identity].items():
            a.compare(supplied[metric], value, TOLERANCES['aggregate_absolute'], 'Configuration ' + str(identity) + ':' + metric)
    aggregates = {(r['method'], r['stride']): r for r in summary['aggregates']}
    expected_aggregates = {(method, stride) for method, scene, stride in raw_keys}
    require(set(aggregates) == expected_aggregates and len(summary['aggregates']) == len(expected_aggregates), 'Equal-scene summary coverage differs')
    for (method, stride), supplied in aggregates.items():
        available = [scene for scene in scenes if (method, scene, stride) in computed]
        require(supplied['scenes'] == len(available) and supplied['complete'] is (len(available) == 13), 'Aggregate available-scene coverage differs')
        for metric in ['psnr_db', 'ssim', 'lpips_vgg']:
            value = mean([computed[method, scene, stride][metric] for scene in available])
            a.compare(supplied[metric], value, TOLERANCES['aggregate_absolute'], 'Scene-equal aggregate ' + str((method, stride, metric)))
    balanced = []
    for stride in STRIDES:
        common = [scene for scene in scenes if all((method, scene, stride) in computed for method in METHODS)]
        if common:
            for method in METHODS:
                balanced.append(dict(method=method, stride=stride, scenes=common, sceneCount=len(common),
                                     viewsPerMethod=sum(len(scenes[scene]['cameras']) for scene in common),
                                     **{metric: mean([computed[method, scene, stride][metric] for scene in common])
                                        for metric in ['psnr_db', 'ssim', 'lpips_vgg']}))
    numerical_path = args.numerical_validation or run / 'validation/quality-numerical-validation.json'
    numerical = read(numerical_path)
    a.source(numerical_path)
    require(numerical['complete'] and numerical['device'] == 'cpu' and numerical['checks']['lpips']['passed'] and
            numerical['metrics_script_sha256'] == protocol['script_sha256'], 'Fresh numerical validation is missing/mismatched')
    a.source(ROOT / 'quality/validate_metrics.py', numerical['validation_script_sha256'])
    os.environ['TORCH_HOME'] = str(torch_home)
    weights = torch_home / 'hub/checkpoints/vgg16-397923af.pth'
    require(protocol['vgg_weight_sha256'] == VGG_SHA, 'Unexpected VGG checkpoint identity')
    a.source(weights, VGG_SHA)
    import torch, torchvision, lpips
    torch.set_num_threads(args.threads); torch.set_grad_enabled(False)
    current_packages = {name: importlib.metadata.version(name) for name in protocol['packages']}
    require(current_packages == protocol['packages'], 'Reference package versions differ from the MPS protocol')
    require(current_packages['lpips'] == '0.1.4' and current_packages['torch'] == '2.8.0' and
            current_packages['torchvision'] == '0.23.0', 'Official CPU reference package pins differ')
    require(importlib.metadata.version('scipy') == '1.16.2', 'Independent SciPy reference version differs')
    a.package_roots.update(lpips=Path(lpips.__file__).parent, torchvision=Path(torchvision.__file__).parent)
    calibration = Path(lpips.__file__).parent / 'weights/v0.1/vgg.pth'
    a.source(calibration, protocol['lpips_calibration_sha256'])
    for path in [Path(lpips.__file__), Path(lpips.__file__).with_name('lpips.py'),
                 Path(lpips.__file__).with_name('pretrained_networks.py'), Path(torchvision.__file__).parent / 'models/vgg.py']:
        a.source(path)
    model = lpips.LPIPS(net='vgg', version='0.1', verbose=False).eval().cpu()
    require(all(p.device.type == 'cpu' for p in model.parameters()), 'CPU reference unexpectedly uses another device')
    spots, selected = [], [(method, scene, 1, 0) for scene in scenes for method in METHODS if (method, scene, 1) in groups]
    spot_path = args.output.with_name(args.output.stem + '-cpu-spotchecks.json')
    require(0 < len(selected) == len(set(selected)) and (partial or len(selected) == 39), 'Deterministic CPU spot coverage differs')
    state['cpuSpotchecksCompleted'] = 0
    for ordinal, identity in enumerate(selected):
        began = time.monotonic()
        row = lookup[identity]
        rendered, truth = rgb(entries[identity]['image']), gt_rgb(identity[1], identity[3])
        ssim = independent_ssim(rendered, truth)
        left = torch.from_numpy(rendered).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        right = torch.from_numpy(truth).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        with torch.inference_mode():
            distance = float(model(left, right, normalize=True).item())
        ssim_passed, ssim_error = a.compare(row['ssim'], ssim, TOLERANCES['ssim_absolute'], 'CPU SSIM ' + str(identity))
        lpips_tolerance = TOLERANCES['lpips_absolute'] + TOLERANCES['lpips_relative'] * abs(distance)
        lpips_passed, lpips_error = a.compare(row['lpips_vgg'], distance, lpips_tolerance, 'CPU LPIPS ' + str(identity))
        spots.append(dict(method=identity[0], scene=identity[1], stride=1, camera_index=0, img_name=row['img_name'],
                          rawSha256=row['raw_sha256'], renderSha256=row['render_sha256'], groundTruthSha256=row['gt_sha256'],
                          mpsSsim=row['ssim'], scipyFloat64Ssim=ssim, ssimAbsoluteError=ssim_error,
                          ssimTolerance=TOLERANCES['ssim_absolute'], ssimPassed=ssim_passed,
                          mpsLpips=row['lpips_vgg'], officialCpuLpips=distance, lpipsAbsoluteError=lpips_error,
                          lpipsTolerance=lpips_tolerance, lpipsPassed=lpips_passed, seconds=time.monotonic() - began))
        state['cpuSpotchecksCompleted'] = ordinal + 1
        # Preserve every reference result even if a later CPU image fails or is interrupted.
        save(spot_path, dict(selection='Every observed complete stride1 configuration, camera_index0; fixed independently of metric values',
                             complete=len(spots) == len(selected), expectedSpotchecks=len(selected),
                             referenceDevice='cpu', tolerances=TOLERANCES, records=spots))
        del left, right, rendered; gc.collect()
        print(f'CPU reference {ordinal + 1}/{len(selected)} {identity[1]} {identity[0]} SSIMdiff={ssim_error:.8g} LPIPSdiff={lpips_error:.8g}', flush=True)
    a.source(spot_path); a.source(Path(__file__))
    gt_rgb.cache_clear(); del model; gc.collect()
    a.ensure_sources_stable()
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return dict(**bindings, checkedViewCount=len(expected), rawConfigurations=len(groups), groundTruthImages=378,
                checkedConfigurations=len(groups), checkedSceneEqualAggregates=len(aggregates), cpuSpotchecksCompleted=len(selected),
                partial=partial, fullMatrixComplete=not partial, requestedSubsetComplete=not a.failures,
                auditScope='explicit-complete-configuration-subset' if partial else 'complete-formal',
                coverage=dict(completedConfigurations=len(groups), expectedConfigurations=156,
                              completedViews=len(expected), expectedViews=4536, observedConfigKeys=sorted(groups)),
                balancedSceneAggregates=balanced,
                psnrMaximumAbsoluteErrorDb=max(psnr_errors, default=0.0),
                ssimMaximumAbsoluteError=max(r['ssimAbsoluteError'] for r in spots),
                lpipsMaximumAbsoluteError=max(r['lpipsAbsoluteError'] for r in spots),
                rawDifferenceArtifacts=[dict(path=os.path.relpath(p, run), sha256=a.source(p)) for p in [differences_path, spot_path]],
                sourceReceipts=list(a.sources.values()), failures=a.failures, passed=not a.failures,
                complete=not partial and not a.failures, tolerances=TOLERANCES,
                toleranceRationale='PSNR integer-SSE/float64 arithmetic should agree to rounding; SSIM allows float32 MPS versus float64 separable reduction; LPIPS allows fixed CPU/MPS float32 kernel reduction differences. Thresholds fixed before formal results.',
                referenceMethods=dict(psnr='Exact uint64 RGB8 SSE -> float64 normalized MSE -> -10log10; every observed complete render',
                    ssim='Independent SciPy float64 separable11tap Gaussian sigma1.5, zero padding, RGB/pixel mean; each present stride1 config camera0',
                    lpips='Official lpips0.1.4 VGG v0.1 on CPU, eval/inference_mode, normalize=True; same pinned checkpoint/calibration; same deterministic subset'),
                numericalSelfTestSha256=a.source(numerical_path), metricScriptSha256=protocol['script_sha256'],
                vggWeightSha256=VGG_SHA, lpipsCalibrationSha256=protocol['lpips_calibration_sha256'],
                measuredDevice='mps', referenceDevice='cpu', referenceThreads=torch.get_num_threads(),
                packages={**current_packages, 'scipy': importlib.metadata.version('scipy')},
                auditHost=dict(system=platform.system(), architecture=platform.machine(), python=platform.python_version()),
                peakRssMiB=rss / (1024 ** 2 if platform.system() == 'Darwin' else 1024), gpuWorkPerformed=False,
                limitation='All observed PSNR and aggregate values independently checked; SSIM/LPIPS CPU recomputation covers camera0 of every present full-model configuration. Remaining observed SSIM/LPIPS values have lineage/range/aggregation checks. A partial run never establishes full156/4536 completion; cross-method comparisons use common scene intersections.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', required=True, type=Path)
    parser.add_argument('--config', type=Path, default=ROOT / 'config/local.json')
    parser.add_argument('--gt', type=Path)
    parser.add_argument('--torch-home', type=Path)
    parser.add_argument('--threads', type=int, default=2)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--metrics-dir', type=Path, help='Explicit quality metric directory, including separately labeled preview output')
    parser.add_argument('--numerical-validation', type=Path)
    parser.add_argument('--allow-partial', action='store_true', help='Audit the exact complete-config subset of a deliberately paused formal run')
    args = parser.parse_args()
    args.run_dir = args.run_dir.resolve()
    args.metrics_dir = args.metrics_dir.resolve() if args.metrics_dir else None
    args.numerical_validation = args.numerical_validation.resolve() if args.numerical_validation else None
    config = read(resolve(args.config)) if args.config.exists() or resolve(args.config).exists() else {}
    args.gt = resolve(args.gt or config['groundTruthRoot'])
    args.torch_home = resolve(args.torch_home or config['torchHome'])
    require(1 <= args.threads <= 8, 'Use1to8 CPU threads')
    args.output = args.output.resolve() if args.output else args.run_dir / 'validation/independent-quality-qa.json'
    require(args.output.is_relative_to(args.run_dir / 'validation') or
            (args.allow_partial and args.output.is_relative_to(ROOT / 'results') and args.output.parent.name == 'validation'),
            'Audit outputs belong under RUN/validation or an explicit partial preview validation directory')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    archive_tag = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    for path in [args.output, args.output.with_name(args.output.stem + '-psnr.jsonl'),
                 args.output.with_name(args.output.stem + '-cpu-spotchecks.json')]:
        if path.exists():
            path.rename(path.with_name(path.name + '.previous-' + archive_tag))
    state = dict(schema='independent-three-method-quality-audit-v1', createdAt=timestamp(),
                 passed=False, complete=False, gpuWorkPerformed=False)
    began = time.monotonic()
    try:
        result = audit(args, state)
        state.pop('audit', None); state.update(result)
    except Exception as error:
        instance = state.pop('audit', None)
        if instance is not None:
            state['sourceReceipts'] = list(instance.sources.values())
            state['failures'] = instance.failures
        state['error'] = str(error)
        state['elapsedSeconds'] = time.monotonic() - began
        save(args.output, state)
        raise
    state['elapsedSeconds'] = time.monotonic() - began
    save(args.output, state)
    print(json.dumps({k: state[k] for k in ['passed', 'complete', 'checkedViewCount', 'cpuSpotchecksCompleted',
                                         'psnrMaximumAbsoluteErrorDb', 'ssimMaximumAbsoluteError', 'lpipsMaximumAbsoluteError']}))
    if not state['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
