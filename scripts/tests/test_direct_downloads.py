"""Offline behavioral checks for locked direct downloads; never contacts a server."""
from __future__ import annotations
import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deps = load('dependency_downloader_test', 'fetch-offline-dependencies.py')
models = load('model_downloader_test', 'restore-models.py')


class Response(io.BytesIO):
    def __init__(self, body, status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers if headers is not None else {'Content-Length': str(len(body))}


class DependencyDownloadTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'artifact.whl'
        self.partial = self.path.with_suffix('.whl.partial')
        self.data = b'locked dependency bytes'
        self.sha = hashlib.sha256(self.data).hexdigest()
        self.url = 'https://files.pythonhosted.org/packages/test/artifact.whl'

    def download(self, **kwargs):
        return deps.download(self.url, self.path, expected_sha=self.sha, expected_bytes=len(self.data), **kwargs)

    def test_explicit_network_policy(self):
        for module in [deps, models]:
            module.validate_network_mode('direct', 'Darwin')
            module.validate_network_mode('direct', 'Linux')
            module.validate_network_mode('ecofde', 'Linux')
            with self.assertRaises((RuntimeError, ValueError)):
                module.validate_network_mode('ecofde', 'Darwin')
            with self.assertRaises(ValueError):
                module.validate_network_mode(None, 'Darwin')

    def test_verified_final_reused_without_network(self):
        self.path.write_bytes(self.data)
        with patch.object(deps.urllib.request, 'urlopen', side_effect=AssertionError('network')):
            self.assertEqual(self.download(), 'reused')

    def test_wrong_final_preserved(self):
        self.path.write_bytes(b'wrong')
        with patch.object(deps.urllib.request, 'urlopen', side_effect=AssertionError('network')):
            with self.assertRaises(ValueError): self.download()
        self.assertEqual(self.path.read_bytes(), b'wrong')

    def test_complete_partial_published_without_network(self):
        self.partial.write_bytes(self.data)
        with patch.object(deps.urllib.request, 'urlopen', side_effect=AssertionError('network')):
            self.assertEqual(self.download(), 'reused-complete-partial')
        self.assertEqual(self.path.read_bytes(), self.data)
        self.assertFalse(self.partial.exists())

    def test_resume_correct_range(self):
        self.partial.write_bytes(self.data[:4])
        def respond(request, **kwargs):
            self.assertEqual(request.get_header('Range'), 'bytes=4-')
            return Response(self.data[4:], 206, {'Content-Range': f'bytes 4-{len(self.data)-1}/{len(self.data)}',
                                                'Content-Length': str(len(self.data)-4)})
        with patch.object(deps.urllib.request, 'urlopen', side_effect=respond): self.download()
        self.assertEqual(self.path.read_bytes(), self.data)

    def test_ignored_range_restarts_scratch(self):
        self.partial.write_bytes(b'old prefix')
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(self.data)):
            self.download()
        self.assertEqual(self.path.read_bytes(), self.data)

    def test_invalid_range_rejected_before_append(self):
        for value in ['bytes 0-21/22', 'bytes 4-21/100', 'bytes 4-20/22', 'garbage']:
            self.partial.write_bytes(self.data[:4])
            with patch.object(deps.urllib.request, 'urlopen', return_value=Response(b'x', 206, {'Content-Range': value})):
                with self.assertRaises(ValueError): self.download()
            self.assertEqual(self.partial.read_bytes(), self.data[:4])
            self.assertFalse(self.path.exists())

    def test_oversized_content_length_rejected(self):
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(self.data, headers={'Content-Length': '1000000000'})):
            with self.assertRaises(ValueError): self.download()
        self.assertFalse(self.path.exists())

    def test_truncated_response_retried_from_retained_prefix(self):
        requests = []
        def respond(request, **kwargs):
            requests.append(request.get_header('Range'))
            if len(requests) == 1:
                return Response(self.data[:4], headers={'Content-Length': str(len(self.data))})
            return Response(self.data[4:], 206, {'Content-Range': f'bytes 4-{len(self.data)-1}/{len(self.data)}',
                                                'Content-Length': str(len(self.data)-4)})
        with patch.object(deps.urllib.request, 'urlopen', side_effect=respond), patch.object(deps.time, 'sleep'):
            self.download()
        self.assertEqual(requests, [None, 'bytes=4-'])
        self.assertEqual(self.path.read_bytes(), self.data)

    def test_http_404_is_not_retried(self):
        with patch.object(deps.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError(self.url, 404, 'missing', {}, None)) as opening:
            with self.assertRaises(urllib.error.HTTPError): self.download()
        self.assertEqual(opening.call_count, 1)

    def test_retries_are_bounded(self):
        with patch.object(deps.urllib.request, 'urlopen', side_effect=urllib.error.URLError('offline')) as opening, patch.object(deps.time, 'sleep'):
            with self.assertRaises(urllib.error.URLError): self.download(attempts=3)
        self.assertEqual(opening.call_count, 3)
        self.assertFalse(self.path.exists())

    def test_completed_bad_hash_is_quarantined_not_published(self):
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(b'x' * len(self.data))):
            with self.assertRaises(ValueError): self.download()
        self.assertFalse(self.path.exists())
        self.assertFalse(self.partial.exists())
        rejected = list(self.path.parent.glob('*.rejected-*'))
        self.assertEqual(len(rejected), 1)
        self.assertEqual(rejected[0].read_bytes(), b'x' * len(self.data))

    def test_bad_complete_scratch_preserved_then_fresh_download(self):
        self.partial.write_bytes(b'x' * len(self.data))
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(self.data)):
            self.download()
        self.assertEqual(self.path.read_bytes(), self.data)
        self.assertEqual(len(list(self.path.parent.glob('*.rejected-*'))), 1)

    def test_scratch_symlink_cannot_truncate_other_file(self):
        other = self.path.parent / 'other'; other.write_bytes(b'keep')
        self.partial.symlink_to(other)
        with self.assertRaises(ValueError): self.download()
        self.assertEqual(other.read_bytes(), b'keep')

    def test_publish_does_not_overwrite_concurrent_destination(self):
        self.partial.write_bytes(self.data); self.path.write_bytes(b'keep')
        with self.assertRaises(ValueError):
            deps.publish_verified(self.partial, self.path, lambda p: p.read_bytes() == self.data)
        self.assertEqual(self.path.read_bytes(), b'keep')
        self.assertTrue(self.partial.exists())

    def test_npm_integrity_and_source_restrictions(self):
        integrity = 'sha512-' + base64.b64encode(hashlib.sha512(self.data).digest()).decode()
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(self.data)):
            deps.download('https://registry.npmjs.org/pkg/-/pkg.tgz', self.path, integrity=integrity)
        self.assertEqual(self.path.read_bytes(), self.data)
        for url in ['http://registry.npmjs.org/pkg', 'https://example.org/pkg', 'https://user:secret@registry.npmjs.org/pkg']:
            with self.assertRaises(ValueError): deps.official_url(url)

    def test_pypi_metadata_keeps_local_lock_authority(self):
        entry = dict(file='example-1.0-py3-none-any.whl', sha256=self.sha, bytes=len(self.data))
        record = dict(filename=entry['file'], digests={'sha256': self.sha}, size=len(self.data), url=self.url)
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(json.dumps({'urls': [record]}).encode())):
            self.assertEqual(deps.locked_wheel_url(entry), self.url)
        record['size'] += 1
        with patch.object(deps.urllib.request, 'urlopen', return_value=Response(json.dumps({'urls': [record]}).encode())):
            with self.assertRaises(ValueError): deps.locked_wheel_url(entry)

    def test_main_reuses_complete_wheel_without_pypi(self):
        root = self.path.parent / 'repo'; cache = self.path.parent / 'cache'
        for name in ['package-lock.json', 'work/bench/package-lock.json']:
            p = root / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps({'packages': {}}))
        entry = dict(file='example-1.0-py3-none-any.whl', sha256=self.sha, bytes=len(self.data))
        (root/'config').mkdir(); (root/'config/python-wheels.lock.json').write_text(json.dumps({'wheels': [entry]}))
        target = cache/'python-wheels'/entry['file']; target.parent.mkdir(parents=True); target.write_bytes(self.data)
        with patch.object(deps, 'REPO', root), patch.object(sys, 'argv', ['fetch', '--network-node', 'direct', '--output', str(cache)]), patch.object(deps.platform, 'system', return_value='Darwin'), patch.object(deps.urllib.request, 'urlopen', side_effect=AssertionError('network')):
            deps.main()
        receipt = json.loads((cache/'dependency-cache-receipt.json').read_text())
        self.assertEqual(receipt['networkNode'], 'direct')
        self.assertEqual(receipt['pythonWheels'], [entry])


class ModelRangeTests(unittest.TestCase):
    def fake_curl(self, body=b'xyz', status=206, content_range=None):
        def run(args, **kwargs):
            self.assertIn('--max-filesize', args)
            headers = Path(args[args.index('--dump-header') + 1])
            value = content_range or f'bytes 0-2/{models.ARCHIVE_BYTES}'
            headers.write_bytes(f'HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 {status}\r\ncontent-range: {value}\r\n\r\n'.encode())
            return subprocess.CompletedProcess(args, 0, body, b'')
        return run

    def test_locked_exact_range(self):
        with patch.object(models.subprocess, 'run', side_effect=self.fake_curl()):
            self.assertEqual(models.range_bytes(0, 2, '/usr/bin/curl'), b'xyz')

    def test_wrong_status_range_length_and_bound_rejected(self):
        for fake in [self.fake_curl(status=200), self.fake_curl(content_range='bytes 1-3/4'), self.fake_curl(body=b'x')]:
            with patch.object(models.subprocess, 'run', side_effect=fake):
                with self.assertRaises(ValueError): models.range_bytes(0, 2, '/usr/bin/curl')
        with self.assertRaises(ValueError): models.range_bytes(0, 8*1024*1024, '/usr/bin/curl')

    def test_resumable_zip_extraction_crc_sha_and_existing_reuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); destination = root/'data'; destination.mkdir(); locks = root/'locks'; locks.mkdir()
            payload = b'locked original payload\n' * 8; member_name = 'bicycle/cfg_args'
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive: archive.writestr(member_name, payload)
            archive_bytes = buffer.getvalue()
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive: info = archive.getinfo(member_name)
            item = dict(relative_path=member_name, archive_member=member_name, bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(), zip_crc32=f'{info.CRC:08x}')
            (locks/'official-archive-inventory.json').write_text(json.dumps([dict(path=member_name, size=len(payload), crc32=item['zip_crc32'], header_offset=0, compressed_size=info.compress_size)]))
            target = destination/member_name; target.parent.mkdir()
            header = struct.unpack('<IHHHHHIIIHH', archive_bytes[:30]); begin = 30+header[-2]+header[-1]
            partial = target.with_name(target.name+'.mac-download.compressed.part'); partial.write_bytes(archive_bytes[begin:begin+5])
            ranges = []
            def ranged(start, end, curl): ranges.append((start,end)); return archive_bytes[start:end+1]
            with patch.object(models.shutil, 'which', return_value='/usr/bin/curl'), patch.object(models, 'range_bytes', side_effect=ranged):
                models.fetch_originals(destination, locks, [item])
            self.assertEqual(target.read_bytes(), payload)
            self.assertIn((begin+5, begin+info.compress_size-1), ranges)
            self.assertFalse(partial.exists())
            with patch.object(models.shutil, 'which', return_value='/usr/bin/curl'), patch.object(models, 'range_bytes', side_effect=AssertionError('network')):
                models.fetch_originals(destination, locks, [item])


if __name__ == '__main__':
    unittest.main()
