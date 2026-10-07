#!/usr/bin/env python3
"""Verify a previously installed local environment; never install or download.

Run after all performance and quality GPU work ends. Python introspection uses
only the standard library. Locked wheel/tarball payloads are compared with the
actual configured environment, and original installation receipts are preserved
verbatim. A successful verification is not a new installation event.
"""
from __future__ import annotations
import argparse
import base64
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'portable-existing-environment-verification-v1'
RECEIPT_NAME = 'existing-environment-verification.json'
FILES_NAME = 'existing-environment-files.json'
PROVENANCE_DIR = 'existing-environment-provenance'
PROVENANCE_NAMES = {'python-installation.json', 'bench-npm-installation.json', 'node-identities.json'}
MAX_EVIDENCE_BYTES = 8 * 1024 * 1024


def require(ok, message):
    if not ok:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text())


def sha(path, algorithm='sha256'):
    value = hashlib.new(algorithm)
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def configured_path(value, root=ROOT):
    # Preserve the venv executable symlink when launching Python.
    return Path(os.path.abspath(Path(root) / Path(value).expanduser()))


def safe_relative(value):
    path = PurePosixPath(value)
    require(value and not path.is_absolute() and '..' not in path.parts and '\\' not in value,
            'Unsafe dependency member path: ' + value)
    return path


def ordinary_file(path):
    require(path.is_file(), 'Missing dependency/source file: ' + str(path))
    return path.resolve()


def original_json(path):
    require(path.stat().st_size <= MAX_EVIDENCE_BYTES, 'Original receipt is unexpectedly large')
    raw = path.read_bytes()
    return raw, json.loads(raw)


class FileEvidence:
    """Compact roots + relative identities keep the complete receipt small."""
    def __init__(self):
        self.roots, self.files, self.identities = [], [], {}

    def add(self, path, root=None, expected=None):
        path = ordinary_file(Path(path))
        if path not in self.identities:
            before = path.stat()
            digest = sha(path)
            after = path.stat()
            require((before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
                    (after.st_size, after.st_mtime_ns, after.st_ctime_ns), 'Source changed while verifying: ' + str(path))
            root = Path(root).resolve() if root else path.parent
            require(path.is_relative_to(root), 'Dependency file escapes its declared root')
            text = str(root)
            if text not in self.roots:
                self.roots.append(text)
            entry = [self.roots.index(text), path.relative_to(root).as_posix(), before.st_size, digest]
            self.files.append(entry)
            self.identities[path] = digest
        digest = self.identities[path]
        require(expected is None or digest == expected, 'Installed/source payload differs: ' + str(path))
        return digest

    def document(self):
        return dict(schema='portable-existing-environment-files-v1', roots=self.roots, files=self.files,
                    meaning='Current verified file bytes; not an installation log or proof of historical process memory')


def python_inventory(executable, versions):
    code = '''import importlib.metadata as m,json,platform,sys
names=json.loads(sys.argv[1])
print(json.dumps(dict(executable=sys.executable,prefix=sys.prefix,basePrefix=sys.base_prefix,
 system=platform.system(),architecture=platform.machine(),version=platform.python_version(),
 packages={name:dict(version=m.version(name),root=str(m.distribution(name).locate_file(''))) for name in names})))'''
    return json.loads(subprocess.check_output([str(executable), '-I', '-c', code, json.dumps(list(versions))], text=True))


def verify_wheels(wheels, lock, original, inventory, evidence):
    require(original.get('installed_offline') is True and original.get('architecture') == 'arm64',
            'Original Python receipt must describe an actual offline arm64 installation')
    require(original.get('versions') == lock['versions'], 'Original Python installation versions differ from the lock')
    expected = {item['file']: item for item in lock['wheels']}
    supplied = {item['file']: item for item in original.get('wheels', [])}
    require(len(expected) == len(lock['wheels']) and len(supplied) == len(original.get('wheels', [])) and
            supplied == expected, 'Original installed wheel identities differ from the lock')
    require(set(inventory['packages']) == set(lock['versions']) and
            all(inventory['packages'][name]['version'] == version for name, version in lock['versions'].items()),
            'Configured Python package versions differ from the lock')
    roots = {Path(item['root']).resolve() for item in inventory['packages'].values()}
    require(len(roots) == 1, 'Expected all pinned wheels inside one configured virtualenv site-packages')
    site = roots.pop(); prefix = Path(inventory['prefix']).resolve()
    require(site.is_relative_to(prefix) and prefix != Path(inventory['basePrefix']).resolve(),
            'Configured Python must use its own virtualenv, without system-site packages')
    results, exclusions = [], []
    for item in lock['wheels']:
        file = wheels / item['file']
        require(file.stat().st_size == item['bytes'], 'Locked wheel size differs: ' + item['file'])
        evidence.add(file, wheels, item['sha256'])
        count = 0
        with zipfile.ZipFile(file) as archive:
            names = archive.namelist()
            # A wheel can vendor other distributions (notably setuptools).
            # Only its top-level RECORD is the installer manifest; nested
            # RECORD files remain ordinary hashed payloads of that manifest.
            records = [name for name in names if len(PurePosixPath(name).parts) == 2 and
                       name.endswith('.dist-info/RECORD')]
            require(len(records) == 1 and len(names) == len(set(names)), 'Invalid wheel member/RECORD inventory')
            for name, digest, size in csv.reader(io.StringIO(archive.read(records[0]).decode())):
                relative = safe_relative(name)
                if not digest:
                    require(name == records[0], 'Unexpected unhashed wheel payload: ' + name)
                    exclusions.append(dict(wheel=item['file'], member=name, reason='pip rewrites installed RECORD'))
                    continue
                require(digest.startswith('sha256='), 'Unsupported wheel RECORD digest')
                hex_digest = base64.urlsafe_b64decode(digest.split('=', 1)[1] + '==').hex()
                require(len(hex_digest) == 64 and size.isdigit(), 'Invalid wheel RECORD identity')
                parts = relative.parts
                if parts[0].endswith('.data'):
                    require(len(parts) >= 3 and parts[1] in ['data', 'purelib', 'platlib'],
                            'Unsupported relocated wheel payload; review instead of skipping: ' + name)
                    target = (prefix if parts[1] == 'data' else site).joinpath(*parts[2:])
                else:
                    target = site.joinpath(*parts)
                require(target.stat().st_size == int(size), 'Installed wheel payload size differs: ' + name)
                evidence.add(target, prefix, hex_digest); count += 1
        results.append(dict(file=item['file'], sha256=item['sha256'], verifiedInstalledPayloadFiles=count))
    return dict(prefix=str(prefix), sitePackages=str(site), packages=inventory['packages'], wheels=results,
                verifiedPayloadFiles=sum(x['verifiedInstalledPayloadFiles'] for x in results), exclusions=exclusions,
                scope='All hashed locked wheel RECORD payloads, including relocated data. pip-generated entrypoints, bytecode and extra installation files are outside the archive-payload comparison.')


def cached_tarball(cache, integrity):
    require(isinstance(integrity, str) and integrity.startswith('sha512-') and ' ' not in integrity,
            'Expected one npm SHA512 integrity value')
    digest = base64.b64decode(integrity.split('-', 1)[1], validate=True).hex()
    require(len(digest) == 128, 'Invalid npm SHA512 integrity')
    path = cache / '_cacache/content-v2/sha512' / digest[:2] / digest[2:4] / digest[4:]
    require(path.is_file() and sha(path, 'sha512') == digest, 'Missing/different locked npm cache tarball: ' + integrity)
    return path


def applicable(entry):
    return (not entry.get('os') or 'darwin' in entry['os']) and (not entry.get('cpu') or 'arm64' in entry['cpu'])


def verify_npm(root, config, cache, original, identities, evidence):
    require(original.get('platform') == 'darwin' and original.get('arch') == 'arm64' and
            original.get('lockSha256') == sha(root / 'work/bench/package-lock.json'),
            'Original npm installation receipt does not match this arm64 bench lock')
    require(identities.get('passed') is True, 'Original installed Node identities were not accepted')
    old = {(x['directory'], x['package']): x['version'] for x in identities['checkedInstalledPackages']}
    original_bench = {x['name']: x['version'] for x in original['packages']}
    require(len(original_bench) == len(original['packages']), 'Original npm installation has duplicate package identities')
    playwright = configured_path(config['playwrightModule'], root)
    require(playwright.is_dir() and read(playwright / 'package.json')['name'] == 'playwright',
            'Existing-environment verification requires configured playwrightModule to be its actual package directory')
    module_roots = {'.': playwright.resolve().parent, 'work/bench': (root / 'work/bench/node_modules').resolve()}
    results, skipped, replacements = [], [], []
    for directory, modules in module_roots.items():
        lock_path = root / directory / 'package-lock.json'
        lock = read(lock_path); evidence.add(lock_path, root)
        for name, entry in lock['packages'].items():
            if not name or not applicable(entry):
                continue
            relative = safe_relative(name)
            require(relative.parts[0] == 'node_modules', 'Unexpected npm lock package location')
            package = modules.joinpath(*relative.parts[1:])
            if not package.exists() and entry.get('optional') and name not in [
                    'node_modules/@esbuild/darwin-arm64', 'node_modules/@rollup/rollup-darwin-arm64']:
                skipped.append(dict(directory=directory, package=name, reason='Absent upstream optional package')); continue
            metadata = read(package / 'package.json')
            package_name = '/'.join(relative.parts[1:])
            require(metadata['version'] == entry['version'] and metadata['name'] == package_name,
                    'Actual npm package identity differs: ' + name)
            require(directory != 'work/bench' or original_bench.get(package_name) == entry['version'],
                    'Original npm installation does not cover this actual bench package: ' + name)
            require(old.get((directory, name)) == entry['version'] or entry.get('optional'),
                    'Original Node identity receipt does not cover installed required package: ' + name)
            archive_path = cached_tarball(cache, entry['integrity']); evidence.add(archive_path, cache)
            count = 0; archive_root = None
            with tarfile.open(archive_path, 'r:*') as archive:
                seen = set()
                for member in archive:
                    if member.isdir():
                        continue
                    relative = safe_relative(member.name)
                    require(len(relative.parts) > 1 and member.isfile(),
                            'Unexpected nonregular npm tar member: ' + member.name)
                    # npm's @types archives may use e.g. "three/" instead of
                    # "package/". SRI still fixes the archive; require one root.
                    archive_root = archive_root or relative.parts[0]
                    require(relative.parts[0] == archive_root, 'Multiple npm archive roots')
                    name_in_package = PurePosixPath(*relative.parts[1:]).as_posix()
                    require(name_in_package not in seen, 'Duplicate npm payload member')
                    seen.add(name_in_package)
                    target = package / name_in_package
                    with archive.extractfile(member) as stream:
                        expected = hashlib.file_digest(stream, 'sha256').hexdigest()
                    actual = evidence.add(target, modules)
                    if actual != expected:
                        require(metadata['name'] == 'esbuild' and name_in_package == 'bin/esbuild',
                                'Installed npm payload differs: ' + str(target))
                        native = modules / '@esbuild/darwin-arm64/bin/esbuild'
                        require(actual == evidence.add(native, modules), 'Generated esbuild binary differs from native package')
                        replacements.append(dict(path=str(target), sha256=actual, originalTarSha256=expected,
                                                 matchesLockedNativePackagePath=str(native)))
                    count += 1
            results.append(dict(directory=directory, package=name, actualPath=str(package.resolve()),
                                version=entry['version'], integrity=entry['integrity'], archiveRoot=archive_root,
                                verifiedPayloadFiles=count))
    require(any(x['package'] == 'node_modules/@esbuild/darwin-arm64' for x in results), 'Native esbuild was not verified')
    require(any(x['package'] == 'node_modules/@rollup/rollup-darwin-arm64' for x in results), 'Native Rollup was not verified')
    return dict(moduleRoots={key: str(value) for key, value in module_roots.items()}, packages=results,
                optionalAbsent=skipped, generatedReplacements=replacements,
                scope='Every regular payload member from the applicable installed locked npm tarballs; extra installer/cache files and .bin links are outside this comparison.')


def preserved_identity(path, relative, raw):
    return dict(path=relative, originalPath=str(path.resolve()), bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def verify(args, root=ROOT):
    root = Path(root).resolve(); run = args.run_dir.resolve(); setup = run.parent / 'setup'
    require(run.is_relative_to(root / 'results') and run.parent != root / 'results', 'Use results/RUN/formal')
    for lock in [root / 'results/gpu-session.lock', run / 'gpu-session.lock', run.parent / 'gpu-session.lock']:
        require(not lock.exists(), 'Finish GPU collection/quality before verifying dependency payloads')
    cleanup = read(run / 'runtime-cleanup.json')
    require(cleanup.get('complete') is True and cleanup.get('passed') is True and cleanup.get('gpuLockReleased') is True and
            all(c.get('alive') is False for c in cleanup['children']), 'Finish performance and owned-process cleanup first')
    output = setup / RECEIPT_NAME
    targets = [output, setup / FILES_NAME, *[setup / PROVENANCE_DIR / name for name in PROVENANCE_NAMES]]
    require(not any(path.exists() or path.is_symlink() for path in targets), 'Existing verification evidence must be preserved; do not overwrite')
    config_path = configured_path(args.config, root); config = read(config_path)
    protocol_path = run / 'protocol.json'; protocol = read(protocol_path)
    python_raw, python_old = original_json(args.python_install_receipt)
    npm_raw, npm_old = original_json(args.npm_install_receipt)
    node_raw, node_old = original_json(args.node_identities)
    executable = configured_path(config['pythonExecutable'], root)
    inventory = python_inventory(executable, read(root / 'config/python-wheels.lock.json')['versions'])
    require(inventory['system'] == 'Darwin' and inventory['architecture'] == 'arm64' and
            inventory['version'].startswith('3.12.') and inventory['version'] == python_old['python'].split()[0] and
            configured_path(inventory['executable']) == executable and
            executable.parent.parent.resolve() == Path(inventory['prefix']).resolve(),
            'Actual Python executable/virtualenv/architecture/version differs')
    node = configured_path(args.node or npm_old['nodeExecutable'], root)
    node_info = json.loads(subprocess.check_output([str(node), '-p',
        'JSON.stringify({executable:process.execPath,version:process.version,architecture:process.arch,platform:process.platform})'], text=True))
    require(node_info['platform'] == 'darwin' and node_info['architecture'] == 'arm64' and
            node_info['version'] == protocol['hostIdentity']['nodeVersion'] == npm_old['nodeVersion'] and
            Path(node_info['executable']).resolve() == node.resolve() == Path(npm_old['nodeExecutable']).resolve(),
            'Actual Node identity differs from formal protocol/original installation evidence')
    evidence = FileEvidence()
    for path in [protocol_path, config_path, executable, Path(inventory['prefix']) / 'pyvenv.cfg', node, Path(__file__), root / 'config/python-wheels.lock.json',
                 root / 'requirements.txt', root / 'quality/requirements.txt']:
        evidence.add(path)
    lock = read(root / 'config/python-wheels.lock.json')
    python = verify_wheels(args.wheels.resolve(), lock, python_old, inventory, evidence)
    npm = verify_npm(root, config, args.npm_cache.resolve(), npm_old, node_old, evidence)
    copies = [(args.python_install_receipt, 'python-installation.json', python_raw),
              (args.npm_install_receipt, 'bench-npm-installation.json', npm_raw),
              (args.node_identities, 'node-identities.json', node_raw)]
    provenance = [preserved_identity(source, PROVENANCE_DIR + '/' + name, raw) for source, name, raw in copies]
    files_raw = (json.dumps(evidence.document(), separators=(',', ':')) + '\n').encode()
    require(len(files_raw) <= MAX_EVIDENCE_BYTES, 'File evidence exceeds small-receipt limit; retain failure and review packaging policy')
    result = dict(schema=SCHEMA, complete=True, passed=True, verifiedAt=datetime.now(timezone.utc).isoformat(),
        verificationOnly=True, installationPerformed=False, networkAccess=False, gpuWorkPerformed=False,
        runDirectory=os.path.relpath(run, root), protocolId=protocol['protocolId'], collectionProtocolSha256=sha(protocol_path),
        configPath=str(config_path), configSha256=sha(config_path),
        pythonExecutable=str(executable), pythonExecutableResolved=str(executable.resolve()), pythonVersion=inventory['version'],
        nodeExecutable=str(node), nodeVersion=node_info['version'], python=python, npm=npm,
        pythonWheelLockSha256=sha(root / 'config/python-wheels.lock.json'),
        npmLocks={name: sha(root / name) for name in ['package-lock.json', 'work/bench/package-lock.json']},
        fileEvidence=dict(path=FILES_NAME, sha256=hashlib.sha256(files_raw).hexdigest(), bytes=len(files_raw), files=len(evidence.files)),
        originalReceipts=provenance, scriptSha256=sha(Path(__file__)),
        limitation='Verifies current configured environment against fixed original dependency payloads and preserves genuine historical receipts. It does not claim a new installation or retroactive proof of process memory. Generated/extra installation files are explicitly outside payload comparisons.')
    setup.mkdir(parents=True, exist_ok=True)
    require(not setup.is_symlink() and setup.resolve().is_relative_to(run.parent), 'Setup output escapes run')
    (setup / PROVENANCE_DIR).mkdir(exist_ok=True)
    require(not (setup / PROVENANCE_DIR).is_symlink(), 'Provenance output cannot be a symlink')
    for _, name, raw in copies:
        with (setup / PROVENANCE_DIR / name).open('xb') as stream:
            stream.write(raw)
    with (setup / FILES_NAME).open('xb') as stream:
        stream.write(files_raw)
    with output.open('x') as stream:
        json.dump(result, stream, indent=2); stream.write('\n')
    return result


def validate_receipt(path, run, protocol, quality, root=ROOT):
    """Packaging check: rehash all verified files, without imports or reinstall."""
    root = Path(root).resolve(); run = Path(run).resolve(); setup = run.parent / 'setup'
    receipt = read(path)
    require(receipt.get('schema') == SCHEMA and receipt.get('complete') is True and receipt.get('passed') is True and
            receipt.get('verificationOnly') is True and receipt.get('installationPerformed') is False and
            receipt.get('networkAccess') is False and receipt.get('gpuWorkPerformed') is False,
            'Existing-environment receipt is not an accepted verification-only result')
    require((root / receipt['runDirectory']).resolve() == run and receipt['protocolId'] == protocol['protocolId'] and
            receipt['collectionProtocolSha256'] == sha(run / 'protocol.json'), 'Existing-environment receipt belongs to a different formal run')
    config = read(Path(receipt['configPath']))
    require(sha(Path(receipt['configPath'])) == receipt['configSha256'] and
            str(configured_path(config['pythonExecutable'], root)) == receipt['pythonExecutable'] and
            str(configured_path(config['pythonExecutable'], root).resolve()) == receipt['pythonExecutableResolved'] and
            str(configured_path(config['pythonExecutable'], root).parent.parent.resolve()) == receipt['python']['prefix'],
            'Existing-environment configured Python identity changed')
    require(str(configured_path(config['playwrightModule'], root).resolve().parent) == receipt['npm']['moduleRoots']['.'] and
            str((root / 'work/bench/node_modules').resolve()) == receipt['npm']['moduleRoots']['work/bench'],
            'Existing-environment actual Node dependency roots changed')
    require(receipt['nodeVersion'] == protocol['hostIdentity']['nodeVersion'] and
            receipt['pythonVersion'] == quality['host']['python'] and
            {name: receipt['python']['packages'][name]['version'] for name in quality['packages']} == quality['packages'],
            'Existing-environment runtime versions differ from performance/quality')
    require(receipt['pythonWheelLockSha256'] == sha(root / 'config/python-wheels.lock.json') and
            receipt['npmLocks'] == {name: sha(root / name) for name in ['package-lock.json', 'work/bench/package-lock.json']},
            'Existing-environment dependency locks changed')
    require(receipt['scriptSha256'] == sha(Path(__file__)), 'Existing-environment verifier changed since receipt')
    expected_names = {PROVENANCE_DIR + '/' + name for name in PROVENANCE_NAMES}
    require(len(receipt['originalReceipts']) == 3 and {x['path'] for x in receipt['originalReceipts']} == expected_names,
            'Existing-environment original receipt inventory differs')
    files = []
    for item in [receipt['fileEvidence'], *receipt['originalReceipts']]:
        relative = safe_relative(item['path']); source = setup / relative
        require(source.is_file() and not source.is_symlink() and source.resolve().is_relative_to(setup.resolve()) and
                source.stat().st_size == item['bytes'] <= MAX_EVIDENCE_BYTES and sha(source) == item['sha256'],
                'Existing-environment preserved evidence changed: ' + str(relative))
        files.append(source)
    require(receipt['fileEvidence']['path'] == FILES_NAME, 'Unexpected environment file-manifest name')
    manifest = read(setup / FILES_NAME)
    require(manifest.get('schema') == 'portable-existing-environment-files-v1' and
            len(manifest['files']) == receipt['fileEvidence']['files'] and manifest['files'], 'Invalid environment file evidence')
    seen = set()
    for root_index, relative, size, digest in manifest['files']:
        require(type(root_index) is int and 0 <= root_index < len(manifest['roots']) and type(size) is int and size >= 0 and
                isinstance(digest, str) and re.fullmatch('[0-9a-f]{64}', digest), 'Invalid verified dependency file identity')
        base = Path(manifest['roots'][root_index]); source = (base / safe_relative(relative)).resolve()
        require(base.is_absolute() and source.is_relative_to(base.resolve()) and source not in seen,
                'Verified dependency file escapes its declared root or is duplicated')
        require(source.is_file() and source.stat().st_size == size and sha(source) == digest,
                'Verified existing dependency/source changed: ' + str(source))
        seen.add(source)
    required = {run / 'protocol.json', Path(receipt['configPath']).resolve(), Path(receipt['pythonExecutableResolved']),
                Path(receipt['python']['prefix']) / 'pyvenv.cfg',
                Path(receipt['nodeExecutable']).resolve(), root / 'config/python-wheels.lock.json',
                root / 'package-lock.json', root / 'work/bench/package-lock.json', Path(__file__).resolve()}
    require(required <= seen, 'Existing-environment verification omits mandatory bound sources')
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / 'config/local.json')
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--python-install-receipt', type=Path, required=True)
    parser.add_argument('--npm-install-receipt', type=Path, required=True)
    parser.add_argument('--node-identities', type=Path, required=True)
    parser.add_argument('--wheels', type=Path, required=True)
    parser.add_argument('--npm-cache', type=Path, required=True, help='npm cache root containing _cacache/')
    parser.add_argument('--node', type=Path, help='Default: nodeExecutable from the original npm installation receipt')
    args = parser.parse_args()
    result = verify(args)
    print(json.dumps(dict(complete=result['complete'], verificationOnly=True,
                         receipt=str(args.run_dir.resolve().parent / 'setup' / RECEIPT_NAME),
                         verifiedFiles=result['fileEvidence']['files'])))


if __name__ == '__main__':
    main()
