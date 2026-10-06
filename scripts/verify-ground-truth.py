#!/usr/bin/env python3
"""Verify reusable prepared GT without copying images or using torch/GPU."""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import struct
from portable_common import REPO, read, save, sha


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def validate_pixel_lock(lock, selection, selection_path, policy_path):
    """Bind this reusable GT whitelist to the frozen source/camera protocol."""
    policy = read(policy_path)
    if (lock.get('schema') != 'portable-ground-truth-pixels-lock-v1' or
            lock.get('complete') is not True or lock.get('images') != 378 or
            lock.get('selection_file_sha256') != sha(selection_path) or
            lock.get('selection_sha256') != canonical_sha(selection) or
            lock.get('source_resolution_policy_sha256') != sha(policy_path) or
            policy.get('complete') is not True or
            lock.get('source_entries_sha256') != policy['source_entries_sha256'] or
            lock.get('entries_sha256') != canonical_sha(lock['entries'])):
        raise ValueError('Prepared GT pixel lock differs from frozen camera/source policy')
    entries = lock['entries']
    lookup = {(e['scene'], e['camera_index']): e for e in entries}
    expected = {(s['scene'], i): (c['img_name'], s['camera_sha256'])
                for s in selection['scenes'] for i, c in enumerate(s['cameras'])}
    if (len(entries) != 378 or len(lookup) != 378 or set(lookup) != set(expected) or
            any((e['img_name'], e['camera_sha256']) != expected[key]
                for key, e in lookup.items())):
        raise ValueError('Prepared GT pixel lock camera coverage differs')
    return lookup


def validate_manifest_identities(manifest, transform, selection_sha, locked):
    """Reject changed source/pixel identities before opening any image files."""
    if not manifest['complete'] or manifest['selection_sha256'] != selection_sha:
        raise ValueError('GT is incomplete or uses a different fixed camera selection')
    if manifest.get('transform') != transform:
        raise ValueError('Prepared GT uses a different fixed image transform or Pillow version')
    entries = manifest['entries']
    seen = set()
    for entry in entries:
        key = (entry['scene'], entry['camera_index'])
        if key in seen or key not in locked:
            raise ValueError('Duplicate or mismatched GT camera/image identity')
        for field, expected in locked[key].items():
            if entry.get(field) != expected:
                raise ValueError(f'Prepared GT fixed source/pixel identity differs: {key}: {field}')
        seen.add(key)
    if seen != set(locked) or len(entries) != 378:
        raise ValueError('Expected all 378 GT images')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ground-truth-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    selection_path = REPO / 'quality/selection.json'
    selection = read(selection_path)
    policy_path = REPO / 'quality/source-resolution-policy.json'
    lock_path = REPO / 'scripts/ground-truth-pixels-lock.json'
    lock = read(lock_path)
    locked = validate_pixel_lock(lock, selection, selection_path, policy_path)
    manifest_path = args.ground_truth_root / 'ground-truth-manifest.json'
    manifest = read(manifest_path)
    selection_sha = canonical_sha(selection)
    transform = dict(width=1280, height=720, channels='RGB', sample_type='uint8',
                     color='encoded RGB as stored; no radiometric linearization or exposure correction',
                     resize='Pillow BICUBIC; independent x/y; no crop/pad; no EXIF transpose',
                     source_resolution_policy_sha256=sha(policy_path),
                     source_resolution_note='Official truck/train images are979x546/980x545, about half calibration size, and are upsampled to1280x720; all source sizes are retained per view',
                     pillow_version='11.3.0', alpha='source photographs converted to RGB')
    if lock['transform'] != transform:
        raise ValueError('Prepared GT pixel lock transform differs')
    validate_manifest_identities(manifest, transform, selection_sha, locked)
    from PIL import Image, __version__ as pillow_version
    if pillow_version != '11.3.0':
        raise ValueError('Use pinned Pillow11.3.0 for prepared GT pixel verification')
    entries = manifest['entries']
    seen = set()
    gt_root = args.ground_truth_root.resolve()
    for entry in entries:
        key = (entry['scene'], entry['camera_index'])
        relative = Path(entry['relative_path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe GT relative path')
        image_path = args.ground_truth_root / relative
        if not image_path.resolve().is_relative_to(gt_root):
            raise ValueError('GT image path escapes explicit ground-truth root')
        if sha(image_path) != entry['sha256']:
            raise ValueError('Prepared GT bytes differ: ' + str(image_path))
        with image_path.open('rb') as stream:
            header = stream.read(26)
        if (header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR' or
                struct.unpack('>II', header[16:24]) != (1280, 720) or header[24:26] != b'\x08\x02'):
            raise ValueError('Expected 1280x720 RGB8 prepared PNG: ' + str(image_path))
        with Image.open(image_path) as image:
            image.load()
            if image.mode != 'RGB' or image.size != (1280, 720):
                raise ValueError('Prepared GT decoded mode/dimensions differ: ' + str(image_path))
            if hashlib.sha256(image.tobytes()).hexdigest() != locked[key]['rgb8_sha256']:
                raise ValueError('Prepared GT decoded pixels differ from fixed reference: ' + str(image_path))
        seen.add(key)
    if seen != set(locked) or len(seen) != 378:
        raise ValueError('Expected all 378 GT images')
    save(args.output, dict(schema='portable-prepared-ground-truth-verification-v1', complete=True,
         checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), images=len(seen),
         selectionFileSha256=sha(selection_path), selectionSha256=selection_sha,
         groundTruthManifestSha256=sha(manifest_path), transform=manifest['transform'],
         fixedPixelLockSha256=sha(lock_path), fixedPixelEntriesSha256=lock['entries_sha256'],
         sourceResolutionPolicySha256=sha(policy_path), sourceEntriesSha256=lock['source_entries_sha256'],
         allDecodedPixelHashesMatched=True, pillowVersion=pillow_version,
         gpuWorkPerformed=False))
    print('Verified all 378 prepared GT file hashes, fixed RGB pixel/source hashes and camera identities')


if __name__ == '__main__':
    main()
