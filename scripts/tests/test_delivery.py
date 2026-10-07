"""Offline delivery checks with temporary synthetic report artifacts, never GPU."""
from __future__ import annotations
import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import sys
import unittest
import zipfile
from unittest.mock import patch

SCRIPTS=Path(__file__).resolve().parents[1]
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,SCRIPTS/file)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
review=module('test_visual_delivery','record-visual-review.py')
package=module('test_package_delivery','package-results.py')


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        temporary=tempfile.TemporaryDirectory(prefix='synthetic-delivery-')
        self.addCleanup(temporary.cleanup);self.root=Path(temporary.name).resolve()
        self.run=self.root/'results/fixture/formal';self.setup=self.run.parent/'setup'
        self.patcher=patch.object(package,'ROOT',self.root);self.patcher.start();self.addCleanup(self.patcher.stop)
        review_root=patch.object(review,'ROOT',self.root);review_root.start();self.addCleanup(review_root.stop)
        self.write(self.root/'scripts/ground-truth-pixels-lock.json',{'fixtureOnly':True})
        self.write(self.run/'protocol.json',{'protocolId':'synthetic-formal-protocol','hostIdentity':{'nodeVersion':'v24.19.0'}})
        self.write(self.run/'quality/metrics/metrics-protocol.json',{'gt_manifest_sha256':'a'*64,'host':{'python':'3.12.14'}})
        self.write(self.run/'analysis/analysis-qa.json',{'passed':True,'complete':True})
        self.write(self.run/'runtime-cleanup.json',{'passed':True,'complete':True,'gpuLockReleased':True,'children':[{'alive':False}]})
        self.write(self.run/'raw/fixture.json',{'syntheticOnly':True})
        self.write(self.run/'telemetry/fixture.jsonl','{"syntheticOnly":true}\n')
        self.write(self.run/'quality/metrics/quality-summary.json',{'syntheticOnly':True})
        self.write(self.run/'quality/metrics/per-view.jsonl','{"syntheticOnly":true}\n')
        self.write(self.root/'work/fixture-source.py','# synthetic frozen source\n')
        self.write(self.root/'analysis/fixture-analyzer.py','# synthetic report generator\n')
        self.write(self.setup/'validation/fixture-cpu-audit.json',{'syntheticOnly':True})
        common=[self.run/name for name in ('protocol.json','runtime-cleanup.json','raw/fixture.json','telemetry/fixture.jsonl')]
        metric_paths=[self.run/'quality/metrics'/name for name in ('quality-summary.json','per-view.jsonl','metrics-protocol.json')]
        self.formal={'schema':'independent-mac-three-method-performance-audit-v1','passed':True,'complete':True,
                     'fullMatrixComplete':True,'partial':False,'pilot':False,'protocolId':'synthetic-formal-protocol',
                     'runDirectory':'results/fixture/formal','sourceReceipts':[self.source_identity(p,relative=True) for p in
                          common+[self.setup/'validation/fixture-cpu-audit.json']]}
        self.quality={'passed':True,'complete':True,'fullMatrixComplete':True,'partial':False,
                      'sourceReceipts':[self.source_identity(p,relative=True) for p in common+metric_paths],
                      **{field:review.sha(path) for field,path in zip(
                          ('qualitySummarySha256','perViewSha256','metricsProtocolSha256'),metric_paths)}}
        self.write(self.run/'validation/independent-formal-qa.json',self.formal)
        self.write(self.run/'validation/independent-quality-qa.json',self.quality)
        for name in ('index.html','captures.html'):
            self.write(self.run/'analysis'/name,'<p>synthetic fixture only</p>')
        self.build={'complete':True,'protocolId':'synthetic-formal-protocol',
                    'analysisSources':{'fixture-analyzer.py':review.sha(self.root/'analysis/fixture-analyzer.py')},
                    'sources':[self.source_identity(p) for p in common+metric_paths+[
                        self.run/'validation/independent-quality-qa.json',self.root/'work/fixture-source.py']],
                    'outputs':[self.identity('analysis/'+name) for name in ('index.html','captures.html','analysis-qa.json')]}
        self.write(self.run/'analysis/build-receipt.json',self.build)
        shots=[]
        for name in sorted(review.REQUIRED_SCREENSHOTS):
            relative='validation/report-preview/'+name
            self.write(self.run/relative,b'synthetic-not-a-real-review-image:'+name.encode())
            shots.append(self.identity(relative))
        self.qa={'schema':'mac-portable-report-render-qa-v1','passed':True,'complete':True,
                 'reportBuildSha256':review.sha(self.run/'analysis/build-receipt.json'),
                 'analysisQaSha256':review.sha(self.run/'analysis/analysis-qa.json'),
                 'screenshots':shots,'ownedCleanup':{'complete':True,'serverListening':False,'children':[{'alive':False}]}}
        self.write(self.run/'validation/report-visual-qa.json',self.qa)
        self.gt={'complete':True,'images':378,'allDecodedPixelHashesMatched':True,
                 'groundTruthManifestSha256':'a'*64,
                 'fixedPixelLockSha256':review.sha(self.root/'scripts/ground-truth-pixels-lock.json')}
        self.deps={'schema':'portable-offline-installation-v1','complete':True,'nodeVersion':'v24.19.0',
                   'pythonVersion':'Python 3.12.14','networkAccessDuringInstallation':False,
                   'dependencyCacheReceiptSha256':'b'*64}
        self.write(self.setup/'ground-truth-verification.json',self.gt)
        self.write(self.setup/'dependency-installation.json',self.deps)

    def write(self,path,value):
        path.parent.mkdir(parents=True,exist_ok=True)
        if isinstance(value,bytes):path.write_bytes(value)
        elif isinstance(value,str):path.write_text(value)
        else:path.write_text(json.dumps(value,indent=2)+'\n')

    def identity(self,relative):
        path=self.run/relative
        return {'path':relative,'sha256':review.sha(path),'bytes':path.stat().st_size}

    def source_identity(self,path,relative=False):
        return {'path':os.path.relpath(path,self.root) if relative else str(path.resolve()),
                'sha256':review.sha(path),'bytes':path.stat().st_size}

    def refresh_build_qa(self):
        self.write(self.run/'analysis/build-receipt.json',self.build)
        self.qa['reportBuildSha256']=review.sha(self.run/'analysis/build-receipt.json')
        self.write(self.run/'validation/report-visual-qa.json',self.qa)

    def record(self,findings=None):
        return review.record_review(self.run,'codex','Synthetic test Codex',
            'Synthetic fixture validation only; not an actual scientific visual review.',findings or [])

    def package_fixture(self):
        self.write(self.run.parent/'pilot/raw/synthetic.json',{'fixtureOnly':True})
        self.write(self.run/'validation/prerequisites.json',{'pilotDirectory':'results/fixture/pilot','sources':[]})
        output=self.run.parent/'delivery.zip'
        def source_archive(command,**unused):
            self.assertEqual(command[0],'git')
            destination=Path(next(value.split('=',1)[1] for value in command if value.startswith('--output=')))
            with zipfile.ZipFile(destination,'w') as archive:
                archive.writestr('mac-splat-benchmark/README.md','Synthetic source archive for a unit test only.')
        with patch.object(package,'git',side_effect=lambda *args: '' if args[0]=='status' else 'f'*40), \
                patch.object(package.subprocess,'run',side_effect=source_archive), \
                patch.object(sys,'argv',['package-results.py','--run-dir',str(self.run),'--output',str(output)]), \
                contextlib.redirect_stdout(io.StringIO()):
            package.main()
        return output

    def test_accepts_codex_review_without_claiming_human_review(self):
        result=self.record();self.assertTrue(result['passed']);self.assertFalse(result['humanVisualReview'])
        self.assertEqual(len(result['screenshots']),12)
        checks,paths,acceptance=package.validate_delivery(self.run)
        self.assertIn('validation/visual-review.json',checks)
        self.assertEqual(acceptance['reviewerType'],'codex');self.assertFalse(acceptance['humanVisualReview'])
        self.assertEqual({p.name for p in paths},{'ground-truth-verification.json','dependency-installation.json'})

    def test_missing_visual_review_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'Missing/nonregular'):
            package.validate_delivery(self.run)

    def test_unresolved_finding_records_failure_and_blocks_packaging(self):
        result=self.record(['Synthetic unresolved layout issue'])
        self.assertFalse(result['passed'])
        with self.assertRaisesRegex(ValueError,'Acceptance not passed'):
            package.validate_delivery(self.run)

    def test_replacing_review_preserves_previous_record(self):
        first=self.record(['Synthetic unresolved issue']);self.record()
        saved=list((self.run/'validation').glob('visual-review-previous-*.json'))
        self.assertEqual(len(saved),1);self.assertEqual(json.loads(saved[0].read_text()),first)
        package.validate_delivery(self.run)

    def test_changed_report_output_is_rejected(self):
        self.record();self.write(self.run/'analysis/index.html','changed after automatic QA')
        with self.assertRaisesRegex(ValueError,'Report output changed'):
            package.validate_delivery(self.run)

    def test_changed_build_makes_automatic_qa_stale(self):
        self.build['anotherField']='new build';self.write(self.run/'analysis/build-receipt.json',self.build)
        with self.assertRaisesRegex(ValueError,'QA is stale'):
            self.record()

    def test_changed_automatic_qa_makes_visual_review_stale(self):
        self.record();self.qa['newRun']='different automatic QA';self.write(self.run/'validation/report-visual-qa.json',self.qa)
        with self.assertRaisesRegex(ValueError,'Visual review is stale'):
            package.validate_delivery(self.run)

    def test_changed_screenshot_is_rejected(self):
        self.record();self.write(self.run/self.qa['screenshots'][0]['path'],b'changed pixels')
        with self.assertRaisesRegex(ValueError,'QA screenshot changed'):
            package.validate_delivery(self.run)

    def test_missing_required_screenshot_is_rejected(self):
        self.qa['screenshots'].pop();self.write(self.run/'validation/report-visual-qa.json',self.qa)
        with self.assertRaisesRegex(ValueError,'screenshots are missing'):
            self.record()

    def test_screenshot_traversal_and_absolute_paths_are_rejected(self):
        for value in ('../outside.png',str(self.root/'outside.png')):
            with self.subTest(value=value):
                self.qa['screenshots'][0]['path']=value;self.write(self.run/'validation/report-visual-qa.json',self.qa)
                with self.assertRaisesRegex(ValueError,'Artifact path'):
                    self.record()

    def test_screenshot_symlink_escape_is_rejected(self):
        shot=self.run/self.qa['screenshots'][0]['path'];outside=self.root/'outside.png';outside.write_bytes(shot.read_bytes())
        shot.unlink();shot.symlink_to(outside)
        with self.assertRaisesRegex(ValueError,'escapes'):
            self.record()

    def test_report_output_escape_is_rejected_even_with_matching_hash(self):
        outside=self.root/'outside.html';outside.write_text('outside')
        self.build['outputs'][0]={'path':'../../../../outside.html','bytes':outside.stat().st_size,'sha256':review.sha(outside)}
        self.write(self.run/'analysis/build-receipt.json',self.build);self.qa['reportBuildSha256']=review.sha(self.run/'analysis/build-receipt.json')
        self.write(self.run/'validation/report-visual-qa.json',self.qa)
        with self.assertRaisesRegex(ValueError,'Artifact path'):
            self.record()

    def test_codex_review_cannot_be_relabelled_as_human(self):
        result=self.record();result['humanVisualReview']=True;self.write(self.run/'validation/visual-review.json',result)
        with self.assertRaisesRegex(ValueError,'mislabelled'):
            package.validate_delivery(self.run)

    def test_changed_report_inputs_are_rejected_even_when_outputs_and_qa_are_unchanged(self):
        self.record()
        for path in [self.run/'raw/fixture.json',self.run/'telemetry/fixture.jsonl',
                     self.run/'runtime-cleanup.json',self.run/'protocol.json',
                     self.run/'quality/metrics/per-view.jsonl',self.root/'work/fixture-source.py']:
            with self.subTest(source=str(path)):
                original=path.read_bytes()
                # Whitespace preserves JSON validity and all pass flags.
                path.write_bytes(original+b' ')
                with self.assertRaisesRegex(ValueError,'Report build source changed'):
                    package.validate_delivery(self.run)
                path.write_bytes(original)

    def test_performance_audit_only_source_is_rehashed(self):
        self.record();self.write(self.setup/'validation/fixture-cpu-audit.json',{'changedAfterAudit':True})
        with self.assertRaisesRegex(ValueError,'Independent performance audit source changed'):
            package.validate_delivery(self.run)

    def test_changed_or_added_report_generator_source_is_rejected(self):
        self.record();source=self.root/'analysis/fixture-analyzer.py';original=source.read_bytes()
        source.write_bytes(original+b'# modified after report build\n')
        with self.assertRaisesRegex(ValueError,'Report analysis source changed'):
            package.validate_delivery(self.run)
        source.write_bytes(original)
        self.write(self.root/'analysis/added.py','# newly added report module\n')
        with self.assertRaisesRegex(ValueError,'analysis source file inventory changed'):
            package.validate_delivery(self.run)

    def test_replacing_performance_audit_after_review_is_rejected(self):
        self.record();self.formal['createdAt']='different successful audit execution'
        self.write(self.run/'validation/independent-formal-qa.json',self.formal)
        with self.assertRaisesRegex(ValueError,'Visual review is stale: sourceFreshness'):
            package.validate_delivery(self.run)

    def test_replacing_quality_audit_after_report_build_is_rejected(self):
        self.record();self.quality['anotherRun']='changed successful audit'
        self.write(self.run/'validation/independent-quality-qa.json',self.quality)
        with self.assertRaisesRegex(ValueError,'Report build source changed'):
            package.validate_delivery(self.run)

    def test_quality_audit_must_be_bound_by_build_and_bind_its_metrics(self):
        saved=list(self.build['sources'])
        self.build['sources']=[entry for entry in saved if not entry['path'].endswith('independent-quality-qa.json')]
        self.refresh_build_qa()
        with self.assertRaisesRegex(ValueError,'must be bound by the report build'):
            self.record()
        self.quality['perViewSha256']='0'*64
        self.write(self.run/'validation/independent-quality-qa.json',self.quality)
        self.build['sources']=[self.source_identity(Path(entry['path'])) for entry in saved]
        self.refresh_build_qa()
        with self.assertRaisesRegex(ValueError,'metric binding differs'):
            self.record()

    def test_audit_from_different_run_or_protocol_is_rejected(self):
        for field,value in [('runDirectory','results/other/formal'),('protocolId','different-protocol')]:
            with self.subTest(field=field):
                changed=dict(self.formal);changed[field]=value
                self.write(self.run/'validation/independent-formal-qa.json',changed)
                with self.assertRaisesRegex(ValueError,'belongs to a different run/protocol'):
                    self.record()

    def test_audit_missing_current_collection_source_is_rejected(self):
        self.formal['sourceReceipts']=[entry for entry in self.formal['sourceReceipts'] if not entry['path'].endswith('raw/fixture.json')]
        self.write(self.run/'validation/independent-formal-qa.json',self.formal)
        with self.assertRaisesRegex(ValueError,'collection sources differ'):
            self.record()

    def test_added_raw_file_is_rejected_as_unreported_input(self):
        self.record();self.write(self.run/'raw/unreported.json',{'syntheticOnly':True})
        with self.assertRaisesRegex(ValueError,'raw inventory differs'):
            package.validate_delivery(self.run)

    def test_canonical_source_alias_duplicates_are_rejected(self):
        self.build['sources'].append(self.source_identity(self.run/'raw/fixture.json',relative=True))
        self.refresh_build_qa()
        with self.assertRaisesRegex(ValueError,'duplicate source paths'):
            self.record()

    def test_legitimate_external_sources_accept_absolute_and_parent_relative_paths(self):
        outside=tempfile.TemporaryDirectory(prefix='synthetic-external-input-');self.addCleanup(outside.cleanup)
        external=Path(outside.name).resolve()/'gt-or-weight.dat';external.write_bytes(b'synthetic external source identity')
        self.build['sources'].append(self.source_identity(external))
        self.quality['sourceReceipts'].append(self.source_identity(external,relative=True))
        self.write(self.run/'validation/independent-quality-qa.json',self.quality)
        self.build['sources']=[self.source_identity(Path(entry['path'])) for entry in self.build['sources']]
        self.refresh_build_qa();self.record()
        package.validate_delivery(self.run)
        output=self.package_fixture()
        with zipfile.ZipFile(output) as archive:
            self.assertFalse(any(external.name in name for name in archive.namelist()))
        external.write_bytes(b'changed external pixels or weights')
        with self.assertRaisesRegex(ValueError,'Report build source changed'):
            package.validate_delivery(self.run)

    def test_invalid_source_identity_or_duplicate_audit_source_is_rejected(self):
        saved=self.build['sources'][0]['bytes'];self.build['sources'][0]['bytes']=True
        self.refresh_build_qa()
        with self.assertRaisesRegex(ValueError,'invalid source identity'):
            self.record()
        self.build['sources'][0]['bytes']=saved;self.refresh_build_qa()
        self.formal['sourceReceipts'].append(self.source_identity(self.run/'raw/fixture.json'))
        self.write(self.run/'validation/independent-formal-qa.json',self.formal)
        with self.assertRaisesRegex(ValueError,'duplicate source paths'):
            self.record()

    def test_online_setup_includes_only_small_named_receipts(self):
        self.record();attempt=self.setup/'online-fixture'
        for name,data in [('setup.json',{'complete':True}),('ground-truth-verification.json',self.gt),('dependency-installation.json',self.deps)]:
            self.write(attempt/name,data)
        self.write(attempt/'very-large.log','excluded log')
        self.write(attempt/'local-personal.json',{'private':'must not package'})
        self.write(self.setup/'cache/private.json',{'private':'must not package'})
        self.write(self.setup/'validation/supersplat-worker.json',{'passed':True})
        _,paths,_=package.validate_delivery(self.run)
        relatives={p.relative_to(self.setup).as_posix() for p in paths}
        self.assertIn('online-fixture/setup.json',relatives)
        self.assertIn('validation/supersplat-worker.json',relatives)
        self.assertNotIn('online-fixture/very-large.log',relatives)
        self.assertNotIn('online-fixture/local-personal.json',relatives)
        self.assertNotIn('cache/private.json',relatives)

    def test_oversized_setup_receipt_is_rejected(self):
        self.record()
        with (self.setup/'environment.json').open('wb') as stream:stream.truncate(package.MAX_SETUP_RECEIPT_BYTES+1)
        with self.assertRaisesRegex(ValueError,'Oversized setup'):
            package.validate_delivery(self.run)

    def test_wrong_gt_pixel_or_manifest_identity_is_rejected(self):
        self.record()
        for field in ('groundTruthManifestSha256','fixedPixelLockSha256'):
            with self.subTest(field=field):
                changed=dict(self.gt);changed[field]='0'*64
                self.write(self.setup/'ground-truth-verification.json',changed)
                with self.assertRaisesRegex(ValueError,'fixed-pixel GT'):
                    package.validate_delivery(self.run)

    def test_missing_or_node_only_install_receipt_is_rejected(self):
        self.record();(self.setup/'dependency-installation.json').unlink()
        with self.assertRaisesRegex(ValueError,'dependency-installation'):
            package.validate_delivery(self.run)
        self.write(self.setup/'dependency-installation.json',dict(self.deps,pythonVersion=None))
        with self.assertRaisesRegex(ValueError,'dependency-installation'):
            package.validate_delivery(self.run)

    def test_setup_receipt_symlink_escape_is_rejected(self):
        self.record();receipt=self.setup/'dependency-installation.json';outside=self.root/'outside-receipt.json'
        outside.write_bytes(receipt.read_bytes());receipt.unlink();receipt.symlink_to(outside)
        with self.assertRaisesRegex(ValueError,'escapes'):
            package.validate_delivery(self.run)

    def test_actual_zip_includes_review_and_setup_evidence_not_cache_or_large_logs(self):
        self.record()
        self.write(self.setup/'online-fixture/setup.json',{'fixtureOnly':True,'complete':True})
        self.write(self.setup/'cache/secret.json',{'mustNotPackage':True})
        with (self.run/'large.log').open('wb') as stream:stream.truncate(16*1024*1024+1)
        output=self.package_fixture()
        with zipfile.ZipFile(output) as archive:
            names=set(archive.namelist());self.assertIsNone(archive.testzip())
            self.assertIn('run/validation/visual-review.json',names)
            self.assertIn('support/results/fixture/setup/dependency-installation.json',names)
            self.assertIn('support/results/fixture/setup/ground-truth-verification.json',names)
            self.assertIn('support/results/fixture/setup/online-fixture/setup.json',names)
            self.assertFalse(any('secret.json' in name or name.endswith('large.log') for name in names))
            manifest=json.loads(archive.read('artifact-manifest.json'))
            self.assertEqual(manifest['acceptance']['reviewerType'],'codex')
            self.assertFalse(manifest['acceptance']['humanVisualReview'])
            self.assertEqual(len(manifest['excludedLargeLogs']),1)
            for entry in manifest['files']:
                self.assertEqual(review.hashlib.sha256(archive.read(entry['path'])).hexdigest(),entry['sha256'])
        receipt=json.loads(output.with_suffix('.receipt.json').read_text())
        self.assertEqual(receipt['sha256'],review.sha(output))

    def test_model_or_weight_accidentally_inside_run_cannot_be_packaged(self):
        self.record();self.write(self.run/'unwanted.pth',b'synthetic weight marker')
        with self.assertRaisesRegex(ValueError,'inputs outside'):
            self.package_fixture()


if __name__=='__main__':unittest.main(verbosity=2)
