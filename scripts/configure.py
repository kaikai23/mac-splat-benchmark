#!/usr/bin/env python3
"""Create ignored machine-local paths; verify copied model bytes by default."""
from __future__ import annotations
import argparse
import datetime
import json
import os
from pathlib import Path
import sys
from portable_common import REPO, find_chrome, locked_models, resolve, save, sha, verify_models


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-root', required=True)
    parser.add_argument('--ground-truth-root')
    parser.add_argument('--chrome')
    parser.add_argument('--output-root', default='results')
    parser.add_argument('--pilot-output', help='A complete 12-configuration pilot required before full; defaults to OUTPUT_ROOT/pilot')
    parser.add_argument('--python', default='.venv/bin/python')
    parser.add_argument('--torch-home', default='.cache/torch')
    parser.add_argument('--config', default='config/local.json')
    parser.add_argument('--paths-only', action='store_true', help='Configure paths without reading 18.5GB; runner still requires full validation before GPU work')
    parser.add_argument('--no-overwrite', action='store_true', help='Create a new config exclusively; refuse any existing file')
    args = parser.parse_args()
    if sys.version_info < (3, 10):
        raise RuntimeError('Use Python 3.12 for installation/quality; these setup helpers require at least Python 3.10')
    data_root = resolve(args.data_root)
    if not data_root.is_dir():
        raise FileNotFoundError(data_root)
    chrome = find_chrome(args.chrome)
    output_root = resolve(args.output_root)
    # Dereferencing a venv's bin/python symlink bypasses its pyvenv.cfg and packages.
    python_executable = os.path.abspath(REPO / Path(args.python).expanduser())
    config = dict(dataRoot=str(data_root), cameraRoot=str(REPO / 'config/cameras'),
                  groundTruthRoot=str(resolve(args.ground_truth_root)) if args.ground_truth_root else None,
                  chromeExecutable=str(chrome), outputRoot=str(output_root),
                  pilotOutput=str(resolve(args.pilot_output)) if args.pilot_output else str(output_root / 'pilot'),
                  pythonExecutable=python_executable, torchHome=str(resolve(args.torch_home)))
    if args.paths_only:
        locked_models()
        config['dataVerificationReceipt'] = None
    else:
        models, lock = verify_models(data_root)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        receipt_path = output_root / 'setup' / ('data-verification-' + stamp + '.json')
        save(receipt_path, dict(schema='portable-data-verification-v1', complete=True,
             checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), dataRoot=str(data_root),
             models=models, cameras=lock['cameras'], dataLockSha256=sha(REPO / 'config/data-lock.json')))
        config['dataVerificationReceipt'] = str(receipt_path)
    target = resolve(args.config)
    if target.parent != REPO / 'config' or not target.name.startswith('local') or target.suffix != '.json':
        raise ValueError('Machine paths must be written to an ignored config/local*.json file')
    if args.no_overwrite:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('x') as stream:
            json.dump(config, stream, indent=2)
            stream.write('\n')
    else:
        save(target, config)
    print('Wrote', target)
    print('Model verification:', 'deferred to runner preflight' if args.paths_only else 'all 52 SHA256 passed')


if __name__ == '__main__':
    main()
