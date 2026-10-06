# Spark 0.1.10 benchmark integration

The measured `spark` method is the native runtime default of official tag
`v0.1.10`, commit `792d6d193db8b79ed4d1f32ef65cca9ec93f0896` (MIT).
The constructor's runtime fallback is `this.sort32 ?? false`; an upstream API
comment claiming a true default is stale. This experiment explicitly sets
`view.sort32=false`. It does not include a custom FP16 variant or Spark 2.x.

Native GPU code computes depth keys in a separate pass and packs two binary16
keys per RGBA8 word using `packHalf2x16`. The original `sortDoubleSplats` Worker
RPC calls the embedded `sort_splats` WASM descending bucket sort. This is CPU
sorting, not GPU sorting. Native key filtering, half encoding, depth bias 1,
packed splat storage, and quantized SH storage are retained. No custom
compaction, saturation, or half-conversion shader is added. This version has no
LoD subsystem; the benchmark loads each supplied PLY in full.

`acquisition/` records official GitHub/npm identities. All 225 tracked upstream
files were checked against their Git blob identities, and the npm and Git
`dist/spark.module.js` match byte for byte. Upstream source and release bundle
are kept unchanged. `benchmark-instrument.mjs` creates `dist/spark.benchmark.js`
and `benchmark-provenance.json` with timing-only modifications. It verifies that
reversing its edits reconstructs the official bundle and that both embedded
WASM payloads are unchanged. `benchmark.patch` exposes the extracted edited
regions for review. The modification identifier is `spark-0.1.10-timers-v1`.

The host is `../bench-spark` on port 8771. It shares Three.js 0.180.0 and Vite
6.4.1 from `../bench/node_modules`; native Three.js requirements permit this
version. Models come from `BENCH_DATA_ROOT`, not a hard-coded machine path.
The Visionary-only host is `../bench-visionary` on port 8770.

## Completion and stage measurements

Synchronous samples force fresh native generation, prepare the current camera
through `SparkViewpoint.prepare({update:true,forceOrigin:true})`, await its native
Worker sort, draw, call `gl.finish`, and await all GPU query availability.
Background native updates are disabled in this mode. Assertions check exactly
one generation query, one depth-key query, one draw query, a fresh sort sequence,
full input count, and current-camera sorting. Disjoint GPU queries are rejected.

`gpuPrepMs`, `gpuSortMetricMs`, and `gpuDrawMs` are disjoint WebGL elapsed-time
queries. The second name is retained for common schema compatibility and means
GPU depth-key generation, not sorting. `gpuTotalMs` is their sum;
`stageCostSumMs = gpuTotalMs + cpuSortMs`. The CPU sort timer wraps the original
WASM call, including its JavaScript/WASM buffer access and copying. Worker RPC,
depth readback, and ordering update wall times are separately recorded. They
must not be added again to the stage sum. Their transfer boundaries differ:
depth readback occurs outside the GPU
queries, whereas the native ordering `InstancedBufferAttribute` uploads during
`renderer.render`, within the draw query command scope. The legacy
`orderingUploadWallMs` field measures CPU `updateDisplay` / attribute update,
not GPU upload execution. All are inside end-to-end completion time.

### Native synchronous prepare lifecycle compensation

Upstream 0.1.10 `SparkViewpoint.prepare()` increments the new accumulator's
reference count before calling `sortUpdate`. The latter's `updateDisplay`
retains another reference for the display, but `prepare()` does not release its
temporary reference on return. Repeated forced generation therefore retains one
orphan reference per frame and exhausts the native five-accumulator limit.
The original source and instrumented release bundle are unchanged. The adapter
balances that temporary borrow after successful native `prepare()`, using the
original `releaseAccumulator` method. It verifies that the prepared accumulator
is both active and displayed, with reference count exactly 3 before release and
2 afterward (active plus display). Each sample records the compensation and
remaining count. This corrects synchronous API ownership only; it changes no
GPU commands, key generation, sort ordering, or draw algorithm. Native async
rAF uses `driveSort`, which already releases its temporary sort reference.

`validate-native-prepare.mjs` executes the official `prepare`, `updateDisplay`,
and accumulator ownership methods on CPU, substituting only GPU generation and
sorting work. It demonstrates native exhaustion after five completed frames
and verifies 256 compensated frames using two reusable accumulators. Its
receipt defaults to `results/setup/native-prepare-lifecycle-review.json`.

The runner's end-to-end timer encloses `bench.sample(camera)` from setting the
camera through query readback and assertions. It is not display latency. The
legacy `viewCompleteWallMs` ends at `gl.finish`, before timer-query polling;
analysis must use `e2eCompletionMs` for the requested completion-time percentiles.
Asynchronous rAF uses the native update scheduler and is a separate diagnostic.

## Revalidation

Run `node work/spark-v0.1.10/benchmark-instrument.mjs` to reproduce the instrumented
bundle. Run `node work/spark-v0.1.10/validate-native-sort.mjs` from any directory
to exercise the actual embedded Worker and WASM on CPU. Its default receipt is
`results/setup/spark-native-sort-cpu-validation.json`, or use `--output=PATH`.
No browser or external network is used. The six tests include all 65,536 half
bit patterns, random keys, and stable ties. Native32 is checked only for source
integrity, not measured as an additional method. These CPU checks cannot verify
GPU shader output, GPU timing, or image correctness; each target Mac must also
run the repository's GPU validation and pilot before its formal measurements.
