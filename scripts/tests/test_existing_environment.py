"""Synthetic offline payload/provenance tests; no real installs, torch or GPU."""
from __future__ import annotations
import argparse
import base64
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPTS = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result


verify = module('existing_environment_test', 'verify-existing-environment.py')
package = module('existing_environment_package_test', 'package-results.py')


class ExistingEnvironmentTests(unittest.TestCase):
    def write(self, path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data if isinstance(data, bytes) else (json.dumps(data) + '\n').encode())

    def npm(self, directory, name, version, extra=None):
        base = self.root / directory / 'node_modules' / name
        files = {'package.json': json.dumps({'name': name, 'version': version}).encode(), **(extra or {})}
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            for relative, data in files.items():
                entry = tarfile.TarInfo('package/' + relative); entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data)); self.write(base / relative, data)
        content = stream.getvalue(); digest = hashlib.sha512(content).digest(); hex_digest = digest.hex()
        cache = self.cache / '_cacache/content-v2/sha512' / hex_digest[:2] / hex_digest[2:4] / hex_digest[4:]
        self.write(cache, content)
        return {'version': version, 'integrity': 'sha512-' + base64.b64encode(digest).decode()}

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='synthetic-existing-environment-')
        self.addCleanup(temporary.cleanup); self.root = Path(temporary.name).resolve()
        self.run = self.root / 'results/run/formal'; self.setup = self.run.parent / 'setup'
        self.cache = self.root / 'cache/npm'; self.wheels = self.root / 'cache/wheels'
        self.venv = self.root / 'synthetic-venv'; self.site = self.venv / 'lib/python3.12/site-packages'
        self.python = self.venv / 'bin/python'; self.node = self.root / 'bin/node'
        self.write(self.python, b'synthetic executable identity, never executed')
        self.write(self.venv / 'pyvenv.cfg', b'include-system-site-packages = false\n')
        self.write(self.node, b'synthetic node identity, never executed')
        self.config_path = self.root / 'config/local.json'
        self.config = {'pythonExecutable': str(self.python), 'playwrightModule': str(self.root / 'node_modules/playwright')}
        self.write(self.config_path, self.config)
        self.protocol = {'protocolId': 'synthetic-formal', 'hostIdentity': {'nodeVersion': 'v24.19.0'}}
        self.write(self.run / 'protocol.json', self.protocol)
        self.write(self.run / 'runtime-cleanup.json', {'complete': True, 'passed': True, 'gpuLockReleased': True, 'children': []})
        self.payload = self.site / 'fixturelib/__init__.py'; content = b'# fixed synthetic wheel module\n'
        self.write(self.payload, content)
        self.wheels.mkdir(parents=True)
        wheel = self.wheels / 'fixturelib-1.0-py3-none-any.whl'
        record = io.StringIO(); rows = csv.writer(record, lineterminator='\n')
        rows.writerow(['fixturelib/__init__.py', 'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(content).digest()).decode().rstrip('='), len(content)])
        rows.writerow(['fixturelib-1.0.dist-info/RECORD', '', ''])
        with zipfile.ZipFile(wheel, 'w') as archive:
            archive.writestr('fixturelib/__init__.py', content)
            archive.writestr('fixturelib-1.0.dist-info/RECORD', record.getvalue())
        self.lock = {'versions': {'fixturelib': '1.0'}, 'wheels': [{'file': wheel.name, 'bytes': wheel.stat().st_size, 'sha256': verify.sha(wheel)}]}
        self.write(self.root / 'config/python-wheels.lock.json', self.lock)
        for name in ['requirements.txt', 'quality/requirements.txt']:
            self.write(self.root / name, b'fixturelib==1.0\n')
        self.original_python = {'python': '3.12.14 synthetic fixture', 'architecture': 'arm64', 'installed_offline': True,
                                'versions': self.lock['versions'], 'wheels': self.lock['wheels']}
        self.inventory = {'executable': str(self.python), 'prefix': str(self.venv), 'basePrefix': str(self.root / 'base-python'),
                          'system': 'Darwin', 'architecture': 'arm64', 'version': '3.12.14',
                          'packages': {'fixturelib': {'version': '1.0', 'root': str(self.site)}}}
        roots = {'': {'packages': {'': {}}}, 'work/bench': {'packages': {'': {}}}}
        packages = [('', 'playwright', '1.62.1', {}),
                    ('work/bench', '@esbuild/darwin-arm64', '0.25.12', {'bin/esbuild': b'synthetic native binary'}),
                    ('work/bench', '@rollup/rollup-darwin-arm64', '4.63.1', {'rollup.node': b'synthetic rollup binary'}),
                    ('work/bench', 'esbuild', '0.25.12', {'bin/esbuild': b'synthetic upstream js wrapper'})]
        for directory, name, version, extra in packages:
            roots[directory]['packages']['node_modules/' + name] = self.npm(directory, name, version, extra)
        for directory, lock in roots.items():
            self.write(self.root / directory / 'package-lock.json', lock)
        # The single documented npm installation transform: esbuild's launcher
        # is replaced by the exact native binary whose locked tarball is checked.
        self.esbuild = self.root / 'work/bench/node_modules/esbuild/bin/esbuild'
        self.write(self.esbuild, b'synthetic native binary')
        self.original_npm = {'platform': 'darwin', 'arch': 'arm64', 'nodeExecutable': str(self.node), 'nodeVersion': 'v24.19.0',
                             'lockSha256': verify.sha(self.root / 'work/bench/package-lock.json'),
                             'packages': [{'name': name, 'version': version} for directory, name, version, _ in packages if directory]}
        self.node_old = {'passed': True, 'checkedInstalledPackages': [
            {'directory': directory or '.', 'package': 'node_modules/' + name, 'version': version}
            for directory, name, version, _ in packages]}
        self.args = argparse.Namespace(config=self.config_path, run_dir=self.run, wheels=self.wheels, npm_cache=self.cache,
            python_install_receipt=self.root / 'original/python.json', npm_install_receipt=self.root / 'original/npm.json',
            node_identities=self.root / 'original/node.json', node=None)
        self.write(self.args.python_install_receipt, self.original_python)
        self.write(self.args.npm_install_receipt, self.original_npm)
        self.write(self.args.node_identities, self.node_old)
        self.node_info = {'executable': str(self.node), 'version': 'v24.19.0', 'architecture': 'arm64', 'platform': 'darwin'}
        self.quality = {'host': {'python': '3.12.14'}, 'packages': {'fixturelib': '1.0'}, 'gt_manifest_sha256': 'a' * 64}
        self.write(self.run / 'quality/metrics/metrics-protocol.json', self.quality)

    def perform(self):
        with patch.object(verify, 'python_inventory', return_value=self.inventory), \
                patch.object(verify.subprocess, 'check_output', return_value=json.dumps(self.node_info)):
            return verify.verify(self.args, root=self.root)

    def validate(self):
        return verify.validate_receipt(self.setup / verify.RECEIPT_NAME, self.run, self.protocol, self.quality, root=self.root)

    def test_payloads_and_original_receipt_bytes_are_verified_without_claiming_installation(self):
        result = self.perform(); self.validate()
        self.assertTrue(result['verificationOnly']); self.assertFalse(result['installationPerformed'])
        self.assertEqual(result['python']['verifiedPayloadFiles'], 1)
        self.assertEqual(len(result['npm']['generatedReplacements']), 1)
        for original, name in [(self.args.python_install_receipt, 'python-installation.json'),
                               (self.args.npm_install_receipt, 'bench-npm-installation.json'),
                               (self.args.node_identities, 'node-identities.json')]:
            self.assertEqual(original.read_bytes(), (self.setup / verify.PROVENANCE_DIR / name).read_bytes())

    def test_existing_route_satisfies_package_without_any_installation_receipt(self):
        self.perform()
        lock = self.root / 'scripts/ground-truth-pixels-lock.json'; self.write(lock, {'synthetic': True})
        self.write(self.setup / 'ground-truth-verification.json', {'complete': True, 'images': 378,
            'allDecodedPixelHashesMatched': True, 'groundTruthManifestSha256': 'a' * 64, 'fixedPixelLockSha256': verify.sha(lock)})
        with patch.object(package, 'ROOT', self.root):
            paths, acceptance = package.setup_evidence(self.run)
        self.assertEqual(acceptance['dependencyReceipts'], [])
        self.assertEqual(len(acceptance['existingEnvironmentReceipts']), 1)
        self.assertTrue({verify.RECEIPT_NAME, verify.FILES_NAME, *verify.PROVENANCE_NAMES} <= {p.name for p in paths})
        self.assertFalse(any(p == self.args.python_install_receipt or p == self.python for p in paths))

    def test_gpu_lock_refuses_before_introspection_or_payload_work(self):
        self.write(self.root / 'results/gpu-session.lock', b'owned process')
        with patch.object(verify, 'python_inventory') as probe:
            with self.assertRaisesRegex(ValueError, 'Finish GPU'):
                verify.verify(self.args, root=self.root)
            probe.assert_not_called()

    def test_installed_python_payload_change_is_rejected(self):
        self.write(self.payload, b'# changed fixed synthetic wheel module\n')
        with self.assertRaisesRegex(ValueError, 'payload size differs|payload differs'):
            self.perform()

    def test_vendored_record_is_hashed_payload_not_a_second_installer_manifest(self):
        wheel = self.wheels / self.lock['wheels'][0]['file']
        nested = 'fixturelib/_vendor/dependency-1.0.dist-info/RECORD'
        data = b'fixed vendored metadata, not the wheel installer manifest\n'
        with zipfile.ZipFile(wheel) as archive:
            payload = archive.read('fixturelib/__init__.py')
            record = archive.read('fixturelib-1.0.dist-info/RECORD').decode()
        row = io.StringIO(); csv.writer(row, lineterminator='\n').writerow(
            [nested, 'sha256=' + base64.urlsafe_b64encode(hashlib.sha256(data).digest()).decode().rstrip('='), len(data)])
        with zipfile.ZipFile(wheel, 'w') as archive:
            archive.writestr('fixturelib/__init__.py', payload)
            archive.writestr(nested, data)
            archive.writestr('fixturelib-1.0.dist-info/RECORD', record + row.getvalue())
        self.write(self.site / nested, data)
        self.lock['wheels'][0].update(bytes=wheel.stat().st_size, sha256=verify.sha(wheel))
        self.write(self.root / 'config/python-wheels.lock.json', self.lock)
        self.write(self.args.python_install_receipt, self.original_python)
        result = self.perform(); self.validate()
        self.assertEqual(result['python']['verifiedPayloadFiles'], 2)
        self.write(self.site / nested, b'changed nested metadata')
        with self.assertRaisesRegex(ValueError, 'Verified existing dependency/source changed'):
            self.validate()

    def test_npm_generated_binary_must_equal_the_verified_native_payload(self):
        self.write(self.esbuild, b'unsupported generated binary')
        with self.assertRaisesRegex(ValueError, 'Generated esbuild binary differs'):
            self.perform()

    def test_cached_npm_tarball_tampering_is_rejected(self):
        path = next(p for p in (self.cache / '_cacache/content-v2').rglob('*') if p.is_file())
        path.write_bytes(path.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'npm cache tarball'):
            self.perform()

    def test_original_wheel_identity_cannot_be_replaced_by_matching_version_only(self):
        self.original_python['wheels'] = [dict(self.lock['wheels'][0], sha256='0' * 64)]
        self.write(self.args.python_install_receipt, self.original_python)
        with self.assertRaisesRegex(ValueError, 'installed wheel identities differ'):
            self.perform()

    def test_wrong_actual_python_or_node_identity_is_rejected(self):
        self.inventory['executable'] = str(self.root / 'other/bin/python')
        with self.assertRaisesRegex(ValueError, 'Actual Python'):
            self.perform()
        self.inventory['executable'] = str(self.python); self.node_info['version'] = 'v22.0.0'
        with self.assertRaisesRegex(ValueError, 'Actual Node'):
            self.perform()

    def test_no_overwrite_of_prior_verification(self):
        self.perform()
        with self.assertRaisesRegex(ValueError, 'must be preserved'):
            self.perform()

    def test_package_rejects_changed_dependency_after_verification(self):
        self.perform(); self.payload.write_bytes(b'changed after verification')
        with self.assertRaisesRegex(ValueError, 'Verified existing dependency/source changed'):
            self.validate()

    def test_package_rejects_different_run_quality_or_config(self):
        self.perform(); self.quality['packages']['fixturelib'] = '2.0'
        with self.assertRaisesRegex(ValueError, 'runtime versions differ'):
            self.validate()
        self.quality['packages']['fixturelib'] = '1.0'
        self.config['pythonExecutable'] = str(self.root / 'different/bin/python'); self.write(self.config_path, self.config)
        with self.assertRaisesRegex(ValueError, 'configured Python identity changed'):
            self.validate()

    def test_preserved_original_receipt_cannot_be_changed(self):
        self.perform(); path = self.setup / verify.PROVENANCE_DIR / 'python-installation.json'
        path.write_bytes(path.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'preserved evidence changed'):
            self.validate()

    def test_traversal_in_dependency_member_is_rejected(self):
        for name in ['../other', '/absolute', 'package/../../outside', 'package\\bad']:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Unsafe dependency member'):
                verify.safe_relative(name)

    def test_preserved_receipt_symlink_escape_is_rejected(self):
        self.perform(); path = self.setup / verify.PROVENANCE_DIR / 'python-installation.json'
        path.unlink(); path.symlink_to(self.args.python_install_receipt)
        with self.assertRaisesRegex(ValueError, 'preserved evidence changed'):
            self.validate()


if __name__ == '__main__':
    unittest.main(verbosity=2)
