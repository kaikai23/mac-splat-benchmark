"""Recompute every stage from actual samples, preserving native query boundaries."""
from __future__ import annotations
import math
import statistics
from collections import Counter, defaultdict
from common import STAGES, equal, number, require, timestamp

def validate_pose(sample, camera, supersplat=False):
    origin, direction = sample.get('sortedViewOrigin'), sample.get('sortedViewDirection')
    require(isinstance(origin, list) and len(origin) == 3 and isinstance(direction, list) and len(direction) == 3,
            'Fresh-sort camera pose is missing')
    expected = camera['position'] + [(-1 if supersplat else 1) * camera['rotation'][i][2] for i in range(3)]
    for a, b in zip(origin + direction, expected):
        tolerance = max(1e-5, abs(b) * 2e-7) if supersplat else 1e-6
        require(isinstance(a, (int, float)) and math.isfinite(a) and abs(a - b) <= tolerance,
                'Fresh-sort source pose differs from the selected camera')

def normalize(sample, method, model_count):
    result = dict.fromkeys(STAGES)
    if method == 'visionary':
        gpu = sample['gpu']
        prep, sort, draw, total = [number(gpu, k) for k in ('prepMs', 'sortMs', 'drawMs', 'totalMs')]
        require(total > 0 and total + 1e-6 >= prep + sort + draw, 'Visionary span cannot exclude its component stages')
        require(gpu.get('timestampWriteCount') == 6 and sample.get('timingMode') == 'stages', 'Visionary timestamp contract differs')
        stages = gpu.get('stageTimings', [])
        require([r['stage'] for r in stages] == ['prep', 'sort', 'draw'], 'Visionary three stage queries are missing')
        for row, v in zip(stages, (prep, sort, draw)):
            equal(number(row, 'ms'), v, 'Visionary stage timestamp')
        require(sample['gaussianCount'] == model_count and 0 <= sample['visibleSplats'] <= model_count,
                'Visionary count contract differs')
        result.update(stage_cost_ms=total, gpu_prep_ms=prep, gpu_sort_ms=sort, gpu_draw_ms=draw,
                      gpu_total_ms=total, visionary_stage_sum_ms=prep + sort + draw,
                      sync_wall_ms=number(sample, 'wallMs', True))
        return result
    draw, gpu = number(sample, 'gpuDrawMs'), number(sample, 'gpuTotalMs')
    stage = number(sample, 'stageCostSumMs', True)
    sort = number(sample, 'cpuSortMs')
    if method == 'supersplat':
        prep, post, blit = (number(sample, k) for k in ('cpuPrepMs', 'cpuPostprocessMs', 'gpuBlitMs'))
        cpu = number(sample, 'cpuWorkerComputeMs')
        equal(cpu, prep + sort + post, 'SuperSplat worker compute')
        equal(number(sample, 'cpuWorkerSpanMs'), cpu, 'SuperSplat contiguous worker stages')
        equal(gpu, draw + blit, 'SuperSplat GPU total')
        equal(stage, cpu + gpu, 'SuperSplat stage sum')
        require(sample.get('gpuPrepMs') is None and sample.get('gpuPrepMode') == 'fused-into-draw',
                'SuperSplat GPU prep is fused into draw, not zero')
        require(sample.get('gpuSortMetricMs') == sample.get('gpuSortMs') == 0 and sample.get('gpuSortMetricMode') == 'CPU',
                'SuperSplat native CPU sort contract differs')
        require(sample['sortedSplats'] == model_count and 0 <= sample['activeSplats'] <= model_count and sample['visible'] == sample['activeSplats'],
                'SuperSplat full-sort/front-count contract differs')
        bits = max(10, min(20, math.floor(math.log2(model_count / 4) + .5)))
        require(sample['compareBits'] == bits and sample['bucketCount'] == (1 << bits) + 1, 'SuperSplat adaptive bucket width differs')
        wall, query = number(sample, 'wallMs', True), number(sample, 'queryReadyWallMs', True)
        equal(number(sample, 'viewCompleteWallMs', True), wall, 'SuperSplat wall alias')
        require(query + 1e-6 >= wall, 'Query-ready wall precedes synchronous-call wall')
        result.update(cpu_key_generation_histogram_ms=prep, cpu_postprocess_ms=post, gpu_blit_ms=blit,
                      sync_wall_ms=wall, query_ready_wall_ms=query)
    else:
        prep = number(sample, 'gpuPrepMs')
        depth_metric = number(sample, 'gpuSortMetricMs')
        equal(gpu, prep + depth_metric + draw, 'Spark GPU prep + depth-key metric + draw total')
        result['gpu_depth_metric_ms'] = depth_metric
        packing = 0
        require('cpuKeyPackingMs' not in sample and 'cpuPackingAndSortMs' not in sample, 'Native Spark unexpectedly uses custom compaction')
        require(sample.get('gpuQueryCounts') == {'prep': 1, 'metric': 1, 'draw': 1}, 'Native Spark GPU query coverage differs')
        require(sample.get('prepareLifecycleCompensated') is True and sample.get('prepareAccumulatorRefCount') == 2
                and isinstance(sample.get('accumulatorCount'), int) and 2 <= sample['accumulatorCount'] <= 5,
                'Native Spark synchronous prepare resource lifecycle differs')
        equal(stage, gpu + sort + packing, 'Spark primary stage cost')
        require(sample['numSplats'] == model_count and 0 <= sample['sortedSplats'] <= model_count, 'Spark count contract differs')
        result.update(gpu_prep_ms=prep, sync_wall_ms=number(sample, 'viewCompleteWallMs', True))
    result.update(stage_cost_ms=stage, cpu_sort_ms=sort, gpu_draw_ms=draw, gpu_total_ms=gpu)
    return result

def quantile(values, p):
    values = sorted(values)
    x = (len(values) - 1) * p
    a, b = math.floor(x), math.ceil(x)
    return values[a] + (values[b] - values[a]) * (x - a)

def summarize(raw, method):
    cameras, rounds = raw['cameras'], raw['rounds']
    require(len(rounds) == 5 and [r['repeat'] for r in rounds] == list(range(5)), 'Exactly five chronological rounds required')
    require(raw['warmup']['elapsedMs'] >= 10000 and raw['warmup']['samples'] >= 128, 'Initial warmup insufficient')
    repeats, all_samples, warnings = [], [], Counter()
    previous_end, previous_sequence, previous_request = timestamp(raw['startedAt']), None, None
    for rd in rounds:
        start, end = timestamp(rd['startedAt']), timestamp(rd['completedAt'])
        require(previous_end <= start <= end <= timestamp(raw['completedAt']), 'Round chronology overlaps/exceeds session')
        previous_end = end
        if rd['repeat']:
            require(rd['warmup']['elapsedMs'] >= 1500 and rd['warmup']['samples'] >= 32, 'Between-round warmup insufficient')
        require(len(rd['samples']) == len(cameras) * 3, 'Each round must traverse every camera three times')
        rows, seen = [], Counter()
        for ordinal, sample in enumerate(rd['samples']):
            cycle, order = divmod(ordinal, len(cameras))
            index = (order + rd['repeat'] * 7 + cycle * 11) % len(cameras)
            require(sample.get('repeat', rd['repeat']) == rd['repeat'] and sample['cycle'] == cycle
                    and sample['order'] == order and sample['cameraIndex'] == index, 'Camera traversal order differs')
            camera = cameras[index]
            require(sample['cameraId'] == camera['id'] and sample['img_name'] == camera['img_name'], 'Camera identity differs')
            if method != 'visionary':
                validate_pose(sample, camera, method == 'supersplat')
                sequence = sample['sortSequence']
                require(isinstance(sequence, int) and sequence > 0 and (previous_sequence is None or sequence > previous_sequence),
                        'A new sort must complete for the current camera')
                previous_sequence = sequence
                if method == 'supersplat':
                    request = sample['requestId']
                    skipped = rd['warmup']['samples'] if ordinal == 0 and rd['repeat'] else 0
                    require(isinstance(request, int) and request > 0 and
                            (previous_request is None or request == previous_request + skipped + 1), 'SuperSplat fresh Worker request sequence differs')
                    previous_request = request
            value = normalize(sample, method, raw['model']['gaussian_count'])
            if value['stage_cost_ms'] > value['sync_wall_ms'] + 1e-6:
                warnings['stage_sum_exceeds_sync_wall_samples'] += 1
            if value['query_ready_wall_ms'] is not None and value['stage_cost_ms'] > value['query_ready_wall_ms'] + 1e-6:
                warnings['stage_sum_exceeds_query_ready_wall_samples'] += 1
            value.update(repeat=rd['repeat'], cycle=cycle, camera_index=index)
            rows.append(value)
            seen[cycle, index] += 1
        require(seen == Counter((c, i) for c in range(3) for i in range(len(cameras))), 'Missing or duplicate camera observations')
        means = {'repeat': rd['repeat']}
        for field in ('stage_cost_ms', *STAGES):
            by_view = defaultdict(list)
            for row in rows:
                if row[field] is not None:
                    by_view[row['camera_index']].append(row[field])
            means[field] = statistics.fmean(statistics.fmean(v) for v in by_view.values()) if by_view else None
        repeats.append(means)
        all_samples.extend(rows)
    result = {'views': len(cameras), 'repeats': 5, 'samples': len(all_samples)}
    for field in ('stage_cost_ms', *STAGES):
        means = [r[field] for r in repeats if r[field] is not None]
        samples = [r[field] for r in all_samples if r[field] is not None]
        if field == 'stage_cost_ms':
            result.update(stage_cost_ms_mean=statistics.fmean(means), stage_cost_ms_sd=statistics.stdev(means),
                          stage_cost_ms_p50=quantile(samples, .5), stage_cost_ms_p95=quantile(samples, .95))
        else:
            result[field] = statistics.fmean(means) if means else None
    return result, repeats, dict(warnings)
