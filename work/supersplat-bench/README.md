# SuperSplat Editor 2.1.0 benchmark host

This host uses the pinned editor source under `../supersplat-v2.1/src` and the
vendored PlayCanvas 2.5.1 release modules under `vendor/playcanvas`.
Upstream licenses are preserved beside both source trees. The official engine
sorter source is retained at `vendor/engine-source/gsplat-sorter.js` for the
independent worker comparison.

`dist/gsplat-sorter.benchmark.js` adds timing and an explicit current-view sort
request to the native worker. Its sorting algorithm is unchanged. The
instrumentation builder, reverse edits and original/release source identities
are included. The editor UI, grid and picking layers are outside this host.

Install the shared dependencies from `../bench/package-lock.json` using the
repository setup script. `BENCH_DATA_ROOT` selects an external model directory;
the default `../data` is only a local fallback and is never committed.

From the repository root, the CPU-only worker validation is:

```sh
node work/supersplat-bench/verify-worker.mjs --output=results/setup/supersplat-worker.json
```

Use `run-experiment.cjs` for GPU validation and collection. Do not launch this
host concurrently with another GPU experiment. GPU preparation is fused into
the draw; the native adaptive bucket sorter is neither Spark FP16 nor FP32.
