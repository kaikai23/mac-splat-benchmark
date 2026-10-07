#!/usr/bin/env python3
"""Package a fully accepted local run and its committed reproduction source."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
_review_spec = importlib.util.spec_from_file_location('delivery_visual_review', Path(__file__).with_name('record-visual-review.py'))
VISUAL = importlib.util.module_from_spec(_review_spec)
_review_spec.loader.exec_module(VISUAL)
MAX_SETUP_RECEIPT_BYTES = 8 * 1024 * 1024


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()


def setup_evidence(run):
    """Collect only named small receipts from this run's preparation directory."""
    setup = run.parent / 'setup'
    if (not run.is_relative_to(ROOT / 'results') or run.parent == ROOT / 'results' or
            not setup.resolve().is_relative_to(run.parent.resolve()) or setup.is_symlink()):
        raise ValueError('Use a run beneath results/RUN/ with its own ordinary RUN/setup directory')
    if not setup.is_dir():
        raise ValueError('Missing run-local setup receipts; offline preparation also needs dependency and GT verification receipts')
    top_names = {'dependency-installation.json', 'ground-truth-verification.json', 'environment.json'}
    online_names = top_names | {'setup.json', 'original-models.json', 'all-models.json'}
    validation_names = {'supersplat-worker.json', 'spark-native-sort-cpu-validation.json',
                        'native-prepare-lifecycle-review.json', 'gpu-probe/gpu-probe-metal.json'}
    paths = []
    for path in sorted(setup.rglob('*.json')):
        rel = path.relative_to(setup)
        selected = ((len(rel.parts) == 1 and (rel.name in top_names or
                    rel.name.startswith('data-verification-'))) or
                    (len(rel.parts) == 2 and rel.parts[0].startswith('online-') and rel.name in online_names) or
                    (rel.parts[0] == 'validation' and Path(*rel.parts[1:]).as_posix() in validation_names))
        if not selected:
            continue
        VISUAL.safe_file(setup, rel)
        if path.stat().st_size > MAX_SETUP_RECEIPT_BYTES:
            raise ValueError('Oversized setup receipt; do not package logs/data as evidence: ' + str(rel))
        paths.append(path)
    protocol = json.loads((run / 'protocol.json').read_text())
    quality = json.loads((run / 'quality/metrics/metrics-protocol.json').read_text())
    gt_matches, dependency_matches = [], []
    for path in paths:
        receipt = json.loads(path.read_text())
        if path.name == 'ground-truth-verification.json':
            if (receipt.get('complete') is True and receipt.get('images') == 378 and
                    receipt.get('allDecodedPixelHashesMatched') is True and
                    receipt.get('groundTruthManifestSha256') == quality['gt_manifest_sha256'] and
                    receipt.get('fixedPixelLockSha256') == digest(ROOT / 'scripts/ground-truth-pixels-lock.json')):
                gt_matches.append(path)
        elif path.name == 'dependency-installation.json':
            if (receipt.get('schema') == 'portable-offline-installation-v1' and receipt.get('complete') is True and
                    receipt.get('nodeVersion') == protocol['hostIdentity']['nodeVersion'] and
                    receipt.get('pythonVersion') == 'Python ' + quality['host']['python'] and
                    receipt.get('networkAccessDuringInstallation') is False and
                    len(receipt.get('dependencyCacheReceiptSha256', '')) == 64):
                dependency_matches.append(path)
    if not gt_matches:
        raise ValueError('RUN/setup needs a fixed-pixel GT verification receipt matching this quality run and repository lock')
    if not dependency_matches:
        raise ValueError('RUN/setup needs a complete offline dependency-installation receipt matching this run Node/Python versions')
    return paths, {'setupDirectory': setup.relative_to(ROOT).as_posix(),
        'groundTruthReceipts': [p.relative_to(ROOT).as_posix() for p in gt_matches],
        'dependencyReceipts': [p.relative_to(ROOT).as_posix() for p in dependency_matches]}


def validate_delivery(run):
    checks = ['analysis/analysis-qa.json', 'validation/independent-formal-qa.json',
              'validation/independent-quality-qa.json', 'validation/report-visual-qa.json',
              'validation/visual-review.json']
    for relative in checks:
        receipt = json.loads(VISUAL.safe_file(run, relative).read_text())
        if receipt.get('passed') is not True or receipt.get('complete') is not True:
            raise ValueError('Acceptance not passed/complete: ' + relative)
    cleanup = json.loads(VISUAL.safe_file(run, 'runtime-cleanup.json').read_text())
    if (not cleanup.get('complete') or not cleanup.get('passed') or not cleanup.get('gpuLockReleased') or
            any(c.get('alive') is not False for c in cleanup['children'])):
        raise ValueError('Performance run or owned-process cleanup incomplete')
    state = VISUAL.validate_report_state(run, repo_root=ROOT)
    review = VISUAL.validate_visual_review(run, state)
    support, setup = setup_evidence(run)
    return checks, support, {'visualReviewSha256': digest(run / 'validation/visual-review.json'),
        'reviewerType': review['reviewerType'], 'humanVisualReview': review['humanVisualReview'],
        'reportQaSha256': state['reportQaSha256'], 'reportBuildSha256': state['reportBuildSha256'],
        'sourceFreshness': state['sourceFreshness'],
        'setupEvidence': setup}


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
    checks, setup_paths, acceptance = validate_delivery(run)
    if output.exists() or output.with_suffix('.receipt.json').exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    commit = git('rev-parse', 'HEAD')
    stamp = datetime.now(timezone.utc).isoformat()
    entries = []
    excluded_large_logs = []
    temporary = output.with_suffix(output.suffix + '.partial')
    if temporary.exists():
        raise FileExistsError('Preserve/review existing incomplete archive before retry: ' + str(temporary))
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
                    relative = path.relative_to(directory)
                    forbidden = {'node_modules', '.venv', '.cache', 'models', 'gt-source',
                                 'ground-truth', 'offline-cache', 'npm-cache', 'python-wheels'}
                    if (forbidden.intersection(relative.parts[:-1]) or
                            path.suffix.lower() in ('.ply', '.splat', '.ksplat', '.spz', '.pth', '.pt', '.ckpt', '.whl') or
                            (path.name.startswith('local') and path.suffix == '.json')):
                        raise ValueError('Keep model/dependency/machine-config inputs outside the result package: ' + str(relative))
                    if path.suffix == '.log' and path.stat().st_size > 16 * 1024 * 1024:
                        excluded_large_logs.append({'path': prefix + relative.as_posix(),
                            'bytes': path.stat().st_size, 'reason': 'Optional log exceeds16MiB; raw measurements and receipts remain included'})
                        continue
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
        for path in setup_paths:
            if path.resolve() not in included:
                paths.append(('support/' + path.relative_to(ROOT).as_posix(), path))
                included.add(path.resolve())
        # Optional diagnostics are evidence, never added to formal result rows.
        for relative in ('results/setup/timer-domain-review.json',
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
                        'acceptance': acceptance,
                        'excludedLargeLogs': excluded_large_logs,
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
               'acceptance': acceptance,
               'excludedLargeLogs': excluded_large_logs,
               'manifestIncluded': 'artifact-manifest.json', 'sourceIncluded': 'reproduction-source.zip',
               'allMemberCrcReadbackPassed': True}
    output.with_suffix('.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
