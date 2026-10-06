"""Verify official source photos and prepare RGB8 ground truth at 1280x720."""
from __future__ import annotations
import argparse, hashlib, json, pathlib, sys
from PIL import Image, __version__ as pillow_version
from acquire_ground_truth import save, stamp


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', type=pathlib.Path, required=True)
    ap.add_argument('--selection', type=pathlib.Path, required=True)
    ap.add_argument('--source-resolution-policy', type=pathlib.Path,
                    default=pathlib.Path(__file__).with_name('source-resolution-policy.json'))
    ap.add_argument('--output', type=pathlib.Path, required=True)
    args = ap.parse_args()
    source_manifest = args.source / 'source-manifest.json'
    manifest = json.loads(source_manifest.read_text())
    selection = json.loads(args.selection.read_text())
    selection_sha = hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
    if manifest['selection_sha256'] != selection_sha:
        raise ValueError('GT sources belong to a different camera/image-folder selection')
    resolution_policy = json.loads(args.source_resolution_policy.read_text())
    source_entries_sha = hashlib.sha256(json.dumps(manifest['entries'], sort_keys=True).encode()).hexdigest()
    if not resolution_policy['complete'] or resolution_policy['source_entries_sha256'] != source_entries_sha:
        raise ValueError('Source resolution policy belongs to different/unverified photos')
    resolution_scenes = {s['scene']: s for s in resolution_policy['scenes']}
    if set(resolution_scenes) != {s['scene'] for s in selection['scenes']}:
        raise ValueError('Source resolution policy scene coverage differs')
    cameras = {(s['scene'], i): (c, s) for s in selection['scenes'] for i, c in enumerate(s['cameras'])}
    expected = set(cameras)
    entries = manifest['entries']
    if not manifest['complete'] or {(e['scene'], e['camera_index']) for e in entries} != expected or len(entries) != len(expected):
        raise ValueError('Incomplete/duplicate GT source coverage')
    transform = dict(width=1280, height=720, channels='RGB', sample_type='uint8',
                     color='encoded RGB as stored; no radiometric linearization or exposure correction',
                     resize='Pillow BICUBIC; independent x/y; no crop/pad; no EXIF transpose',
                     source_resolution_policy_sha256=sha(args.source_resolution_policy),
                     source_resolution_note='Official truck/train images are979x546/980x545, about half calibration size, and are upsampled to1280x720; all source sizes are retained per view',
                     pillow_version=pillow_version, alpha='source photographs converted to RGB')
    manifest_path = args.output / 'ground-truth-manifest.json'
    existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    previous = {}
    if existing:
        if (not existing['complete'] or existing['selection_sha256'] != selection_sha or
            existing['source_manifest_sha256'] != sha(source_manifest) or existing['transform'] != transform):
            raise ValueError('Prepared GT protocol/source changed; choose a new output directory')
        previous = {(e['scene'], e['camera_index']): e for e in existing['entries']}
        if len(existing['entries']) != len(expected) or set(previous) != expected:
            raise ValueError('Existing prepared GT contains duplicate/missing cameras')
    records = []
    for entry in entries:
        key = entry['scene'], entry['camera_index']
        camera, scene = cameras[key]
        path = args.source / entry['relative_path']
        if sha(path) != entry['sha256'] or path.stat().st_size != entry['bytes']:
            raise ValueError(f'Source image bytes changed: {path}')
        if entry['img_name'] != camera['img_name']:
            raise ValueError('GT camera name mismatch')
        relative = f"rgb1280/{entry['scene']}/{camera['img_name']}.png"
        if existing:
            old = previous[key]
            if (old['relative_path'] != relative or old['source_sha256'] != entry['sha256'] or
                old['source_member'] != entry['member'] or old['camera_sha256'] != scene['camera_sha256'] or
                old['img_name'] != camera['img_name'] or sha(args.output / relative) != old['sha256']):
                raise ValueError('Existing GT evidence changed; refusing to silently overwrite')
            records.append(old)
            continue
        with Image.open(path) as image:
            image.load()
            original_size = image.size
            resolution = resolution_scenes[entry['scene']]
            if list(original_size) != resolution['source_dimensions'] or scene['image_dir'] != resolution['image_dir']:
                raise ValueError('Source photo/image-folder differs from verified resolution policy')
            divisor = resolution['calibration_nominal_divisor']
            if any(abs(actual - native / divisor) > 1.1 for actual, native in
                   zip(original_size, [camera['width'], camera['height']])):
                raise ValueError(f'Source resolution differs from cfg_args/camera: {path}: {original_size}')
            rgb = image.convert('RGB')
            # Independent x/y resize exactly follows the shared camera projection.
            resized = rgb.resize((1280, 720), resample=Image.Resampling.BICUBIC)
            dest = args.output / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            resized.save(dest, compress_level=6)
            pixels_sha256 = hashlib.sha256(resized.tobytes()).hexdigest()
        records.append(dict(scene=entry['scene'], camera_index=entry['camera_index'],
                            img_name=camera['img_name'], relative_path=relative,
                            sha256=sha(dest), rgb8_sha256=pixels_sha256,
                            source_sha256=entry['sha256'], source_member=entry['member'],
                            source_size=list(original_size), calibration_nominal_divisor=divisor,
                            camera_sha256=scene['camera_sha256']))
    if existing:
        print(json.dumps(dict(complete=True, images=len(records), output=str(args.output), existing_verified=True)))
        return
    save(manifest_path, dict(
        schema='mac-ground-truth-rgb1280-v1', complete=True, created_at=stamp(),
        selection_sha256=selection_sha, selection_file_sha256=sha(args.selection),
        source_manifest_sha256=sha(source_manifest), entries=records,
        transform=transform,
        camera_selection='lexical image-name sort, every eighth source image; exact archived 378 heldout cameras'))
    print(json.dumps(dict(complete=True, images=len(records), output=str(args.output))))


if __name__ == '__main__': main()
