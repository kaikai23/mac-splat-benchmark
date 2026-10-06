"""Artificial unit fixtures: never written to experiment outputs."""
import copy
import statistics
import unittest
from metrics import normalize, summarize

def visionary(cost):
    prep, sort, draw = .1*cost, .3*cost, .5*cost
    return {'gpu':{'prepMs':prep,'sortMs':sort,'drawMs':draw,'totalMs':cost,'timestampWriteCount':6,
                   'stageTimings':[{'stage':k,'ms':v} for k,v in zip(('prep','sort','draw'),(prep,sort,draw))]},
            'timingMode':'stages','gaussianCount':100,'visibleSplats':50,'wallMs':cost+2}

class MetricChecks(unittest.TestCase):
    def test_visionary_includes_gaps(self):
        value=normalize(visionary(10),'visionary',100)
        self.assertEqual(value['stage_cost_ms'],10)
        self.assertEqual(value['visionary_stage_sum_ms'],9)
        self.assertIsNone(value['cpu_sort_ms'])

    def test_cpu_time_cannot_replace_gpu(self):
        fixture=visionary(10)
        fixture['gpu']['totalMs']=None
        fixture['cpuSubmitMs']=10
        with self.assertRaises(ValueError):
            normalize(fixture,'visionary',100)

    def test_negative_and_nonfinite_rejected(self):
        for v in (-1,float('nan'),float('inf')):
            fixture=visionary(10)
            fixture['gpu']['prepMs']=v
            with self.assertRaises(ValueError):
                normalize(fixture,'visionary',100)

    def test_native_spark_independent_depth_stage(self):
        fixture={'gpuPrepMs':1,'gpuSortMetricMs':2,'gpuDrawMs':3,'gpuTotalMs':6,
                 'cpuSortMs':4,'stageCostSumMs':10,'numSplats':100,'sortedSplats':90,
                 'viewCompleteWallMs':20,'gpuQueryCounts':{'prep':1,'metric':1,'draw':1},
                 'prepareLifecycleCompensated':True,'prepareAccumulatorRefCount':2,'accumulatorCount':2}
        value=normalize(fixture,'spark',100)
        self.assertEqual(value['stage_cost_ms'],10)
        self.assertEqual(value['gpu_depth_metric_ms'],2)
        self.assertIsNone(value['gpu_sort_ms'])
        fixture['gpuTotalMs']=4
        with self.assertRaises(ValueError): normalize(fixture,'spark',100)

    def test_super_splat_fused_is_not_zero(self):
        fixture={'gpuDrawMs':2,'gpuTotalMs':3,'gpuBlitMs':1,'stageCostSumMs':9,'cpuPrepMs':1,
                 'cpuSortMs':2,'cpuPostprocessMs':3,'cpuWorkerComputeMs':6,'cpuWorkerSpanMs':6,
                 'gpuPrepMs':None,'gpuPrepMode':'fused-into-draw','gpuSortMetricMs':0,'gpuSortMs':0,
                 'gpuSortMetricMode':'CPU','sortedSplats':100,'activeSplats':90,'visible':90,
                 'compareBits':10,'bucketCount':1025,'wallMs':7,'viewCompleteWallMs':7,'queryReadyWallMs':10}
        self.assertIsNone(normalize(fixture,'supersplat',100)['gpu_prep_ms'])
        fixture['gpuPrepMs']=0
        with self.assertRaises(ValueError):
            normalize(fixture,'supersplat',100)

    def test_equal_view_then_round_sd_and_traversal(self):
        cameras=[{'id':i,'img_name':str(i)} for i in range(2)]
        raw={'cameras':cameras,'model':{'gaussian_count':100},'warmup':{'elapsedMs':10000,'samples':128},
             'startedAt':'2026-10-07T00:00:00Z','completedAt':'2026-10-07T00:01:00Z','rounds':[]}
        for repeat in range(5):
            rd={'repeat':repeat,'warmup':{'elapsedMs':1500,'samples':32},
                'startedAt':f'2026-10-07T00:00:{repeat*10+1:02}Z',
                'completedAt':f'2026-10-07T00:00:{repeat*10+9:02}Z','samples':[]}
            for cycle in range(3):
                for order in range(2):
                    i=(order+repeat*7+cycle*11)%2
                    rd['samples'].append({**visionary(10+repeat+cycle+i*2),'repeat':repeat,'cycle':cycle,
                                          'order':order,'cameraIndex':i,'cameraId':i,'img_name':str(i)})
            raw['rounds'].append(rd)
        row,repeats,warnings=summarize(raw,'visionary')
        self.assertEqual(row['samples'],30)
        self.assertEqual(row['stage_cost_ms_mean'],14)
        self.assertAlmostEqual(row['stage_cost_ms_sd'],statistics.stdev([12,13,14,15,16]))
        bad=copy.deepcopy(raw)
        bad['rounds'][1]['warmup']['samples']=31
        with self.assertRaises(ValueError): summarize(bad,'visionary')
        bad=copy.deepcopy(raw)
        bad['rounds'][0]['samples'][1]['cameraIndex']=0
        with self.assertRaises(ValueError): summarize(bad,'visionary')

if __name__=='__main__': unittest.main()
