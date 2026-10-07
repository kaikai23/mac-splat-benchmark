"""Inventory/download the 378 official heldout images using bounded ZIP ranges.

Choose explicit direct retrieval on the colleague's Mac, or retrieval on ecofde
followed by transfer of the verified output. There is no implicit network mode.
Does not require torch, never trains/renders, and never reads model PLY payloads.
"""
from __future__ import annotations
import argparse, concurrent.futures, datetime, hashlib, io, json, pathlib
import struct, time, subprocess, tempfile, zipfile, zlib


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, indent=2) + '\n')
    tmp.replace(path)


def request(url, start, end, return_headers=False):
    expected = end - start + 1
    for attempt in range(10):
        try:
            with tempfile.NamedTemporaryFile() as headers_file:
                result = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--max-time', '90', '--range', f'{start}-{end}', '--max-filesize', str(expected),
                    '--dump-header', headers_file.name, url], capture_output=True)
                if result.returncode:
                    raise ValueError(result.stderr.decode(errors='replace'))
                blocks = pathlib.Path(headers_file.name).read_text().strip().split('\n\n')
                lines = blocks[-1].splitlines()
                if lines[0].split()[1] != '206': raise ValueError('Expected HTTP206; refusing full archive')
                headers = dict(line.split(':', 1) for line in lines[1:] if ':' in line)
                headers = {k.lower(): v.strip() for k, v in headers.items()}
                if not headers.get('content-range', '').startswith(f'bytes {start}-{end}/'):
                    raise ValueError(f'Incorrect range response: {headers}')
                if len(result.stdout) != expected: raise ValueError('Range length differs')
                return (result.stdout, headers) if return_headers else result.stdout
        except Exception:
            if attempt == 9:
                raise
            time.sleep(min(16, 2 ** attempt))


class RemoteZip(io.RawIOBase):
    def __init__(self, source, cache_dir):
        self.url = source['url']
        _, headers = request(self.url, 0, 0, return_headers=True)
        self.size = int(headers['content-range'].split('/')[-1])
        self.headers = {k: headers.get(k) for k in ['etag', 'last-modified', 'content-range']}
        self.pos = 0
        self.cache_start = max(0, self.size - 2 * 1024 * 1024)
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache = cache_dir / (source['id'] + f'-{self.size}-tail.bin')
        if not cache.exists():
            cache.write_bytes(request(self.url, self.cache_start, self.size - 1))
        self.cache = cache.read_bytes()
        if len(self.cache) != self.size - self.cache_start:
            raise ValueError('Truncated cached ZIP tail')

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos
    def read(self, size=-1):
        size = min(self.size - self.pos, size if size >= 0 else self.size - self.pos)
        if size <= 0: return b''
        if size > 16 * 1024 * 1024:
            raise ValueError('Unexpected large ZIP metadata read')
        if self.pos >= self.cache_start:
            result = self.cache[self.pos - self.cache_start:self.pos - self.cache_start + size]
        else:
            result = request(self.url, self.pos, self.pos + size - 1)
        self.pos += len(result)
        return result


def inventory(selection, output):
    scenes = {s['scene']: s for s in selection['scenes']}
    entries, sources = [], []
    for source in selection['sources']:
        remote = RemoteZip(source, output / 'zip-metadata')
        archive = zipfile.ZipFile(remote)
        infos = archive.infolist()
        sources.append(dict(source, archive_bytes=remote.size, headers=remote.headers,
                            inventory_entries=len(infos)))
        for scene_name in source['scenes']:
            scene = scenes[scene_name]
            for index, camera in enumerate(scene['cameras']):
                suffix = f"/{scene_name}/{scene['image_dir']}/{camera['img_name']}"
                matches = [i for i in infos if ('/' + str(pathlib.PurePosixPath(i.filename).with_suffix(''))).endswith(suffix)
                           and pathlib.PurePosixPath(i.filename).suffix.lower() in ['.png', '.jpg', '.jpeg']]
                if len(matches) != 1:
                    raise ValueError(f'{scene_name}/{camera["img_name"]}: {len(matches)} source images')
                info = matches[0]
                entries.append(dict(scene=scene_name, camera_index=index, img_name=camera['img_name'],
                                    source_id=source['id'], url=source['url'], member=info.filename,
                                    bytes=info.file_size, compressed_bytes=info.compress_size,
                                    crc32=f'{info.CRC:08x}', compression=info.compress_type,
                                    header_offset=info.header_offset,
                                    relative_path=f"source/{scene_name}/{pathlib.PurePosixPath(info.filename).name}"))
        print(source['id'], 'selected', len(entries), flush=True)
    result = dict(schema='mac-ground-truth-inventory-v1', created_at=stamp(),
                  selected_images=len(entries), selected_bytes=sum(e['bytes'] for e in entries),
                  selected_compressed_bytes=sum(e['compressed_bytes'] for e in entries),
                  sources=sources, entries=entries,
                  selection_sha256=hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest())
    if len(entries) != sum(len(s['cameras']) for s in selection['scenes']):
        raise ValueError('Incomplete requested image set')
    save(output / 'inventory.json', result)
    return result


def acquire(entry, output):
    target = output / entry['relative_path']
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        image = target.read_bytes()
    else:
        off = entry['header_offset']
        header = request(entry['url'], off, off + 29)
        fields = struct.unpack('<IHHHHHIIIHH', header)
        if fields[0] != 0x04034b50 or fields[3] != entry['compression']:
            raise ValueError('ZIP local header differs')
        start = off + 30 + fields[-2] + fields[-1]
        if entry['compressed_bytes'] > 32 * 1024 * 1024 or entry['bytes'] > 64 * 1024 * 1024:
            raise ValueError('Unexpectedly large single photo')
        data = request(entry['url'], start, start + entry['compressed_bytes'] - 1)
        if entry['compression'] == zipfile.ZIP_DEFLATED:
            image = zlib.decompress(data, -15)
        elif entry['compression'] == zipfile.ZIP_STORED:
            image = data
        else:
            raise ValueError('Unsupported ZIP compression')
    if len(image) != entry['bytes'] or f'{zlib.crc32(image):08x}' != entry['crc32']:
        raise ValueError(f'Source photo CRC/length mismatch: {target}')
    if not target.exists():
        tmp = target.with_suffix(target.suffix + '.part')
        tmp.write_bytes(image)
        tmp.replace(target)
    return dict(entry, sha256=hashlib.sha256(image).hexdigest())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--selection', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--network-node', choices=['ecofde', 'direct'], required=True,
                        help='direct explicitly permits official-source retrieval on this host; ecofde preserves the remote-node workflow')
    parser.add_argument('--max-bytes', type=int, default=1024 * 1024 * 1024)
    args = parser.parse_args()
    import platform
    if args.network_node == 'ecofde' and platform.system() == 'Darwin':
        raise ValueError('ecofde mode must run on that remote node; use explicit --network-node direct for retrieval on this Mac')
    selection = json.loads(args.selection.read_text())
    path = args.output / 'inventory.json'
    inv = json.loads(path.read_text()) if path.exists() else inventory(selection, args.output)
    expected_sha = hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest()
    if inv['selection_sha256'] != expected_sha:
        raise ValueError('Inventory belongs to different camera selection')
    print(json.dumps({k: inv[k] for k in ['selected_images', 'selected_bytes', 'selected_compressed_bytes']}), flush=True)
    if not args.download: return
    if inv['selected_bytes'] > args.max_bytes:
        raise ValueError('Selected photo footprint exceeds explicit bound')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        records = []
        for i, entry in enumerate(pool.map(lambda e: acquire(e, args.output), inv['entries'])):
            records.append(entry)
            if (i + 1) % 25 == 0: print('CRC verified', i + 1, '/', len(inv['entries']), flush=True)
    manifest_path = args.output / 'source-manifest.json'
    inventory_sha = hashlib.sha256(path.read_bytes()).hexdigest()
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text())
        if (not previous['complete'] or previous['entries'] != records or
                previous['inventory_sha256'] != inventory_sha or previous['selection_sha256'] != expected_sha):
            raise ValueError('Existing GT source manifest differs; refusing silent replacement')
        print('VERIFIED existing manifest', len(records), 'photos', flush=True)
        return
    save(manifest_path, dict(schema='mac-ground-truth-sources-v1',
         completed_at=stamp(), complete=True, entries=records, sources=inv['sources'],
         inventory_sha256=inventory_sha,
         selection_sha256=expected_sha, network_node=args.network_node))
    print('VERIFIED', len(records), 'photos', flush=True)


if __name__ == '__main__': main()
