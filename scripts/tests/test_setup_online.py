"""Offline orchestration boundaries; no network, GPU, models or installed deps.

Run: python3.12 -m unittest discover -s scripts/tests -p 'test_setup_online.py' -v
The process-cleanup cases launch only this test's Python sleepers and always clean
up their known process groups, including after a failed assertion.
"""
from __future__ import annotations
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('setup_online_under_test', SCRIPTS / 'setup-online.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class TemporaryRepository(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='setup-online-test-')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.repo = self.base / 'repo'
        self.repo.mkdir()
        for folder in ('config', 'scripts', 'results', 'work/bench'):
            (self.repo / folder).mkdir(parents=True, exist_ok=True)
        self.data = self.base / 'data'
        self.cache = self.base / 'cache'
        self.output = self.repo / 'results/run'
        self.config = self.repo / 'config/local-test.json'
        self.chrome = self.base / 'Chrome'
        self.chrome.write_text('test-only executable placeholder')
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(patch.object(setup, 'REPO', self.repo))
        self.patches.enter_context(patch.object(setup, 'resolve', side_effect=self.resolve))

    def resolve(self, value):
        path = Path(value).expanduser()
        return (path if path.is_absolute() else self.repo / path).resolve()

    def check(self, **changes):
        values = dict(data=self.data, cache=self.cache, output=self.output, config=self.config)
        values.update(changes)
        setup.check_paths(**values)

    def write_config(self, value):
        self.config.write_text(json.dumps(value, indent=2) + '\n')

    def preflight_mocks(self):
        stack = contextlib.ExitStack()
        stack.enter_context(patch.object(setup.platform, 'system', return_value='Darwin'))
        stack.enter_context(patch.object(setup.platform, 'machine', return_value='arm64'))
        stack.enter_context(patch.object(setup.shutil, 'which', side_effect=lambda name: str(name)))
        stack.enter_context(patch.object(setup, 'find_chrome', return_value=self.chrome))
        def metadata(command, **unused):
            if '-p' in command:
                return json.dumps(dict(arch='arm64', major=24))
            return json.dumps(dict(version=[3, 12], arch='arm64'))
        stack.enter_context(patch.object(setup.subprocess, 'check_output', side_effect=metadata))
        stack.enter_context(patch.object(sys, 'argv', ['setup-online.py', '--data-root', str(self.data),
            '--cache', str(self.cache), '--output-root', str(self.output), '--config', str(self.config),
            '--python', sys.executable, '--chrome', str(self.chrome)]))
        stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        return stack


class PathAndConfigurationTests(TemporaryRepository):
    def test_disjoint_roots_are_allowed_without_writes(self):
        self.check()
        self.assertFalse(self.data.exists())
        self.assertFalse(self.cache.exists())
        self.assertFalse(self.output.exists())

    def test_tracked_source_roots_are_rejected(self):
        for field in ('data', 'cache'):
            for directory in ('work', 'runner', 'validation', 'config', 'quality', 'analysis', 'scripts', '.git', '.venv', 'node_modules'):
                with self.subTest(field=field, directory=directory), self.assertRaises(ValueError):
                    self.check(**{field: self.repo / directory / 'unsafe'})
        for directory in ('work', 'quality', 'config'):
            with self.subTest(output=directory), self.assertRaises(ValueError):
                self.check(output=self.repo / directory / 'unsafe')

    def test_existing_nondirectory_asset_roots_are_rejected(self):
        for field in ('data', 'cache', 'output'):
            path = getattr(self, field)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('preserve this file')
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'non-directory'):
                self.check()
            self.assertEqual(path.read_text(), 'preserve this file')
            path.unlink()

    def test_ancestor_nested_and_shared_roots_are_rejected(self):
        invalid = [dict(data=self.repo), dict(cache=self.base), dict(output=self.repo/'results'),
                   dict(output=self.base/'outside'), dict(cache=self.data),
                   dict(cache=self.data/'cache'), dict(data=self.cache/'data'),
                   dict(data=self.output/'data'), dict(cache=self.output/'cache'),
                   dict(data=self.repo/'results'), dict(cache=self.repo/'results')]
        for values in invalid:
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.check(**values)

    def test_symlink_alias_to_tracked_source_is_rejected_after_cli_resolution(self):
        alias = self.base / 'alias'
        alias.symlink_to(self.repo/'quality', target_is_directory=True)
        with self.assertRaises(ValueError):
            self.check(data=self.resolve(alias))

    def test_only_ignored_local_configuration_names_are_allowed(self):
        for path in (self.repo/'config/example.json', self.repo/'local.json', self.repo/'config/local-test.yaml'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.check(config=path)

    def test_gpu_lock_and_existing_measurements_are_rejected(self):
        lock=self.repo/'results/gpu-session.lock';lock.write_text('{"owned":true}')
        with self.assertRaisesRegex(ValueError, 'GPU'):
            self.check()
        self.assertTrue(lock.exists())
        lock.unlink()
        for relative in ('protocol.json','pilot/protocol.json','formal/protocol.json'):
            path=self.output/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('{}')
            with self.subTest(relative=relative), self.assertRaisesRegex(ValueError,'measurements'):
                self.check()
            path.unlink()

    def test_existing_mismatched_config_stops_before_any_stage_and_preserves_bytes(self):
        self.write_config(dict(dataRoot='another-experiment', custom='keep me'))
        before=self.config.read_bytes()
        with self.preflight_mocks(), patch.object(setup,'execute') as execute:
            with self.assertRaisesRegex(ValueError,'Existing local config'):
                setup.main()
        execute.assert_not_called()
        self.assertEqual(self.config.read_bytes(),before)
        self.assertFalse(self.output.exists())
        self.assertFalse((self.repo/'results/setup/online-setup.lock').exists())

    def test_matching_config_validation_preserves_extra_fields_and_bytes(self):
        expected=setup.configuration(self.data,self.cache,self.output,self.chrome)
        self.write_config(dict(expected, custom='preserve extra settings'))
        before=self.config.read_bytes()
        setup.check_existing_config(self.config,expected)
        self.assertEqual(self.config.read_bytes(),before)

    def test_legacy_missing_or_global_validation_root_is_not_silently_migrated(self):
        expected=setup.configuration(self.data,self.cache,self.output,self.chrome)
        for legacy in (None,str(self.repo/'results/setup')):
            actual=dict(expected,custom='keep legacy evidence')
            if legacy is None:actual.pop('validationRoot')
            else:actual['validationRoot']=legacy
            self.write_config(actual);before=self.config.read_bytes()
            with self.preflight_mocks(),patch.object(setup,'execute') as execute:
                with self.assertRaisesRegex(ValueError,'validationRoot'):
                    setup.main()
            execute.assert_not_called()
            self.assertEqual(self.config.read_bytes(),before)
            self.assertFalse(self.output.exists())

    def test_distinct_runs_have_disjoint_prerequisite_files(self):
        configurations=[setup.configuration(self.data,self.cache,self.repo/'results'/name,self.chrome)
                        for name in ('first-run','second-run')]
        evidence=['supersplat-worker.json','spark-native-sort-cpu-validation.json',
                  'native-prepare-lifecycle-review.json','gpu-probe/gpu-probe-metal.json']
        first={Path(configurations[0]['validationRoot'])/name for name in evidence}
        second={Path(configurations[1]['validationRoot'])/name for name in evidence}
        self.assertTrue(first.isdisjoint(second))
        for path in first:
            path.parent.mkdir(parents=True,exist_ok=True);path.write_text('first run evidence\n')
        for path in second:
            path.parent.mkdir(parents=True,exist_ok=True);path.write_text('second run evidence\n')
        self.assertTrue(all(path.read_text()=='first run evidence\n' for path in first))
        self.assertFalse((self.repo/'results/setup/gpu-probe/gpu-probe-metal.json').exists())


class StageFailureTests(TemporaryRepository):
    def make_success_hash_inputs(self):
        (self.repo/'config/data-lock.json').write_text('{}')
        (self.repo/'scripts/ground-truth-pixels-lock.json').write_text('{}')

    def test_matching_existing_config_is_preserved_by_entire_pipeline(self):
        self.make_success_hash_inputs()
        self.write_config(dict(setup.configuration(self.data,self.cache,self.output,self.chrome),
                               custom='keep this extra setting'))
        before=self.config.read_bytes();calls=[]
        def execute(command,log):
            calls.append(command[0]);log.write_text('completed\n')
        with self.preflight_mocks(),patch.object(setup,'steps',return_value=[
                ('first',['first']),('configure-target-mac',['must-not-run']),('record-environment',['environment'])]), \
                patch.object(setup,'execute',side_effect=execute):
            setup.main()
        self.assertEqual(calls,['first','environment'])
        self.assertEqual(self.config.read_bytes(),before)
        receipt=json.loads(next((self.output/'setup').glob('online-*/setup.json')).read_text())
        self.assertTrue(receipt['complete'])
        self.assertEqual(receipt['steps'][1]['action'],'preserved-matching-existing-config')

    def test_config_modified_during_downloads_is_preserved_and_stops_setup(self):
        expected=setup.configuration(self.data,self.cache,self.output,self.chrome)
        self.write_config(expected);calls=[]
        def user_edit(command,log):
            calls.append(command[0]);log.write_text('download complete\n')
            self.write_config(dict(expected,custom='concurrent user edit'))
        with self.preflight_mocks(),patch.object(setup,'steps',return_value=[
                ('first',['first']),('configure-target-mac',['configure']),('last',['last'])]), \
                patch.object(setup,'execute',side_effect=user_edit):
            with self.assertRaisesRegex(ValueError,r'(?i)config(?:uration)? changed'):
                setup.main()
        self.assertEqual(calls,['first'])
        self.assertEqual(json.loads(self.config.read_text())['custom'],'concurrent user edit')
        self.assertFalse((self.repo/'results/setup/online-setup.lock').exists())

    def test_config_modified_during_final_environment_step_cannot_be_marked_complete(self):
        self.make_success_hash_inputs()
        expected=setup.configuration(self.data,self.cache,self.output,self.chrome)
        self.write_config(expected)
        def final_user_edit(command,log):
            log.write_text('environment completed\n')
            self.write_config(dict(expected,custom='late concurrent edit'))
        with self.preflight_mocks(),patch.object(setup,'steps',return_value=[
                ('configure-target-mac',['configure']),('record-environment',['environment'])]), \
                patch.object(setup,'execute',side_effect=final_user_edit):
            with self.assertRaisesRegex(ValueError,r'(?i)config(?:uration)? changed'):
                setup.main()
        receipt=json.loads(next((self.output/'setup').glob('online-*/setup.json')).read_text())
        self.assertFalse(receipt['complete'])
        self.assertEqual(json.loads(self.config.read_text())['custom'],'late concurrent edit')

    def test_failure_does_not_continue_and_releases_only_owned_setup_lock(self):
        calls=[]
        def fail(command,log):
            calls.append(command[0]);log.write_text('controlled failure\n')
            raise subprocess.CalledProcessError(7,command)
        with self.preflight_mocks(), patch.object(setup,'steps',return_value=[('first',['first']),('second',['second'])]), \
                patch.object(setup,'execute',side_effect=fail):
            with self.assertRaises(subprocess.CalledProcessError):
                setup.main()
        self.assertEqual(calls,['first'])
        receipts=list((self.output/'setup').glob('online-*/setup.json'))
        self.assertEqual(len(receipts),1)
        receipt=json.loads(receipts[0].read_text())
        self.assertFalse(receipt['complete'])
        self.assertEqual([s['name'] for s in receipt['steps']],['first'])
        self.assertFalse(receipt['steps'][0]['complete'])
        self.assertFalse((self.repo/'results/setup/online-setup.lock').exists())
        self.assertFalse(self.config.exists())

    def test_existing_setup_lock_is_not_removed_or_overwritten(self):
        lock=self.repo/'results/setup/online-setup.lock';lock.parent.mkdir();lock.write_text('{"identity":"other-owner"}\n')
        before=lock.read_bytes()
        with self.preflight_mocks(),patch.object(setup,'execute') as execute:
            with self.assertRaises(FileExistsError):setup.main()
        execute.assert_not_called()
        self.assertEqual(lock.read_bytes(),before)

    def test_gpu_lock_appearing_between_stages_stops_before_next_stage(self):
        calls=[];gpu=self.repo/'results/gpu-session.lock'
        def finish_then_lock(command,log):
            calls.append(command[0]);log.write_text('done\n');gpu.write_text('{"identity":"new-gpu-owner"}')
        with self.preflight_mocks(),patch.object(setup,'steps',return_value=[('first',['first']),('second',['second'])]), \
                patch.object(setup,'execute',side_effect=finish_then_lock):
            with self.assertRaisesRegex(ValueError,'GPU work started'):
                setup.main()
        self.assertEqual(calls,['first'])
        self.assertTrue(gpu.exists())
        self.assertEqual(json.loads(gpu.read_text())['identity'],'new-gpu-owner')
        self.assertFalse((self.repo/'results/setup/online-setup.lock').exists())


class GroundTruthWorkflowTests(TemporaryRepository):
    def test_installation_receipts_are_scoped_to_each_setup_attempt(self):
        targets=[]
        for run,attempt in [('first','online-one'),('first','online-two'),('second','online-three')]:
            output=self.repo/'results'/run;receipts=output/'setup'/attempt
            command=dict(setup.steps(sys.executable,self.data,self.cache,output,self.config,self.chrome,receipts))['install-dependencies']
            target=Path(command[command.index('--receipt')+1]);targets.append(target)
            self.assertEqual(target,receipts/'dependency-installation.json')
        self.assertEqual(len(set(targets)),3)
        self.assertNotIn(self.repo/'results/setup/dependency-installation.json',targets)

    def test_gt_producer_consumer_paths_and_pinned_python_are_consistent(self):
        stages=setup.steps(sys.executable,self.data,self.cache,self.output,self.config,self.chrome,self.output/'setup')
        by_name=dict(stages);names=[name for name,_ in stages]
        required=['download-source-photos','prepare-reference-images','verify-reference-pixels','configure-target-mac']
        self.assertEqual([name for name in names if name in required],required)
        def argument(name,flag):
            command=by_name[name]
            return command[command.index(flag)+1]
        self.assertEqual(argument('download-source-photos','--network-node'),'direct')
        self.assertEqual(argument('download-source-photos','--output'),argument('prepare-reference-images','--source'))
        self.assertEqual(argument('prepare-reference-images','--output'),argument('verify-reference-pixels','--ground-truth-root'))
        self.assertEqual(argument('prepare-reference-images','--output'),argument('configure-target-mac','--ground-truth-root'))
        self.assertEqual(by_name['prepare-reference-images'][0],str(self.repo/'.venv/bin/python'))
        self.assertEqual(by_name['verify-reference-pixels'][0],str(self.repo/'.venv/bin/python'))
        self.assertIn('--no-overwrite',by_name['configure-target-mac'])
        self.assertEqual(argument('configure-target-mac','--validation-root'),
                         setup.configuration(self.data,self.cache,self.output,self.chrome)['validationRoot'])
        self.assertFalse(any('run-experiment' in str(part) or 'probe-gpu' in str(part)
                             for _,command in stages for part in command))


class InstallerReceiptTests(TemporaryRepository):
    def test_default_and_explicit_receipt_paths(self):
        specification=importlib.util.spec_from_file_location('installer_receipt_under_test',SCRIPTS/'install-offline.py')
        installer=importlib.util.module_from_spec(specification);specification.loader.exec_module(installer)
        locks={}
        for name in ('package-lock.json','work/bench/package-lock.json'):
            path=self.repo/name;path.write_text('{}\n');locks[name]=installer.sha(path)
        self.cache.mkdir()
        (self.cache/'dependency-cache-receipt.json').write_text(json.dumps({'npmLocks':locks}))
        default=self.repo/'results/setup/dependency-installation.json'
        cases=[(None,default),('results/new-run/setup/dependency-installation.json',self.repo/'results/new-run/setup/dependency-installation.json'),
               (str(self.base/'explicit/installation.json'),self.base/'explicit/installation.json')]
        original=None
        for argument,target in cases:
            command=['install-offline.py','--cache',str(self.cache),'--node-only']
            if argument is not None:command.extend(['--receipt',argument])
            def metadata(args,**unused):
                return json.dumps({'arch':'arm64','major':24}) if '-p' in args else 'v24.19.0\n'
            with self.subTest(receipt=argument),patch.object(installer,'REPO',self.repo), \
                    patch.object(installer,'resolve',side_effect=self.resolve), \
                    patch.object(installer.platform,'system',return_value='Darwin'), \
                    patch.object(installer.platform,'machine',return_value='arm64'), \
                    patch.object(installer.shutil,'which',side_effect=lambda name:name), \
                    patch.object(installer.subprocess,'check_output',side_effect=metadata), \
                    patch.object(installer.subprocess,'run') as run, \
                    patch.object(sys,'argv',command),contextlib.redirect_stdout(io.StringIO()):
                installer.main()
            self.assertEqual(run.call_count,2)  # Mocked npm only; no installation or GPU work.
            receipt=json.loads(target.read_text())
            self.assertTrue(receipt['complete'])
            self.assertIsNone(receipt['pythonVersion'])
            self.assertFalse(receipt['gpuWorkPerformed'])
            if original is None:original=default.read_bytes()
            self.assertEqual(default.read_bytes(),original)


class ExclusiveConfigurationTests(TemporaryRepository):
    def test_configure_default_run_layout_matches_setup_and_delivery(self):
        specification=importlib.util.spec_from_file_location('configure_default_layout_under_test',SCRIPTS/'configure.py')
        configure=importlib.util.module_from_spec(specification);specification.loader.exec_module(configure)
        self.data.mkdir()
        with patch.object(configure,'REPO',self.repo),patch.object(configure,'resolve',side_effect=self.resolve), \
                patch.object(configure,'find_chrome',return_value=self.chrome), \
                patch.object(configure,'locked_models',return_value=([],{})), \
                patch.object(sys,'argv',['configure.py','--data-root',str(self.data),'--config',str(self.config),
                                        '--paths-only','--no-overwrite']),contextlib.redirect_stdout(io.StringIO()):
            configure.main()
        actual=json.loads(self.config.read_text())
        output=self.repo/'results/my-mac-run'
        expected=setup.configuration(self.data,self.cache,output,self.chrome)
        for field in ('outputRoot','pilotOutput','validationRoot'):
            self.assertEqual(actual[field],expected[field])
        self.assertEqual((output/'formal').parent/'setup',Path(actual['validationRoot']).parent)
        self.assertNotEqual(output,self.repo/'results')

    def test_configure_validation_root_defaults_and_explicit_override(self):
        specification=importlib.util.spec_from_file_location('configure_validation_under_test',SCRIPTS/'configure.py')
        configure=importlib.util.module_from_spec(specification);specification.loader.exec_module(configure)
        self.data.mkdir()
        for name,override in [('first',None),('second',None),('explicit','results/custom-validation')]:
            output=self.repo/'results'/name;config=self.repo/'config'/('local-'+name+'.json')
            command=['configure.py','--data-root',str(self.data),'--output-root',str(output),
                     '--config',str(config),'--paths-only','--no-overwrite']
            if override:command.extend(['--validation-root',override])
            with patch.object(configure,'REPO',self.repo),patch.object(configure,'resolve',side_effect=self.resolve), \
                    patch.object(configure,'find_chrome',return_value=self.chrome), \
                    patch.object(configure,'locked_models',return_value=([],{})), \
                    patch.object(sys,'argv',command),contextlib.redirect_stdout(io.StringIO()):
                configure.main()
            actual=json.loads(config.read_text())
            self.assertEqual(actual['validationRoot'],str(self.resolve(override) if override else output/'setup/validation'))
            self.assertFalse(Path(actual['validationRoot']).exists())

    def test_configure_preserves_venv_python_symlink_path(self):
        specification=importlib.util.spec_from_file_location('configure_venv_under_test',SCRIPTS/'configure.py')
        configure=importlib.util.module_from_spec(specification);specification.loader.exec_module(configure)
        self.data.mkdir()
        base_python=self.base/'base-python';base_python.write_text('interpreter fixture; never executed')
        venv_python=self.repo/'.venv/bin/python';venv_python.parent.mkdir(parents=True)
        venv_python.symlink_to(base_python)
        self.assertNotEqual(venv_python.absolute(),venv_python.resolve())
        with patch.object(configure,'REPO',self.repo),patch.object(configure,'resolve',side_effect=self.resolve), \
                patch.object(configure,'find_chrome',return_value=self.chrome), \
                patch.object(configure,'locked_models',return_value=([],{})), \
                patch.object(sys,'argv',['configure.py','--data-root',str(self.data),'--config',str(self.config),
                                        '--python','.venv/bin/python','--paths-only','--no-overwrite']), \
                contextlib.redirect_stdout(io.StringIO()):
            configure.main()
        actual=json.loads(self.config.read_text())
        self.assertEqual(actual['pythonExecutable'],str(venv_python.absolute()))
        self.assertNotEqual(actual['pythonExecutable'],str(base_python.resolve()))
        self.assertTrue(venv_python.is_symlink())

    def test_configure_exclusive_create_refuses_concurrent_existing_file(self):
        specification=importlib.util.spec_from_file_location('configure_under_test',SCRIPTS/'configure.py')
        configure=importlib.util.module_from_spec(specification);specification.loader.exec_module(configure)
        self.data.mkdir();self.write_config({'owner':'another process'})
        before=self.config.read_bytes()
        with patch.object(configure,'REPO',self.repo),patch.object(configure,'resolve',side_effect=self.resolve), \
                patch.object(configure,'find_chrome',return_value=self.chrome), \
                patch.object(configure,'locked_models',return_value=([],{})), \
                patch.object(sys,'argv',['configure.py','--data-root',str(self.data),'--config',str(self.config),
                                        '--paths-only','--no-overwrite']):
            with self.assertRaises(FileExistsError):configure.main()
        self.assertEqual(self.config.read_bytes(),before)


@unittest.skipUnless(os.name=='posix','Process group cleanup requires POSIX')
class OwnedProcessCleanupTests(unittest.TestCase):
    def alive_group(self, pgid):
        try:os.killpg(pgid,0)
        except ProcessLookupError:return False
        return True

    def cleanup_case(self, leader_exits):
        with tempfile.TemporaryDirectory(prefix='setup-owned-process-') as temporary:
            folder=Path(temporary);log=folder/'child.log';ready=folder/'grandchild-ready'
            grand='import os,signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path('+repr(str(ready))+').write_text(str(os.getpid()));time.sleep(120)'
            child='\n'.join(['import json,os,pathlib,subprocess,sys,time',
                'grand=subprocess.Popen([sys.executable,"-u","-c",'+repr(grand)+'])',
                'deadline=time.monotonic()+5',
                'while not pathlib.Path('+repr(str(ready))+').exists() and time.monotonic()<deadline: time.sleep(.01)',
                'print(json.dumps({"leader":os.getpid(),"grandchild":grand.pid}),flush=True)',
                'os._exit(0)' if leader_exits else 'time.sleep(120)'])
            harness='\n'.join(['import importlib.util,pathlib,sys',
                'sys.path.insert(0,'+repr(str(SCRIPTS))+')',
                'spec=importlib.util.spec_from_file_location("owned_setup",'+repr(str(SCRIPTS/'setup-online.py'))+')',
                'module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)',
                'try: module.execute([sys.executable,"-u","-c",'+repr(child)+'],pathlib.Path('+repr(str(log))+'))',
                'except KeyboardInterrupt: sys.exit(130)'])
            process=subprocess.Popen([sys.executable,'-u','-c',harness],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,start_new_session=True,text=True)
            pgid=None
            try:
                deadline=time.monotonic()+8
                while time.monotonic()<deadline:
                    if log.exists() and log.read_text().strip():break
                    if process.poll() is not None:break
                    time.sleep(.02)
                self.assertTrue(log.exists() and log.read_text().strip(),'Controlled child did not publish ownership')
                owned=json.loads(log.read_text().splitlines()[0]);pgid=owned['leader']
                self.assertNotEqual(pgid,os.getpgrp())
                self.assertEqual(os.getpgid(owned['grandchild']),pgid)
                process.send_signal(signal.SIGINT)
                _,error=process.communicate(timeout=15)
                self.assertEqual(process.returncode,130,error)
                deadline=time.monotonic()+2
                while self.alive_group(pgid) and time.monotonic()<deadline:time.sleep(.02)
                self.assertFalse(self.alive_group(pgid),'Owned grandchild survived interruption cleanup')
            finally:
                # Only this fixture's freshly created process groups are touched.
                if pgid is not None and self.alive_group(pgid):
                    os.killpg(pgid,signal.SIGKILL)
                if process.poll() is None:
                    os.killpg(process.pid,signal.SIGKILL)
                    process.wait(timeout=5)
                if process.stderr:process.stderr.close()

    def test_interrupt_cleans_group_when_leader_already_exited(self):
        self.cleanup_case(leader_exits=True)

    def test_interrupt_kills_term_ignoring_grandchild_after_leader_exits(self):
        self.cleanup_case(leader_exits=False)


if __name__=='__main__':unittest.main(verbosity=2)
