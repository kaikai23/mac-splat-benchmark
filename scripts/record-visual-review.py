#!/usr/bin/env python3
"""Record an operator's actual visual review after automated report QA.

This command checks artifact identities; it does not inspect images for the
reviewer. Codex reviews remain explicitly distinct from human reviews.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_SCREENSHOTS = {
    'desktop-index-top.png', 'desktop-captures-top.png',
    'mobile-index-top.png', 'mobile-captures-top.png',
    'desktop-main-speed-table.png', 'desktop-completion-fps-plot.png',
    'desktop-quality-table-and-plot.png', 'desktop-timer-domain-diagnostics.png',
    'desktop-gallery-first-scene.png', 'mobile-gallery-first-scene.png',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_text())


def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def safe_file(root, relative, required_directory=None):
    relative = Path(relative)
    require(not relative.is_absolute() and '..' not in relative.parts, 'Artifact path must be relative and remain inside its run')
    path = root / relative
    allowed = root / required_directory if required_directory else root
    require(path.resolve().is_relative_to(root.resolve()) and
            allowed.resolve().is_relative_to(root.resolve()) and
            path.resolve().is_relative_to(allowed.resolve()), 'Artifact path escapes its required directory')
    require(path.is_file() and not path.is_symlink(), 'Missing/nonregular artifact: ' + str(relative))
    return path


def validate_source_freshness(run, build, repo_root):
    """Rehash report/audit inputs without adding external dependencies to a package.

    Producers resolve build sources absolutely and audit sources relative to the
    repository; external GT, browser and Python-package paths are legitimate.
    Artifact/output paths use the separate, strictly contained safe_file policy.
    """
    repo_root = Path(repo_root).resolve()
    cache, signatures = {}, {}

    def actual(path):
        path = path.resolve()
        require(path.is_file(), 'Missing/nonregular source: ' + str(path))
        before = path.stat()
        signature = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
        if path not in cache:
            digest = sha(path)
            after = path.stat()
            require(signature == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns),
                    'Source changed during verification: ' + str(path))
            cache[path] = dict(path=str(path), sha256=digest, bytes=before.st_size)
            signatures[path] = signature
        else:
            require(signature == signatures[path], 'Source changed during verification: ' + str(path))
        return cache[path]

    def sources(entries, label):
        require(isinstance(entries, list) and entries, label + ' has no bound sources')
        result = {}
        for entry in entries:
            require(isinstance(entry, dict) and isinstance(entry.get('path'), str) and entry['path'] and
                    isinstance(entry.get('sha256'), str) and re.fullmatch(r'[0-9a-f]{64}', entry['sha256']) and
                    type(entry.get('bytes')) is int and entry['bytes'] >= 0, label + ' has an invalid source identity')
            value = Path(entry['path'])
            path = (value if value.is_absolute() else repo_root / value).resolve()
            require(path not in result, label + ' has duplicate source paths: ' + str(path))
            identity = actual(path)
            require(identity['sha256'] == entry['sha256'] and identity['bytes'] == entry['bytes'],
                    label + ' source changed: ' + str(path))
            result[path] = identity
        return result

    def manifest_sha(index):
        canonical = sorted(index.values(), key=lambda item: item['path'])
        return hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

    report_sources = sources(build.get('sources'), 'Report build')
    analysis_hashes = build.get('analysisSources')
    current_analysis = {path.name: path for path in (repo_root / 'analysis').glob('*.py') if path.is_file()}
    require(isinstance(analysis_hashes, dict) and analysis_hashes and
            set(analysis_hashes) == set(current_analysis), 'Report analysis source file inventory changed')
    analysis_sources = {}
    for name, expected in analysis_hashes.items():
        identity = actual(current_analysis[name])
        require(identity['sha256'] == expected, 'Report analysis source changed: ' + name)
        analysis_sources[current_analysis[name].resolve()] = identity
    protocol_path, runtime_path = run / 'protocol.json', run / 'runtime-cleanup.json'
    protocol = read(protocol_path)
    require(build.get('protocolId') == protocol.get('protocolId') and protocol.get('protocolId'),
            'Report build protocol identity differs from this run')
    raw_root = (run / 'raw').resolve()
    raw_paths = {path.resolve() for path in raw_root.glob('*.json') if path.is_file()}
    require(raw_paths and raw_paths == {path for path in report_sources if path.parent == raw_root},
            'Report build raw inventory differs from this run')
    required_collection = raw_paths | {protocol_path.resolve(), runtime_path.resolve()}
    require(required_collection <= report_sources.keys(), 'Report build is missing collection source bindings')
    audit_identities = []
    for relative, kind in [('validation/independent-formal-qa.json', 'performance'),
                           ('validation/independent-quality-qa.json', 'quality')]:
        path = safe_file(run, relative)
        receipt = read(path)
        require(receipt.get('passed') is True and receipt.get('complete') is True and
                receipt.get('fullMatrixComplete') is True and receipt.get('partial') is False,
                'Independent ' + kind + ' audit must accept the complete formal matrix')
        index = sources(receipt.get('sourceReceipts'), 'Independent ' + kind + ' audit')
        require(required_collection <= index.keys() and
                raw_paths == {p for p in index if p.parent == raw_root},
                'Independent ' + kind + ' audit collection sources differ from this report')
        for shared in index.keys() & report_sources.keys():
            require(index[shared] == report_sources[shared], 'Audit/report source identity differs: ' + str(shared))
        if kind == 'performance':
            # The frozen analyzer does not list this receipt in build.sources.
            # Bind it here to the same protocol/raw/runtime and to visual review.
            value = receipt.get('runDirectory')
            require(isinstance(value, str) and (repo_root / value).resolve() == run and
                    receipt.get('schema') == 'independent-mac-three-method-performance-audit-v1' and
                    receipt.get('pilot') is False and receipt.get('protocolId') == build['protocolId'],
                    'Independent performance audit belongs to a different run/protocol')
        else:
            require(path.resolve() in report_sources and index.keys() <= report_sources.keys(),
                    'Independent quality audit and all its sources must be bound by the report build')
            for field, name in [('qualitySummarySha256', 'quality-summary.json'),
                                ('perViewSha256', 'per-view.jsonl'),
                                ('metricsProtocolSha256', 'metrics-protocol.json')]:
                source = (run / 'quality/metrics' / name).resolve()
                require(source in index and receipt.get(field) == index[source]['sha256'],
                        'Independent quality audit metric binding differs: ' + field)
        identity = actual(path)
        audit_identities.append(dict(path=relative, sha256=identity['sha256'], bytes=identity['bytes'],
                                     sourceCount=len(index), sourceManifestSha256=manifest_sha(index)))
    # Catch changes to an already-hashed input while checking the later inputs.
    for path in cache:
        actual(path)
    return dict(policy='rehash-build-and-independent-audit-sources-v1',
                reportSourceCount=len(report_sources), reportSourceManifestSha256=manifest_sha(report_sources),
                analysisSourceCount=len(analysis_sources), analysisSourceManifestSha256=manifest_sha(analysis_sources),
                uniqueSourceFilesVerified=len(cache), independentAudits=audit_identities)


def validate_report_state(run, repo_root=None):
    """Recheck inputs, outputs and screenshot identities; never launch a browser."""
    run = Path(run).resolve()
    qa_path = safe_file(run, 'validation/report-visual-qa.json')
    build_path = safe_file(run, 'analysis/build-receipt.json')
    analysis_path = safe_file(run, 'analysis/analysis-qa.json')
    qa, build, analysis = read(qa_path), read(build_path), read(analysis_path)
    require(qa.get('schema') == 'mac-portable-report-render-qa-v1' and
            qa.get('passed') is True and qa.get('complete') is True,
            'Automated full-report rendering QA must pass before visual review/delivery')
    cleanup = qa.get('ownedCleanup', {})
    require(cleanup.get('complete') is True and cleanup.get('serverListening') is False and
            all(c.get('alive') is False for c in cleanup.get('children', [])),
            'Automated report QA owned-process cleanup is incomplete')
    require(build.get('complete') is True and analysis.get('passed') is True and analysis.get('complete') is True,
            'Complete analysis/build receipts are required')
    require(qa.get('reportBuildSha256') == sha(build_path) and qa.get('analysisQaSha256') == sha(analysis_path),
            'Automated report QA is stale: current build/analysis identity differs')
    outputs, seen = [], set()
    for entry in build['outputs']:
        path = safe_file(run, entry['path'], 'analysis')
        relative = path.relative_to(run).as_posix()
        require(relative not in seen, 'Duplicate report output in build receipt')
        require(sha(path) == entry['sha256'] and path.stat().st_size == entry['bytes'],
                'Report output changed since build/QA: ' + relative)
        seen.add(relative)
        outputs.append(dict(path=relative, sha256=entry['sha256'], bytes=entry['bytes']))
    require({'analysis/index.html', 'analysis/captures.html'} <= seen, 'Both report pages must be bound by the build receipt')
    screenshots, seen = [], set()
    for entry in qa['screenshots']:
        path = safe_file(run, entry['path'], 'validation/report-preview')
        relative = path.relative_to(run).as_posix()
        require(relative not in seen, 'Duplicate QA screenshot identity')
        require(sha(path) == entry['sha256'] and path.stat().st_size == entry['bytes'],
                'QA screenshot changed: ' + relative)
        seen.add(relative)
        screenshots.append(dict(path=relative, sha256=entry['sha256'], bytes=entry['bytes']))
    required = {'validation/report-preview/' + name for name in REQUIRED_SCREENSHOTS}
    require(required <= seen, 'Required automated QA screenshots are missing')
    freshness = validate_source_freshness(run, build, repo_root or ROOT)
    return dict(reportQaSha256=sha(qa_path), reportBuildSha256=sha(build_path),
                analysisQaSha256=sha(analysis_path), reportOutputs=sorted(outputs, key=lambda x: x['path']),
                screenshots=sorted(screenshots, key=lambda x: x['path']), sourceFreshness=freshness)


def validate_visual_review(run, state=None):
    state = state or validate_report_state(run)
    path = safe_file(Path(run), 'validation/visual-review.json')
    review = read(path)
    require(review.get('schema') == 'mac-report-operator-visual-review-v1' and
            review.get('complete') is True and review.get('passed') is True and not review.get('findings'),
            'A passed operator visual review with no unresolved findings is required')
    require(review.get('reviewerType') in ('codex', 'human') and
            review.get('humanVisualReview') is (review['reviewerType'] == 'human') and
            isinstance(review.get('reviewerName'), str) and review['reviewerName'].strip() and
            isinstance(review.get('notes'), str) and review['notes'].strip() and review.get('reviewedAt'),
            'Visual reviewer identity/notes/date are incomplete or mislabelled')
    for key in ('reportQaSha256', 'reportBuildSha256', 'analysisQaSha256', 'screenshots', 'reportOutputs', 'sourceFreshness'):
        require(review.get(key) == state[key], 'Visual review is stale: ' + key)
    return review


def record_review(run, reviewer_type, reviewer_name, notes, findings):
    require(reviewer_type in ('codex', 'human'), 'Reviewer type must be codex or human')
    require(reviewer_name.strip() and notes.strip(), 'Name and notes must describe actual visual inspection')
    require(all(f.strip() for f in findings), 'Each finding must be nonempty')
    state = validate_report_state(run)
    review = dict(schema='mac-report-operator-visual-review-v1', complete=True, passed=not findings,
        reviewedAt=datetime.now(timezone.utc).isoformat(), reviewerType=reviewer_type,
        reviewerName=reviewer_name.strip(), humanVisualReview=reviewer_type == 'human',
        notes=notes.strip(), findings=[f.strip() for f in findings], **state,
        attestation='The named reviewer states that these notes follow actual inspection of the bound report screenshots; this command only verifies artifact identities.',
        scriptSha256=sha(Path(__file__)), gpuWorkPerformed=False)
    target = Path(run) / 'validation/visual-review.json'
    require(target.parent.resolve().is_relative_to(Path(run).resolve()), 'Review output escapes run')
    if target.exists():
        require(target.is_file() and not target.is_symlink(), 'Existing review is not an ordinary file')
        previous = target.with_name('visual-review-previous-' + uuid.uuid4().hex + '.json')
        with previous.open('xb') as stream:
            stream.write(target.read_bytes())
    temporary = target.with_name('visual-review-' + uuid.uuid4().hex + '.tmp')
    with temporary.open('x') as stream:
        json.dump(review, stream, indent=2)
        stream.write('\n')
    temporary.replace(target)
    return review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--reviewer-type', choices=['codex', 'human'], required=True)
    parser.add_argument('--reviewer-name', required=True)
    parser.add_argument('--notes', required=True, help='Findings after actually viewing the report and QA screenshots')
    parser.add_argument('--finding', action='append', default=[], help='Unresolved issue; repeat for multiple issues. Records passed=false.')
    args = parser.parse_args()
    run = args.run_dir.resolve()
    require(run.is_relative_to(ROOT / 'results') and run != ROOT / 'results', 'Review a local run under results/')
    require(not (ROOT / 'results/gpu-session.lock').exists(), 'Finish GPU collection before report review')
    result = record_review(run, args.reviewer_type, args.reviewer_name, args.notes, args.finding)
    print(json.dumps(dict(passed=result['passed'], humanVisualReview=result['humanVisualReview'],
                         screenshots=len(result['screenshots']), receipt=str(run / 'validation/visual-review.json'))))


if __name__ == '__main__':
    main()
