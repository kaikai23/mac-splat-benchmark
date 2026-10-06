'use strict';
const assert = require('node:assert/strict');
const {quantile, summarize, acPowerPolicy} = require('./common.cjs');
const {argumentsFrom} = require('../run-experiment.cjs');
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-12);
close(quantile([1, 2, 5, 10], .5), 3.5);
close(quantile([1, 2, 5, 10], .95), 9.25);
const stats = summarize([
  {samples: [{e2eCompletionMs: 10}, {e2eCompletionMs: 20}], windowElapsedMs: 35},
  {samples: [{e2eCompletionMs: 30}], windowElapsedMs: 40}
]);
assert.equal(stats.completedFramesPerSecond, 40);
assert.equal(stats.p50Ms, 20);
close(stats.p95Ms, 29);
assert.throws(() => summarize([{samples: [{e2eCompletionMs: 0}], windowElapsedMs: 1}]));
assert.equal(acPowerPolicy('Battery Power:\n lowpowermode 1\nAC Power:\n lowpowermode 0\n').acLowPowerMode, 0);
assert.throws(() => acPowerPolicy('AC Power:\n lowpowermode 1\n'));
assert.equal(acPowerPolicy('AC Power:\n displaysleep 10\n').acLowPowerMode, null);
assert.equal(argumentsFrom(['--mode', 'full', '--output', 'results/test']).mode, 'full');
assert.throws(() => argumentsFrom(['--mode', 'bogus']));
console.log('PASS numerical definitions, AC power profiles, and CLI contracts');
