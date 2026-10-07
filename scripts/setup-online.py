#!/usr/bin/env python3
"""Prepare this benchmark on an Apple Silicon Mac using pinned official downloads.

Downloads, installation, model subsets and reference images run serially. This
command never starts a renderer, GPU probe, pilot, or benchmark measurement.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import selectors
import shlex
import shutil
import signal
import subprocess
import sys
import time
import uuid

from portable_common import REPO, find_chrome, read, resolve, save, sha


def require(condition, message):
    if not condition:
        raise ValueError(message)


def configuration(data, cache, output, chrome):
    return dict(dataRoot=str(data / 'models'), cameraRoot=str(REPO / 'config/cameras'),
                groundTruthRoot=str(data / 'ground-truth'), chromeExecutable=str(chrome),
                outputRoot=str(output), pilotOutput=str(output / 'pilot'),
                pythonExecutable=str(REPO / '.venv/bin/python'), torchHome=str(cache / 'torch'))


def check_paths(data, cache, output, config):
    require(config.parent == REPO / 'config' and config.name.startswith('local') and
            config.suffix == '.json', 'Use an ignored config/local*.json file')
    require(output.is_relative_to(REPO / 'results') and output != REPO / 'results',
            '--output-root must be a dedicated directory under repository results/')
    for path in (data, cache, output):
        require(not path.exists() or path.is_dir(), 'Asset/cache/output root already exists as a non-directory')
        require(path != REPO and not REPO.is_relative_to(path), 'Do not use the repository or its ancestor as an asset/output root')
        for folder in ('work', 'runner', 'validation', 'config', 'quality', 'analysis', 'scripts', '.git', '.venv', 'node_modules'):
            require(not path.is_relative_to(REPO / folder), 'Do not write setup assets into tracked source directories')
    require(not data.is_relative_to(cache) and not cache.is_relative_to(data),
            'Data and dependency cache must be separate directories')
    require(not output.is_relative_to(data) and not output.is_relative_to(cache) and
            not data.is_relative_to(output) and not cache.is_relative_to(output),
            'Measurement output must be separate from data and dependency cache')
    require(not (REPO / 'results/gpu-session.lock').exists(),
            'Stop the owned GPU workload and release its lock before setup')
    require(not any((output / p).exists() for p in ('protocol.json', 'pilot/protocol.json', 'formal/protocol.json')),
            'This output already contains measurements; choose a new --output-root')


def check_existing_config(config, expected):
    if config.exists():
        actual = read(config)
        require(all(actual.get(k) == v for k, v in expected.items()),
                'Existing local config points to another experiment; use a new --config config/local-NAME.json')


def steps(python, data, cache, output, config, chrome, receipts):
    def script(path):
        return str(REPO / path)
    quality_python = str(REPO / '.venv/bin/python')
    return [
        ('download-dependencies', [python, script('scripts/fetch-offline-dependencies.py'),
            '--network-node', 'direct', '--output', str(cache), '--with-vgg']),
        ('install-dependencies', [python, script('scripts/install-offline.py'),
            '--cache', str(cache), '--python', python]),
        ('download-original-models', [python, script('scripts/restore-models.py'), 'fetch-originals',
            '--network-node', 'direct', '--manifest-dir', script('config/data'),
            '--data-dir', str(data / 'models'), '--receipt', str(receipts / 'original-models.json')]),
        ('build-and-verify-subsets', [python, script('scripts/restore-models.py'), 'rebuild-subsets',
            '--manifest-dir', script('config/data'), '--data-dir', str(data / 'models'),
            '--receipt', str(receipts / 'all-models.json')]),
        ('download-source-photos', [python, script('quality/acquire_ground_truth.py'),
            '--network-node', 'direct', '--selection', script('quality/selection.json'),
            '--output', str(data / 'gt-source'), '--download', '--max-bytes', '400000000']),
        ('prepare-reference-images', [quality_python, script('quality/prepare_ground_truth.py'),
            '--source', str(data / 'gt-source'), '--selection', script('quality/selection.json'),
            '--output', str(data / 'ground-truth')]),
        ('verify-reference-pixels', [quality_python, script('scripts/verify-ground-truth.py'),
            '--ground-truth-root', str(data / 'ground-truth'),
            '--output', str(receipts / 'ground-truth-verification.json')]),
        ('configure-target-mac', [python, script('scripts/configure.py'),
            '--data-root', str(data / 'models'), '--ground-truth-root', str(data / 'ground-truth'),
            '--chrome', str(chrome), '--output-root', str(output), '--python', quality_python,
            '--torch-home', str(cache / 'torch'), '--config', str(config), '--no-overwrite']),
        ('record-environment', [quality_python, script('scripts/detect-environment.py'),
            '--chrome', str(chrome), '--output', str(receipts / 'environment.json')]),
    ]


def stop_owned_group(child):
    def group_alive():
        child.poll()  # Reap the leader while checking any remaining descendants.
        try:
            os.killpg(child.pid, 0)
            return True
        except ProcessLookupError:
            return False
    if group_alive():
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 2
        while group_alive() and time.monotonic() < deadline:
            time.sleep(.05)
        if group_alive():
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    child.wait()


def execute(command, log):
    # A separate process group lets interruption stop only this setup's children.
    with log.open('x') as stream:
        child = subprocess.Popen(command, cwd=REPO, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, start_new_session=True)
        selector = selectors.DefaultSelector()
        selector.register(child.stdout, selectors.EVENT_READ)
        try:
            while True:
                ready = selector.select(timeout=.2)
                if ready:
                    data = os.read(child.stdout.fileno(), 65536)
                    if not data:
                        break
                    text = data.decode('utf-8', errors='replace')
                    print(text, end='', flush=True)
                    stream.write(text)
                    stream.flush()
                elif child.poll() is not None:
                    break  # An orphaned descendant must not keep the pipe open forever.
            code = child.wait()
            if code:
                raise subprocess.CalledProcessError(code, command)
        finally:
            stop_owned_group(child)
            selector.close()
            child.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-root', required=True, help='Parent of models/, gt-source/, ground-truth/')
    parser.add_argument('--output-root', default='results/my-mac-run')
    parser.add_argument('--cache', default='.cache/online-setup')
    parser.add_argument('--python', default=sys.executable, help='Native arm64 Python3.12 executable')
    parser.add_argument('--chrome')
    parser.add_argument('--config', default='config/local.json')
    parser.add_argument('--plan', action='store_true', help='Print commands without downloads, installation or writes')
    args = parser.parse_args()
    data, cache, output, config = [resolve(v) for v in (args.data_root, args.cache, args.output_root, args.config)]
    check_paths(data, cache, output, config)
    python = shutil.which(args.python) or str(resolve(args.python))
    if args.plan:
        chrome = resolve(args.chrome) if args.chrome else Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        for name, command in steps(python, data, cache, output, config, chrome, output / 'setup/online-ATTEMPT'):
            print(name + ': ' + shlex.join(command))
        print('No changes made. Allow at least30GB free space for new assets, dependencies, temporary files and results.')
        return
    require(platform.system() == 'Darwin' and platform.machine() == 'arm64',
            'Run setup on the target Apple Silicon Mac with native arm64 Python3.12')
    info = json.loads(subprocess.check_output([python, '-c',
        'import platform,sys,json;print(json.dumps({"version":list(sys.version_info[:2]),"arch":platform.machine()}))'], text=True))
    require(info == {'version': [3, 12], 'arch': 'arm64'}, 'Pinned wheels require native arm64 Python3.12')
    require(shutil.which('node') and shutil.which('npm') and shutil.which('curl'), 'Install native Node.js22/24 and make npm/curl available first')
    node = json.loads(subprocess.check_output(['node', '-p',
        'JSON.stringify({arch:process.arch,major:Number(process.versions.node.split(".")[0])})'], text=True))
    require(node['arch'] == 'arm64' and node['major'] in (22, 24), 'Use native arm64 Node.js22/24')
    for folder in (REPO, REPO / 'work/bench'):
        require(not (folder / 'node_modules').is_symlink(),
                'Use a normal checkout with its own dependencies; node_modules is a symlink: ' + str(folder))
    chrome = find_chrome(args.chrome)
    check_existing_config(config, configuration(data, cache, output, chrome))
    existing_config_sha = sha(config) if config.exists() else None
    configured_sha = existing_config_sha
    lock = REPO / 'results/setup/online-setup.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    identity = uuid.uuid4().hex
    with lock.open('x') as stream:
        json.dump(dict(pid=os.getpid(), identity=identity, purpose='serial online setup; no GPU work'), stream)
    receipts = output / 'setup' / ('online-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + identity[:8])
    receipt = dict(schema='target-mac-online-setup-v1', complete=False,
                   startedAt=datetime.now(timezone.utc).isoformat(), scriptSha256=sha(Path(__file__)),
                   networkMode='direct', dataRoot=str(data), dependencyCache=str(cache),
                   config=str(config), steps=[], gpuWorkPerformed=False, measurementsStarted=False)
    previous_term = signal.getsignal(signal.SIGTERM)
    def interrupted(signum, frame):
        raise KeyboardInterrupt('Setup interrupted; verified completed downloads can be reused')
    signal.signal(signal.SIGTERM, interrupted)
    try:
        save(receipts / 'setup.json', receipt)
        for name, command in steps(python, data, cache, output, config, chrome, receipts):
            require(not (REPO / 'results/gpu-session.lock').exists(), 'GPU work started during setup; stop setup before measurement')
            print('\n' + name + '\n' + shlex.join(command), flush=True)
            record = dict(name=name, command=command, startedAt=datetime.now(timezone.utc).isoformat(), complete=False)
            receipt['steps'].append(record)
            save(receipts / 'setup.json', receipt)
            log = receipts / (name + '.log')
            if name == 'configure-target-mac' and existing_config_sha is not None:
                require(config.exists() and sha(config) == existing_config_sha,
                        'Local config changed during setup; preserve it and choose a new config path')
                record['action'] = 'preserved-matching-existing-config'
                log.write_text('Existing matching configuration retained byte-for-byte, including extra fields.\n')
            else:
                execute(command, log)
            if name == 'configure-target-mac':
                configured_sha = sha(config)
            record.update(complete=True, finishedAt=datetime.now(timezone.utc).isoformat(),
                          logSha256=sha(receipts / (name + '.log')))
            save(receipts / 'setup.json', receipt)
        require(config.exists() and sha(config) == configured_sha,
                'Configuration changed before setup completed; preserve it for review')
        check_existing_config(config, configuration(data, cache, output, chrome))
        receipt.update(complete=True, finishedAt=datetime.now(timezone.utc).isoformat(),
                       configSha256=sha(config), dataLockSha256=sha(REPO / 'config/data-lock.json'),
                       gtPixelLockSha256=sha(REPO / 'scripts/ground-truth-pixels-lock.json'))
        save(receipts / 'setup.json', receipt)
        print('\nSetup complete. Follow docs/COLLEAGUE_QUICKSTART.zh-CN.md for local validation, pilot and full measurement.')
        print('Setup receipt:', receipts / 'setup.json')
    except BaseException as exc:
        receipt.update(complete=False, failedAt=datetime.now(timezone.utc).isoformat(),
                       error=str(exc) or type(exc).__name__)
        save(receipts / 'setup.json', receipt)
        raise
    finally:
        signal.signal(signal.SIGTERM, previous_term)
        if lock.exists() and read(lock).get('identity') == identity:
            lock.unlink()


if __name__ == '__main__':
    main()
