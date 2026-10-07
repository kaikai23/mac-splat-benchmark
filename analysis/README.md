# Three-method portable analysis

This directory validates and reports **new measurements from one target Mac**.
It accepts only Visionary1.0.1, official native Spark.js0.1.10, and SuperSplat
Editor2.1.0/PlayCanvas2.5.1. The actual Spark native sorting width is bound by
`protocol.methodDefinitions.spark.sortBits` and sample metadata. Timer/diagnostic
instrumentation is declared separately from algorithm modifications.
The Spark adapter also balances the temporary accumulator reference retained by
native synchronous `prepare`; the native algorithms, shaders and WASM stay
unchanged. Every timed sample records the compensated reference count.
“Default” refers only to the selected native 16-bit sorting-key path. The
benchmark explicitly sets `sortRadial=false`, `preBlurAmount=0.3` and
`blurAmount=0`; the corresponding upstream defaults are `true`, `0` and `0.3`.

There are no Windows timing inputs, no old Mac Spark2.1 measurements, no custom
FP16 variant, and no FP16-versus-FP32 comparison deliverable. The exact matrix is
**13 scenes ×4 strides ×3 methods =156 configurations**, each with5 rounds and
3 camera traversals:780 round means and68,040 timing samples. Formal capture
coverage is234 PNGs plus4,536 full-view lossless quality images.

## Run

In this document `results/RUN` (or `BENCH_RUN`) is the outer run directory;
formal measurements and their acceptance receipts are inside `formal/`. Run
commands from the repository root after following the [colleague guide](../docs/COLLEAGUE_QUICKSTART.zh-CN.md).

Finish performance and ground-truth quality measurement first. The analyzer
does not launch a browser, render a frame, run torch, or perform GPU inference.
It also requires the new formal run's `validation/quality-numerical-validation.json`:
complete CPU analytical PSNR, independent SciPy SSIM, and LPIPS checks bound to
the current metric/validation script SHA256 and the same VGG checkpoint as the
actual quality run. Historical numerical receipts are not substituted.

```sh
.venv/bin/python analysis/analyze.py \
  --config config/local.json --run-dir results/RUN/formal
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

The formal run's `analysis/` directory (`results/RUN/formal/analysis/`) receives:

- Bilingual `index.html`, `report-zh.md`, `report-en.md`, actual GT/three-method
  `captures.html`, and full `report.json`.
- `gallery/` contains exact-byte copies of thirteen GT camera-0 PNGs and
  thirty-nine renderer camera-0 PNGs. `gallery-receipt.json` binds source and
  copied SHA256 values; images are neither resized nor re-encoded. Small linked
  provenance files are copied to `evidence/` with `evidence-copy-receipt.json`,
  so the report's HTML, figures, gallery and links work from `analysis/` alone.
- `configurations.csv`, `round-means.csv`, `e2e-samples.csv`, `aggregates.csv`, and
  separately labeled native callback `native-raf.csv`. Environment fields are
  retained on exported performance rows.
- `projection-intrinsics.csv`, deriving effective `fx/fy` from all 378 frozen
  cameras at the actual 1280×720 framebuffer.
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
The report counts every same-sample `stage > E2E` observation by method, including
SuperSplat. CPU Worker clocks and GPU query durations are different timing
domains; their component-cost sum is not additive physical serial elapsed time.
All values remain present and the underlying discrepancy is not assigned an
unverified cause. Primary throughput uses the complete browser-loop window.

Shared camera centers and GT use independent x/y scaling. Effective focal lengths
are `fx*1280/original_width` and `fy*720/original_height`. SuperSplat preserves the
native PlayCanvas covariance Jacobian's use of the horizontal focal value for
both axes. This can change Gaussian footprints and draw workload relative to the
independent-focal methods; the report lists all thirteen scene ratios. The ratio
is not a direct prediction of complete ellipse height, since covariance,
rotation, blur and radius caps also contribute. Quality or speed differences
cannot be attributed solely to sorting keys. Comparing different Macs also
changes CPU, memory, browser, OS and thermal behavior, not only the GPU chip.

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

## Post-measurement report rendering QA

After timing, quality, both quality audits and `analyze.py` finish, run:

```sh
node analysis/validate_report.cjs \
  --config config/local.json --run-dir results/RUN/formal
```

The validator refuses active GPU locks or incomplete runtime/build receipts. It
starts its own loopback-only HTTP server and configured system Chrome with
`--disable-gpu`, then checks both report pages at desktop width 1400 and mobile
width 390. Every relative asset/link must remain inside `analysis/` and return
HTTP 200, all images must decode, and body-level horizontal overflow and page/
console/network errors are failures. Horizontal scrolling within tables is
allowed. Existing build-output SHA values are checked before viewing.

Screenshots of the top views, primary speed table/plot, quality table/plot,
timing diagnostics and gallery are written to `validation/report-preview/`.
`validation/report-visual-qa.json` records links, hashes, dimensions and owned
browser/server cleanup. Signals or cleanup failures leave `passed=false`.
This is automated rendering QA; `humanVisualReview=false` remains explicit.
After actually inspecting every screenshot listed in that QA receipt, record
who reviewed the current artifact and the observed findings:

```sh
.venv/bin/python scripts/record-visual-review.py \
  --run-dir results/RUN/formal --reviewer-type codex --reviewer-name Codex \
  --notes 'Replace with findings from actually viewing all recorded screenshots'
```

Use `--reviewer-type human` and the actual name only for a human reviewer.
Codex review keeps `humanVisualReview=false`; it is not misrepresented as human
review. Each unresolved `--finding 'description'` records a failed review and
blocks packaging. After changes, regenerate the analysis and automatic QA,
inspect the new screenshots, and record a new review. The packager requires
`validation/visual-review.json` to pass and bind the current build, QA and all
screenshots. Do not run browser QA or visual review during collection.

When an isolated timer-domain review exists under configured `validationRoot`,
the analyzer binds its renderer source, browser/chip and diagnostic raw hashes,
summary and cleanup before copying the small evidence files into the report.
Those diagnostic samples never enter formal aggregates. Adjacent API query
intervals can be sensitive to predecessor completion; this does not establish
exclusive GPU costs or a verified internal ANGLE cause. Serialized diagnostic
waits are not the production protocol and their FPS is not a baseline result.

## Historical 34-configuration preview only

`preview.py` preserves the earlier, explicitly partial34-configuration review.
It is **not a general automatic preview entry point for a new colleague run**:
its scope receipt and some displayed labels target that historical selection
(eleven shared full-model scenes plus truck/SuperSplat). Those historical raw
results and scope receipts are not supplied by a fresh Git clone. Do not call
it with an arbitrary paused run or fabricate its `scope-manifest.json`.

The default reproduction path completes the156-configuration formal run and
uses `analyze.py`. If collection is paused, keep the genuine raw/checkpoints and
incomplete status, then resume the unchanged formal command when authorized.
A specially requested partial review needs its own explicit scope and reviewed
reporting logic; partial auditor/quality flags never establish full completion.
See [troubleshooting](../docs/TROUBLESHOOTING.zh-CN.md) for safe recovery.
