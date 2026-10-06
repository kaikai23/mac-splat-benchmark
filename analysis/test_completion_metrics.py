"""CPU-only tests of the completion-clock aggregation contract."""
import unittest

from completion_metrics import summarize_completion


def raw():
    rounds = []
    for repeat in range(5):
        start = 1000 * repeat
        point = start + 2
        samples = []
        for duration in (10 + repeat, 20 + repeat, 30 + repeat):
            samples.append({'e2eCompletionMs': duration, 'e2eStartMs': point,
                            'e2eEndMs': point + duration})
            point += duration + 1
        rounds.append({'repeat': repeat, 'windowElapsedMs': 100 + 20 * repeat,
                       'windowStartMs': start, 'windowEndMs': start + 100 + 20 * repeat,
                       'samples': samples})
    return {'cameras': [{}], 'rounds': rounds}


class CompletionMetricContracts(unittest.TestCase):
    def test_throughput_uses_entire_measured_loop(self):
        summary, rounds = summarize_completion(raw())
        self.assertAlmostEqual(summary['completed_frames_per_second'], 15000 / 700)
        self.assertNotAlmostEqual(summary['completed_frames_per_second'], 1000 / 22)
        self.assertNotAlmostEqual(summary['completed_frames_per_second'],
                                  sum(r['completed_frames_per_second'] for r in rounds) / 5)

    def test_quantiles_use_individual_samples_not_round_means(self):
        summary, _ = summarize_completion(raw())
        self.assertAlmostEqual(summary['e2e_completion_mean_ms'], 22)
        self.assertAlmostEqual(summary['e2e_completion_p50_ms'], 22)
        self.assertAlmostEqual(summary['e2e_completion_p95_ms'], 33.3)

    def test_short_loop_rejected(self):
        value = raw()
        value['rounds'][0]['windowElapsedMs'] = 50
        with self.assertRaises(ValueError):
            summarize_completion(value)

    def test_missing_completion_cannot_fall_back_to_stage_or_wall(self):
        value = raw()
        del value['rounds'][0]['samples'][0]['e2eCompletionMs']
        value['rounds'][0]['samples'][0]['stageCostSumMs'] = 10
        value['rounds'][0]['samples'][0]['viewCompleteWallMs'] = 20
        with self.assertRaises(KeyError):
            summarize_completion(value)


if __name__ == '__main__':
    unittest.main()
