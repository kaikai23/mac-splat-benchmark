"""Mac analysis contracts; no Windows measurements are inputs by default."""
from __future__ import annotations
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENES = ('bicycle', 'flowers', 'garden', 'stump', 'treehill', 'room', 'counter',
          'kitchen', 'bonsai', 'drjohnson', 'playroom', 'truck', 'train')
STRIDES = (1, 2, 4, 8)
METHODS = ('visionary', 'spark', 'supersplat')
LABELS = {'visionary': 'Visionary 1.0.1', 'spark': 'Spark.js 0.1.10 (native)', 'supersplat': 'SuperSplat Editor 2.1.0'}
COMMITS = {'visionary': 'e50f3f6c7200be0516567f0830e5240dfa26d27d',
           'spark': '792d6d193db8b79ed4d1f32ef65cca9ec93f0896',
           'supersplat': '2f23b4b2072da694172faa26ff44fc67f2a01ca2'}
BOUNDARIES = {
    'visionary': 'GPU prep-through-draw timestamp span including gaps',
    'spark': 'GPU prep + independent GPU depth-key metric + native CPU WASM sort + GPU draw including native ordering buffer upload; depth readback, CPU ordering-attribute update and RPC excluded',
    'supersplat': 'CPU bounds/key/histogram + prefix/scatter + front-count/mapping + GPU fused prep/draw including order upload and clear + output blit; RPC excluded',
}
STAGES = ('cpu_key_generation_histogram_ms', 'cpu_sort_ms',
          'cpu_postprocess_ms', 'gpu_prep_ms', 'gpu_sort_ms', 'gpu_draw_ms', 'gpu_blit_ms',
          'gpu_depth_metric_ms', 'gpu_total_ms', 'sync_wall_ms', 'query_ready_wall_ms', 'visionary_stage_sum_ms')

def require(condition, message):
    if not condition:
        raise ValueError(message)

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def resolved(path, root=ROOT):
    require(isinstance(path, (str, Path)) and '\\' not in str(path), 'Expected a Mac path, not a Windows source path')
    p = Path(path)
    return (p if p.is_absolute() else root / p).resolve()

def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')

def write_csv(path, rows):
    fields = list(dict.fromkeys(k for row in rows for k in row))
    with Path(path).open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def now():
    return datetime.now(timezone.utc).isoformat()

def timestamp(value):
    t = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(t.tzinfo is not None, 'Collection time must have a timezone')
    return t

def number(mapping, key, positive=False):
    value = mapping.get(key)
    require(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
            and value >= 0 and (not positive or value > 0), f'{key} must be finite and nonnegative')
    return value

def equal(actual, expected, label):
    require(math.isclose(actual, expected, rel_tol=1e-8, abs_tol=1e-6), f'{label} differs from its components')

def nonfinite(value):
    if isinstance(value, float):
        return not math.isfinite(value)
    if isinstance(value, dict):
        return any(nonfinite(v) for v in value.values())
    if isinstance(value, list):
        return any(nonfinite(v) for v in value)
    return False
