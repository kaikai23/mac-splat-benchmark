#!/usr/bin/env python3
"""Read actual Mac hardware/OS/Chrome metadata without creating a GPU workload."""
from __future__ import annotations
import argparse
import datetime
import json
import platform
import plistlib
import shutil
import sys
from portable_common import command, find_chrome, save, sha


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chrome')
    parser.add_argument('--output')
    parser.add_argument('--hash-browser', action='store_true')
    args = parser.parse_args()
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise RuntimeError('Use native arm64 Python on the target Apple Silicon Mac; do not run under Rosetta')
    chrome = find_chrome(args.chrome)
    plist = chrome.parents[1] / 'Info.plist'
    chrome_info = plistlib.loads(plist.read_bytes()) if plist.is_file() else {}
    display_command = command(['/usr/sbin/system_profiler', 'SPDisplaysDataType', '-json'])
    display_data = json.loads(display_command['stdout']) if display_command['exitCode'] == 0 else {}
    # Keep GPU facts; do not publish machine serials, hardware UUIDs or usernames.
    display_fields = ['sppci_model', 'sppci_cores', 'spdisplays_vendor', 'spdisplays_metal', 'sppci_device_type']
    gpus = [{k: row[k] for k in display_fields if k in row} for row in display_data.get('SPDisplaysDataType', [])]
    result = dict(schema='portable-mac-environment-diagnostic-v1',
         recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
         platform=platform.system(), architecture=platform.machine(), pythonVersion=platform.python_version(),
         os=command(['/usr/bin/sw_vers']), chip=command(['/usr/sbin/sysctl', '-n', 'machdep.cpu.brand_string']),
         memory=command(['/usr/sbin/sysctl', '-n', 'hw.memsize']), graphics=gpus,
         chromeExecutable=str(chrome), chromeVersion=chrome_info.get('CFBundleShortVersionString'),
         chromeSha256=sha(chrome) if args.hash_browser else None,
         node=command([shutil.which('node'), '--version']) if shutil.which('node') else None,
         power=command(['/usr/bin/pmset', '-g', 'batt']), powerProfiles=command(['/usr/bin/pmset', '-g', 'custom']),
         gpuCapability='Not tested here; runner must execute WebGPU/WebGL timer probes on this Mac.',
         privacy='Runtime paths belong only in ignored results/local configuration, not committed reports.', gpuWorkPerformed=False)
    if args.output:
        save(args.output, result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
