"""Recompute the separate instrumented GPU-completion protocol.

Never obtains completion duration from a stage sum, GPU query span, native
gl.finish wall, or rAF interval. The runner must record a distinct browser-clock
interval around await bench.sample(camera), plus the complete per-round loop.
"""
from __future__ import annotations

import math
import statistics

from common import require
from metrics import quantile


def close(actual, expected, label):
    require(isinstance(actual, (int, float)) and math.isfinite(actual)
            and math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-5), label)


def summarize_completion(raw: dict) -> tuple[dict, list[dict]]:
    rounds = raw['rounds']
    require(len(rounds) == 5 and [r['repeat'] for r in rounds] == list(range(5)),
            'Completion protocol requires five chronological rounds')
    expected_samples_per_round = 3 * len(raw['cameras'])
    all_values = []
    output_rounds = []
    previous_window_end = None
    for round_record in rounds:
        samples = round_record['samples']
        require(len(samples) == expected_samples_per_round,
                'Completion round must have three samples per camera')
        values = [s['e2eCompletionMs'] for s in samples]
        require(all(isinstance(value, (int, float)) and math.isfinite(value) and value > 0
                    for value in values), 'Missing/invalid distinct completion sample duration')
        elapsed = round_record['windowElapsedMs']
        window_start, window_end = round_record['windowStartMs'], round_record['windowEndMs']
        require(all(isinstance(v, (int, float)) and math.isfinite(v) for v in (window_start, window_end)),
                'Missing/invalid browser window clock boundaries')
        close(elapsed, window_end - window_start, 'Browser window clock subtraction differs')
        require(previous_window_end is None or window_start >= previous_window_end,
                'Completion round windows overlap')
        previous_end = window_start
        for sample, duration in zip(samples, values):
            start, end = sample['e2eStartMs'], sample['e2eEndMs']
            require(all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, end))
                    and previous_end <= start < end <= window_end,
                    'Sequential completion interval extends outside round or overlaps')
            close(duration, end - start, 'Completion browser-clock subtraction differs')
            previous_end = end
        previous_window_end = window_end
        require(isinstance(elapsed, (int, float)) and math.isfinite(elapsed)
                and elapsed + 1e-5 >= math.fsum(values),
                'Browser loop elapsed time cannot exclude its sequential completion intervals')
        if 'sampleCount' in round_record:
            require(round_record['sampleCount'] == len(samples), 'Completion round count mismatch')
        fps = 1000 * len(values) / elapsed
        if 'completedFramesPerSecond' in round_record:
            close(round_record['completedFramesPerSecond'], fps, 'Round completion throughput mismatch')
        all_values.extend(values)
        output_rounds.append({
            'repeat': round_record['repeat'], 'samples': len(values),
            'e2e_completion_mean_ms': statistics.fmean(values),
            'e2e_completion_p50_ms': quantile(values, .5),
            'e2e_completion_p95_ms': quantile(values, .95),
            'window_elapsed_ms': elapsed, 'completion_intervals_sum_ms': math.fsum(values),
            'loop_outside_completion_intervals_ms': elapsed - math.fsum(values),
            'completed_frames_per_second': fps,
        })
    elapsed_total = math.fsum(r['window_elapsed_ms'] for r in output_rounds)
    fps = 1000 * len(all_values) / elapsed_total
    p50, p95 = quantile(all_values, .5), quantile(all_values, .95)
    if 'e2eCompletion' in raw:
        provided = raw['e2eCompletion']
        require(provided['sampleCount'] == len(all_values), 'Completion summary count mismatch')
        for name, expected in [('p50Ms', p50), ('p95Ms', p95), ('totalWindowMs', elapsed_total),
                               ('completedFramesPerSecond', fps)]:
            close(provided[name], expected, 'Runner completion summary differs: ' + name)
    round_means = [r['e2e_completion_mean_ms'] for r in output_rounds]
    summary = {
        'samples': len(all_values), 'rounds': len(rounds),
        'e2e_completion_mean_ms': statistics.fmean(all_values),
        'e2e_completion_round_mean_sd_ms': statistics.stdev(round_means),
        'e2e_completion_p50_ms': p50, 'e2e_completion_p95_ms': p95,
        'e2e_completion_min_ms': min(all_values), 'e2e_completion_max_ms': max(all_values),
        'total_window_elapsed_ms': elapsed_total,
        'completion_intervals_sum_ms': math.fsum(all_values),
        'completed_frames_per_second': fps,
        'metric_family': 'instrumented_fresh_sort_gpu_completion',
        'throughput_definition': '1000 * sample_count / sum(five measured browser-loop windowElapsedMs)',
        'quantile_definition': 'Type 7: linear interpolation at (N-1)*p over all individual e2eCompletionMs samples',
        'boundary': 'Browser performance.now immediately before await bench.sample(camera) through Promise completion, including current-camera update, fresh sort, GPU completion and metric collection',
        'excluded': 'Model load, warmup, inter-round warmup, screenshots, display presentation/input-to-photon latency',
        'outliers_removed': 0,
    }
    return summary, output_rounds
