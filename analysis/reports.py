"""Human and paper artifacts for the validated three-method portable protocol."""
from __future__ import annotations
import html
import json
import os
from pathlib import Path
import re
import shutil
import statistics

from common import SCENES, STRIDES, METHODS, LABELS, BOUNDARIES, write_json, sha, require

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
    core_parts = re.fullmatch(r'proc\s*(\d+):(\d+):(\d+)', processor)
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
    configuration_headers = ['Scene', 'stride', 'Method', 'Gaussians', 'Views', 'Samples',
                             'E2E mean ± round SD ms', 'E2E P50 ms', 'E2E P95 ms', 'Completed FPS',
                             'Stage cost ± round SD ms', 'PSNR dB ↑', 'SSIM ↑', 'LPIPS ↓']
    configuration_rows = [
        [r['scene'], f's{r["stride"]}', labels[r['method']], f'{r["gaussian_count"]:,}', r['views'], r['samples'],
         f'{fmt(r["e2e_completion_mean_ms"])} ± {fmt(r["e2e_completion_round_mean_sd_ms"])}',
         fmt(r['e2e_completion_p50_ms']), fmt(r['e2e_completion_p95_ms']), fmt(r['completed_frames_per_second']),
         f'{fmt(r["stage_cost_ms_mean"])} ± {fmt(r["stage_cost_ms_sd"])}',
         fmt(r['gt_psnr_db']), fmt(r['gt_ssim'], 4), fmt(r['gt_lpips_vgg'], 4)] for r in rows]
    timeline = report['collectionTimeline']
    gap = timeline['largestAdjacentGap']
    timeline_rows = [
        ['First configuration start UTC', timeline['startedAt']],
        ['Last configuration completion UTC', timeline['completedAt']],
        ['Configuration-session span seconds', fmt(timeline['configurationSessionSpanSeconds'])],
        ['Latest collector invocation UTC', timeline['latestRuntimeStartedAt'] + ' → ' + timeline['latestRuntimeFinishedAt']],
        ['Existing complete configurations reused by latest invocation', timeline['resumedConfigurationCount']],
        ['Maximum adjacent configuration gap seconds', fmt(gap['gap_seconds'])],
        ['Before largest gap', gap['previous_configuration'] + ' / completed ' + gap['previous_completed_at']],
        ['After largest gap', gap['next_configuration'] + ' / started ' + gap['next_started_at']],
        ['Negative adjacent wall-clock intervals', timeline['negativeAdjacentIntervals']]]
    resume_zh = (f'最新一次收集器运行的清理回执记录复用了{timeline["resumedConfigurationCount"]}个已完成配置；本批包含检查点续跑。'
                 if timeline['resumedConfigurationCount'] else '最新一次收集器运行的清理回执未记录复用已完成配置。')
    resume_en = (f'The latest collector cleanup receipt records reuse of {timeline["resumedConfigurationCount"]} complete configurations; this collection includes checkpoint continuation. '
                 if timeline['resumedConfigurationCount'] else 'The latest collector cleanup receipt records no reused complete configurations. ')
    power_rows = []
    for method in METHODS:
        group = [r for r in rows if r['method'] == method]
        batteries = [r['battery_min_percent'] for r in group if r['battery_min_percent'] is not None] + [r['battery_max_percent'] for r in group if r['battery_max_percent'] is not None]
        power_rows.append([labels[method], sum(r['telemetry_samples'] for r in group), 'AC Power', f'{min(batteries)}–{max(batteries)}%' if batteries else 'No battery / N/A', sum((r['swapouts_counter_delta'] or 0)>0 for r in group)])
    variation_rows = [[r['scene'],r['stride'],labels[r['method']],fmt(r['round_cv_percent'],2),fmt(100*r['e2e_completion_round_mean_sd_ms']/r['e2e_completion_mean_ms'],2)] for r in sorted(rows,key=lambda r:r['round_cv_percent'],reverse=True)[:10]]
    raf_headers = ['Scene', 'Method', 'Frames', 'Callback Hz (not display FPS)', 'Interval P50 ms', 'Interval P95 ms']
    raf_rows = [[r['scene'],labels[r['method']],r['frames'],fmt(r['callback_throughput_hz']),fmt(r['interval_p50_ms']),fmt(r['interval_p95_ms'])] for r in report['nativeRaf']]
    stages_over_wall = sum(r['diagnostics'].get('stage_sum_exceeds_sync_wall_samples', 0) for r in rows)
    timing_domain_rows = []
    for method in METHODS:
        group = [r for r in rows if r['method'] == method]
        count = sum(r['samples'] for r in group)
        exceeded = sum(r['stage_exceeds_e2e_samples'] for r in group)
        timing_domain_rows.append([labels[method], count, exceeded, fmt(100 * exceeded / count, 2),
                                  fmt(max(r['max_stage_to_e2e_ratio'] for r in group)),
                                  sum(r['diagnostics'].get('stage_sum_exceeds_sync_wall_samples', 0) for r in group)])
    plots(out, report, labels)
    quality_protocol = report['quality']
    caveat_zh = ('端到端区间为浏览器performance.now在await bench.sample(camera)之前到Promise返回之后：包括当前相机更新、新排序、GPU完成等待、timer-query轮询/读回和计量断言。它是带计量开销的完成耗时，不是输入到光子或屏幕呈现延迟。FPS按所有完成帧数×1000除以5轮完整浏览器loop窗口总毫秒计算，含loop记账；排除加载、预热、截图、Node RPC/序列化和轮间预热。P50/P95对全部逐帧样本做Type7线性插值，不是轮均值分位数；分布混合选定视角复杂度与运行波动，不等于固定镜头抖动。')
    caveat_en = ('End-to-end completion is the browser performance.now interval around await bench.sample(camera), including the current-camera update, fresh sort, GPU-completion waits, timer-query polling/readback and measurement assertions. This is instrumented completion latency, not input-to-photon or display latency. Completed FPS is 1000 times all completed frames divided by the sum of five complete browser-loop windows, including bookkeeping and excluding loading, warmups, captures and Node RPC/serialization. P50/P95 use Type-7 interpolation over individual samples, not round means; they mix selected-view complexity with runtime variation.')
    timer_domains_zh = (f'本批正式数据中有{qa["stageExceedsE2ESamples"]}个样本的阶段成本大于同次E2E，按方法的实际计数在“计时域诊断”列出。'
                        'GPU阶段值保留原始API查询区间累计值；尤其SuperSplat相邻draw/blit查询尚不能当作互斥独占GPU执行成本。加上CPU Worker计时后的阶段和是分项成本诊断，不能解释成物理可加和的串行elapsed time。'
                        '所有API原始值不夹断、不剔除、不替换；主速度结论只来自实测E2E P50/P95与浏览器完整采样loop窗口的completed-frame FPS，绝不取阶段和的倒数。')
    timer_domains_en = (f'In this formal batch, selected stage costs exceed the same-sample E2E interval in {qa["stageExceedsE2ESamples"]} samples; actual per-method counts appear in the timer-domain diagnostics. '
                        'GPU stage values retain the raw API query interval sums. In particular, adjacent SuperSplat draw/blit queries have not been validated as mutually exclusive GPU execution costs. Adding CPU Worker timing produces a component-cost diagnostic, not physically additive serial elapsed time. '
                        'API values are never clamped, dropped or replaced. Primary speed conclusions use measured E2E P50/P95 and completed-frame FPS from complete browser sampling-loop windows, never inverse stage sums.')
    timer_review = report.get('timerDomainReview')
    isolated_rows = []
    if timer_review:
        for case in timer_review['diagnostic']['cases']:
            values = case['meanMs']
            isolated_rows.append([case['scene'],case['stride'],case['mode'],case['samples'],
                                  fmt(values['gpuDrawMs']), '— (single span)' if case['mode']=='single-span' else fmt(values['gpuBlitMs']),
                                  fmt(values['gpuTotalMs'])])
        isolated_zh = ('另行隔离的60样本诊断显示，在本次ANGLE/Metal环境中，相邻查询对前序draw是否完成敏感：先等待draw完成再开始blit查询时，blit的API区间大幅下降，而原生blit操作未变。'
                       '这支持查询区间并非独立blit执行成本。上游ANGLE的NoWait与command-buffer GPUStart/End累计机制仅提供可能解释；未匹配已安装Chrome内建ANGLE的精确revision，不宣称已确定内部根因，也不归因为普通clock-origin不一致。'
                       '以下每条件仅10样本、固定模式顺序、独立浏览器会话并附加GL诊断；串行等待改变了协议，不作为生产修正，其速度不与正式baseline比较。单span模式没有单独blit计时，表中不记为0。')
        isolated_en = ('A separate 60-sample diagnostic shows predecessor-completion sensitivity on this ANGLE/Metal setup: waiting for draw completion before beginning the blit query sharply reduces its API interval while leaving the native blit operation unchanged. '
                       'This supports that the query is not an independent blit execution cost. Upstream ANGLE NoWait boundaries and command-buffer GPUStart/End accumulation provide a possible mechanism only; the exact ANGLE revision in installed Chrome was not matched. No exact internal cause or generic clock-origin mismatch is claimed. '
                       'Each condition has only ten samples, fixed mode order, a separate browser and extra GL checks. Serial waits change the protocol and are neither a production correction nor a baseline speed comparison. Single-span mode has no separate blit measurement, so the table does not represent it as zero.')
    scale_zh = '156=13场景×4个stride×3方法；780轮、68,040计时样本、234正式PNG、4,536质量视图。stride按原始PLY第0、stride、2×stride…行确定性取点，不是LoD。每配置一个浏览器/模型会话内5轮、每轮3个完整视角cycle；初始预热同时至少10秒和128样本，轮间至少1.5秒和32样本。五轮不是五个独立浏览器进程。'
    scale_en = '156 configurations = 13 scenes × four fixed strides × three methods; 780 rounds, 68,040 timing samples, 234 formal PNGs and 4,536 quality views. Strides select original PLY rows 0, stride, 2×stride… and are not LoD. Each configuration has five rounds in one browser/model session, each with three traversals of every heldout view. Initial warmup requires both 10 seconds and 128 samples; inter-round warmup requires 1.5 seconds and 32 samples. The five rounds are not five independent processes.'
    versions_zh = f'Spark.js固定0.1.10官方算法，实际选用原生{bits}位排序键；加入计时/诊断插桩，并在适配器中释放原生同步prepare未释放的临时accumulator引用，保持active/display两份引用。算法、shader及WASM未改，不宣称bundle字节完全未改。没有改造FP16算法版本，也没有混入2.1.0结果。Visionary为1.0.1；SuperSplat Editor为2.1.0/PlayCanvas2.5.1。排序键位宽不是整套高斯属性精度；Visionary仍保留官方loader的FP16属性编码。'
    versions_en = f'Spark.js is pinned to official version 0.1.10 algorithms using its native {bits}-bit sorting-key path. Instrumentation adds timing/diagnostics; the adapter releases the temporary accumulator reference left by native synchronous prepare while retaining its active/display references. Algorithms, shaders and WASM remain unchanged; the instrumented bundle is not claimed to be byte-identical to upstream. No modified FP16 algorithm variant or Spark 2.1.0 measurement enters this run. Visionary 1.0.1 and SuperSplat Editor 2.1.0/PlayCanvas 2.5.1 remain pinned. Sorting-key width is not whole-model attribute precision; Visionary retains the official loader\'s FP16 attribute encoding.'
    spark_parameters = report['renderParameters']['spark']
    settings_zh = ('Spark的“默认”仅指原生16位排序键路径与上游运行时默认一致，不表示所有选项均为默认。'
                   f'本次metadata记录sortRadial={str(spark_parameters["sortRadial"]).lower()}、preBlurAmount={spark_parameters["preBlurAmount"]}、blurAmount={spark_parameters["blurAmount"]}；'
                   '它们是既定基准的显式参数，上游对应默认值为true、0、0.3。')
    settings_en = ('“Default Spark” refers only to the native 16-bit key path matching the upstream runtime default; it does not mean all options use upstream defaults. '
                   f'The recorded benchmark explicitly uses sortRadial={str(spark_parameters["sortRadial"]).lower()}, preBlurAmount={spark_parameters["preBlurAmount"]} and blurAmount={spark_parameters["blurAmount"]}; '
                   'the corresponding upstream defaults are true, 0 and 0.3.')
    projection = report['projectionIntrinsics']
    ratio_min = min(r['effective_fx_over_fy_min'] for r in projection)
    ratio_max = max(r['effective_fx_over_fy_max'] for r in projection)
    projection_rows = [[r['scene'],r['views'],fmt(r['effective_fx_px']),fmt(r['effective_fy_px']),
                        f'{r["effective_fx_over_fy_min"]:.6f}–{r["effective_fx_over_fy_max"]:.6f}'] for r in projection]
    projection_zh = ('相机中心和GT图像采用独立x/y缩放：有效fx=fx×1280/原width，有效fy=fy×720/原height。'
                     f'全部378个冻结相机的有效fx/fy为{ratio_min:.6f}–{ratio_max:.6f}；本组每场景内参相同。'
                     'SuperSplat保留PlayCanvas原生单focal协方差Jacobian，x/y两轴均用横向focal；其高斯footprint不能保证与独立fx/fy投影的其他方法一致，可能影响质量和绘制负担。'
                     '该比值不是完整高斯椭圆高度的等比例变化：协方差、旋转、blur和半径上限同样起作用。相同PLY与相机不表示相同内部精度、可见集合或栅格化负担。')
    projection_en = ('Camera centers and GT images use independent x/y scaling: effective fx=fx×1280/original width and effective fy=fy×720/original height. '
                     f'Across all 378 frozen cameras the effective fx/fy ratio is {ratio_min:.6f}–{ratio_max:.6f}; intrinsics are constant within each scene in this set. '
                     'SuperSplat retains the native PlayCanvas single-focal covariance Jacobian, using the horizontal focal value for both axes. Its Gaussian footprints are therefore not guaranteed to match the other independent-fx/fy projections, which can affect quality and draw workload. '
                     'The ratio does not predict a proportional change in the complete ellipse height: covariance, rotation, blur and radius caps also matter. Identical PLY files and camera centers do not imply identical internal precision, visible sets or rasterization workload.')
    aggregation_zh = '每配置mean±SD中的SD来自5个轮均值。所有跨场景汇总按13场景等权：先各场景算FPS，再求均值；不能把跨场景平均耗时取倒数。汇总P50/P95是各场景分位数的算术平均，不是合并全部场景后的总体分位数。逐配置和逐帧完整数值在CSV中。'
    aggregation_en = 'SD describes the five within-session round means. Cross-scene aggregates give equal weight to thirteen scenes: compute FPS per scene first, then average; do not invert the across-scene mean latency. Aggregate P50/P95 columns average the scene-specific quantiles; they are not pooled quantiles. Configuration and individual-sample CSVs preserve the full precision.'
    quality_zh = '真实heldout照片为参考。PSNR在本机CPU以float64 RGB8 MSE逐图取dB后平均；SSIM为11×11 Gaussian、sigma1.5、零填充5、RGB平均；LPIPS为官方v0.1 VGG ImageNet与学习校准。SSIM/LPIPS实际设备见质量协议，MPS只在性能采集结束后使用。照片按冻结投影独立缩放到1280×720，无裁剪/补边/曝光调整；T&T truck/train原图979×546/980×545需上采样，共70视图。因此不宣称复现论文native-resolution分数。三方法编码、剔除、可见集合、footprint与排序不同，质量差异不能仅归因于键位宽。'
    quality_en = 'The reference is the actual heldout photograph. PSNR uses local CPU float64 RGB8 MSE, averaged after converting each view to dB. SSIM uses an11×11 Gaussian window, sigma1.5, five-pixel zero padding and RGB averaging. LPIPS uses official v0.1 VGG/ImageNet features and learned calibration. The quality protocol records the actual SSIM/LPIPS device; MPS evaluation runs only after performance collection. Photos are independently resized to1280×720 without crop, padding or exposure adjustment; truck/train source images are979×546/980×545, so70 views are upsampled. These are not native-resolution paper scores. Encoding, culling, visible sets and raster footprints differ across renderers; quality differences cannot be attributed only to key width.'
    diagnostics_zh = f'未删除任何有效样本。同次stage成本超过E2E样本数：{qa["stageExceedsE2ESamples"]}；stage和大于旧式同步wall样本数：{stages_over_wall}。后者作为跨计时域/后端边界诊断保留，不能将gl.finish返回时间冒充GPU完成或用阶段和倒数冒充FPS。原生rAF只在stride1每配置360callback采集；可沿用旧排序，不保证实际呈现或当前视角新排序，callbackHz独立列示。'
    diagnostics_en = f'No valid samples are removed. Same-sample stage cost exceeds the E2E interval in {qa["stageExceedsE2ESamples"]} samples; stage sums exceed the legacy synchronous wall in {stages_over_wall}. The latter remains a cross-clock/backend diagnostic; gl.finish return time is not substituted for verified completion. Native rAF records 360 callbacks per full-model configuration and may reuse an earlier sort. Callback Hz is distinct from fresh-sort completion throughput and physical presentation FPS.'
    power_zh = '所有已观测供电必须为AC，5秒采样不能排除未捕获的短暂变化。无锁频或温度恒定假设。swapout计数跨度覆盖完整会话，包括加载、预热和截图，不能归因到计时区间；所有记录保留。方法顺序按scene/stride轮换降低单向时间漂移，但各方法仍是不同会话。'
    power_en = 'All observed power states must be AC; five-second polling cannot exclude unsampled brief transitions. No frequency lock or fixed temperature is assumed. Swapout changes cover complete sessions including load, warmup and captures, and cannot be assigned specifically to measured intervals. Method order rotates across scene/stride to reduce one-directional drift, but methods remain separate sessions.'
    power_zh += '质量与速度差异不能仅归因于排序键位宽；跨Mac比较还同时涉及CPU、内存、OS、浏览器和热状态，不能解释为只隔离GPU芯片效应。'
    power_en += ' Quality and speed differences cannot be attributed solely to sorting-key width. Cross-Mac comparisons also include CPU, memory, OS, browser and thermal state; they do not isolate GPU-chip effects.'
    links = [('Protocol','../protocol.json'),('Full raw-linked JSON','report.json'),('Configurations CSV','configurations.csv'),
             ('Hardware inventory','../environment/host-inventory.json'),('Pilot and CPU/GPU prerequisites','../validation/prerequisites.json'),
             ('All round means','round-means.csv'),('Individual E2E samples','e2e-samples.csv'),('Scene aggregates','aggregates.csv'),
             ('Configuration collection timeline','collection-timeline.csv'),('Collector cleanup and checkpoint reuse','../runtime-cleanup.json'),
             ('Effective projection intrinsics','projection-intrinsics.csv'),
             ('Quality protocol','../quality/metrics/metrics-protocol.json'),('Quality summary','../quality/metrics/quality-summary.json'),
             ('CPU numerical validation','../validation/quality-numerical-validation.json'),
             ('Independent formal performance audit','../validation/independent-formal-qa.json'),
             ('Independent actual-image quality audit','../validation/independent-quality-qa.json'),
             ('QA','analysis-qa.json'),('SHA receipt','build-receipt.json'),('Capture gallery','captures.html'),('LaTeX','full-model-table.tex')]
    copied_evidence = []
    if timer_review:
        for evidence in timer_review['evidenceFiles']:
            source = Path(evidence['sourcePath']); destination = out / evidence['reportPath']
            destination.parent.mkdir(parents=True, exist_ok=True)
            source_sha = sha(source); shutil.copyfile(source, destination); output_sha = sha(destination)
            require(source_sha == output_sha, 'Timer diagnostic evidence copy differs')
            copied_evidence.append({'sourcePath':str(source),'sourceSha256':source_sha,
                                    'outputPath':evidence['reportPath'],'outputSha256':output_sha})
            links.append((evidence['label'], evidence['reportPath']))
    portable_links = []
    for label, target in links:
        if target.startswith('../'):
            source = (out / target).resolve()
            destination = out / 'evidence' / target[3:]
            destination.parent.mkdir(parents=True, exist_ok=True)
            source_sha = sha(source)
            shutil.copyfile(source, destination)
            output_sha = sha(destination)
            require(output_sha == source_sha, 'Evidence copy differs from its source')
            target = destination.relative_to(out).as_posix()
            copied_evidence.append({'sourcePath': str(source), 'sourceSha256': source_sha,
                                    'outputPath': target, 'outputSha256': output_sha})
        portable_links.append((label, target))
    links = portable_links
    write_json(out / 'evidence-copy-receipt.json', {'complete': True, 'records': copied_evidence,
                                                  'policy': 'Exact bytes copied for standalone report links'})
    sections = []
    def section(key, zh, en, paragraphs_zh=(), paragraphs_en=(), headers=None, data=None, figures=()):
        sections.append(dict(key=key,zh=zh,en=en,pzh=list(paragraphs_zh),pen=list(paragraphs_en),headers=headers,rows=data,figures=list(figures)))
    section('scope','范围与版本','Scope and versions',[scale_zh,versions_zh,settings_zh],[scale_en,versions_en,settings_en])
    section('environment','实际设备与渲染环境','Actual device and render environment',headers=['Field','Value'],data=environment_rows)
    section('collection-timeline','采集时间与检查点续跑','Collection intervals and checkpoint continuation',
            [resume_zh + f'下表使用已绑定raw的配置会话起止时间与收集器回执，不把整个墙钟跨度当作计时窗口。最大相邻间隔从前一配置completedAt到下一配置startedAt计算；完整{timeline["adjacentIntervals"]}个相邻间隔及两端raw哈希见CSV。间隔可能包含暂停、启动/清理和其他非测量工作，时间戳本身不证明其具体原因。各方法为分立会话，本批不是持续热稳态测试，不能假设间隔两端温度或频率相同。所有速度和质量统计保持原定义，不按这些间隔修正。'],
            [resume_en + f'The table uses bound raw configuration-session timestamps and the collector receipt; total wall-clock span is not a measured-loop window. The maximum adjacent interval runs from one configuration completedAt to the next startedAt; the CSV preserves all {timeline["adjacentIntervals"]} intervals and both raw hashes. Gaps may include pauses, startup/cleanup and other unmeasured work; timestamps alone do not establish their cause. Methods use separate sessions and this is not a continuous thermal steady-state test; equal temperature or frequency across a gap is not assumed. Timing and quality definitions are unchanged and receive no gap correction.'],
            ['Recorded fact', 'Value'], timeline_rows)
    section('e2e','主速度表：完整模型端到端P50/P95与完成FPS','Main speed table: full-model E2E percentiles and completed FPS',[caveat_zh,aggregation_zh,timer_domains_zh],[caveat_en,aggregation_en,timer_domains_en],main_headers,main_rows,['full-model-completed-fps.png','full-model-e2e-percentiles.png'])
    section('scales','四规模与场景等权汇总','Four scales and equal-scene aggregates',[aggregation_zh],[aggregation_en],aggregate_headers,aggregate_rows,['four-scale-throughput.png'])
    section('configurations','全部156配置明细','All 156 measured configurations',
            ['每行对应一个场景、stride和方法；覆盖全部13×4×3配置。表内可上下及左右滚动，CSV保留完整精度。数值直接取自已验证的逐配置结果，不重新计算统计。E2E与阶段成本的SD均为5个轮均值的样本标准差；阶段和不是端到端时间。全部配置使用上方环境表所列1280×720、DPR 1、浏览器及OS。'],
            ['Each row is one scene/stride/method, covering all 13×4×3 configurations. Scroll within the table vertically and horizontally; the CSV retains full precision. Values come directly from validated configuration records without recomputing statistics. SD is the sample standard deviation of five round means for E2E and stages; stage sums are not end-to-end time. Every configuration uses the 1280×720 framebuffer, DPR 1, browser and OS listed above.'],
            configuration_headers, configuration_rows)
    section('stage','不同计时边界的阶段成本','Method-specific selected stages',
            ['阶段成本不是统一端到端时间。'+ ' '.join(BOUNDARIES[m] for m in METHODS)],
            ['Selected stages are not unified end-to-end times. '+ ' '.join(BOUNDARIES[m] for m in METHODS)],stage_headers,stage_rows,['full-model-stage-cost.png'])
    section('components','CPU/GPU分项','CPU/GPU components',
            ['13完整场景等权均值，单位ms；缺项不代表0。Spark独立depth-key GPU pass不是GPU排序；其排序在原生CPU WASM。SuperSplat GPU prep融合在draw。'],
            ['Equal-scene full-model means in ms. Missing/fused is not zero. Spark\'s GPU depth-key pass is not GPU sorting; sorting remains native CPU WASM. SuperSplat GPU prep is fused into draw.'],component_headers,component_rows)
    section('quality','真实照片质量PSNR/SSIM/LPIPS','Ground-truth PSNR/SSIM/LPIPS',[quality_zh],[quality_en],quality_headers,quality_rows,['full-model-quality.png'])
    section('projection','原生投影与高斯footprint限制','Native projection and Gaussian-footprint limitations',
            [projection_zh],[projection_en],['Scene','Views','Effective fx px','Effective fy px','Effective fx/fy range'],projection_rows)
    section('variation','波动与计时诊断','Variation and timing diagnostics',[diagnostics_zh],[diagnostics_en],['Scene','stride','Method','Stage round CV %','E2E round CV %'],variation_rows)
    section('timer-domains','计时域诊断：阶段和与E2E分开','Timer-domain diagnostics: stage sums versus E2E',
            [timer_domains_zh],[timer_domains_en],['Method','Actual samples','Stage > E2E','Percentage %','Max stage / E2E','Stage > legacy wall'],timing_domain_rows)
    if timer_review:
        section('isolated-timer','独立诊断：相邻API查询对前序完成敏感','Separate diagnostic: predecessor sensitivity of adjacent API queries',
                [isolated_zh],[isolated_en],['Scene','stride','Separate diagnostic mode','Samples','Draw query / single span ms','Blit query ms','API GPU sum / span ms'],isolated_rows)
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
    css += 'main,section,.table-scroll{min-width:0}section,.table-scroll{max-width:100%}#configurations .table-scroll{max-height:760px;overflow:auto}#configurations table{min-width:1700px}#configurations th{position:sticky;top:0;z-index:1}#configurations td:nth-child(n+4){white-space:nowrap}'
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
    gallery_records=[]
    (out/'gallery').mkdir(exist_ok=True)
    for scene in SCENES:
        cards=[]
        reference=gt_lookup[scene,0]
        entries=[('Ground truth','ground-truth',Path(report['groundTruthRoot'])/reference['relative_path'],reference['sha256'])]
        for method in METHODS:
            capture=next(r for r in captures if r['scene']==scene and r['stride']==1 and r['method']==method and r['camera_index']==0)
            entries.append((labels[method],method,Path(capture['path']),capture['sha256']))
        for label,method,path,expected_sha in entries:
            destination=out/'gallery'/f'{scene}-{method}-v000.png'
            shutil.copyfile(path,destination)
            output_sha=sha(destination)
            require(output_sha==expected_sha,'Gallery copy differs from validated source capture/GT')
            relative=destination.relative_to(out).as_posix()
            gallery_records.append({'scene':scene,'method':method,'stride':1 if method!='ground-truth' else None,
                                    'cameraIndex':0,'sourcePath':str(path),'sourceSha256':expected_sha,
                                    'outputPath':relative,'outputSha256':output_sha,'bytes':destination.stat().st_size})
            cards.append('<figure><a href="'+html.escape(relative)+'"><img loading="lazy" src="'+html.escape(relative)+'" alt="'+html.escape(scene+' '+label)+'"></a><figcaption>'+html.escape(label)+'</figcaption></figure>')
        gallery.append('<section><h2>'+scene+' / full model / camera0</h2><div class="gallery">'+''.join(cards)+'</div></section>')
    (out/'captures.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GT + three renderer capture gallery</title><style>'+css+'</style><main><h1>GT与三方法同相机截图</h1><p>Actual saved images; visual inspection is not a proof of equivalent quality.</p>'+''.join(gallery)+'</main>',encoding='utf-8')
    write_json(out/'gallery-receipt.json',{'complete':True,'images':len(gallery_records),'groundTruthImages':13,
                                         'rendererImages':39,'records':gallery_records,
                                         'policy':'Exact original PNG bytes; no resizing or re-encoding'})
    latex=['% Newly measured local Mac run; P50/P95 ms and serialized completed FPS.', '\\begin{tabular}{lrrr}', '\\hline',
           'Scene & Visionary & Spark.js 0.1.10 & SuperSplat \\\\', '\\hline']
    for scene in SCENES:
        values=['{:.3f}/{:.3f}/{:.3f}'.format(lookup[scene,1,m]['e2e_completion_p50_ms'],lookup[scene,1,m]['e2e_completion_p95_ms'],lookup[scene,1,m]['completed_frames_per_second']) for m in METHODS]
        latex.append(scene+' & '+' & '.join(values)+' \\\\')
    latex += ['\\hline','\\end{tabular}']
    (out/'full-model-table.tex').write_text('\n'.join(latex)+'\n')
    full=[r for r in report['aggregates'] if r['stride']==1]
    rebuttal='We remeasured Visionary1.0.1, official native Spark.js0.1.10 and SuperSplat Editor2.1.0 on the recorded local Mac, using156 configurations across13 scenes and4 deterministic input strides. At1280×720 with SH3 and LoD disabled, each configuration has five within-session rounds and three heldout-camera traversals per round, totaling68,040 timing samples. Equal-scene full-model serialized completion throughput is '+', '.join(labels[r['method']]+' '+fmt(r['completed_frames_per_second'])+' FPS' for r in full)+'. These rates include verified GPU completion and measurement readback; they are neither physical display FPS nor inverses of selected-stage costs. We additionally evaluate4,536 rendered views against real heldout photographs with PSNR, SSIM and LPIPS. Native encoding, culling and rasterization differences are retained, so timing differences do not establish equivalent image quality. Full hardware, browser, power, source hashes, per-sample timing and image lineage are preserved.'
    rebuttal += ' Spark uses its native runtime-default 16-bit key path with explicit benchmark radial-sort and blur parameters, not an all-default configuration. SuperSplat retains its native single-focal covariance projection; shared camera centers do not guarantee identical Gaussian footprints. Neither quality nor speed differences isolate sort-key width or GPU-chip effects.'
    (out/'rebuttal-en.md').write_text(rebuttal+'\n')
