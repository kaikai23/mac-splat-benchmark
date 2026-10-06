"""Standard-library helpers. No import-time network or GPU work."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess

REPO = Path(__file__).resolve().parents[1]


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def resolve(value):
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (REPO / path).resolve()


def command(args):
    result = subprocess.run(args, text=True, capture_output=True, check=False)
    return dict(command=args, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr)


def find_chrome(explicit=None):
    candidates = [explicit, os.environ.get('CHROME_PATH'),
                  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                  str(Path.home() / 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')]
    for value in candidates:
        if value and Path(value).expanduser().is_file():
            return Path(value).expanduser().resolve()
    raise FileNotFoundError('Install an Apple Silicon Chrome build or pass --chrome with its executable path')


def locked_models():
    lock = read(REPO / 'config/data-lock.json')
    for item in lock['manifests']:
        if sha(REPO / item['path']) != item['sha256']:
            raise ValueError('Repository data lock changed: ' + item['path'])
    manifest = read(REPO / 'config/data/manifest.json')
    subsets = read(REPO / 'config/data/subsets-manifest.json')
    models = [dict(s['ply'], scene=s['scene'], stride=1) for s in manifest['scenes']]
    models += subsets['subsets']
    if len(models) != 52 or len({(m['scene'], m['stride']) for m in models}) != 52:
        raise ValueError('Expected 52 unique fixed models')
    for item in lock['cameras']:
        p = REPO / item['path']
        if sha(p) != item['sha256'] or len(read(p)) != item['views']:
            raise ValueError('Frozen heldout camera file changed: ' + item['scene'])
    if sum(c['views'] for c in lock['cameras']) != 378:
        raise ValueError('Expected 378 fixed heldout camera views')
    return models, lock


def verify_models(data_root):
    models, lock = locked_models()
    root = Path(data_root).resolve()
    result = []
    for item in models:
        relative = Path(item['relative_path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe locked relative model path')
        path = root / relative
        if not path.is_file() or path.stat().st_size != item['bytes']:
            raise ValueError('Missing or wrong-sized model: ' + str(path))
        actual = sha(path)
        if actual != item['sha256']:
            raise ValueError('Model SHA mismatch; preserve the file before repair: ' + str(path))
        result.append(dict(scene=item['scene'], stride=item['stride'], relative_path=item['relative_path'],
                           bytes=item['bytes'], sha256=actual, gaussian_count=item['gaussian_count']))
        print('Verified', item['relative_path'], flush=True)
    return result, lock
