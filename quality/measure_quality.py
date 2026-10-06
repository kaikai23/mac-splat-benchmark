"""Measure PSNR, SSIM, LPIPS for independently rendered Mac RGB captures.

No browser/GPU launch; CPU by default. MPS only if explicitly chosen, after timing.
Offline-only: refuses to initialize LPIPS without the local pretrained VGG weights.
"""
from __future__ import annotations
import argparse, collections, csv, hashlib, importlib.metadata, json, math, os
import pathlib, platform, statistics, sys
from acquire_ground_truth import save, stamp

METRICS = ['psnr_db', 'ssim', 'lpips_vgg']
VGG_CHECKPOINT_SHA256 = '397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0'
ROOT = pathlib.Path(__file__).resolve().parents[1]


def pixel_psnr(a8, b8):
    import numpy as np
    mse = float(np.mean(((a8.astype(np.float64) - b8.astype(np.float64)) / 255) ** 2))
    return (-10 * math.log10(mse) if mse else None), mse == 0


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(8 * 1024 * 1024), b''): digest.update(data)
    return digest.hexdigest()


def ssim_torch(a, b):
    """SSIM definition: 11x11 Gaussian sigma1.5, zero-padded, all RGB pixels."""
    import torch
    import torch.nn.functional as F
    weights = torch.tensor([math.exp(-(i - 5) ** 2 / (2 * 1.5 ** 2)) for i in range(11)],
                           device=a.device, dtype=torch.float32)
    weights /= weights.sum()
    kernel = torch.outer(weights, weights).expand(3, 1, 11, 11).contiguous()
    blur = lambda x: F.conv2d(x, kernel, padding=5, groups=3)
    ma, mb = blur(a), blur(b)
    va, vb, cov = blur(a * a) - ma * ma, blur(b * b) - mb * mb, blur(a * b) - ma * mb
    score = ((2 * ma * mb + 0.01 ** 2) * (2 * cov + 0.03 ** 2)) / (
        (ma * ma + mb * mb + 0.01 ** 2) * (va + vb + 0.03 ** 2))
    return score.mean().item()


def read_rgb(path):
    import numpy as np
    from PIL import Image
    with Image.open(path) as image:
        image.load()
        if image.size != (1280, 720): raise ValueError(f'Wrong render/GT dimensions: {path}')
        return np.asarray(image.convert('RGB')).copy()


def resolve_image(value, raw_path):
    root = raw_path.parent.parent.resolve()
    p = pathlib.Path(value)
    result = (p if p.is_absolute() else root / p).resolve()
    if not result.is_relative_to(root) or not result.is_file():
        raise ValueError(f'Missing capture or path outside this run: {value}')
    return result


def metric_contract(row):
    """Reject damaged cached rows instead of silently accepting stale metrics."""
    p, infinite = row['psnr_db'], row['psnr_infinite']
    if not isinstance(infinite, bool): raise ValueError('PSNR infinity flag is not Boolean')
    if (infinite and p is not None) or (not infinite and
            (not isinstance(p, (int, float)) or isinstance(p, bool) or not math.isfinite(p) or p < 0)):
        raise ValueError('PSNR value/flag contract differs')
    for key in ['ssim', 'lpips_vgg']:
        x = row[key]
        if not isinstance(x, (int, float)) or isinstance(x, bool) or not math.isfinite(x):
            raise ValueError(f'Invalid {key}')
    if not -1.00001 <= row['ssim'] <= 1.00001 or row['lpips_vgg'] < 0:
        raise ValueError('SSIM/LPIPS value outside metric range')


def load_checkpoint(path):
    """Recover only a final unterminated write; retain original bytes and receipt."""
    if not path.exists(): return []
    data = path.read_bytes()
    lines = data.splitlines(keepends=True)
    rows, chunks, recovery = [], [], None
    for i, line in enumerate(lines):
        try:
            row = json.loads(line)
        except (ValueError, UnicodeDecodeError):
            if i != len(lines) - 1 or line.endswith(b'\n'):
                raise ValueError('Checkpoint corruption before a final unterminated line')
            recovery = 'Removed incomplete final JSONL write'
            break
        rows.append(row)
        chunks.append(line)
    retained = b''.join(chunks)
    if retained and not retained.endswith(b'\n'):
        retained += b'\n'
        recovery = recovery or 'Completed newline after intact final JSONL row'
    if recovery:
        token = stamp().replace(':', '').replace('+', '').replace('.', '')
        backup = path.with_name(f'per-view-before-recovery-{token}.jsonl')
        backup.write_bytes(data)
        tmp = path.with_suffix('.jsonl.recovered')
        tmp.write_bytes(retained); tmp.replace(path)
        save(path.with_name(f'checkpoint-recovery-{token}.json'), dict(
            action=recovery, original_sha256=hashlib.sha256(data).hexdigest(),
            retained_sha256=hashlib.sha256(retained).hexdigest(), preserved_file=backup.name,
            original_bytes=len(data), retained_bytes=len(retained), retained_rows=len(rows)))
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--config', type=pathlib.Path,
                    help='Optional repository-root-relative configuration supplying GT and torch paths')
    ap.add_argument('--run-dir', type=pathlib.Path, required=True,
                    help='Portable experiment run root with protocol.json and raw/*.json')
    ap.add_argument('--gt', type=pathlib.Path)
    ap.add_argument('--selection', type=pathlib.Path, default=ROOT / 'quality/selection.json')
    ap.add_argument('--torch-home', type=pathlib.Path)
    ap.add_argument('--output', type=pathlib.Path)
    ap.add_argument('--device', choices=['cpu', 'mps'], default='cpu')
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--allow-partial', action='store_true')
    args = ap.parse_args()
    args.run_dir = args.run_dir.resolve()
    if args.config:
        config_path = args.config if args.config.is_absolute() else ROOT / args.config
        config = json.loads(config_path.read_text())
        for field, key in [('gt', 'groundTruthRoot'), ('torch_home', 'torchHome')]:
            if getattr(args, field) is None:
                value = pathlib.Path(config[key])
                setattr(args, field, (value if value.is_absolute() else ROOT / value).resolve())
    if args.gt is None or args.torch_home is None:
        ap.error('Supply --config with groundTruthRoot/torchHome or explicit --gt and --torch-home')
    args.output = args.output or args.run_dir / 'quality/metrics'
    for lock in [args.run_dir / 'gpu-session.lock', args.run_dir.parent / 'gpu-session.lock',
                 ROOT / 'results/gpu-session.lock']:
        if lock.exists(): raise ValueError('Performance/GPU collection is still locked; quality must run afterwards')
    collection_protocol_path = args.run_dir / 'protocol.json'
    collection_protocol = json.loads(collection_protocol_path.read_text())
    cleanup = json.loads((args.run_dir / 'runtime-cleanup.json').read_text())
    if cleanup.get('complete') is not True or not cleanup.get('finishedAt') or cleanup.get('gpuLockReleased') is not True or any(c.get('alive') for c in cleanup.get('children', [])):
        raise ValueError('Performance collection/cleanup is incomplete')
    for method in ('spark',):
        if collection_protocol['methodDefinitions'][method]['version'] != '0.1.10':
            raise ValueError('This reproduction requires newly measured Spark 0.1.10')
    selection = json.loads(args.selection.read_text())
    selection_sha = hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
    scene_datasets = {s['scene']: s['dataset'] for s in selection['scenes']}
    camera_hashes = {s['scene']: s['camera_sha256'] for s in selection['scenes']}
    expected_cameras = {(s['scene'], i): c for s in selection['scenes'] for i, c in enumerate(s['cameras'])}
    gt_manifest_path = args.gt / 'ground-truth-manifest.json'
    gt_manifest = json.loads(gt_manifest_path.read_text())
    if not gt_manifest['complete']: raise ValueError('Incomplete GT manifest')
    if gt_manifest['selection_sha256'] != selection_sha: raise ValueError('GT selection identity differs')
    gt_lookup = {(e['scene'], e['camera_index']): e for e in gt_manifest['entries']}
    if len(gt_manifest['entries']) != len(expected_cameras) or set(gt_lookup) != set(expected_cameras):
        raise ValueError('GT camera coverage differs or contains duplicates')
    if any(e['camera_sha256'] != camera_hashes[e['scene']] for e in gt_manifest['entries']):
        raise ValueError('GT archived camera-file identity differs')
    entries = []
    for directory in [args.run_dir]:
        for path in sorted((directory / 'raw').glob('*.json')):
            raw = json.loads(path.read_text())
            method = raw['method']
            allowed_engines = {'visionary': {'visionary'}, 'spark': {'spark'}, 'supersplat': {'supersplat'}}
            if method not in allowed_engines: raise ValueError(f'Unknown method: {method}')
            if raw.get('engine') not in allowed_engines[method]: raise ValueError(f'Wrong engine identity: {path}')
            if raw.get('status') != 'complete' or raw.get('error') or raw.get('errors'):
                raise ValueError(f'Incomplete/error raw: {path}')
            if raw['protocolId'] != collection_protocol['protocolId']:
                raise ValueError('Raw collection protocol differs')
            definition = collection_protocol['methodDefinitions'][method]
            if raw['metadata']['version'] != definition['version'] or raw['metadata']['sourceCommit'] != definition['sourceCommit']:
                raise ValueError('Renderer version/source differs from this portable run')
            if method == 'spark' and raw.get('metadata', {}).get('sortBits') != collection_protocol['methodDefinitions']['spark']['sortBits']:
                raise ValueError(f'Spark method/sort width differs: {path}')
            if raw['cameras'] != next(s['cameras'] for s in selection['scenes'] if s['scene'] == raw['scene']):
                raise ValueError(f'Raw cameras differ from frozen quality selection: {path}')
            raw_sha = sha(path)
            captures = raw.get('qualityCaptures', raw.get('captures', []))
            for cap in captures:
                entries.append(dict(method=method, scene=raw['scene'], stride=raw['stride'],
                                    camera_index=cap['cameraIndex'], img_name=cap['img_name'],
                                    path=str(resolve_image(cap['path'], path)),
                                    expected_capture_sha256=cap.get('sha256'),
                                    raw_path=str(path.resolve()), raw_sha256=raw_sha,
                                    protocol_id=raw['protocolId'], engine_version=definition['version'],
                                    engine_source_commit=definition['sourceCommit']))
    if not entries: raise ValueError('No render captures')
    key = lambda e: (e['method'], e['scene'], e['stride'], e['camera_index'])
    observed = [key(e) for e in entries]
    if len(set(observed)) != len(observed): raise ValueError('Duplicate render image identity')
    expected = {(m, s, stride, i) for m in ['visionary', 'spark', 'supersplat']
                for s, i in expected_cameras for stride in [1, 2, 4, 8]}
    if not set(observed) <= expected: raise ValueError('Render identities outside the frozen full matrix')
    complete = set(observed) == expected
    if not complete and not args.allow_partial: raise ValueError(f'Expected 4536 render images, got {len(observed)}; use --allow-partial only for pilot')
    if collection_protocol.get('pilot') and complete:
        raise ValueError('A pilot protocol cannot establish formal completion')
    # Validate coverage before importing torch or allocating the inference model.
    os.environ['TORCH_HOME'] = str(args.torch_home.resolve())
    import numpy as np
    import torch, torchvision, lpips
    torch.set_num_threads(args.threads)
    torch.set_grad_enabled(False)
    if args.device == 'mps' and not torch.backends.mps.is_available(): raise ValueError('MPS unavailable')
    weights = args.torch_home / 'hub/checkpoints/vgg16-397923af.pth'
    if not weights.is_file(): raise ValueError('Missing local pretrained VGG weights; download through ecofde first')
    weight_sha = sha(weights)
    if weight_sha != VGG_CHECKPOINT_SHA256: raise ValueError('VGG pretrained checkpoint SHA differs')
    calibration = pathlib.Path(lpips.__file__).parent / 'weights/v0.1/vgg.pth'
    model = lpips.LPIPS(net='vgg', version='0.1', verbose=False).eval().to(args.device)
    protocol = dict(schema='portable-three-method-quality-v1', device=args.device, dtype='float32',
                    collection_protocol_id=collection_protocol['protocolId'],
                    collection_protocol_sha256=sha(collection_protocol_path),
                    method_definitions=collection_protocol['methodDefinitions'],
                    host=dict(system=platform.system(), macos=platform.mac_ver()[0],
                              architecture=platform.machine(), python=platform.python_version()),
                    gt_manifest_sha256=sha(gt_manifest_path), vgg_weight_sha256=weight_sha,
                    ground_truth_transform=gt_manifest['transform'],
                    selection_sha256=selection_sha, selection_file_sha256=sha(args.selection),
                    lpips_calibration_sha256=sha(calibration), script_sha256=sha(pathlib.Path(__file__)),
                    packages={p: importlib.metadata.version(p) for p in ['torch', 'torchvision', 'lpips', 'numpy', 'Pillow']},
                    psnr='-10 log10(mean squared error); RGB8 /255, peak1; infinite encoded as null+flag',
                    ssim='11x11 Gaussian sigma1.5, C1=.01^2,C2=.03^2, zero-pad5, average all pixels and RGB',
                    lpips='official lpips v0.1 VGG ImageNet trunk + learned calibration, eval mode, normalize=True from [0,1]',
                    aggregation='arithmetic per-view means per scene/stride/method; equal-weight scene means for aggregate',
                    caveat='fixed 1280x720 independently resized source RGB; no claim of original paper metric equivalence')
    args.output.mkdir(parents=True, exist_ok=True)
    protocol_path = args.output / 'metrics-protocol.json'
    if protocol_path.exists() and json.loads(protocol_path.read_text()) != protocol:
        raise ValueError('Changed metric protocol; choose a new output directory')
    save(protocol_path, protocol)
    checkpoint = args.output / 'per-view.jsonl'
    records = {}
    for row in load_checkpoint(checkpoint):
        if key(row) in records: raise ValueError('Duplicate checkpoint row')
        metric_contract(row)
        records[key(row)] = row
    with checkpoint.open('a') as out:
        for index, entry in enumerate(entries):
            camera = expected_cameras[entry['scene'], entry['camera_index']]
            gt = gt_lookup[entry['scene'], entry['camera_index']]
            if entry['img_name'] != camera['img_name'] or gt['img_name'] != camera['img_name']:
                raise ValueError('Camera/image names differ')
            path = pathlib.Path(entry['path'])
            gt_path = args.gt / gt['relative_path']
            image_sha = sha(path)
            if entry.get('expected_capture_sha256') and image_sha != entry['expected_capture_sha256']:
                raise ValueError('Capture checksum differs from raw collection receipt')
            if sha(gt_path) != gt['sha256']: raise ValueError('GT bytes changed')
            if key(entry) in records:
                cached = records[key(entry)]
                if cached['render_sha256'] != image_sha: raise ValueError('Existing render bytes changed')
                if cached['gt_sha256'] != gt['sha256'] or cached['img_name'] != camera['img_name']:
                    raise ValueError('Cached GT/image identity differs')
                if entry.get('raw_sha256') != cached.get('raw_sha256'):
                    raise ValueError('Raw source provenance changed since checkpoint')
                continue
            a8, b8 = read_rgb(path), read_rgb(gt_path)
            a = torch.from_numpy(a8).permute(2, 0, 1).unsqueeze(0).float().to(args.device) / 255
            b = torch.from_numpy(b8).permute(2, 0, 1).unsqueeze(0).float().to(args.device) / 255
            # Float64 CPU MSE preserves exact RGB8 squared-error averaging.
            psnr_db, psnr_infinite = pixel_psnr(a8, b8)
            row = dict(entry, render_sha256=image_sha, render_rgb8_sha256=hashlib.sha256(a8.tobytes()).hexdigest(),
                       gt_sha256=gt['sha256'], psnr_db=psnr_db,
                       psnr_infinite=psnr_infinite, ssim=ssim_torch(a, b),
                       lpips_vgg=float(model(a, b, normalize=True).item()))
            metric_contract(row)
            out.write(json.dumps(row) + '\n'); out.flush()
            records[key(row)] = row
            if index % 25 == 0: print(f'{index + 1}/{len(entries)}', flush=True)
    if set(records) != set(observed): raise ValueError('Checkpoint contains additional images')
    groups = collections.defaultdict(list)
    for row in records.values(): groups[key(row)[:3]].append(row)
    rows = []
    for (method, scene, stride), views in sorted(groups.items()):
        count = sum(s == scene for s, _ in expected_cameras)
        summary = dict(method=method, scene=scene, dataset=scene_datasets[scene], stride=stride,
                       views=len(views), complete=len(views) == count)
        for metric in METRICS:
            values = [v[metric] for v in views]
            summary[metric] = statistics.mean(values) if all(v is not None for v in values) else None
        summary['psnr_infinite_views'] = sum(v['psnr_infinite'] for v in views)
        rows.append(summary)
    aggregates = []
    for method in sorted({r['method'] for r in rows}):
        for stride in [1, 2, 4, 8]:
            subset = [r for r in rows if r['method'] == method and r['stride'] == stride]
            if not subset: continue
            aggregates.append(dict(method=method, stride=stride, scenes=len(subset),
                              complete=len(subset) == 13 and all(r['complete'] for r in subset),
                              **{k: statistics.mean(r[k] for r in subset) if all(r[k] is not None for r in subset) else None for k in METRICS}))
    capture_manifest = args.output / 'capture-manifest.json'
    save(capture_manifest, dict(entries=[{k: row[k] for k in ['method', 'scene', 'stride', 'camera_index',
        'img_name', 'path', 'render_sha256', 'render_rgb8_sha256']} for row in records.values()]))
    save(args.output / 'quality-summary.json', dict(complete=complete, generated_at=stamp(),
         metrics=['psnr', 'ssim', 'lpips'], referenceType='ground-truth',
         render_images=len(records), expected_render_images=4536, configurations=rows, aggregates=aggregates,
         protocol_sha256=sha(protocol_path), per_view_sha256=sha(checkpoint),
         ground_truth_manifest_sha256=sha(gt_manifest_path), capture_manifest_sha256=sha(capture_manifest),
         ground_truth_transform=gt_manifest['transform'],
         coverage=dict(methods=3, scenes=13, strides=[1, 2, 4, 8], heldout_views=378,
                       expected_captures=4536, actual_captures=len(records)),
         aggregation=protocol['aggregation']))
    for name, data in [('quality-by-config.csv', rows), ('quality-aggregate.csv', aggregates)]:
        with (args.output / name).open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(data[0])); writer.writeheader(); writer.writerows(data)
    print(json.dumps(dict(complete=complete, images=len(records), configurations=len(rows))))


if __name__ == '__main__': main()
