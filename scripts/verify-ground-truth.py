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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ground-truth-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    selection_path = REPO / 'quality/selection.json'
    selection = read(selection_path)
    expected = {(s['scene'], i): (c['img_name'], s['camera_sha256'])
                for s in selection['scenes'] for i, c in enumerate(s['cameras'])}
    manifest_path = args.ground_truth_root / 'ground-truth-manifest.json'
    manifest = read(manifest_path)
    selection_sha = hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
    if not manifest['complete'] or manifest['selection_sha256'] != selection_sha:
        raise ValueError('GT is incomplete or uses a different fixed camera selection')
    transform = dict(width=1280, height=720, channels='RGB', sample_type='uint8',
                     color='encoded RGB as stored; no radiometric linearization or exposure correction',
                     resize='Pillow BICUBIC; independent x/y; no crop/pad; no EXIF transpose',
                     source_resolution_policy_sha256=sha(REPO / 'quality/source-resolution-policy.json'),
                     source_resolution_note='Official truck/train images are979x546/980x545, about half calibration size, and are upsampled to1280x720; all source sizes are retained per view',
                     pillow_version='11.3.0', alpha='source photographs converted to RGB')
    if manifest.get('transform') != transform:
        raise ValueError('Prepared GT uses a different fixed image transform or Pillow version')
    entries = manifest['entries']
    seen = set()
    for entry in entries:
        key = (entry['scene'], entry['camera_index'])
        if key in seen or key not in expected or (entry['img_name'], entry['camera_sha256']) != expected[key]:
            raise ValueError('Duplicate or mismatched GT camera/image identity')
        relative = Path(entry['relative_path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe GT relative path')
        image_path = args.ground_truth_root / relative
        if sha(image_path) != entry['sha256']:
            raise ValueError('Prepared GT bytes differ: ' + str(image_path))
        with image_path.open('rb') as stream:
            header = stream.read(26)
        if (header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR' or
                struct.unpack('>II', header[16:24]) != (1280, 720) or header[24:26] != b'\x08\x02'):
            raise ValueError('Expected 1280x720 RGB8 prepared PNG: ' + str(image_path))
        seen.add(key)
    if seen != set(expected) or len(seen) != 378:
        raise ValueError('Expected all 378 GT images')
    save(args.output, dict(schema='portable-prepared-ground-truth-verification-v1', complete=True,
         checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), images=len(seen),
         selectionFileSha256=sha(selection_path), selectionSha256=selection_sha,
         groundTruthManifestSha256=sha(manifest_path), transform=manifest['transform'],
         gpuWorkPerformed=False))
    print('Verified all 378 prepared GT image hashes and camera identities')


if __name__ == '__main__':
    main()
