"""Human and paper artifacts for the validated three-method portable protocol."""
from __future__ import annotations
import html
import json
import os
from pathlib import Path
import re
import statistics

from common import SCENES, STRIDES, METHODS, LABELS, BOUNDARIES, write_json

COLORS = {'visionary': '#2867a5', 'spark': '#df8a25', 'supersplat': '#6b9562'}


def fmt(x, n=3):
    return '∞' if x is None else f'{x:.{n}f}'


def table(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] +
                     ['| ' + ' | '.join(str(v) for v in row) + ' |' for row in rows])


def html_table(headers, rows):
    return '<div class="table-scroll"><table><thead><tr>' + ''.join('<th>' + html.escape(str(h)) + '</th>' for h in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join('<td>' + html.escape(str(v)) + '</td>' for v in row) + '</tr>' for row in rows) + '</tbody></table></div>'


def plots(out, report, labels):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    lookup = {(r['scene'], r['stride'], r['method']): r for r in report['configurations']}
    with plt.rc_context({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False,
                         'axes.spines.right': False, 'svg.fonttype': 'none'}):
        for field, name, ylabel, title in [
            ('completed_frames_per_second', 'full-model-completed-fps', 'Serial completed frames / second', 'Instrumented GPU-completion throughput'),
            ('stage_cost_ms_mean', 'full-model-stage-cost', 'Selected stage cost (ms)', 'Method-specific selected stages; not E2E FPS')]:
            fig, ax = plt.subplots(figsize=(14, 5.8), layout='constrained')
            for index, method in enumerate(METHODS):
                selected = [lookup[s, 1, method] for s in SCENES]
                error = [r['stage_cost_ms_sd'] for r in selected] if field == 'stage_cost_ms_mean' else None
                ax.bar([i + (index - 1) * .24 for i in range(13)], [r[field] for r in selected],
                       yerr=error, width=.22, capsize=2, color=COLORS[method], label=labels[method])
            ax.set_xticks(range(13), SCENES, rotation=25, ha='right'); ax.set_ylabel(ylabel)
            ax.set_title(title + ' — 13 full models, 1280×720', loc='left')
            ax.legend(frameon=False, ncols=3, fontsize=9); ax.grid(axis='y', alpha=.2); ax.set_axisbelow(True)
            for ext in ('png', 'svg'): fig.savefig(out / f'{name}.{ext}', dpi=200)
            plt.close(fig)
        fig, ax = plt.subplots(figsize=(14, 6), layout='constrained')
        for method in METHODS:
            for percentile, marker, style in [('p50', 'o', '-'), ('p95', '^', '--')]:
                ax.plot(range(13), [lookup[s, 1, method][f'e2e_completion_{percentile}_ms'] for s in SCENES],
                        marker=marker, linestyle=style, color=COLORS[method], label=labels[method] + ' ' + percentile.upper())
        ax.set_xticks(range(13), SCENES, rotation=25, ha='right'); ax.set_ylabel('Instrumented GPU completion (ms)')
        ax.set_title('Individual-sample completion P50/P95 — mixed heldout views', loc='left')
        ax.legend(frameon=False, ncols=3, fontsize=8); ax.grid(alpha=.2)
        for ext in ('png', 'svg'): fig.savefig(out / f'full-model-e2e-percentiles.{ext}', dpi=200)
        plt.close(fig)
        fig, axes = plt.subplots(3, 5, figsize=(16, 9), layout='constrained')
        for ax, scene in zip(axes.flat, SCENES):
            for method in METHODS:
                selected = [lookup[scene, stride, method] for stride in reversed(STRIDES)]
                ax.plot([r['gaussian_count'] / 1e6 for r in selected], [r['completed_frames_per_second'] for r in selected],
                        marker='o', markersize=3, color=COLORS[method], label=labels[method])
            ax.set_title(scene, loc='left'); ax.grid(alpha=.2); ax.set_ylim(bottom=0)
        for ax in list(axes.flat)[13:]: ax.set_visible(False)
        fig.supxlabel('Input Gaussians (millions) — deterministic strides 8, 4, 2, 1')
        fig.supylabel('Serial completed frames / second')
        fig.suptitle('Three methods × four fixed scales; native LoD disabled', x=.02, ha='left')
        fig.legend(*axes[0, 0].get_legend_handles_labels(), loc='outside lower center', ncols=3, frameon=False)
        for ext in ('png', 'svg'): fig.savefig(out / f'four-scale-throughput.{ext}', dpi=200)
        plt.close(fig)
        fig, axes = plt.subplots(3, 1, figsize=(14, 11), layout='constrained', sharex=True)
        for ax, field, ylabel in zip(axes, ('gt_psnr_db', 'gt_ssim', 'gt_lpips_vgg'), ('GT PSNR (dB) ↑', 'GT SSIM ↑', 'GT LPIPS ↓')):
            for index, method in enumerate(METHODS):
                values = [lookup[s, 1, method][field] for s in SCENES]
                if any(v is None for v in values):
                    # Perfect-image infinite PSNR must not become a finite bar.
                    values = [float('nan') if v is None else v for v in values]
                ax.bar([i + (index - 1) * .24 for i in range(13)], values, width=.22, color=COLORS[method], label=labels[method])
            ax.set_ylabel(ylabel); ax.grid(axis='y', alpha=.2); ax.set_axisbelow(True)
        axes[0].legend(frameon=False, ncols=3, fontsize=9)
        axes[0].set_title('True heldout photographs — per-view means at fixed 1280×720', loc='left')
        axes[-1].set_xticks(range(13), SCENES, rotation=25, ha='right')
        for ext in ('png', 'svg'): fig.savefig(out / f'full-model-quality.{ext}', dpi=200)
        plt.close(fig)
    write_json(out / 'plot-receipt.json', {'backend': 'matplotlib', 'version': matplotlib.__version__,
               'formats': ['PNG 200dpi', 'SVG'], 'data': 'Validated newly measured run only',
               'stageErrorBars': 'SD of five within-session round means', 'fps': 'Count / full measured browser-loop window'})


def build(out, report, qa, captures):
    rows = report['configurations']; env = report['environment']
    lookup = {(r['scene'], r['stride'], r['method']): r for r in rows}
    bits = report['methodDefinitions']['spark']['sortBits']
    labels = {**LABELS, 'spark': f'Spark.js 0.1.10 native {bits}-bit keys'}
    hardware = report['hostInventory'].get('hardware', {}).get('SPHardwareDataType', [{}])[0]
    processor = hardware.get('number_processors', 'See host inventory')
    core_parts = re.fullmatch(r'proc(\d+):(\d+):(\d+)', processor)
    if core_parts:
        total, performance, efficiency = core_parts.groups()
        processor = f'{total} cores ({performance} performance + {efficiency} efficiency) / {total} 核（{performance} 性能 + {efficiency} 能效）'
    display = report['hostInventory'].get('hardware', {}).get('SPDisplaysDataType', [{}])[0]
    environment_rows = [
        ['Host / 主机', hardware.get('machine_name', 'Mac')],
        ['Chip / 芯片', hardware.get('chip_type', 'See host inventory')],
        ['CPU', processor], ['GPU', display.get('sppci_model', display.get('_name', 'See host inventory'))],
        ['RAM', hardware.get('physical_memory', 'See host inventory')],
        ['Framebuffer', '1280 × 720 pixels'], ['Viewport', '1280 × 760 CSS pixels'], ['DPR', 1],
        ['Render settings', 'SH3 · black background · LoD off'],
        ['Browser', str(env['browser_version']) + ' / headless'],
        ['OS', f'{env["os_name"]} {env["os_version"]} / build {env["os_build"]}'],
        ['Quality device', f'PSNR: CPU float64; SSIM / LPIPS: {report["qualityProtocol"]["device"]} float32'],
        ['Protocol', report['protocolId']], ['Start UTC', report['startedAt']], ['End UTC', report['completedAt']]]
    main_headers = ['Scene'] + [labels[m] + '\nP50 / P95 ms · FPS' for m in METHODS]
    main_rows = [[scene] + [f'{lookup[scene,1,m]["e2e_completion_p50_ms"]:.3f} / {lookup[scene,1,m]["e2e_completion_p95_ms"]:.3f} · {lookup[scene,1,m]["completed_frames_per_second"]:.3f}' for m in METHODS] for scene in SCENES]
    aggregate_headers = ['stride', 'Method', 'E2E mean ms', 'Mean scene P50 ms', 'Mean scene P95 ms', 'Mean scene FPS', 'GT PSNR dB', 'GT SSIM', 'GT LPIPS']
    aggregate_rows = [[f's{r["stride"]}', labels[r['method']], *[fmt(r[k], 5 if k in ('gt_ssim', 'gt_lpips_vgg') else 3) for k in
                      ('e2e_completion_mean_ms', 'e2e_completion_p50_ms', 'e2e_completion_p95_ms', 'completed_frames_per_second', 'gt_psnr_db', 'gt_ssim', 'gt_lpips_vgg')]] for r in report['aggregates']]
    stage_headers = ['Scene'] + [labels[m] + ' ms ± SD' for m in METHODS]
    stage_rows = [[scene] + [f'{lookup[scene,1,m]["stage_cost_ms_mean"]:.3f} ± {lookup[scene,1,m]["stage_cost_ms_sd"]:.3f}' for m in METHODS] for scene in SCENES]
    component_fields = ['gpu_prep_ms', 'gpu_depth_metric_ms', 'gpu_sort_ms', 'gpu_draw_ms', 'gpu_blit_ms', 'cpu_key_generation_histogram_ms', 'cpu_sort_ms', 'cpu_postprocess_ms']
    component_headers = ['Method', 'GPU prep', 'GPU depth key', 'GPU sort', 'GPU draw/fused', 'GPU blit', 'CPU key/hist', 'CPU sort', 'CPU post']
    component_rows = []
    for method in METHODS:
        group = [lookup[s, 1, method] for s in SCENES]
        component_rows.append([labels[method]] + [fmt(statistics.fmean(r[f] for r in group)) if all(r[f] is not None for r in group) else '— / fused or N/A' for f in component_fields])
    quality_headers = ['Scene', 'Method', 'PSNR dB ↑', 'SSIM ↑', 'LPIPS ↓']
    quality_rows = [[s, labels[m], fmt(lookup[s,1,m]['gt_psnr_db']), fmt(lookup[s,1,m]['gt_ssim'],5), fmt(lookup[s,1,m]['gt_lpips_vgg'],5)] for s in SCENES for m in METHODS]
    power_rows = []
    for method in METHODS:
        group = [r for r in rows if r['method'] == method]
        batteries = [r['battery_min_percent'] for r in group if r['battery_min_percent'] is not None] + [r['battery_max_percent'] for r in group if r['battery_max_percent'] is not None]
        power_rows.append([labels[method], sum(r['telemetry_samples'] for r in group), 'AC Power', f'{min(batteries)}–{max(batteries)}%' if batteries else 'No battery / N/A', sum((r['swapouts_counter_delta'] or 0)>0 for r in group)])
    variation_rows = [[r['scene'],r['stride'],labels[r['method']],fmt(r['round_cv_percent'],2),fmt(100*r['e2e_completion_round_mean_sd_ms']/r['e2e_completion_mean_ms'],2)] for r in sorted(rows,key=lambda r:r['round_cv_percent'],reverse=True)[:10]]
    raf_headers = ['Scene', 'Method', 'Frames', 'Callback Hz (not display FPS)', 'Interval P50 ms', 'Interval P95 ms']
    raf_rows = [[r['scene'],labels[r['method']],r['frames'],fmt(r['callback_throughput_hz']),fmt(r['interval_p50_ms']),fmt(r['interval_p95_ms'])] for r in report['nativeRaf']]
    stages_over_wall = sum(r['diagnostics'].get('stage_sum_exceeds_sync_wall_samples', 0) for r in rows)
    plots(out, report, labels)
    quality_protocol = report['quality']
    caveat_zh = ('端到端区间为浏览器performance.now在await bench.sample(camera)之前到Promise返回之后：包括当前相机更新、新排序、GPU完成等待、timer-query轮询/读回和计量断言。它是带计量开销的完成耗时，不是输入到光子或屏幕呈现延迟。FPS按所有完成帧数×1000除以5轮完整浏览器loop窗口总毫秒计算，含loop记账；排除加载、预热、截图、Node RPC/序列化和轮间预热。P50/P95对全部逐帧样本做Type7线性插值，不是轮均值分位数；分布混合选定视角复杂度与运行波动，不等于固定镜头抖动。')
    caveat_en = ('End-to-end completion is the browser performance.now interval around await bench.sample(camera), including the current-camera update, fresh sort, GPU-completion waits, timer-query polling/readback and measurement assertions. This is instrumented completion latency, not input-to-photon or display latency. Completed FPS is 1000 times all completed frames divided by the sum of five complete browser-loop windows, including bookkeeping and excluding loading, warmups, captures and Node RPC/serialization. P50/P95 use Type-7 interpolation over individual samples, not round means; they mix selected-view complexity with runtime variation.')
    scale_zh = '156=13场景×4个stride×3方法；780轮、68,040计时样本、234正式PNG、4,536质量视图。stride按原始PLY第0、stride、2×stride…行确定性取点，不是LoD。每配置一个浏览器/模型会话内5轮、每轮3个完整视角cycle；初始预热同时至少10秒和128样本，轮间至少1.5秒和32样本。五轮不是五个独立浏览器进程。'
    scale_en = '156 configurations = 13 scenes × four fixed strides × three methods; 780 rounds, 68,040 timing samples, 234 formal PNGs and 4,536 quality views. Strides select original PLY rows 0, stride, 2×stride… and are not LoD. Each configuration has five rounds in one browser/model session, each with three traversals of every heldout view. Initial warmup requires both 10 seconds and 128 samples; inter-round warmup requires 1.5 seconds and 32 samples. The five rounds are not five independent processes.'
    versions_zh = f'Spark.js固定0.1.10官方算法，实际选用原生{bits}位排序键；加入计时/诊断插桩，并在适配器中释放原生同步prepare未释放的临时accumulator引用，保持active/display两份引用。算法、shader及WASM未改，不宣称bundle字节完全未改。没有改造FP16算法版本，也没有混入2.1.0结果。Visionary为1.0.1；SuperSplat Editor为2.1.0/PlayCanvas2.5.1。排序键位宽不是整套高斯属性精度；Visionary仍保留官方loader的FP16属性编码。'
    versions_en = f'Spark.js is pinned to official version 0.1.10 algorithms using its native {bits}-bit sorting-key path. Instrumentation adds timing/diagnostics; the adapter releases the temporary accumulator reference left by native synchronous prepare while retaining its active/display references. Algorithms, shaders and WASM remain unchanged; the instrumented bundle is not claimed to be byte-identical to upstream. No modified FP16 algorithm variant or Spark 2.1.0 measurement enters this run. Visionary 1.0.1 and SuperSplat Editor 2.1.0/PlayCanvas 2.5.1 remain pinned. Sorting-key width is not whole-model attribute precision; Visionary retains the official loader\'s FP16 attribute encoding.'
    aggregation_zh = '每配置mean±SD中的SD来自5个轮均值。所有跨场景汇总按13场景等权：先各场景算FPS，再求均值；不能把跨场景平均耗时取倒数。汇总P50/P95是各场景分位数的算术平均，不是合并全部场景后的总体分位数。逐配置和逐帧完整数值在CSV中。'
    aggregation_en = 'SD describes the five within-session round means. Cross-scene aggregates give equal weight to thirteen scenes: compute FPS per scene first, then average; do not invert the across-scene mean latency. Aggregate P50/P95 columns average the scene-specific quantiles; they are not pooled quantiles. Configuration and individual-sample CSVs preserve the full precision.'
    quality_zh = '真实heldout照片为参考。PSNR在本机CPU以float64 RGB8 MSE逐图取dB后平均；SSIM为11×11 Gaussian、sigma1.5、零填充5、RGB平均；LPIPS为官方v0.1 VGG ImageNet与学习校准。SSIM/LPIPS实际设备见质量协议，MPS只在性能采集结束后使用。照片按冻结投影独立缩放到1280×720，无裁剪/补边/曝光调整；T&T truck/train原图979×546/980×545需上采样，共70视图。因此不宣称复现论文native-resolution分数。三方法编码、剔除、可见集合、footprint与排序不同，质量差异不能仅归因于键位宽。'
    quality_en = 'The reference is the actual heldout photograph. PSNR uses local CPU float64 RGB8 MSE, averaged after converting each view to dB. SSIM uses an11×11 Gaussian window, sigma1.5, five-pixel zero padding and RGB averaging. LPIPS uses official v0.1 VGG/ImageNet features and learned calibration. The quality protocol records the actual SSIM/LPIPS device; MPS evaluation runs only after performance collection. Photos are independently resized to1280×720 without crop, padding or exposure adjustment; truck/train source images are979×546/980×545, so70 views are upsampled. These are not native-resolution paper scores. Encoding, culling, visible sets and raster footprints differ across renderers; quality differences cannot be attributed only to key width.'
    diagnostics_zh = f'未删除任何有效样本。同次stage成本超过E2E样本数：{qa["stageExceedsE2ESamples"]}；stage和大于旧式同步wall样本数：{stages_over_wall}。后者作为跨计时域/后端边界诊断保留，不能将gl.finish返回时间冒充GPU完成或用阶段和倒数冒充FPS。原生rAF只在stride1每配置360callback采集；可沿用旧排序，不保证实际呈现或当前视角新排序，callbackHz独立列示。'
    diagnostics_en = f'No valid samples are removed. Same-sample stage cost exceeds the E2E interval in {qa["stageExceedsE2ESamples"]} samples; stage sums exceed the legacy synchronous wall in {stages_over_wall}. The latter remains a cross-clock/backend diagnostic; gl.finish return time is not substituted for verified completion. Native rAF records 360 callbacks per full-model configuration and may reuse an earlier sort. Callback Hz is distinct from fresh-sort completion throughput and physical presentation FPS.'
    power_zh = '所有已观测供电必须为AC，5秒采样不能排除未捕获的短暂变化。无锁频或温度恒定假设。swapout计数跨度覆盖完整会话，包括加载、预热和截图，不能归因到计时区间；所有记录保留。方法顺序按scene/stride轮换降低单向时间漂移，但各方法仍是不同会话。'
    power_en = 'All observed power states must be AC; five-second polling cannot exclude unsampled brief transitions. No frequency lock or fixed temperature is assumed. Swapout changes cover complete sessions including load, warmup and captures, and cannot be assigned specifically to measured intervals. Method order rotates across scene/stride to reduce one-directional drift, but methods remain separate sessions.'
    links = [('Protocol','../protocol.json'),('Full raw-linked JSON','report.json'),('Configurations CSV','configurations.csv'),
             ('Hardware inventory','../environment/host-inventory.json'),('Pilot and CPU/GPU prerequisites','../validation/prerequisites.json'),
             ('All round means','round-means.csv'),('Individual E2E samples','e2e-samples.csv'),('Scene aggregates','aggregates.csv'),
             ('Quality protocol','../quality/metrics/metrics-protocol.json'),('Quality summary','../quality/metrics/quality-summary.json'),
             ('QA','analysis-qa.json'),('SHA receipt','build-receipt.json'),('Capture gallery','captures.html'),('LaTeX','full-model-table.tex')]
    sections = []
    def section(key, zh, en, paragraphs_zh=(), paragraphs_en=(), headers=None, data=None, figures=()):
        sections.append(dict(key=key,zh=zh,en=en,pzh=list(paragraphs_zh),pen=list(paragraphs_en),headers=headers,rows=data,figures=list(figures)))
    section('scope','范围与版本','Scope and versions',[scale_zh,versions_zh],[scale_en,versions_en])
    section('environment','实际设备与渲染环境','Actual device and render environment',headers=['Field','Value'],data=environment_rows)
    section('e2e','主速度表：完整模型端到端P50/P95与完成FPS','Main speed table: full-model E2E percentiles and completed FPS',[caveat_zh,aggregation_zh],[caveat_en,aggregation_en],main_headers,main_rows,['full-model-completed-fps.png','full-model-e2e-percentiles.png'])
    section('scales','四规模与场景等权汇总','Four scales and equal-scene aggregates',[aggregation_zh],[aggregation_en],aggregate_headers,aggregate_rows,['four-scale-throughput.png'])
    section('stage','不同计时边界的阶段成本','Method-specific selected stages',
            ['阶段成本不是统一端到端时间。'+ ' '.join(BOUNDARIES[m] for m in METHODS)],
            ['Selected stages are not unified end-to-end times. '+ ' '.join(BOUNDARIES[m] for m in METHODS)],stage_headers,stage_rows,['full-model-stage-cost.png'])
    section('components','CPU/GPU分项','CPU/GPU components',
            ['13完整场景等权均值，单位ms；缺项不代表0。Spark独立depth-key GPU pass不是GPU排序；其排序在原生CPU WASM。SuperSplat GPU prep融合在draw。'],
            ['Equal-scene full-model means in ms. Missing/fused is not zero. Spark\'s GPU depth-key pass is not GPU sorting; sorting remains native CPU WASM. SuperSplat GPU prep is fused into draw.'],component_headers,component_rows)
    section('quality','真实照片质量PSNR/SSIM/LPIPS','Ground-truth PSNR/SSIM/LPIPS',[quality_zh],[quality_en],quality_headers,quality_rows,['full-model-quality.png'])
    section('variation','波动与计时诊断','Variation and timing diagnostics',[diagnostics_zh],[diagnostics_en],['Scene','stride','Method','Stage round CV %','E2E round CV %'],variation_rows)
    section('raf','原生异步callback辅助指标','Native asynchronous callback diagnostics',
            ['callbackHz=1000×N/ΣintervalMs，不是屏幕FPS，未把静态heldout质量分数当作每个callback的质量。'],
            ['Callback Hz=1000×N/ΣintervalMs. This is not display FPS; heldout still-image quality does not establish the quality of every asynchronous callback.'],raf_headers,raf_rows)
    section('power','电源与会话限制','Power and session limitations',[power_zh],[power_en],['Method','Telemetry rows','Source','Battery range','Sessions with swapout increase'],power_rows)
    for language in ('zh','en'):
        title = 'Mac三方法完整实测报告' if language=='zh' else 'Three-method complete Mac measurement report'
        pieces = ['# '+title,'**156/156 configurations · 780 rounds · 68,040 timed samples · 4,536 GT quality views**']
        for s in sections:
            pieces.extend(['## '+s[language],*s['p'+language]])
            if s['headers']: pieces.append(table([str(h).replace('\n','<br>') for h in s['headers']],s['rows']))
            pieces.extend(f'![{f}]({f})' for f in s['figures'])
        pieces.extend(['## '+('复现证据' if language=='zh' else 'Reproduction evidence'), ' · '.join(f'[{name}]({target})' for name,target in links)])
        (out/f'report-{language}.md').write_text('\n\n'.join(pieces)+'\n',encoding='utf-8')
    css='*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#182838;font:15px/1.7 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}header{background:#183950;color:white;padding:28px}header h1{margin:0}nav{display:flex;gap:16px;overflow:auto;white-space:nowrap;background:white;padding:12px;position:sticky;top:0;border-bottom:1px solid #ddd}main{max-width:1450px;margin:auto;padding:24px}section{scroll-margin-top:70px;background:white;padding:24px;margin-bottom:24px;border-radius:12px}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px;border-bottom:1px solid #e4eaf0;text-align:left}th{background:#eaf1f7}.chart{width:100%;height:auto}a{color:#176293}.en{color:#557087;font-size:14px}p{max-width:1250px}figure{margin:6px}img{max-width:100%}.gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}@media(max-width:700px){main{padding:10px}section{padding:15px}.gallery{grid-template-columns:1fr}}'
    body = []
    for s in sections:
        inner=''.join('<p>'+html.escape(p)+'</p>' for p in s['pzh'])+''.join('<p class="en">'+html.escape(p)+'</p>' for p in s['pen'])
        if s['headers']:inner+=html_table(s['headers'],s['rows'])
        inner+=''.join('<img class="chart" loading="lazy" src="'+f+'" alt="'+f+'">' for f in s['figures'])
        body.append(f'<section id="{s["key"]}"><h2>{s["zh"]}</h2><p class="en">{s["en"]}</p>{inner}</section>')
    body.append('<section><h2>复现证据 / Evidence</h2><p>'+' · '.join(f'<a href="{target}">{name}</a>' for name,target in links)+'</p></section>')
    page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mac三方法实测</title><style>'+css+'</style><header><h1>Mac三方法完整实测 · 156 / 156</h1><p>Visionary 1.0.1 · Spark.js 0.1.10 native '+str(bits)+'-bit · SuperSplat Editor 2.1.0</p></header><nav>'+''.join(f'<a href="#{s["key"]}">{s["zh"]}</a>' for s in sections)+'</nav><main>'+''.join(body)+'</main></html>'
    (out/'index.html').write_text(page,encoding='utf-8')
    gt_lookup={(r['scene'],r['camera_index']):r for r in report['groundTruthManifest']['entries']}
    gallery=[]
    for scene in SCENES:
        cards=[]
        entries=[('Ground truth',Path(report['groundTruthRoot'])/gt_lookup[scene,0]['relative_path'])]
        entries += [(labels[m],Path(next(r['path'] for r in captures if r['scene']==scene and r['stride']==1 and r['method']==m and r['camera_index']==0))) for m in METHODS]
        for label,path in entries:
            relative=os.path.relpath(path,out)
            cards.append('<figure><a href="'+html.escape(relative)+'"><img loading="lazy" src="'+html.escape(relative)+'" alt="'+html.escape(scene+' '+label)+'"></a><figcaption>'+html.escape(label)+'</figcaption></figure>')
        gallery.append('<section><h2>'+scene+' / full model / camera0</h2><div class="gallery">'+''.join(cards)+'</div></section>')
    (out/'captures.html').write_text('<!doctype html><meta charset="utf-8"><title>GT + three renderer capture gallery</title><style>'+css+'</style><main><h1>GT与三方法同相机截图</h1><p>Actual saved images; visual inspection is not a proof of equivalent quality.</p>'+''.join(gallery)+'</main>',encoding='utf-8')
    latex=['% Newly measured local Mac run; P50/P95 ms and serialized completed FPS.', '\\begin{tabular}{lrrr}', '\\hline',
           'Scene & Visionary & Spark.js 0.1.10 & SuperSplat \\\\', '\\hline']
    for scene in SCENES:
        values=['{:.3f}/{:.3f}/{:.3f}'.format(lookup[scene,1,m]['e2e_completion_p50_ms'],lookup[scene,1,m]['e2e_completion_p95_ms'],lookup[scene,1,m]['completed_frames_per_second']) for m in METHODS]
        latex.append(scene+' & '+' & '.join(values)+' \\\\')
    latex += ['\\hline','\\end{tabular}']
    (out/'full-model-table.tex').write_text('\n'.join(latex)+'\n')
    full=[r for r in report['aggregates'] if r['stride']==1]
    rebuttal='We remeasured Visionary1.0.1, official native Spark.js0.1.10 and SuperSplat Editor2.1.0 on the recorded local Mac, using156 configurations across13 scenes and4 deterministic input strides. At1280×720 with SH3 and LoD disabled, each configuration has five within-session rounds and three heldout-camera traversals per round, totaling68,040 timing samples. Equal-scene full-model serialized completion throughput is '+', '.join(labels[r['method']]+' '+fmt(r['completed_frames_per_second'])+' FPS' for r in full)+'. These rates include verified GPU completion and measurement readback; they are neither physical display FPS nor inverses of selected-stage costs. We additionally evaluate4,536 rendered views against real heldout photographs with PSNR, SSIM and LPIPS. Native encoding, culling and rasterization differences are retained, so timing differences do not establish equivalent image quality. Full hardware, browser, power, source hashes, per-sample timing and image lineage are preserved.'
    (out/'rebuttal-en.md').write_text(rebuttal+'\n')
