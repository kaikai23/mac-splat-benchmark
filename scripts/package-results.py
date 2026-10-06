#!/usr/bin/env python3
"""Package a fully accepted local run and its committed reproduction source."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run = args.run_dir.resolve()
    output = args.output.resolve()
    if not run.is_dir() or output.is_relative_to(run):
        raise ValueError('Run must exist and archive must be outside the run directory')
    if (ROOT / 'results/gpu-session.lock').exists():
        raise ValueError('Finish the GPU workload before packaging')
    if git('status', '--porcelain', '--untracked-files=normal'):
        raise ValueError('Commit the reproduction source before packaging')
    checks = [
        'analysis/analysis-qa.json',
        'validation/independent-formal-qa.json',
        'validation/independent-quality-qa.json',
        'validation/report-visual-qa.json',
    ]
    for relative in checks:
        receipt = json.loads((run / relative).read_text())
        if receipt.get('passed') is not True:
            raise ValueError('Acceptance not passed: ' + relative)
    cleanup = json.loads((run / 'runtime-cleanup.json').read_text())
    if not cleanup.get('complete') or not cleanup.get('passed') or any(c['alive'] for c in cleanup['children']):
        raise ValueError('Performance run or owned-process cleanup incomplete')
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    commit = git('rev-parse', 'HEAD')
    stamp = datetime.now(timezone.utc).isoformat()
    entries = []
    temporary = output.with_suffix(output.suffix + '.partial')
    with tempfile.TemporaryDirectory(dir=output.parent, prefix='source-package-') as td:
        source = Path(td) / 'reproduction-source.zip'
        subprocess.run(['git', '-C', str(ROOT), 'archive', '--format=zip', '--prefix=mac-splat-benchmark/',
                        '--output=' + str(source), commit], check=True)
        paths = [('reproduction-source.zip', source)]
        def add_tree(directory, prefix):
            for path in sorted(directory.rglob('*')):
                if path.is_symlink():
                    raise ValueError('Run package cannot follow symlinks: ' + str(path))
                if path.is_file():
                    paths.append((prefix + path.relative_to(directory).as_posix(), path))
        add_tree(run, 'run/')
        prerequisites = json.loads((run / 'validation/prerequisites.json').read_text())
        pilot = (ROOT / prerequisites['pilotDirectory']).resolve()
        if not pilot.is_relative_to(ROOT) or pilot == run:
            raise ValueError('Pilot support path escapes repository or equals formal run')
        add_tree(pilot, 'support/' + pilot.relative_to(ROOT).as_posix() + '/')
        included = {p.resolve() for _, p in paths}
        for item in prerequisites['sources']:
            path = (ROOT / item['path']).resolve()
            if not path.is_relative_to(ROOT) or digest(path) != item['sha256']:
                raise ValueError('Prerequisite identity/path mismatch: ' + item['path'])
            if path not in included:
                paths.append(('support/' + path.relative_to(ROOT).as_posix(), path))
                included.add(path)
        # Optional diagnostics are evidence, never added to formal result rows.
        for relative in ('results/setup/clean-mac-offline-install.json',
                         'results/setup/timer-domain-review.json',
                         'results/setup/timer-domain-review.md',
                         'results/setup/timer-diagnostic'):
            path = ROOT / relative
            if path.is_dir():
                add_tree(path, 'support/' + relative + '/')
            elif path.is_file() and path.resolve() not in included:
                paths.append(('support/' + relative, path))
        with zipfile.ZipFile(temporary, 'w', allowZip64=True) as archive:
            for name, path in paths:
                h = hashlib.sha256()
                info = zipfile.ZipInfo.from_file(path, arcname=name)
                info.compress_type = zipfile.ZIP_STORED if path.suffix.lower() in ('.png', '.webp', '.zip') else zipfile.ZIP_DEFLATED
                size = 0
                with path.open('rb') as src, archive.open(info, 'w', force_zip64=True) as dst:
                    for chunk in iter(lambda: src.read(8 * 1024 * 1024), b''):
                        dst.write(chunk)
                        h.update(chunk)
                        size += len(chunk)
                entries.append({'path': name, 'bytes': size, 'sha256': h.hexdigest()})
            manifest = {'schema': 'mac-three-method-delivery-manifest-v1', 'createdAt': stamp,
                        'sourceCommit': commit, 'run': run.name, 'files': entries,
                        'excludedInputs': ['52 PLY models', '378 full ground-truth images',
                                           'installed dependencies', 'LPIPS/VGG checkpoints'],
                        'inputRecovery': 'See reproduction-source.zip README.md and pinned input manifests.'}
            archive.writestr('artifact-manifest.json', json.dumps(manifest, indent=2) + '\n')
            archive.writestr('START_HERE.txt',
                'Open run/analysis/index.html for the bilingual report and run/analysis/captures.html for the gallery.\n'
                'Every measurement and renderer image is newly collected on the recorded Mac.\n'
                'Extract reproduction-source.zip and follow README.md to run the same protocol on another Mac.\n'
                'Models, complete GT, dependencies and weights are excluded; pinned recovery scripts are included.\n'
                'artifact-manifest.json records SHA256 for each bundled source/result file.\n')
    with zipfile.ZipFile(temporary) as archive:
        bad_member = archive.testzip()
        if bad_member is not None:
            raise ValueError('Archive CRC verification failed: ' + bad_member)
    temporary.replace(output)
    receipt = {'schema': 'mac-three-method-archive-receipt-v1', 'complete': True, 'createdAt': stamp,
               'archive': output.name, 'bytes': output.stat().st_size, 'sha256': digest(output),
               'sourceCommit': commit, 'files': len(entries) + 2, 'acceptedReceipts': checks,
               'manifestIncluded': 'artifact-manifest.json', 'sourceIncluded': 'reproduction-source.zip',
               'allMemberCrcReadbackPassed': True}
    output.with_suffix('.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
