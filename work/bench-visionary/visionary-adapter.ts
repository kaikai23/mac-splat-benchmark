import * as THREE from 'three';
import { GaussianRenderer } from '../visionary/src/renderer/gaussian_renderer';
import { PLYLoader } from '../visionary/src/io/ply_loader';
import { PointCloud } from '../visionary/src/point_cloud/point_cloud';
import { CameraAdapter } from '../visionary/src/camera/CameraAdapter';
import { applyCamera } from './camera';

const SOURCE_COMMIT = 'e50f3f6c7200be0516567f0830e5240dfa26d27d';
type CameraSpec = {
  position: number[]; rotation: number[][]; fx: number; fy: number;
  width: number; height: number;
};
type TimingMode = 'all-pass' | 'stages' | 'none';
type Options = {
  width?: number; height?: number; shDegree?: number; kernelSize?: number;
  timingMode?: TimingMode;
};
type Region = { label: string; stage: 'prep' | 'sort' | 'draw'; start: number; end: number };
// Exact sequence at SOURCE_COMMIT. Validate it so sparse timestamps cannot silently
// stop before the final radix pass if the pinned upstream implementation changes.
const SORT_PASS_LABELS = [
  'RS::Zero (Indirect)', 'RS::Histogram (Indirect)', 'Radix Sort :: Prefix Sum Pass',
  ...['even', 'odd', 'even', 'odd'].flatMap(parity => [
    `RS::ScatterLocal_${parity} (Indirect)`,
    `RS::ScatterPrefix_${parity} (Indirect)`,
    `RS::ScatterApply_${parity} (Indirect)`,
  ]),
];

/** Pass timestamp injection wraps the original encoder; all renderer/shader work is upstream. */
class PassTimer {
  querySet: GPUQuerySet;
  resolveBuffer: GPUBuffer;
  readBuffer: GPUBuffer;
  regions: Region[] = [];
  capacity: number;
  writeCount = 0;
  private sortPassCount = 0;

  constructor(private device: GPUDevice, private mode: Exclude<TimingMode, 'none'>) {
    this.capacity = mode === 'all-pass' ? 128 : 6;
    this.querySet = device.createQuerySet({ type: 'timestamp', count: this.capacity });
    this.resolveBuffer = device.createBuffer({
      size: this.capacity * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    this.readBuffer = device.createBuffer({
      size: this.capacity * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  wrap(encoder: GPUCommandEncoder): GPUCommandEncoder {
    this.regions = [];
    this.writeCount = 0;
    this.sortPassCount = 0;
    return new Proxy(encoder, {
      get: (target, property) => {
        if (property === 'beginComputePass' || property === 'beginRenderPass') {
          return (descriptor: any = {}) => {
            const label = descriptor.label ?? String(property);
            const stage = property === 'beginRenderPass' ? 'draw'
              : label.startsWith('preprocess') ? 'prep' : 'sort';
            let timestampWrites: GPUComputePassTimestampWrites | undefined;
            if (this.mode === 'all-pass') {
              const start = this.regions.length * 2;
              if (start + 1 >= this.capacity) throw new Error('Visionary timestamp capacity exceeded');
              this.regions.push({ label, stage, start, end: start + 1 });
              timestampWrites = {
                querySet: this.querySet, beginningOfPassWriteIndex: start, endOfPassWriteIndex: start + 1,
              };
            } else if (stage === 'prep') {
              if (this.regions.length !== 0) throw new Error('Expected one initial Visionary preprocess pass');
              this.regions.push({ label: 'preprocess stage', stage, start: 0, end: 1 });
              timestampWrites = { querySet: this.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
            } else if (stage === 'sort') {
              if (label !== SORT_PASS_LABELS[this.sortPassCount]) {
                throw new Error(`Visionary sort pass sequence changed at ${this.sortPassCount}: ${label}`);
              }
              if (this.sortPassCount === 0) {
                this.regions.push({ label: 'complete radix-sort stage', stage, start: 2, end: 3 });
                timestampWrites = { querySet: this.querySet, beginningOfPassWriteIndex: 2 };
              }
              if (this.sortPassCount === SORT_PASS_LABELS.length - 1) {
                timestampWrites = { querySet: this.querySet, endOfPassWriteIndex: 3 };
              }
              this.sortPassCount += 1;
            } else {
              if (this.sortPassCount !== SORT_PASS_LABELS.length || this.regions.length !== 2) {
                throw new Error('Visionary stages timer expected all 15 sort passes before one draw pass');
              }
              this.regions.push({ label: 'draw stage', stage, start: 4, end: 5 });
              timestampWrites = { querySet: this.querySet, beginningOfPassWriteIndex: 4, endOfPassWriteIndex: 5 };
            }
            if (timestampWrites) {
              this.writeCount += Number(timestampWrites.beginningOfPassWriteIndex !== undefined)
                + Number(timestampWrites.endOfPassWriteIndex !== undefined);
            }
            return (target[property] as any).call(target,
              timestampWrites ? { ...descriptor, timestampWrites } : descriptor);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  resolve(encoder: GPUCommandEncoder) {
    if (this.mode === 'stages' && (this.writeCount !== 6 || this.regions.length !== 3)) {
      throw new Error('Incomplete Visionary stages timestamp frame');
    }
    const count = this.regions.length * 2;
    encoder.resolveQuerySet(this.querySet, 0, count, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readBuffer, 0, count * 8);
  }

  async read() {
    await this.readBuffer.mapAsync(GPUMapMode.READ);
    const ticks = new BigUint64Array(this.readBuffer.getMappedRange());
    const regionTimings = this.regions.map(region => ({
      ...region, ms: Number(ticks[region.end] - ticks[region.start]) / 1e6,
    }));
    const span = (stage: Region['stage']) => {
      const matching = this.regions.filter(region => region.stage === stage);
      return matching.length
        ? Number(ticks[matching[matching.length - 1].end] - ticks[matching[0].start]) / 1e6 : null;
    };
    const first = this.regions[0];
    const last = this.regions[this.regions.length - 1];
    const result = {
      prepMs: span('prep'), sortMs: span('sort'), drawMs: span('draw'),
      totalMs: Number(ticks[last.end] - ticks[first.start]) / 1e6,
      passSumMs: this.mode === 'all-pass' ? regionTimings.reduce((sum, pass) => sum + pass.ms, 0) : null,
      passTimings: this.mode === 'all-pass' ? regionTimings : [],
      stageTimings: this.mode === 'stages' ? regionTimings : [],
      timestampWriteCount: this.writeCount,
    };
    this.readBuffer.unmap();
    return result;
  }
}

/**
 * Static complete-model adapter for the official Visionary renderer.
 * renderSample() forces fresh preprocessing + GPU sorting + drawing for the selected camera,
 * then waits for GPU completion and reads real GPU timestamps (never CPU substitutes).
 * renderFrame() submits the same original pipeline with no timing/readback, for rAF tests.
 */
export async function createVisionary(canvas: HTMLCanvasElement, options: Options = {}) {
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const shDegree = options.shDegree ?? 3;
  const kernelSize = options.kernelSize ?? 0.3;
  const timingMode = options.timingMode ?? 'stages';
  if (!['all-pass', 'stages', 'none'].includes(timingMode)) throw new Error(`Invalid timing mode: ${timingMode}`);
  if (!navigator.gpu) throw new Error('WebGPU is unavailable');
  const gpuAdapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!gpuAdapter) throw new Error('No WebGPU adapter');
  const timestampSupported = gpuAdapter.features.has('timestamp-query');
  const device = await gpuAdapter.requestDevice({
    requiredFeatures: timestampSupported ? ['timestamp-query'] : [],
    requiredLimits: {
      maxBufferSize: gpuAdapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: gpuAdapter.limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupStorageSize: gpuAdapter.limits.maxComputeWorkgroupStorageSize,
      maxStorageBuffersPerShaderStage: gpuAdapter.limits.maxStorageBuffersPerShaderStage,
    },
  });
  const errors: string[] = [];
  let disposed = false;
  device.addEventListener('uncapturederror', (event: any) => errors.push(String(event.error?.message ?? event.error)));
  device.lost.then(info => { if (!disposed) errors.push(`GPU device lost: ${info.reason}: ${info.message}`); });
  const assertHealthy = () => { if (errors.length) throw new Error(errors.join('\n')); };
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('Cannot create WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque', colorSpace: 'srgb' });
  const renderer = new GaussianRenderer({ device, format, shDegree, compressed: false, debug: false });
  device.pushErrorScope('validation');
  await renderer.initialize();
  const initializeError = await device.popErrorScope();
  if (initializeError) throw new Error(`Visionary initialization validation: ${initializeError.message}`);
  assertHealthy();
  const timer = timestampSupported && timingMode !== 'none' ? new PassTimer(device, timingMode) : null;
  const visibleReadBuffer = device.createBuffer({
    size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 10000);
  const cameraAdapter = new CameraAdapter();
  let pointCloud: PointCloud | null = null;
  let hasCamera = false;
  const info: any = gpuAdapter.info ?? {};
  const metadata: any = {
    engine: 'visionary', version: '1.0.1', sourceCommit: SOURCE_COMMIT,
    sortBits: 32, sortingImplementation: 'upstream WebGPU radix sort, four 8-bit radix rounds over FP32 depth key bits',
    sourceUrl: 'https://github.com/Visionary-Laboratory/visionary',
    width, height, shDegree, kernelSize, background: '#000000', lod: false,
    timestampSupported, timingMode, timingMethod: timer ? 'WebGPU pass timestamp queries' : null,
    timestampWriteCount: timer ? timingMode === 'stages' ? 6 : 34 : 0,
    timingUnits: 'milliseconds', gpuTotalDefinition: 'first preprocess pass start through draw pass end',
    gpuSortDefinition: 'first radix-sort pass start through last radix-sort pass end, including pass gaps',
    gpuPassSumDefinition: timingMode === 'all-pass'
      ? 'sum of individual GPU pass durations, excluding inter-pass gaps' : null,
    serializedDefinition: 'one new camera preprocessing, sort, and draw; await GPU completion; readback excluded from wallMs',
    renderPath: 'official GaussianRenderer.prepareMulti + renderMulti, one complete PLY model',
    sourcePatches: [], timestampInstrumentation: timer
      ? 'GPUCommandEncoder proxy injects timestampWrites only' : null,
    precision: 'official PLYLoader FP16 position/opacity/covariance/SH; original source PLY unchanged',
    nativeOpacityCull: 0.02, nativeFrustumMargin: 1.2, nativeFragmentCutoff: 'a > 2 * sqrt(log(255))',
    gpuAdapter: {
      vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description,
      backend: info.backend ?? null, driver: info.driver ?? null, type: info.type ?? null,
      d3dShaderModel: info.d3dShaderModel ?? null, powerPreference: info.powerPreference ?? null,
      isFallbackAdapter: gpuAdapter.isFallbackAdapter ?? null,
    },
    deviceLimits: {
      maxBufferSize: device.limits.maxBufferSize,
      maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
    },
  };

  function recordFrame(measure: boolean) {
    assertHealthy();
    if (!pointCloud || !hasCamera) throw new Error('Load a model and set a camera before rendering');
    const encoder = device.createCommandEncoder({ label: 'Visionary benchmark frame' });
    const instrumented = measure && timer ? timer.wrap(encoder) : encoder;
    renderer.prepareMulti(instrumented, device.queue, [pointCloud], {
      camera: cameraAdapter as any, viewport: [width, height], maxSHDegree: shDegree,
      showEnvMap: false, mipSplatting: false, kernelSize, walltime: 0,
    });
    const pass = instrumented.beginRenderPass({
      label: 'Visionary Gaussian draw',
      colorAttachments: [{ view: context!.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    });
    renderer.renderMulti(pass, [pointCloud]);
    pass.end();
    if (measure) {
      timer?.resolve(encoder);
      metadata.timestampWriteCount = timer?.writeCount ?? 0;
      // Read the official renderer's already-produced indirect instance count, after timed work.
      encoder.copyBufferToBuffer((renderer as any).drawIndirectBuffer, 4, visibleReadBuffer, 0, 4);
    }
    device.queue.submit([encoder.finish()]);
  }

  return {
    metadata,
    async load(url: string) {
      if (pointCloud) throw new Error('Create a new Visionary adapter for each model to release all resources');
      const start = performance.now();
      const data = await new PLYLoader().loadUrl(url);
      if (data.shDegree() < shDegree) throw new Error(`PLY SH degree ${data.shDegree()} is below requested ${shDegree}`);
      pointCloud = new PointCloud(device, data);
      pointCloud.setMaxShDeg(shDegree);
      pointCloud.setKernelSize(kernelSize);
      pointCloud.setGaussianScaling(1);
      pointCloud.setOpacityScale(1);
      await device.queue.onSubmittedWorkDone();
      assertHealthy();
      metadata.gaussianCount = pointCloud.numPoints;
      metadata.modelShDegree = pointCloud.shDeg;
      metadata.modelUrl = url;
      metadata.loadMs = performance.now() - start;
      return { gaussianCount: pointCloud.numPoints, shDegree: pointCloud.shDeg, loadMs: metadata.loadMs };
    },
    setCamera(spec: CameraSpec | THREE.PerspectiveCamera) {
      if ('isPerspectiveCamera' in spec) camera.copy(spec);
      else applyCamera(camera, spec, width, height);
      // The official adapter recomputes projection from fov/aspect. Keep exact shared fx/fy
      // projection instead, while retaining its original WebGPU coordinate conversion.
      const updateProjectionMatrix = camera.updateProjectionMatrix;
      camera.updateProjectionMatrix = () => {};
      try { cameraAdapter.update(camera as any, [width, height]); }
      finally { camera.updateProjectionMatrix = updateProjectionMatrix; }
      const focal: [number, number] = [
        camera.projectionMatrix.elements[0] * width / 2,
        camera.projectionMatrix.elements[5] * height / 2,
      ];
      cameraAdapter.projection.focal = () => focal;
      hasCamera = true;
    },
    async renderSample() {
      const start = performance.now();
      const measure = timingMode !== 'none';
      recordFrame(measure);
      const cpuSubmitMs = performance.now() - start;
      await device.queue.onSubmittedWorkDone();
      const wallMs = performance.now() - start;
      assertHealthy();
      const gpu = timer ? await timer.read() : {
        prepMs: null, sortMs: null, drawMs: null, totalMs: null, passSumMs: null,
        passTimings: [], stageTimings: [], timestampWriteCount: 0,
      };
      let visibleSplats: number | null = null;
      if (measure) {
        await visibleReadBuffer.mapAsync(GPUMapMode.READ);
        visibleSplats = new Uint32Array(visibleReadBuffer.getMappedRange())[0];
        visibleReadBuffer.unmap();
      }
      return { gpu, cpuSubmitMs, wallMs, visibleSplats, gaussianCount: pointCloud!.numPoints, timingMode };
    },
    renderFrame() {
      const start = performance.now();
      recordFrame(false);
      return { cpuSubmitMs: performance.now() - start };
    },
    async waitIdle() { await device.queue.onSubmittedWorkDone(); assertHealthy(); },
    async dispose() {
      if (disposed) return;
      await device.queue.onSubmittedWorkDone().catch(() => {});
      disposed = true;
      context.unconfigure();
      device.destroy();
      pointCloud = null;
    },
  };
}
