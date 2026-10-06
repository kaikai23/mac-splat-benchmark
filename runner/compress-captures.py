"""Compress completed PNG captures to lossless RGB WebP and verify every pixel."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

folder, key = Path(sys.argv[1]), sys.argv[2]
items = []
for source in sorted(folder.glob(key + '-v*.png')):
    with Image.open(source) as image:
        rgb = image.convert('RGB')
        before = rgb.tobytes()
        target = source.with_suffix('.webp')
        rgb.save(target, lossless=True, method=2)
    with Image.open(target) as decoded:
        if decoded.convert('RGB').tobytes() != before:
            raise RuntimeError('Lossless pixel verification failed: ' + str(target))
    items.append({'file': target.name, 'width': rgb.width, 'height': rgb.height,
                  'pixelRgbSha256': hashlib.sha256(before).hexdigest(),
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    source.unlink()
(folder / (key + '-lossless-receipt.json')).write_text(json.dumps(items, indent=2) + '\n')
