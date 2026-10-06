#!/usr/bin/env python3
"""Download exact locked dependencies on ecofde, never on the measurement Mac."""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import urllib.request
from portable_common import REPO, read, save, sha

VGG_SHA = '397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0'


def download(url, path, expected_sha=None, integrity=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    def valid(candidate):
        if not candidate.is_file():
            return False
        if expected_sha:
            return sha(candidate) == expected_sha
        algorithm, digest = integrity.split('-', 1)
        return base64.b64encode(hashlib.new(algorithm, candidate.read_bytes()).digest()).decode() == digest
    if path.exists():
        if not valid(path):
            raise ValueError('Existing artifact has wrong hash; preserve before repair: ' + str(path))
        return
    temporary = path.with_suffix(path.suffix + '.partial')
    request = urllib.request.Request(url, headers={'User-Agent': 'portable-mac-repro/1'})
    with urllib.request.urlopen(request, timeout=90) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if not valid(temporary):
        raise ValueError('Downloaded artifact hash mismatch: ' + url)
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network-node', choices=['ecofde'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--npm-only', action='store_true')
    parser.add_argument('--with-vgg', action='store_true')
    args = parser.parse_args()
    if platform.system() == 'Darwin':
        raise RuntimeError('Run this download command through ssh ecofde; install offline on the Mac')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1', npm_config_audit='false', npm_config_fund='false')
    tarballs = {}
    for relative in ['package-lock.json', 'work/bench/package-lock.json']:
        lock = read(REPO / relative)
        for entry in lock['packages'].values():
            url, integrity = entry.get('resolved'), entry.get('integrity')
            if url and integrity:
                if not url.startswith('https://registry.npmjs.org/'):
                    raise ValueError('Unexpected package registry URL: ' + url)
                if url in tarballs and tarballs[url] != integrity:
                    raise ValueError('Conflicting dependency integrity')
                tarballs[url] = integrity
    for number, (url, integrity) in enumerate(sorted(tarballs.items()), 1):
        artifact = output / 'npm-tarballs' / (hashlib.sha256(url.encode()).hexdigest() + '.tgz')
        download(url, artifact, integrity=integrity)
        subprocess.run(['npm', 'cache', 'add', str(artifact), '--cache', str(output / 'npm-cache'),
                        '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], check=True, env=env)
        print(f'Cached npm artifact {number}/{len(tarballs)}', flush=True)
    wheel_records = []
    if not args.npm_only:
        for entry in read(REPO / 'config/python-wheels.lock.json')['wheels']:
            distribution, version = entry['file'].split('-')[:2]
            with urllib.request.urlopen(f'https://pypi.org/pypi/{distribution}/{version}/json', timeout=60) as response:
                metadata = json.load(response)
            matches = [item for item in metadata['urls'] if item['filename'] == entry['file']]
            if len(matches) != 1 or matches[0]['digests']['sha256'] != entry['sha256']:
                raise ValueError('PyPI metadata differs from the pinned wheel: ' + entry['file'])
            target = output / 'python-wheels' / entry['file']
            download(matches[0]['url'], target, expected_sha=entry['sha256'])
            if target.stat().st_size != entry['bytes']:
                raise ValueError('Wheel byte length differs')
            wheel_records.append(entry)
            print('Downloaded locked wheel', entry['file'], flush=True)
    if args.with_vgg:
        download('https://download.pytorch.org/models/vgg16-397923af.pth',
                 output / 'torch/hub/checkpoints/vgg16-397923af.pth', expected_sha=VGG_SHA)
    save(output / 'dependency-cache-receipt.json', dict(schema='portable-offline-dependency-cache-v1', complete=True,
         networkNode='ecofde', npmArtifacts=len(tarballs), pythonWheels=wheel_records,
         npmLocks={name: sha(REPO / name) for name in ['package-lock.json', 'work/bench/package-lock.json']},
         pythonWheelLockSha256=sha(REPO / 'config/python-wheels.lock.json'),
         vggSha256=VGG_SHA if args.with_vgg else None))
    print('Transfer this cache directory to the Mac; do not commit it to Git:', output)


if __name__ == '__main__':
    main()
