#!/usr/bin/env python3
"""Explicitly partial, read-only preview of completed formal configurations."""
from __future__ import annotations
import argparse
from collections import defaultdict
import html
import json
import math
from pathlib import Path
import shutil
import statistics

from common import ROOT, SCENES, STRIDES, METHODS, LABELS, STAGES, read, require, sha, now, write_csv, write_json
from analyze import parse_os, validate_metadata
from metrics import summarize, normalize, quantile
from completion_metrics import summarize_completion


def resolved(value):
    p = Path(value)
    return (p if p.is_absolute() else ROOT / p).resolve()


def fmt(value, digits=3):
    return '待测 / pending' if value is None else f'{value:.{digits}f}'


def esc(value):
    return html.escape(str(value))


def table(headers, rows, titles=None):
    titles = titles or {}
    return '<div class="table-scroll"><table><thead><tr>'+''.join(f'<th title="{esc(titles.get(h,h))}">{esc(h)}</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(cell)+'</td>' for cell in row)+'</tr>' for row in rows)+'</tbody></table></div>'


def load_quality(directory, configs, captures, gt_manifest):
    summary_path = directory / 'quality-summary.json'
    if not summary_path.exists():
        return {'available': False, 'images': 0, 'expectedImages': len(captures)}, {}, {}
    summary = read(summary_path)
    require(summary.get('requestedSubsetComplete') is True, 'Partial quality subset is not complete')
    require(summary['referenceType'] == 'ground-truth' and set(summary['metrics']) == {'psnr','ssim','lpips'}, 'Expected actual GT metrics')
    require(sha(directory/'per-view.jsonl') == summary['per_view_sha256'], 'Quality per-view SHA differs')
    lookup = {(r['method'],r['scene'],r['stride']):r for r in configs}
    quality_configs = {(r['method'],r['scene'],r['stride']):r for r in summary['configurations']}
    require(set(quality_configs) == set(lookup), 'Quality configuration subset differs from completed formal raw set')
    references = {(r['scene'],r['camera_index']):r for r in gt_manifest['entries']}
    views = {}
    for line in (directory/'per-view.jsonl').read_text().splitlines():
        q = json.loads(line); key = q['method'],q['scene'],q['stride'],q['camera_index']
        require(key in captures and key not in views, 'Quality view outside selected subset/duplicate')
        require(q['raw_sha256'] == lookup[key[:3]]['raw_sha256'] and q['render_sha256'] == captures[key]['sha256'], 'Quality source lineage differs')
        require(q['gt_sha256'] == references[q['scene'],q['camera_index']]['sha256'], 'Quality GT lineage differs')
        views[key] = q
    require(set(views) == set(captures), 'Quality does not cover every selected configuration view')
    for key, q in quality_configs.items():
        group = [v for k,v in views.items() if k[:3] == key]
        require(len(group) == q['views'] == lookup[key]['views'], 'Quality view count differs')
        for field in ('psnr_db','ssim','lpips_vgg'):
            values=[v[field] for v in group]
            mean = statistics.fmean(values) if all(v is not None for v in values) else None
            require(mean is None and q[field] is None or mean is not None and abs(mean-q[field])<1e-6, 'Quality configuration mean differs')
    protocol = read(directory/'metrics-protocol.json')
    require(sha(directory/'metrics-protocol.json')==summary['protocol_sha256'],'Quality protocol SHA differs')
    for q in views.values():
        require((q['psnr_db'] is None)==q['psnr_infinite'],'PSNR infinity flag differs')
        require(q['psnr_db'] is None or math.isfinite(q['psnr_db']) and q['psnr_db']>=0,'Invalid PSNR')
        require(math.isfinite(q['ssim']) and -1.00001<=q['ssim']<=1.00001
                and math.isfinite(q['lpips_vgg']) and q['lpips_vgg']>=0,'Invalid SSIM/LPIPS')
    return {'available': True, 'images':len(views), 'expectedImages':len(captures),
            'summarySha256':sha(summary_path),'perViewSha256':summary['per_view_sha256'],
            'protocolSha256':sha(directory/'metrics-protocol.json'),'device':protocol['device'],
            'vggWeightSha256':protocol['vgg_weight_sha256'],
            'fullMatrixComplete':summary['complete'], 'requestedSubsetComplete':True}, quality_configs, views


def build(args):
    run, out, directory = args.run_dir, args.output, args.quality_dir
    for lock in (ROOT/'results/gpu-session.lock',run/'gpu-session.lock',run.parent/'gpu-session.lock'):
        require(not lock.exists(), 'Performance collection still locked')
    cleanup = read(run/'runtime-cleanup.json')
    require(cleanup.get('finishedAt') and cleanup.get('gpuLockReleased') is True
            and all(c['alive'] is False for c in cleanup['children']), 'Owned performance processes have not stopped')
    protocol = read(run/'protocol.json'); require(not protocol['pilot'], 'Pilot cannot become formal preview')
    scope_path=args.scope or out.parent/'validation/scope-manifest.json'
    require(scope_path.exists(),'A fixed preview scope-manifest.json is required')
    scope=read(scope_path)
    require(scope['completeExperiment'] is False and scope['configurations']==len(scope['rawFiles'])
            and scope['protocolSha256']==sha(run/'protocol.json'),'Scope/protocol identity differs')
    selected_paths=[];expected_raw_sha={}
    for entry in scope['rawFiles']:
        path=run/'raw'/Path(entry['path']).name
        require(path.name not in expected_raw_sha and sha(path)==entry['sha256'],'Scoped raw changed/duplicate')
        expected_raw_sha[path.name]=entry['sha256'];selected_paths.append(path)
    config = read(args.config); gt_root = resolved(config['groundTruthRoot'])
    gt_manifest = read(gt_root/'ground-truth-manifest.json')
    require(gt_manifest['complete'] is True and len(gt_manifest['entries'])==378,'Prepared GT selection incomplete')
    host = read(run/'environment/host-inventory.json')
    hardware=host['hardware']['SPHardwareDataType'][0]
    gpu=host['hardware']['SPDisplaysDataType'][0]
    processor=hardware.get('number_processors','unrecorded')
    if processor.startswith('proc') and len(processor.split(':'))==3:
        total,performance,efficiency=processor[4:].split(':')
        processor=f'{total}核（{performance}性能核+{efficiency}能效核）'
    environment = {**parse_os(host),'browser_version':protocol['browserVersion'],'framebuffer_width':1280,
                   'framebuffer_height':720,'viewport_width':1280,'viewport_height':760,'device_pixel_ratio':1,'headless':True,
                   'chip':hardware['chip_type'],'cpu':processor,'gpu_model':gpu.get('sppci_model',gpu.get('_name')),
                   'gpu_cores':gpu.get('sppci_cores'),'memory':hardware.get('physical_memory'),
                   'gpu_backend':'WebGPU (Visionary); WebGL2 via ANGLE Metal (Spark / SuperSplat)'}
    configs, rounds, samples, views, captures, raw_records = [], [], [], [], {}, {}
    excluded = []
    for path in sorted(selected_paths):
        raw=read(path)
        if raw.get('status')!='complete' or raw.get('error') or raw.get('errors'):
            raise ValueError('Fixed preview scope includes an incomplete configuration: '+path.name)
        method,scene,stride=raw['method'],raw['scene'],raw['stride']; key=method,scene,stride
        require(method in METHODS and scene in SCENES and stride in STRIDES and key not in raw_records,'Unexpected completed configuration')
        require(raw['protocolId']==protocol['protocolId'] and raw['experimentHashes']==protocol['experimentHashes'],'Formal protocol/source identity differs')
        validate_metadata(raw,method,protocol['methodDefinitions'][method],protocol)
        stage, stage_rounds, warnings=summarize(raw,method)
        completion, completion_rounds=summarize_completion(raw)
        identity={'method':method,'scene':scene,'stride':stride}
        digest=sha(path)
        row={**identity,**stage,**completion,**environment,'gaussian_count':raw['model']['gaussian_count'],
             'raw_sha256':digest,'raw_path':str(path),'started_at':raw['startedAt'],'completed_at':raw['completedAt'],
             'renderer_version':raw['metadata']['version'],'stage_exceeds_e2e_samples':0,
             'diagnostics':warnings,'quality_status':'pending','psnr_db':None,'ssim':None,'lpips_vgg':None}
        row['renderer_identity']=raw['metadata'].get('renderer',str(raw['metadata'].get('gpuAdapter')))
        per_camera=defaultdict(list)
        for rd,sr,cr in zip(raw['rounds'],stage_rounds,completion_rounds):
            rounds.append({**identity,**sr,**cr,**environment})
            for sample in rd['samples']:
                component=normalize(sample,method,raw['model']['gaussian_count'])
                row['stage_exceeds_e2e_samples']+=component['stage_cost_ms']>sample['e2eCompletionMs']
                record={**identity,**{k:sample[k] for k in ('repeat','cycle','order','cameraIndex','cameraId','img_name','e2eStartMs','e2eEndMs','e2eCompletionMs')},**component}
                samples.append(record);per_camera[sample['cameraIndex']].append(sample['e2eCompletionMs'])
        for index,camera in enumerate(raw['cameras']):
            vals=per_camera[index]
            views.append({**identity,'camera_index':index,'img_name':camera['img_name'],'timing_samples':len(vals),
                          'e2e_mean_ms':statistics.fmean(vals),'e2e_p50_ms':quantile(vals,.5),'e2e_p95_ms':quantile(vals,.95),
                          'quality_status':'pending','psnr_db':None,'ssim':None,'lpips_vgg':None})
        require(len(raw['qualityCaptures'])==len(raw['cameras']),'Completed raw lacks its quality captures')
        for cap in raw['qualityCaptures']:captures[(*key,cap['cameraIndex'])]=cap
        configs.append(row);raw_records[key]=raw
    require(configs,'No completed formal configurations')
    configs.sort(key=lambda r:(STRIDES.index(r['stride']),SCENES.index(r['scene']),METHODS.index(r['method'])))
    quality,quality_configs,quality_views=load_quality(directory,configs,captures,gt_manifest)
    if args.require_quality:require(quality['available'],'Requested configuration quality is still pending')
    if quality['available']:
        for row in configs:
            q=quality_configs[row['method'],row['scene'],row['stride']]
            row.update({k:q[k] for k in ('psnr_db','ssim','lpips_vgg','psnr_infinite_views')});row['quality_status']='measured'
        for row in views:
            q=quality_views[row['method'],row['scene'],row['stride'],row['camera_index']]
            row.update({k:q[k] for k in ('psnr_db','ssim','lpips_vgg','psnr_infinite')});row['quality_status']='measured'
    balanced=[];balanced_keys=set()
    for stride in STRIDES:
        scenes=[s for s in SCENES if all((m,s,stride) in raw_records for m in METHODS)]
        if not scenes:continue
        balanced_keys.update((s,stride) for s in scenes)
        for method in METHODS:
            group=[r for r in configs if r['method']==method and r['stride']==stride and r['scene'] in scenes]
            fields=['e2e_completion_mean_ms','e2e_completion_p50_ms','e2e_completion_p95_ms','completed_frames_per_second','psnr_db','ssim','lpips_vgg']
            balanced.append({'method':method,'stride':stride,'scenes':len(scenes),'scene_names':scenes,
                             **{f:statistics.fmean(r[f] for r in group) if all(r[f] is not None for r in group) else None for f in fields}})
    expected={(m,s,k) for m in METHODS for s in SCENES for k in STRIDES}
    missing=sorted(expected-set(raw_records),key=lambda x:(STRIDES.index(x[2]),SCENES.index(x[1]),METHODS.index(x[0])))
    audit_status={}
    validation=out.parent/'validation'
    for label,name in [('performance','partial-performance-qa.json'),('quality','independent-quality-qa.json'),('numerical','quality-numerical-validation.json')]:
        path=validation/name
        audit_status[label]={'available':path.exists(),'path':str(path)}
        if path.exists():
            receipt=read(path)
            audit_status[label].update({'passed':receipt.get('passed',receipt.get('complete',False)),'sha256':sha(path)})
            if label=='performance':
                require(receipt['passed'] and receipt['partial'] and receipt['complete'] is False
                        and receipt['fullMatrixComplete'] is False
                        and set(receipt['coverage']['completedKeys'])=={p.stem for p in selected_paths},'Performance audit scope differs')
                bound={resolved(s['path']):s['sha256'] for s in receipt['sourceReceipts']}
                require(all(bound.get((run/'raw'/n).resolve())==v for n,v in expected_raw_sha.items()),'Performance audit does not bind selected raw bytes')
            if label=='quality' and quality['available']:
                require(receipt['passed'] and receipt['partial'] and receipt['requestedSubsetComplete']
                        and receipt['complete'] is False and receipt['fullMatrixComplete'] is False
                        and receipt['qualitySummarySha256']==quality['summarySha256']
                        and receipt['perViewSha256']==quality['perViewSha256']
                        and receipt['metricsProtocolSha256']==quality['protocolSha256'],'Independent quality audit scope differs')
            if label=='numerical':
                require(receipt['complete'] is True and receipt['metrics_script_sha256']==sha(ROOT/'quality/measure_quality.py')
                        and receipt['validation_script_sha256']==sha(ROOT/'quality/validate_metrics.py'), 'Numerical validation source identity differs')
                require(all(receipt['checks'][k] is True for k in ('psnr_analytic','psnr_identity','ssim_identity','ssim_independent_scipy'))
                        and receipt['checks']['lpips']['passed'] is True,'Numerical PSNR/SSIM/LPIPS self-check incomplete')
                if quality['available']:
                    require(receipt['checks']['lpips']['checkpoint_sha256']==quality['vggWeightSha256'],
                            'Numerical validation and actual quality VGG checkpoint differ')
    if args.require_quality:
        require(all(audit_status[k].get('passed') is True for k in ('performance','quality','numerical')),
                'Final quality preview requires performance, independent actual-image and numerical receipts')
    report={'schema':'explicit-completed-configuration-preview-v1','generatedAt':now(),'fullMatrixComplete':False,
            'performanceSubsetComplete':True,'qualitySubsetComplete':quality['available'],'isPreview':True,
            'requestedScopeComplete':quality['available'] and all(audit_status[k].get('passed') is True for k in ('performance','quality','numerical')),
            'completedConfigurations':len(configs),'expectedConfigurations':156,'roundCount':len(rounds),'sampleCount':len(samples),
            'qualityViewsExpected':len(views),'quality':quality,'balancedAggregates':balanced,
            'balancedSceneStrideGroups':[{'scene':s,'stride':k} for s,k in sorted(balanced_keys)],
            'excludedFromBalancedAggregates':[{'method':r['method'],'scene':r['scene'],'stride':r['stride']} for r in configs if (r['scene'],r['stride']) not in balanced_keys],
            'missingConfigurations':[{'method':m,'scene':s,'stride':k} for m,s,k in missing],
            'excludedIncompleteRaw':excluded,'environment':environment,'protocolId':protocol['protocolId'],
            'configurations':configs,'validationStatus':audit_status,'sourceRun':str(run),'sourceProtocolSha256':sha(run/'protocol.json'),
            'scopeManifestSha256':sha(scope_path),'scopeManifestPath':str(scope_path),'hostInventory':host}
    out.mkdir(parents=True,exist_ok=True)
    evidence=[];(out/'evidence').mkdir(exist_ok=True)
    candidates=[scope_path,*[validation/n for n in ('collection-protocol.json','collection-runtime-cleanup.json','collection-progress.json','pause-receipt.json','partial-performance-qa.json','quality-numerical-validation.json','independent-quality-qa.json')]]
    if quality['available']:candidates += [directory/n for n in ('quality-summary.json','metrics-protocol.json','collection-scope.json')]
    for source in candidates:
        if not source.exists():continue
        destination=out/'evidence'/source.name;digest=sha(source);shutil.copyfile(source,destination)
        require(sha(destination)==digest,'Preview evidence copy differs')
        evidence.append({'sourcePath':str(source),'sourceSha256':digest,'outputPath':destination.relative_to(out).as_posix(),'outputSha256':digest})
    report['evidence']=evidence
    write_json(out/'evidence-copy-receipt.json',{'complete':True,'records':evidence})
    write_csv(out/'configurations.csv',configs);write_csv(out/'round-means.csv',rounds)
    write_csv(out/'individual-samples.csv',samples);write_csv(out/'quality-views.csv',views)
    write_csv(out/'balanced-scene-aggregates.csv',balanced);write_json(out/'report.json',report)
    make_html(out,report,raw_records,rounds,views,gt_root,gt_manifest)
    (out/'STATUS.md').write_text(f'PARTIAL: {len(configs)}/156 complete configurations; {len(rounds)} rounds; {len(samples)} samples.\nGT quality for this subset: '+('complete' if quality['available'] else 'pending')+'.\nNo result is claimed for missing configurations.\n')
    write_json(out/'build-receipt.json',{'schema':'partial-preview-build-v1','generatedAt':now(),'fullMatrixComplete':False,
        'performanceSubsetComplete':True,'qualitySubsetComplete':quality['available'],'sourceProtocolSha256':report['sourceProtocolSha256'],
        'scopeManifestSha256':report['scopeManifestSha256'],'requestedScopeComplete':report['requestedScopeComplete'],'evidence':evidence,
        'sources':[{'path':r['raw_path'],'sha256':r['raw_sha256']} for r in configs],
        'quality':quality,'scriptSha256':sha(Path(__file__)),
        'outputs':[{'path':str(p.relative_to(out)),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file() and p.name!='build-receipt.json']})
    return report


def make_html(out,report,raw_records,rounds,views,gt_root,gt_manifest):
    configs=report['configurations'];ready=report['qualitySubsetComplete']
    def qfmt(row,field):return '∞' if ready and field=='psnr_db' and row[field] is None else fmt(row[field],4 if field!='psnr_db' else 3)
    labels={**LABELS,'spark':'Spark.js 0.1.10 · native16 keys'}
    main_headers=['Scene','stride','Method','Gaussians','E2E mean ± SD ms','P50 ms','P95 ms','Completed FPS','PSNR dB ↑','SSIM ↑','LPIPS ↓','Details']
    main_rows=[]
    for r in configs:
        key=f'{r["scene"]}-s{r["stride"]}-{r["method"]}'
        main_rows.append([esc(r['scene']),r['stride'],esc(labels[r['method']]),f'{r["gaussian_count"]:,}',
            f'{r["e2e_completion_mean_ms"]:.3f} ± {r["e2e_completion_round_mean_sd_ms"]:.3f}',
            fmt(r['e2e_completion_p50_ms']),fmt(r['e2e_completion_p95_ms']),fmt(r['completed_frames_per_second']),
            *[qfmt(r,f) for f in ('psnr_db','ssim','lpips_vgg')],f'<a href="#detail-{key}">5轮 / 各视角</a>'])
    summary_headers=['共同场景数','stride','Method','Mean E2E ms','Mean scene P50','Mean scene P95','Mean scene FPS','PSNR dB','SSIM','LPIPS']
    summary_rows=[[r['scenes'],r['stride'],esc(labels[r['method']]),*[fmt(r[f]) for f in ('e2e_completion_mean_ms','e2e_completion_p50_ms','e2e_completion_p95_ms','completed_frames_per_second')],*[qfmt(r,f) for f in ('psnr_db','ssim','lpips_vgg')]] for r in report['balancedAggregates']]
    components=['gpu_prep_ms','gpu_depth_metric_ms','gpu_sort_ms','gpu_draw_ms','gpu_blit_ms','cpu_key_generation_histogram_ms','cpu_sort_ms','cpu_postprocess_ms']
    component_headers=['Scene','stride','Method','Stage API cost ± SD','GPU prep','GPU depth-key','GPU sort','GPU draw / fused','GPU blit','CPU key/hist','CPU sort','CPU post','Stage > E2E']
    component_rows=[[r['scene'],r['stride'],esc(labels[r['method']]),f'{r["stage_cost_ms_mean"]:.3f} ± {r["stage_cost_ms_sd"]:.3f}',*[('— (N/A or fused)' if r[f] is None else fmt(r[f])) for f in components],r['stage_exceeds_e2e_samples']] for r in configs]
    coverage_rows=[[s,k,*[('✓ 已完成' if (m,s,k) in raw_records else '— 未测') for m in METHODS]] for k in STRIDES for s in SCENES]
    details=[]
    for row in configs:
        m,s,k=row['method'],row['scene'],row['stride'];key=f'{s}-s{k}-{m}'
        rr=[r for r in rounds if (r['method'],r['scene'],r['stride'])==(m,s,k)]
        vr=[r for r in views if (r['method'],r['scene'],r['stride'])==(m,s,k)]
        rt=table(['Round','Samples','E2E mean','P50','P95','Completed FPS','Window ms','Stage API cost'],[[r['repeat']+1,r['samples'],*[fmt(r[f]) for f in ('e2e_completion_mean_ms','e2e_completion_p50_ms','e2e_completion_p95_ms','completed_frames_per_second','window_elapsed_ms','stage_cost_ms')]] for r in rr])
        vt=table(['Camera','Image name','Timed samples','View E2E mean','View P50','View P95','PSNR dB','SSIM','LPIPS'],[[r['camera_index'],esc(r['img_name']),r['timing_samples'],*[fmt(r[f]) for f in ('e2e_mean_ms','e2e_p50_ms','e2e_p95_ms')],*[qfmt(r,f) for f in ('psnr_db','ssim','lpips_vgg')]] for r in vr])
        details.append(f'<details id="detail-{key}"><summary>{esc(s)} · stride {k} · {esc(labels[m])} — {row["gaussian_count"]:,} Gaussians</summary><h3>5个会话内轮次 / Five within-session rounds</h3>{rt}<h3>逐视角 / Per selected heldout view</h3><p>每视角的耗时来自15个样本（5轮×每轮3次）；不把其倒数当完整loop FPS。质量为该视角一次独立截图相对GT的分数。</p>{vt}</details>')
    gallery=[];gallery_receipt=[];(out/'gallery').mkdir(exist_ok=True)
    gt={(r['scene'],r['camera_index']):r for r in gt_manifest['entries']}
    for item in report['balancedSceneStrideGroups']:
        if item['stride']!=1:continue
        scene=item['scene'];ref=gt[scene,0]
        entries=[('GT','ground-truth',gt_root/ref['relative_path'],ref['sha256'])]
        for method in METHODS:
            cap=next(c for c in raw_records[method,scene,1]['captures'] if c['cameraIndex']==0)
            entries.append((labels[method],method,Path(report['sourceRun'])/cap['path'],cap['sha256']))
        cards=[]
        for label,method,source,digest in entries:
            destination=out/'gallery'/f'{scene}-{method}-v000.png';shutil.copyfile(source,destination)
            require(sha(destination)==digest,'Gallery bytes differ from source receipt')
            relative=destination.relative_to(out).as_posix()
            cards.append(f'<figure><a href="{relative}"><img loading="lazy" src="{relative}" alt="{esc(scene+" "+label)}"></a><figcaption>{esc(label)}</figcaption></figure>')
            gallery_receipt.append({'scene':scene,'method':method,'sourcePath':str(source),'sourceSha256':digest,'outputPath':relative,'outputSha256':digest})
        gallery.append('<h3>'+esc(scene)+' · stride1 · camera0</h3><div class="gallery">'+''.join(cards)+'</div>')
    write_json(out/'gallery-receipt.json',{'complete':True,'records':gallery_receipt,'policy':'Exact original PNG bytes, no resizing/re-encoding'})
    env=report['environment'];stage_over=sum(r['stage_exceeds_e2e_samples'] for r in configs)
    css='*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#173047;font:15px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}header{background:#183e58;color:white;padding:24px}main{max-width:1600px;padding:22px;margin:auto}section,details{min-width:0;max-width:100%;background:white;border-radius:10px;padding:20px;margin:18px 0}h1,h2{line-height:1.3}a{color:#14679d;overflow-wrap:anywhere}header a{color:#d1ecff}.notice{background:#fff2cb;border-left:5px solid #c98b00;padding:15px}.table-scroll{min-width:0;max-width:100%;overflow:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:8px;border-bottom:1px solid #dce5ed;text-align:left;white-space:nowrap}th{background:#eaf1f6}tr:hover{background:#f2f7fb}summary{cursor:pointer;font-weight:650}p{max-width:1300px}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}figure{margin:0}img{max-width:100%;height:auto}code{background:#eef2f7;padding:2px 4px}button,input{font:inherit;padding:8px}.muted{color:#587087}@media(max-width:700px){main{padding:8px}section,details{padding:12px}.gallery{grid-template-columns:1fr}}'
    links=' · '.join(f'<a href="{file}">{label}</a>' for file,label in [('configurations.csv','34配置CSV'),('round-means.csv','170轮CSV'),('quality-views.csv','956视角CSV'),('individual-samples.csv','14,340逐样本CSV'),('balanced-scene-aggregates.csv','平衡场景摘要CSV'),('report.json','完整JSON'),('build-receipt.json','SHA receipt')])
    definitions='<ul><li><b>E2E mean±SD：</b>mean为全部逐帧完成耗时均值，SD为5个会话内轮均值的样本标准差；不是5次独立冷启动。</li><li><b>E2E P50/P95：</b>浏览器同一performance时钟包围await sample，包含当前相机更新、新排序、GPU完成与query读回/轮询。对全部逐帧样本做Type7分位数，混合视角复杂度与运行波动；不是显示延迟或固定镜头抖动。</li><li><b>Completed FPS：</b>1000×完成样本总数÷5轮完整浏览器loop窗口总毫秒。排除加载、预热、截图和Node RPC。不是stage倒数，也不是屏幕FPS。</li><li><b>PSNR/SSIM/LPIPS：</b>真实照片GT，固定1280×720；PSNR按逐图dB平均，SSIM为11×11 Gaussian/sigma1.5/zero-pad5，LPIPS为VGG v0.1。PSNR CPU float64；SSIM/LPIPS设备见质量状态。没有质量结果时显示待测，不填0。</li><li><b>跨场景摘要：</b>只对三方法共同完整的同stride场景集合先算各场景指标，再场景等权平均。摘要P50/P95是各场景分位数均值，不是合并分位数；FPS先逐场景算，再平均。</li></ul>'
    limits='<p>Spark 0.1.10只在native16排序键这一项采用上游运行时默认；显式sortRadial=false、preBlurAmount=.3、blurAmount=0，上游对应true/0/.3。适配器仅含计时/诊断及同步prepare临时引用补偿，原生算法、shader、WASM不改。</p><p>SuperSplat保留原生单横向focal协方差Jacobian，GT与相机中心按fx/fy独立缩放；冻结相机有效fx/fy为.984859–1.186780。高斯footprint、编码、剔除和draw负担不保证相同，质量/速度不能仅归因排序键或芯片。T&T真值70张需上采样；固定framebuffer分数不等于论文native-resolution指标。</p>'
    status='本34配置质量已测齐 / subset quality measured；PSNR采用本机CPU float64，SSIM/LPIPS采用本机'+str(report['quality'].get('device','')).upper()+' float32' if ready else 'PSNR / SSIM / LPIPS 正在补齐，当前明确显示待测 / quality pending'
    stage_counts='；'.join(f'{labels[m]}: {sum(r["stage_exceeds_e2e_samples"] for r in configs if r["method"]==m)} / {sum(r["samples"] for r in configs if r["method"]==m)}' for m in METHODS)
    validation_rows=[[{'performance':'完整配置的性能审计','quality':'真实图像质量的独立复核','numerical':'质量公式数值自检'}[k], '通过' if v.get('passed') is True else '等待完成', esc(v.get('sha256','尚无回执'))] for k,v in report['validationStatus'].items()]
    evidence_links=' · '.join(f'<a href="{esc(e["outputPath"])}">{esc(Path(e["outputPath"]).name)}</a>' for e in report['evidence'])
    body=[f'<header><h1>Mac 三方法实测预览 · {report["completedConfigurations"]} / 156 配置</h1><p>用于评审指标粒度 · Explicitly partial preview · {status}</p><p>{links}</p></header><main>',
      f'<section class="notice"><b>范围：</b>{len(configs)}个已完成配置，{report["roundCount"]}轮、{report["sampleCount"]:,}计时样本、{report["qualityViewsExpected"]}张质量截图。其余{len(report["missingConfigurations"])}配置未测。全量156配置尚未完成。三种方法只在共同完成的11个场景上等权比较；truck仅SuperSplat已完成，因此单列、不纳入总体比较。stride2/4/8目前均未测，不推断规模趋势。</section>',
      f'<section><h2>环境 / Environment</h2><p><b>{esc(env["chip"])}</b> · CPU {esc(env["cpu"])} · GPU {esc(env["gpu_cores"])} cores · RAM {esc(env["memory"])}。{esc(env["gpu_backend"])}</p><p>{esc(env["browser_version"])} · headless · {esc(env["os_name"])} {esc(env["os_version"])} / {esc(env["os_build"])} · framebuffer <b>1280×720</b> · viewport1280×760 · DPR1 · SH3 · 黑底 · LoD off</p><p>Protocol: {esc(report["protocolId"])}。每配置5轮，每轮将全部选定视角遍历3次。CSV每配置含环境字段。</p></section>',
      '<section id="balanced"><h2>1. 11个共同场景等权摘要 / Balanced-scene summary</h2><p>三种方法只在共同完成的11个场景上等权比较；truck仅SuperSplat已完成，因此单列、不纳入总体比较。</p>'+table(summary_headers,summary_rows)+'</section>',
      '<section id="configs"><h2>2. 逐配置主表 / Configuration detail</h2><p>每行=场景 × 降采样步长 × 方法；stride 1表示完整模型，其他stride表示按固定索引步长保留点。点击末列查看5轮和每个选定测试视角。</p>'+table(main_headers,main_rows,{'E2E mean ± SD ms':'Mean individual completion; SD of five round means','P50 ms':'Type7 percentile of all individual completion samples','Completed FPS':'1000*N/sum(5 browser-loop windowElapsedMs)'})+'</section>',
      f'<section id="stage"><h2>3. 逐配置CPU/GPU阶段 / Component diagnostics</h2><p>单位ms，保留全部API原值。{stage_over}个样本stage成本大于同次E2E（{esc(stage_counts)}）。GPU query区间累计未验证为互斥独占成本，尤其SS draw/blit对前序完成敏感，不能解释为物理串行elapsed，也不能倒数FPS。Spark depth-key pass不是GPU排序；SS GPU prep融合在draw，缺项不是0。</p>'+table(component_headers,component_rows)+'</section>',
      '<section id="drilldown"><h2>4. 轮次与逐视角展开 / Rounds and views</h2><p>下列34个配置共170轮、956个视角；底层14,340个逐帧样本另在CSV。<button onclick="document.querySelectorAll(\'details\').forEach(x=>x.open=true)">展开全部</button> <button onclick="document.querySelectorAll(\'details\').forEach(x=>x.open=false)">收起全部</button></p>'+''.join(details)+'</section>',
      '<section><h2>指标定义与限制 / Definitions</h2>'+definitions+limits+'</section>',
      '<section id="coverage"><h2>完整矩阵覆盖 / Coverage and missing results</h2>'+table(['Scene','stride',*[LABELS[m] for m in METHODS]],coverage_rows)+'</section>',
      '<section id="gallery"><h2>同camera0的GT与三方法 / Same-camera gallery</h2><p>均为既有正式截图与prepared GT的原始PNG字节。截图构图检查不能证明画质等价。</p>'+''.join(gallery)+'</section>',
      '<section><h2>验证状态 / Validation</h2><p>'+evidence_links+'</p>'+table(['检查','状态','回执SHA256'],validation_rows)+'<p>全量156配置尚未完成。审计回执对应本次34个配置的固定范围，详细来源见JSON文件。</p></section></main>']
    body.append('''<script>document.querySelectorAll('a[href^="#detail-"]').forEach(a=>a.addEventListener('click',()=>{const d=document.getElementById(a.hash.slice(1));if(d)d.open=true;}));</script>''')
    (out/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>34配置指标粒度预览</title><style>'+css+'</style>'+''.join(body)+'</html>',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=Path('config/local.json'));parser.add_argument('--run-dir',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--quality-dir',type=Path)
    parser.add_argument('--scope',type=Path,help='Immutable scope receipt; defaults to preview validation/scope-manifest.json')
    parser.add_argument('--require-quality',action='store_true');args=parser.parse_args()
    args.config=resolved(args.config);args.run_dir=resolved(args.run_dir);args.output=resolved(args.output)
    args.quality_dir=resolved(args.quality_dir) if args.quality_dir else args.output.parent/'quality'
    args.scope=resolved(args.scope) if args.scope else None
    report=build(args)
    print(json.dumps({k:report[k] for k in ('completedConfigurations','roundCount','sampleCount','qualityViewsExpected','qualitySubsetComplete','fullMatrixComplete')}))


if __name__=='__main__':main()
