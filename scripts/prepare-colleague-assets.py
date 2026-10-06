#!/usr/bin/env python3
"""Assemble verified, ordinary-file colleague assets locally; never download/upload.

Run from the repository root. Sources and destination must be explicit. A failed
assembly is left for inspection; an existing output is never resumed/overwritten.
"""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
VGG_SHA = '397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0'


def read(path):
    return json.loads(path.read_text())


def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def regular(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), 'Expected ordinary non-symlink file: ' + str(path))
    return info


def inside(root, relative):
    relative = Path(relative)
    require(not relative.is_absolute() and '..' not in relative.parts, 'Unsafe asset relative path')
    path = root / relative
    require(path.resolve().is_relative_to(root.resolve()), 'Asset escapes its explicit root')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('models', 'ground-truth', 'npm-cacache', 'npm-receipt', 'wheels', 'vgg', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--python', required=True, help='Pinned Python3.12/Pillow11.3 interpreter for GT verification')
    parser.add_argument('--copy-method', choices=['apfs-clone', 'copy'], default='apfs-clone',
                        help='APFS clone is default; ordinary copies require explicit selection and full free space')
    args = parser.parse_args()
    output = args.output.absolute()
    require(not os.path.lexists(output), 'Output already exists; preserve/review it before starting a new assembly')
    require(args.copy_method != 'apfs-clone' or platform.system() == 'Darwin', 'APFS clone requires a Mac')
    for name in ('models', 'ground_truth', 'npm_cacache', 'wheels'):
        source = getattr(args, name).absolute()
        require(source.is_dir() and not source.is_symlink(), 'Expected ordinary source directory: ' + str(source))
        require(not output.resolve().is_relative_to(source.resolve()), 'Output cannot be inside a source directory')
        setattr(args, name, source)
    require(args.npm_cacache.name == '_cacache', 'Supply npm-cache/_cacache only, excluding logs')
    data_lock = read(ROOT / 'config/data-lock.json')
    for item in data_lock['manifests']:
        require(sha(inside(ROOT, item['path'])) == item['sha256'], 'Repository data manifest lock differs')
    originals = read(ROOT / 'config/data/manifest.json')
    subsets = read(ROOT / 'config/data/subsets-manifest.json')
    models = [dict(s['ply'], scene=s['scene'], stride=1) for s in originals['scenes']] + subsets['subsets']
    require(len(models) == 52 and len({(m['scene'], m['stride']) for m in models}) == 52,
            'Expected exactly52 locked models')
    wheel_lock_path = ROOT / 'config/python-wheels.lock.json'
    wheel_lock = read(wheel_lock_path)
    require(len(wheel_lock['wheels']) == 25, 'Expected exactly25 pinned wheels')
    regular(args.npm_receipt)
    npm_receipt = read(args.npm_receipt)
    npm_locks = {name: sha(ROOT / name) for name in ('package-lock.json', 'work/bench/package-lock.json')}
    require(npm_receipt.get('schema') == 'portable-offline-dependency-cache-v1' and
            npm_receipt.get('complete') is True and npm_receipt['npmLocks'] == npm_locks and
            npm_receipt['pythonWheelLockSha256'] == sha(wheel_lock_path), 'Npm source receipt does not match repository locks')
    require(npm_receipt.get('networkNode') == 'ecofde', 'Expected original designated-node dependency receipt')
    cache_files = []
    for directory, dirs, files in os.walk(args.npm_cacache, followlinks=False):
        for name in dirs:
            require(not (Path(directory) / name).is_symlink(), 'Symlink directory inside npm cache')
        for name in files:
            path = Path(directory) / name
            regular(path)
            cache_files.append(path)
    require(cache_files, 'Npm content-addressed cache is empty')
    require(any(p.relative_to(args.npm_cacache).parts[0].startswith('content-') for p in cache_files) and
            any(p.relative_to(args.npm_cacache).parts[0].startswith('index-') for p in cache_files),
            'Npm cache requires both content and index files')
    gt_manifest_path = args.ground_truth / 'ground-truth-manifest.json'
    regular(gt_manifest_path)
    gt = read(gt_manifest_path)
    planned = []
    def plan(source, relative, group, expected_sha=None, expected_bytes=None):
        info = regular(source)
        if expected_bytes is not None:
            require(info.st_size == expected_bytes, 'Source byte length differs: ' + str(source))
        planned.append((source, relative, group, expected_sha, info.st_size))
    for entry in models:
        plan(inside(args.models, entry['relative_path']), 'models/' + entry['relative_path'],
             'models', entry['sha256'], entry['bytes'])
    plan(gt_manifest_path, 'ground-truth/ground-truth-manifest.json', 'ground-truth', sha(gt_manifest_path))
    for entry in gt['entries']:
        plan(inside(args.ground_truth, entry['relative_path']), 'ground-truth/' + entry['relative_path'],
             'ground-truth', entry['sha256'])
    for source in sorted(cache_files):
        plan(source, 'offline-cache/npm-cache/_cacache/' + source.relative_to(args.npm_cacache).as_posix(), 'npm-cache')
    plan(args.npm_receipt, 'offline-cache/provenance/npm-source-receipt.json', 'provenance', sha(args.npm_receipt))
    for entry in wheel_lock['wheels']:
        plan(inside(args.wheels, entry['file']), 'offline-cache/python-wheels/' + entry['file'],
             'python-wheels', entry['sha256'], entry['bytes'])
    plan(args.vgg, 'offline-cache/torch/hub/checkpoints/vgg16-397923af.pth', 'vgg', VGG_SHA)
    require(len({p[1] for p in planned}) == len(planned), 'Duplicate output asset path')
    logical_bytes = sum(p[4] for p in planned)
    output.parent.mkdir(parents=True, exist_ok=True)
    free_before = shutil.disk_usage(output.parent).free
    required_free = (logical_bytes if args.copy_method == 'copy' else 0) + 1024**3
    require(free_before > required_free, 'Insufficient free space including1GiB reserve')
    python_info = json.loads(subprocess.check_output([args.python, '-c',
        'import sys,json,PIL;print(json.dumps({"python":list(sys.version_info[:2]),"pillow":PIL.__version__}))'], text=True))
    require(python_info == {'python': [3, 12], 'pillow': '11.3.0'}, 'Use pinned Python3.12/Pillow11.3.0')
    with tempfile.TemporaryDirectory(prefix='colleague-gt-source-') as temporary:
        gt_receipt_path = Path(temporary) / 'ground-truth-verification.json'
        subprocess.run([args.python, str(ROOT / 'scripts/verify-ground-truth.py'),
            '--ground-truth-root', str(args.ground_truth), '--output', str(gt_receipt_path)], check=True)
        gt_receipt = read(gt_receipt_path)
    output.mkdir(exist_ok=False)
    files = []
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(json.dumps({'plannedFiles': len(planned), 'logicalBytes': logical_bytes,
                      'copyMethod': args.copy_method, 'freeBytesBefore': free_before}), flush=True)
    for number, (source, relative, group, expected_sha, length) in enumerate(planned, 1):
        before = regular(source)
        source_sha = sha(source)
        require(expected_sha is None or source_sha == expected_sha, 'Source SHA mismatch: ' + str(source))
        target = inside(output, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        require(not os.path.lexists(target), 'Destination appeared during assembly')
        if args.copy_method == 'apfs-clone':
            subprocess.run(['/bin/cp', '-c', str(source), str(target)], check=True)
        else:
            with source.open('rb') as src, target.open('xb') as dst:
                shutil.copyfileobj(src, dst, length=8 * 1024 * 1024)
        after = regular(source)
        dest = regular(target)
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
                (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), 'Source changed during copy')
        require((before.st_dev, before.st_ino) != (dest.st_dev, dest.st_ino) and dest.st_nlink == 1,
                'Output must be an independent ordinary file, never a hardlink')
        target_sha = sha(target)
        require(dest.st_size == length and target_sha == source_sha, 'Copied asset bytes/SHA mismatch')
        files.append(dict(path=relative, group=group, bytes=length, sha256=target_sha,
                          sourceSha256=source_sha, copyMethod=args.copy_method, distinctInode=True))
        if group == 'models' or number % 100 == 0:
            print(f'Verified {number}/{len(planned)} {relative}', flush=True)
    dependency = dict(npm_receipt, pythonWheels=wheel_lock['wheels'], vggSha256=VGG_SHA,
        assembledLocally=True, assemblyNetworkAccess=False,
        assemblyNote='Verified local assembly; networkNode is inherited from the preserved original npm receipt, not a new download claim.',
        originalNpmReceiptPath='provenance/npm-source-receipt.json',
        originalNpmReceiptSha256=sha(args.npm_receipt), assemblyScriptSha256=sha(Path(__file__)))
    save(output / 'offline-cache/dependency-cache-receipt.json', dependency)
    save(output / 'ground-truth-verification.json', gt_receipt)
    for relative in ('offline-cache/dependency-cache-receipt.json', 'ground-truth-verification.json'):
        path = output / relative
        files.append(dict(path=relative, group='generated-receipt', bytes=path.stat().st_size,
                          sha256=sha(path), generatedLocally=True))
    groups = {group: sum(p[4] for p in planned if p[2] == group) for group in sorted({p[2] for p in planned})}
    manifest = dict(schema='portable-colleague-assets-v1', complete=True, startedAt=started,
        finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), models=52, groundTruthImages=378,
        pythonWheels=25, npmCacheFiles=len(cache_files), copiedFileCount=len(planned),
        logicalBytes=logical_bytes, groupBytes=groups, freeBytesBefore=free_before,
        freeBytesAfter=shutil.disk_usage(output).free, copyMethod=args.copy_method,
        allSourceAndTargetSha256Matched=True, allCopiedFilesDistinctInodes=True,
        sourceScriptSha256=sha(Path(__file__)), dataLockSha256=sha(ROOT / 'config/data-lock.json'),
        pythonWheelLockSha256=sha(wheel_lock_path), gtPixelLockSha256=sha(ROOT / 'scripts/ground-truth-pixels-lock.json'),
        originalNpmReceiptSha256=sha(args.npm_receipt), files=files,
        excludes=['personal config', 'venv', 'node_modules', 'npm logs', 'source photos', 'measurements'],
        networkAccess=False, uploaded=False, gpuWorkPerformed=False,
        note='Manifest lists every bundle file except itself. APFS clones use separate inodes with copy-on-write blocks; transfer as ordinary files.')
    save(output / 'asset-manifest.json', manifest)
    print(json.dumps({'complete': True, 'output': str(output), 'logicalBytes': logical_bytes,
                      'files': len(files), 'assetManifestSha256': sha(output / 'asset-manifest.json')}), flush=True)


if __name__ == '__main__':
    main()
