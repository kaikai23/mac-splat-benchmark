# Three-method portable analysis

This directory validates and reports **new measurements from one target Mac**.
It accepts only Visionary1.0.1, official native Spark.js0.1.10, and SuperSplat
Editor2.1.0/PlayCanvas2.5.1. The actual Spark native sorting width is bound by
`protocol.methodDefinitions.spark.sortBits` and sample metadata. Timer/diagnostic
instrumentation is declared separately from algorithm modifications.
The Spark adapter also balances the temporary accumulator reference retained by
native synchronous `prepare`; the native algorithms, shaders and WASM stay
unchanged. Every timed sample records the compensated reference count.

There are no Windows timing inputs, no old Mac Spark2.1 measurements, no custom
FP16 variant, and no FP16-versus-FP32 comparison deliverable. The exact matrix is
**13 scenes ×4 strides ×3 methods =156 configurations**, each with5 rounds and
3 camera traversals:780 round means and68,040 timing samples. Formal capture
coverage is234 PNGs plus4,536 full-view lossless quality images.

## Run

Finish performance and ground-truth quality measurement first. The analyzer
does not launch a browser, render a frame, run torch, or perform GPU inference.

```sh
.venv/bin/python analysis/analyze.py \
  --config config/local.json --run-dir results/RUN
```

Paths in `config/local.json`, including `groundTruthRoot`, resolve relative to
the repository root. No machine model, user directory, Chrome version or OS
version is assumed: the run records the actual local environment and the report
displays it. The protocol fixes framebuffer1280×720, viewport1280×760, DPR1,
SH3, black background and disabled LoD for cross-machine comparability.

Only complete formal156-configuration coverage is accepted. Missing samples,
quality scores, source identities or captures produce a failing
`analysis/analysis-qa.json` and `analysis/STATUS.md`. No incomplete set is promoted
to a complete report and no missing values are replaced by zeros or references.

## Artifacts

The run's `analysis/` directory receives:

- Bilingual `index.html`, `report-zh.md`, `report-en.md`, actual GT/three-method
  `captures.html`, and full `report.json`.
- `configurations.csv`, `round-means.csv`, `e2e-samples.csv`, `aggregates.csv`, and
  separately labeled native callback `native-raf.csv`. Environment fields are
  retained on exported performance rows.
- Standard Matplotlib PNG200dpi + SVG figures for full-model completion FPS,
  P50/P95, selected stages, four scales, and PSNR/SSIM/LPIPS.
- `full-model-table.tex`, `rebuttal-en.md`, `analysis-qa.json`, and a complete
  input/output SHA receipt. These are generated exclusively from validated inputs.

## Definitions and limitations

The primary speed metric is browser-clock completion around
`await bench.sample(camera)`: current-camera update, fresh sorting, GPU completion
and timer-query readback/polling, including instrumentation. It is not physical
display or input-to-photon latency. Per-configuration P50/P95 use Type7 interpolation
over every measured sample. The distribution mixes different selected views and
runtime variation; it is not a fixed-camera jitter distribution.

Completed FPS is `1000*N/sum(round.windowElapsedMs)`, including browser-loop
bookkeeping and excluding loading/warmup/capture/Node-RPC intervals. Cross-scene
FPS is the arithmetic mean of the13 scene FPS values, not the reciprocal of mean
scene latency. Cross-scene P50/P95 columns are means of scene quantiles, not pooled
global quantiles. Five within-session rounds are not five independent processes.

Selected-stage costs keep their original method-specific boundaries. Native
Spark0.1.10 has a separate GPU depth-key pass and native CPU WASM sorting; that
GPU pass must not be labeled GPU sorting. SuperSplat prep is fused into draw.
Stage sums, legacy `gl.finish` wall, E2E completion, and asynchronous rAF callback
intervals remain different metrics. No stage cost is inverted to manufacture FPS.

The analyzer binds all models to the runner's full integrity receipt, exact frozen
cameras and source hashes, every measured raw identity, power telemetry, all
capture hashes, and all4,536 GT score rows. It independently recomputes timing,
quality grouping, and13-scene equal weights. It does not claim a new18GB model
rehash after collection or human visual equivalence from image decoding alone.

## Lightweight numerical tests

```sh
.venv/bin/python -m unittest discover -s analysis -p 'test_*.py'
```

These pure CPU fixtures test stage arithmetic, physical clock nesting, camera
traversal, Type7 quantiles and whole-loop FPS. Fixtures are never written into
experiment result directories and cannot establish actual GPU performance.
