# Three-method Mac experiment

This repository measures **Visionary 1.0.1, Spark.js 0.1.10, and SuperSplat
Editor 2.1.0 / PlayCanvas 2.5.1** on the current Apple Silicon Mac. Exact upstream
commits, source files, browser executable/framework hashes, hardware and operating
system are recorded for each run. The older Spark 2.1 experiment is historical
evidence outside this repository and supplies no measurements to the new report.

## Matrix and rendering

- 13 scenes: bicycle, flowers, garden, stump, treehill, room, counter, kitchen,
  bonsai, drjohnson, playroom, truck, train.
- Four fixed input strides: 1, 2, 4, 8. Stride retains every nth original Gaussian;
  it is a scale experiment, not runtime LoD or a retrained model.
- Three methods, giving **156 configurations**, 780 rounds and **68,040 timed
  samples**. The same 52 model SHA256 identities and 378 selected heldout camera
  identities are required on every machine.
- 1280 × 720 framebuffer, device pixel ratio 1, 1280 × 760 browser viewport,
  black background, spherical harmonics degree 3, no LoD.
- One fresh headless Chrome session per configuration. Configurations run
  serially in stride/scene order; the method order rotates across scene/stride
  groups. Other GPU tasks and heavy analysis must wait until collection ends.

Each configuration has five rounds, each visiting every selected camera three
times. Camera index is `(order + repeat*7 + cycle*11) % cameraCount`. Initial
warmup must meet both 10 seconds and 128 completed samples. Inter-round warmup
must meet both 1.5 seconds and 32 completed samples. Five rounds share one browser
and loaded model; they are not five independent process experiments.

The pilot is separate: bicycle/train, strides 1/8, all three methods, one round
and one camera cycle, giving 12 configurations and 378 timed samples. Pilot
measurements never enter formal result tables.

## Native Spark 0.1.10 settings

The selected Spark sorting option uses its **actual runtime default**, native
16-bit GPU-generated depth keys with the official CPU WASM bucket sorter.
`SparkViewpoint.sortUpdate` evaluates `this.sort32 ?? false`; the upstream API
comment claiming a true default is inconsistent with that implementation.
The experiment records `sort32=false`, `depthBias=1`, `sortRadial=false` and
`sort360=false`. No custom half conversion, saturation or CPU compaction is added.
The word default applies to sorting precision only. Other benchmark parameters
are explicit: `sortRadial=false` uses axial depth (the upstream default is true),
and `preBlurAmount=0.3, blurAmount=0` uses the archived benchmark's preparation
blur convention (upstream defaults are 0 and 0.3). Those settings are recorded,
not represented as the application's complete default preset.

This version has a standalone GPU depth-key pass. Timer instrumentation records
that pass separately from Gaussian preparation and drawing. The official module
and embedded WASM are retained and fingerprinted; instrumentation only adds
timing/diagnostic fields. The synchronous adapter balances a temporary
accumulator reference retained by native `prepare()`. Its lifecycle regression
test and rationale are documented in `work/spark-v0.1.10/BENCHMARK.md`.

## Completion latency and FPS

The primary latency is measured with the browser's monotonic `performance.now()`
immediately before `await bench.sample(camera)` and immediately after it resolves.
It includes camera assignment, fresh current-camera preparation/sorting/drawing,
GPU completion waits, GPU timer query polling/readback and adapter assertions.
This is **instrumented GPU-completion latency**. Loading, warmup, screenshots,
Node RPC, report generation and physical display presentation are excluded.

P50 and P95 use all individual completion samples within a configuration and
Type-7 linear interpolation at `p*(N-1)`. They mix camera complexity and runtime
variation; they do not describe jitter for a single fixed camera. Reported SD
for the mean is the sample SD of the five round means.

Each round also records a browser-clock window around the entire sampling loop,
including camera selection and bookkeeping. **Completed-frame FPS** is
`1000 * total completed samples / sum(round window milliseconds)`. It is not
computed from GPU stage sums or averaged instantaneous reciprocals. Scene
summaries first compute each scene's statistic, then give scenes equal weight;
averaged scene P50/P95 values are explicitly labeled as such.

The auxiliary native asynchronous run records 360 requestAnimationFrame callback
intervals after 60 warmup callbacks for each full-model configuration: 39 runs,
14,040 callback intervals. Callback throughput is reported separately; callbacks
may reuse an earlier sort and do not measure physical display presentation.

## Stage costs

The same samples retain method-specific component timings:

| Method | Selected stage cost |
|---|---|
| Visionary | GPU timestamp span from preparation start through draw completion, including GPU radix sort and gaps |
| Spark.js 0.1.10 | GPU preparation + standalone GPU depth-key pass + native CPU WASM sort + GPU draw |
| SuperSplat | CPU bounds/key/histogram + prefix/scatter + front-count/mapping + GPU fused preparation/draw + output blit |

These component sums have different coverage and are not interchangeable with
completion latency. Spark depth readback and Worker RPC are outside the GPU
stage queries. Its ordering buffer update is submitted during Three.js drawing;
GPU upload cost is not separately isolated. SuperSplat preparation is fused into
draw and must not be reported as independently measured zero time. CPU draw-only
time is not separately measured for any method.

The report also counts samples whose selected stage sum exceeds independently
measured completion latency. GPU query values and CPU intervals belong to
different timing domains; their sum is retained as an API-reported diagnostic,
not a calibrated physical serial interval or exclusive GPU-work duration. No
sample is clipped or removed because of this discrepancy. Speed conclusions
use the independent completion clock and completed-frame FPS.

SuperSplat uses the Editor's native Splat/AssetLoader rendering path and native
PlayCanvas material, excluding editor UI, selection and overlay drawing. Its
native covariance calculation uses the horizontal focal value for both axes,
while camera centers and ground truth retain independent fx/fy scaling. The
effective fx/fy ratio ranges from 0.984859 to 1.186780 in these cameras; bicycle
is 1.186780. Thus vertical Gaussian footprints can differ, even when image
centers and camera poses agree. This native projection limitation can affect
both speed and image quality and is not corrected by the benchmark.

## Reconstruction quality

Every method/stride renders all heldout views after performance sampling,
producing **4,536 lossless RGB WebP images**. Formal visual examples retain
**234 PNGs**: first/middle/last view at stride 1, first view at each other stride.
The same render may supply both a PNG and a lossless WebP, with decoded-pixel
identity verified.

Ground-truth photographs are the 378 selected official source images, resized to
1280 × 720 with Pillow bicubic interpolation and independent x/y scaling matching
the camera projection. There is no crop, exposure fitting or color linearization.
This fixed framebuffer protocol differs from the original papers' evaluation
resolution; Tanks and Temples source images are upsampled from the released sizes.

- PSNR: encoded RGB8 scaled to [0,1], CPU float64 MSE over all channels, peak 1.
- SSIM: Gaussian 11 × 11 window, sigma 1.5, zero padding 5, C1=0.01², C2=0.03²,
  mean over pixels and RGB channels.
- LPIPS: official lpips 0.1.4, v0.1 VGG, fixed ImageNet and calibration weights,
  float32, evaluation mode, `normalize=True`.

Per-image values are averaged within configuration, then scene means receive
equal weight. CPU numerical spot checks and image/weight/source SHA receipts are
required. MPS quality computation runs only after all performance browsers and
servers have exited. Differences also reflect renderer encoding, projection,
culling and footprint; a quality difference cannot be attributed solely to sort
key width.

## Acceptance and cross-machine comparison

Full completion requires the exact matrix, camera traversal, warmups, current
sort poses, valid GPU timers, source/input hashes, image coverage, quality metrics
and owned-process cleanup. AC power is checked before loading, every five seconds,
before/after rounds and before completion. Active AC low-power mode must be off;
inactive battery-profile settings do not govern an AC run. No clock locking or
temperature isolation is claimed, and polling cannot exclude unobserved brief
power transitions.

Each Mac produces a separate run and actual browser/OS/chip inventory. Comparing
Macs also compares CPU, memory, software and thermal behavior; results should not
be presented as isolating GPU-chip effects alone. Do not substitute results from
another machine or from the older Spark version for a missing configuration.
