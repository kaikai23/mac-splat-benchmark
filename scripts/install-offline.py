#!/usr/bin/env python3
"""Install exact dependencies from a previously downloaded offline cache."""
from __future__ import annotations
import argparse
import datetime
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
from portable_common import REPO, read, save, sha


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--python', default='python3.12')
    parser.add_argument('--node-only', action='store_true')
    args = parser.parse_args()
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise RuntimeError('Install with native arm64 Python on the target Apple Silicon Mac')
    node = shutil.which('node')
    npm = shutil.which('npm')
    if not node or not npm:
        raise FileNotFoundError('Prepare native Apple Silicon Node.js 22 or 24 LTS first')
    info = json.loads(subprocess.check_output([node, '-p', 'JSON.stringify({arch:process.arch,major:Number(process.versions.node.split(".")[0])})'], text=True))
    if info['arch'] != 'arm64' or info['major'] not in [22, 24]:
        raise RuntimeError('Use native arm64 Node.js 22 or 24')
    cache = args.cache.resolve()
    receipt = read(cache / 'dependency-cache-receipt.json')
    if set(receipt['npmLocks']) != {'package-lock.json', 'work/bench/package-lock.json'}:
        raise ValueError('Offline dependency receipt must bind both npm locks')
    for name, expected in receipt['npmLocks'].items():
        if sha(REPO / name) != expected:
            raise ValueError('Offline cache was generated for another npm lock: ' + name)
    env = dict(os.environ, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1', npm_config_offline='true',
               npm_config_audit='false', npm_config_fund='false')
    for folder in [REPO, REPO / 'work/bench']:
        if (folder / 'node_modules').is_symlink():
            raise ValueError('Remove the optional local node_modules symlink before a clean installation: ' + str(folder))
        subprocess.run([npm, 'ci', '--offline', '--cache', str(cache / 'npm-cache'), '--no-audit', '--no-fund'],
                       cwd=folder, env=env, check=True)
    python = None
    if not args.node_only:
        info = json.loads(subprocess.check_output([args.python, '-c',
            'import platform,sys,json;print(json.dumps({"version":list(sys.version_info[:2]),"arch":platform.machine()}))'], text=True))
        if info != dict(version=[3, 12], arch='arm64'):
            raise RuntimeError('Pinned quality wheels require native arm64 Python 3.12')
        lock = read(REPO / 'config/python-wheels.lock.json')
        if receipt['pythonWheelLockSha256'] != sha(REPO / 'config/python-wheels.lock.json'):
            raise ValueError('Offline cache belongs to another Python wheel lock')
        for entry in lock['wheels']:
            wheel = cache / 'python-wheels' / entry['file']
            if not wheel.is_file() or wheel.stat().st_size != entry['bytes'] or sha(wheel) != entry['sha256']:
                raise ValueError('Missing/different locked Python wheel: ' + str(wheel))
        subprocess.run([args.python, '-m', 'venv', str(REPO / '.venv')], check=True)
        python = REPO / '.venv/bin/python'
        subprocess.run([str(python), '-m', 'pip', 'install', '--no-index', '--find-links', str(cache / 'python-wheels'),
                        '-r', str(REPO / 'requirements.txt')], cwd=REPO, check=True)
    target = REPO / 'results/setup/dependency-installation.json'
    save(target, dict(schema='portable-offline-installation-v1', complete=True,
         installedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
         nodeVersion=subprocess.check_output([node, '--version'], text=True).strip(),
         pythonVersion=subprocess.check_output([str(python), '--version'], text=True).strip() if python else None,
         dependencyCacheReceiptSha256=sha(cache / 'dependency-cache-receipt.json'),
         networkAccessDuringInstallation=False, gpuWorkPerformed=False))
    print('Offline installation complete. Configure data/Chrome paths next.')


if __name__ == '__main__':
    main()
