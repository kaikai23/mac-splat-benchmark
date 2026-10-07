#!/usr/bin/env python3
"""Restore the locked Mac experiment assets without rewriting their manifests.

Local actions never use the network. Select direct or ecofde explicitly for fetch.
No action is performed on import, and every data destination must be explicit.
"""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import math
import pathlib
import platform
import shutil
import socket
import struct
import subprocess
import tempfile
import zlib

SCENES = ['bicycle', 'flowers', 'garden', 'stump', 'treehill', 'room', 'counter',
          'kitchen', 'bonsai', 'drjohnson', 'playroom', 'truck', 'train']
URL = 'https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/pretrained/models.zip'
ARCHIVE_BYTES = 14660630999
SIZES = {'char': 1, 'uchar': 1, 'int8': 1, 'uint8': 1, 'short': 2, 'ushort': 2,
         'int16': 2, 'uint16': 2, 'int': 4, 'uint': 4, 'int32': 4, 'uint32': 4,
         'float': 4, 'float32': 4, 'double': 8, 'float64': 8}


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            value.update(data)
    return value.hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_network_mode(mode, system=None):
    require(mode in ('direct', 'ecofde'), 'Choose an explicit --network-node direct or ecofde')
    require(mode != 'ecofde' or (system or platform.system()) != 'Darwin',
            'Use ssh ecofde for --network-node ecofde, or explicitly choose --network-node direct on this Mac')


def safe_path(root, relative):
    rel = pathlib.PurePosixPath(relative)
    require(not rel.is_absolute() and '..' not in rel.parts, 'Unsafe manifest relative path')
    path = root.joinpath(*rel.parts)
    require(path.resolve().is_relative_to(root.resolve()), 'Asset path escapes explicit data directory')
    return path


def load_locks(directory, scenes):
    manifest = json.loads((directory / 'manifest.json').read_text())
    subsets = json.loads((directory / 'subsets-manifest.json').read_text())
    require(manifest['complete'] and manifest['iteration'] == 30000, 'Incomplete/wrong checkpoint manifest')
    require(manifest['source_url'] == URL and manifest['source_archive_bytes'] == ARCHIVE_BYTES, 'Official archive identity differs')
    require(len(manifest['scenes']) == 13 and {s['scene'] for s in manifest['scenes']} == set(SCENES), 'Original scene coverage differs')
    require(len(subsets['subsets']) == 39 and {(s['scene'], s['stride']) for s in subsets['subsets']} ==
            {(s, k) for s in SCENES for k in [2, 4, 8]}, 'Subset coverage differs')
    originals, models, by_scene = [], [], {}
    for scene in manifest['scenes']:
        by_scene[scene['scene']] = scene['ply']
        if scene['scene'] not in scenes:
            continue
        for kind in ['ply', 'cameras', 'config']:
            entry = dict(scene[kind], scene=scene['scene'], kind=kind)
            originals.append(entry)
            if kind == 'ply':
                require(entry['archive_member'].endswith('iteration_30000/point_cloud.ply'), 'Wrong checkpoint member')
                models.append(entry)
    selected = []
    for entry in subsets['subsets']:
        require(entry['source_sha256'] == by_scene[entry['scene']]['sha256'], 'Subset parent SHA differs')
        require(entry['source_gaussian_count'] == by_scene[entry['scene']]['gaussian_count'], 'Subset parent count differs')
        if entry['scene'] in scenes:
            selected.append(entry)
    return originals, models + selected, selected, by_scene


def verified(path, expected):
    require(path.is_file(), f'Missing asset: {path}')
    require(path.stat().st_size == expected['bytes'], f'Asset size differs: {path}')
    actual = digest(path)
    require(actual == expected['sha256'], f'Asset SHA differs; preserve mismatch evidence before repair: {path}')
    return {'relative_path': expected['relative_path'], 'bytes': expected['bytes'],
            'sha256': actual, 'verified': True}


def need_write(path, expected):
    require(not path.is_symlink(), f'Asset destination must not be a symlink: {path}')
    if path.exists():
        verified(path, expected)
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    return True


def publish(temp, target, expected):
    verified(temp, expected)
    # Never overwrite an existing model or reinterpret a new hash as a baseline.
    require(not target.exists(), f'Destination appeared during restore: {target}')
    temp.rename(target)


def import_models(source, destination, models):
    for entry in models:
        target = safe_path(destination, entry['relative_path'])
        if not need_write(target, entry):
            continue
        original = safe_path(source, entry['relative_path'])
        verified(original, entry)
        temp = target.with_name(target.name + '.mac-import.part')
        require(not temp.exists(), f'Preserve/review existing task scratch before retry: {temp}')
        shutil.copyfile(original, temp)
        publish(temp, target, entry)


def range_bytes(start, end, curl):
    require(0 <= start <= end < ARCHIVE_BYTES, 'Range outside locked archive')
    expected = end - start + 1
    require(expected <= 8 * 1024 * 1024, 'Unbounded download request rejected')
    with tempfile.NamedTemporaryFile() as headers:
        run = subprocess.run([curl, '--fail', '--location', '--silent', '--show-error', '--retry', '4',
                              '--max-time', '180', '--max-filesize', str(expected),
                              '--dump-header', headers.name, '--range', f'{start}-{end}', URL], capture_output=True)
        require(run.returncode == 0, 'curl failed: ' + run.stderr.decode(errors='replace')[-500:])
        blocks = pathlib.Path(headers.name).read_text().strip().split('\n\n')
        lines = blocks[-1].splitlines()
        require(lines and lines[0].split()[1] == '206', 'Expected HTTP 206; full-archive response rejected')
        fields = {k.lower(): v.strip() for k, v in (line.split(':', 1) for line in lines[1:] if ':' in line)}
        require(fields.get('content-range') == f'bytes {start}-{end}/{ARCHIVE_BYTES}', 'Archive size/range changed')
        require(len(run.stdout) == expected, 'HTTP range payload length differs')
        return run.stdout


def fetch_originals(destination, lock_dir, originals):
    curl = shutil.which('curl')
    require(curl is not None, 'Native curl executable is required')
    entries = json.loads((lock_dir / 'official-archive-inventory.json').read_text())
    inventory = {e['path']: e for e in entries}
    require(len(inventory) == len(entries), 'Duplicate archive member in locked inventory')
    for expected in originals:
        target = safe_path(destination, expected['relative_path'])
        if not need_write(target, expected):
            continue
        member = inventory[expected['archive_member']]
        require(member['size'] == expected['bytes'] and member['crc32'] == expected['zip_crc32'], 'Locked archive member differs')
        off = member['header_offset']
        header = struct.unpack('<IHHHHHIIIHH', range_bytes(off, off + 29, curl))
        require(header[0] == 0x04034B50 and header[3] in [0, 8] and not header[2] & 1, 'Unsupported ZIP local header')
        name = range_bytes(off + 30, off + 29 + header[-2], curl)
        require(name.decode('utf-8') == expected['archive_member'], 'ZIP local member name differs')
        start = off + 30 + header[-2] + header[-1]
        compressed = target.with_name(target.name + '.mac-download.compressed.part')
        require(not compressed.is_symlink() and (not compressed.exists() or compressed.is_file()),
                'Compressed download scratch must be a regular file')
        offset = compressed.stat().st_size if compressed.exists() else 0
        require(offset <= member['compressed_size'], 'Oversized compressed partial file')
        require(shutil.disk_usage(destination).free > member['compressed_size'] - offset + expected['bytes'] + 1024**3,
                'Restore requires compressed+extracted space and a 1 GiB reserve')
        with compressed.open('ab') as stream:
            while offset < member['compressed_size']:
                length = min(8 * 1024 * 1024, member['compressed_size'] - offset)
                stream.write(range_bytes(start + offset, start + offset + length - 1, curl))
                stream.flush()
                offset += length
        temp = target.with_name(target.name + '.mac-extracting.part')
        require(not temp.is_symlink(), 'Extraction scratch must not be a symlink')
        require(not temp.exists(), f'Preserve/review existing extraction scratch before retry: {temp}')
        decoder = zlib.decompressobj(-15) if header[3] == 8 else None
        crc, written = 0, 0
        with compressed.open('rb') as src, temp.open('xb') as dst:
            for data in iter(lambda: src.read(4 * 1024 * 1024), b''):
                pending = data
                while pending:
                    decoded = decoder.decompress(pending, 8 * 1024 * 1024) if decoder else pending
                    pending = decoder.unconsumed_tail if decoder else b''
                    written += len(decoded)
                    require(written <= expected['bytes'], 'Decoded payload exceeds locked member size')
                    crc = zlib.crc32(decoded, crc)
                    dst.write(decoded)
            if decoder:
                tail = decoder.flush()
                written += len(tail)
                crc = zlib.crc32(tail, crc)
                dst.write(tail)
                require(decoder.eof and not decoder.unused_data, 'Incomplete/trailing deflate data')
        require(written == expected['bytes'] and f'{crc:08x}' == expected['zip_crc32'], 'Extracted member CRC/length differs')
        publish(temp, target, expected)
        compressed.unlink()  # only this command's verified resumable scratch
        print('Restored locked original', expected['relative_path'], flush=True)


def ply_header(stream):
    lines, count, row_bytes, format_seen = [], None, 0, False
    while len(lines) < 300:
        raw = stream.readline(4096)
        require(raw and raw.endswith(b'\n'), 'Invalid/truncated PLY header')
        text = raw.decode('ascii').strip()
        lines.append(raw)
        if text.startswith('format '):
            require(text == 'format binary_little_endian 1.0', 'Only binary little-endian PLY supported')
            format_seen = True
        elif text.startswith('element '):
            require(text.startswith('element vertex ') and count is None, 'Unexpected PLY element')
            count = int(text.split()[-1])
        elif text.startswith('property '):
            parts = text.split()
            require(count is not None and parts[1] in SIZES, 'Unsupported PLY property')
            row_bytes += SIZES[parts[1]]
        elif text == 'end_header':
            require(format_seen and count is not None and count >= 0 and row_bytes > 0, 'Incomplete PLY header')
            return b''.join(lines), count, row_bytes
    raise ValueError('PLY header too long')


def subset_bytes(stream, output, stride):
    """Identical row/header transform to the frozen make_stride_subsets.py."""
    require(stride in [2, 4, 8], 'Only locked power-of-two stride subsets are supported')
    header, count, row_bytes = ply_header(stream)
    output.write(header.replace(f'element vertex {count}'.encode(),
                                f'element vertex {math.ceil(count / stride)}'.encode()))
    consumed = 0
    for block in iter(lambda: stream.read(65536 * row_bytes), b''):
        require(len(block) % row_bytes == 0, 'Partial PLY vertex row')
        consumed += len(block) // row_bytes
        output.write(b''.join(block[i:i+row_bytes] for i in range(0, len(block), stride * row_bytes)))
    require(consumed == count, 'PLY vertex payload size differs')


def rebuild_subsets(destination, subsets, originals):
    verified_sources = set()
    for entry in subsets:
        target = safe_path(destination, entry['relative_path'])
        if not need_write(target, entry):
            continue
        original = originals[entry['scene']]
        source = safe_path(destination, original['relative_path'])
        if source not in verified_sources:
            verified(source, original)
            verified_sources.add(source)
        require(shutil.disk_usage(destination).free > entry['bytes'] + 1024**3, 'Subset requires output space plus 1 GiB reserve')
        temp = target.with_name(target.name + '.mac-subset.part')
        with source.open('rb') as src, temp.open('xb') as dst:
            subset_bytes(src, dst, entry['stride'])
        publish(temp, target, entry)
        print('Restored locked subset', entry['relative_path'], flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'verify', 'import-existing', 'fetch-originals', 'rebuild-subsets'])
    parser.add_argument('--manifest-dir', type=pathlib.Path, required=True, help='Read-only repository config/data containing locked JSON')
    parser.add_argument('--data-dir', type=pathlib.Path, required=True, help='Explicit directory with scene-relative asset paths')
    parser.add_argument('--source-dir', type=pathlib.Path, help='Existing verified 52-model directory, for import-existing')
    parser.add_argument('--network-node', choices=['direct', 'ecofde'], help='Required for fetch-originals: direct on this machine, or ecofde on the designated network node')
    parser.add_argument('--scenes', nargs='+', choices=SCENES, default=SCENES)
    parser.add_argument('--receipt', type=pathlib.Path, help='New output receipt, required for all actions except plan')
    args = parser.parse_args()
    require(len(set(args.scenes)) == len(args.scenes), 'Duplicate scene arguments')
    originals, models, subsets, by_scene = load_locks(args.manifest_dir, set(args.scenes))
    if args.action == 'plan':
        print(json.dumps({'models': len(models), 'expectedBytes': sum(e['bytes'] for e in models),
                          'missing': [e['relative_path'] for e in models if not safe_path(args.data_dir, e['relative_path']).is_file()],
                          'networkUsed': False, 'modelBytesRead': 0}, indent=2))
        return
    require(args.receipt is not None and not args.receipt.exists(), 'An unused --receipt path is required')
    require(not args.data_dir.is_symlink(), 'Pass the explicit real data directory; never mutate through the frozen workspace symlink')
    require(args.receipt.resolve() not in {p.resolve() for p in args.manifest_dir.glob('*.json')}, 'Receipt cannot overwrite locked manifests')
    if args.action != 'verify':
        args.data_dir.mkdir(parents=True, exist_ok=True)
    if args.action == 'fetch-originals':
        validate_network_mode(args.network_node)
        fetch_originals(args.data_dir, args.manifest_dir, originals)
    elif args.action == 'import-existing':
        require(args.source_dir is not None, '--source-dir is required')
        import_models(args.source_dir, args.data_dir, models)
    elif args.action == 'rebuild-subsets':
        rebuild_subsets(args.data_dir, subsets, by_scene)
    checked = [verified(safe_path(args.data_dir, e['relative_path']), e)
               for e in (originals if args.action == 'fetch-originals' else models)]
    receipt = {'schema': 'mac-locked-asset-restore-v1', 'passed': True, 'action': args.action,
               'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'hostname': socket.gethostname(), 'platform': platform.system(),
               'networkNode': args.network_node if args.action == 'fetch-originals' else None,
               'networkUsed': args.action == 'fetch-originals', 'modelsVerified': len(models) if args.action != 'fetch-originals' else len(args.scenes),
               'all52ModelsVerified': args.action != 'fetch-originals' and len(models) == 52,
               'lockedManifestHashes': {p.name: digest(p) for p in
                   [args.manifest_dir / 'manifest.json', args.manifest_dir / 'subsets-manifest.json']},
               'dataDirectory': str(args.data_dir.resolve()), 'files': checked,
               'policy': 'Expected bytes and SHA256 come exclusively from locked input manifests; no new baseline hashes or manifests are written.'}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'passed': True, 'checkedFiles': len(checked), 'receipt': str(args.receipt)}))


if __name__ == '__main__':
    main()
