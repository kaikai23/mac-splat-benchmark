#!/usr/bin/env python3
"""Download locked dependencies with explicit direct or ecofde network mode."""
from __future__ import annotations
import argparse
import base64
import hashlib
import http.client
import json
import os
from pathlib import Path
import platform
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from portable_common import REPO, read, save, sha

VGG_SHA = '397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0'
VGG_BYTES = 553433881
NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException, ssl.SSLError)


def validate_network_mode(mode, system=None):
    if mode not in ('direct', 'ecofde'):
        raise ValueError('Choose an explicit --network-node direct or ecofde')
    if mode == 'ecofde' and (system or platform.system()) == 'Darwin':
        raise RuntimeError('Use ssh ecofde for --network-node ecofde, or explicitly select --network-node direct on this Mac')


def official_url(url, metadata=False):
    parsed = urllib.parse.urlparse(url)
    hosts = {'pypi.org'} if metadata else {'registry.npmjs.org', 'files.pythonhosted.org', 'download.pytorch.org'}
    if parsed.scheme != 'https' or parsed.hostname not in hosts or parsed.username or parsed.password:
        raise ValueError('Unexpected dependency source: ' + url)


def valid_artifact(path, expected_sha=None, integrity=None, expected_bytes=None):
    if path.is_symlink() or not path.is_file() or (expected_bytes is not None and path.stat().st_size != expected_bytes):
        return False
    if expected_sha:
        return sha(path) == expected_sha
    algorithm, expected = integrity.split('-', 1)
    digest = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return base64.b64encode(digest.digest()).decode() == expected


def publish_verified(temporary, path, valid):
    # Link publication is atomic and cannot overwrite a concurrently created file.
    try:
        os.link(temporary, path)
    except FileExistsError:
        if not valid(path):
            raise ValueError('Artifact destination appeared with different bytes: ' + str(path))
    temporary.unlink()


def retryable(error):
    return not isinstance(error, urllib.error.HTTPError) or error.code in (408, 429, 500, 502, 503, 504)


def download(url, path, expected_sha=None, integrity=None, expected_bytes=None, attempts=3):
    """Reuse verified bytes, resume interrupted HTTPS ranges, publish only on hash match.

    Final cache files are never replaced. A completed but hash-invalid temporary
    download is preserved as .rejected-<id> for inspection; a later call starts
    afresh. Incomplete transfers retain their prefix for a bounded retry.
    """
    official_url(url)
    if bool(expected_sha) == bool(integrity) or attempts < 1:
        raise ValueError('Exactly one locked hash/integrity and a positive attempt count are required')
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    maximum = expected_bytes if expected_bytes is not None else 1024 ** 3
    valid = lambda p: valid_artifact(p, expected_sha, integrity, expected_bytes)
    if path.is_symlink():
        raise ValueError('Artifact destination cannot be a symlink: ' + str(path))
    if path.exists():
        if not valid(path):
            raise ValueError('Existing artifact has wrong hash; preserve before repair: ' + str(path))
        return 'reused'
    temporary = path.with_suffix(path.suffix + '.partial')
    if temporary.is_symlink() or (temporary.exists() and not temporary.is_file()):
        raise ValueError('Download scratch must be a regular file: ' + str(temporary))
    if temporary.exists() and valid(temporary):
        publish_verified(temporary, path, valid)
        return 'reused-complete-partial'
    if temporary.exists() and temporary.stat().st_size >= maximum:
        temporary.rename(temporary.with_name(temporary.name + '.rejected-' + uuid.uuid4().hex))
    for attempt in range(attempts):
        offset = temporary.stat().st_size if temporary.exists() else 0
        headers = {'User-Agent': 'portable-mac-repro/1', 'Accept-Encoding': 'identity'}
        if offset:
            headers['Range'] = f'bytes={offset}-'
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                status = response.status
                length = response.headers.get('Content-Length')
                if status == 206:
                    match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
                    if not match:
                        raise ValueError('Missing/invalid dependency Content-Range')
                    start, end, total = map(int, match.groups())
                    if start != offset or end != total - 1 or total > maximum or (expected_bytes is not None and total != expected_bytes):
                        raise ValueError('Dependency response range differs from its requested/locked bounds')
                    response_bytes = total - offset
                    mode = 'ab' if offset else 'wb'
                elif status == 200:
                    # A server may ignore Range. Restart owned scratch, never append a full response.
                    offset, mode = 0, 'wb'
                    response_bytes = int(length) if length is not None else None
                else:
                    raise ValueError('Expected HTTP 200/206 for dependency download')
                if length is not None and (int(length) < 0 or int(length) > maximum - offset or
                                           (response_bytes is not None and int(length) != response_bytes)):
                    raise ValueError('Dependency Content-Length exceeds/differs from the permitted response')
                received = 0
                with temporary.open(mode) as output:
                    while chunk := response.read(1024 * 1024):
                        received += len(chunk)
                        if offset + received > maximum:
                            raise ValueError('Dependency transfer exceeds its size bound')
                        output.write(chunk)
                    output.flush()
                if response_bytes is not None and received != response_bytes:
                    raise urllib.error.URLError('Dependency response ended before its declared length')
            if not valid(temporary):
                rejected = temporary.with_name(temporary.name + '.rejected-' + uuid.uuid4().hex)
                temporary.rename(rejected)
                raise ValueError('Downloaded artifact hash/size mismatch; preserved ' + str(rejected))
            publish_verified(temporary, path, valid)
            return 'downloaded'
        except NETWORK_ERRORS as error:
            if attempt + 1 == attempts or not retryable(error):
                raise
            time.sleep(min(2 ** attempt, 4))


def locked_wheel_url(entry):
    """Resolve one exact wheel on the official PyPI API, retaining local lock authority."""
    distribution, version = entry['file'].split('-')[:2]
    url = f'https://pypi.org/pypi/{distribution}/{version}/json'
    official_url(url, metadata=True)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                payload = response.read(8 * 1024 * 1024 + 1)
                if len(payload) > 8 * 1024 * 1024:
                    raise ValueError('Oversized PyPI metadata response')
                metadata = json.loads(payload)
            break
        except NETWORK_ERRORS as error:
            if attempt == 2 or not retryable(error):
                raise
            time.sleep(min(2 ** attempt, 4))
    matches = [item for item in metadata['urls'] if item['filename'] == entry['file']]
    if len(matches) != 1 or matches[0]['digests']['sha256'] != entry['sha256'] or matches[0]['size'] != entry['bytes']:
        raise ValueError('PyPI metadata differs from the pinned wheel: ' + entry['file'])
    official_url(matches[0]['url'])
    return matches[0]['url']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network-node', choices=['direct', 'ecofde'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--npm-only', action='store_true')
    parser.add_argument('--with-vgg', action='store_true')
    args = parser.parse_args()
    validate_network_mode(args.network_node)
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
            target = output / 'python-wheels' / entry['file']
            if target.exists() or target.is_symlink():
                if not valid_artifact(target, expected_sha=entry['sha256'], expected_bytes=entry['bytes']):
                    raise ValueError('Existing wheel has wrong hash/size; preserve before repair: ' + str(target))
            else:
                download(locked_wheel_url(entry), target, expected_sha=entry['sha256'], expected_bytes=entry['bytes'])
            wheel_records.append(entry)
            print('Verified locked wheel', entry['file'], flush=True)
    if args.with_vgg:
        download('https://download.pytorch.org/models/vgg16-397923af.pth',
                 output / 'torch/hub/checkpoints/vgg16-397923af.pth', expected_sha=VGG_SHA, expected_bytes=VGG_BYTES)
    save(output / 'dependency-cache-receipt.json', dict(schema='portable-offline-dependency-cache-v1', complete=True,
         networkNode=args.network_node, npmArtifacts=len(tarballs), pythonWheels=wheel_records,
         npmLocks={name: sha(REPO / name) for name in ['package-lock.json', 'work/bench/package-lock.json']},
         pythonWheelLockSha256=sha(REPO / 'config/python-wheels.lock.json'),
         vggSha256=VGG_SHA if args.with_vgg else None))
    print('Locked cache ready for offline installation on the target Mac; do not commit it to Git:', output)


if __name__ == '__main__':
    main()
