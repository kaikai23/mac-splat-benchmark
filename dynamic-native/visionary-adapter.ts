import * as THREE from 'three';
import * as ort from 'onnxruntime-web/webgpu';
import { GaussianRenderer } from '../work/visionary/src/renderer/gaussian_renderer';
import { ONNXGenerator } from '../work/visionary/src/ONNX/onnx_generator';
import { DynamicPointCloud } from '../work/visionary/src/point_cloud/dynamic_point_cloud';
import { CameraAdapter } from '../work/visionary/src/camera/CameraAdapter';
import { applyCamera } from '../work/bench-visionary/camera';

const SOURCE_COMMIT = 'e50f3f6c7200be0516567f0830e5240dfa26d27d';
type CameraSpec = { position: number[]; rotation: number[][]; fx: number; fy: number; width: number; height: number };
type TimingMode = 'stages' | 'all-pass';
type Options = { width?: number; height?: number; kernelSize?: number; timingMode?: TimingMode; wasmPath?: string; allowGraphCaptureFallback?: boolean };
type Precision = { dataType: string; bytesPerElement: number; scale?: number; zeroPoint?: number };
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

/** Match the original preprocess early alpha return before covariance access, with opacityScale=1. */
function nativeFiniteStatus(values: number[]) {
  const positionOpacityFinite = values.slice(0, 4).every(Number.isFinite);
  const covarianceFinite = values.slice(4).every(Number.isFinite);
  const allFinite = positionOpacityFinite && covarianceFinite;
  const safelyOpacityCulled = positionOpacityFinite && values[3] < 0.02;
  return { positionOpacityFinite, covarianceFinite, allFinite, safelyOpacityCulled,
    renderableFieldsFinite: allFinite || safelyOpacityCulled };
}

/** Native ONNX updates: no PLY, time scaling, DynamicPointCloud.update, or algorithm modifications. */
export async function createVisionary(canvas: HTMLCanvasElement, options: Options = {}) {
  const width = options.width ?? 1280, height = options.height ?? 720;
  const kernelSize = options.kernelSize ?? 0.3, timingMode = options.timingMode ?? 'stages';
  if (![width, height].every(n => Number.isInteger(n) && n > 0) || !Number.isFinite(kernelSize) || kernelSize < 0
    || !['stages', 'all-pass'].includes(timingMode)) throw new Error('Invalid native dynamic options');
  if (!navigator.gpu) throw new Error('WebGPU unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter || (adapter as any).isFallbackAdapter === true) throw new Error('Native WebGPU adapter required');
  for (const f of ['shader-f16', 'timestamp-query'] as GPUFeatureName[]) if (!adapter.features.has(f)) throw new Error(`Required GPU feature: ${f}`);
  if ((ort.env as any).versions?.web !== '1.22.0') throw new Error('Locked ONNX Runtime Web 1.22.0 required');
  // ORT 1.22 always calls adapter.requestDevice during backend initialization;
  // assigning env.webgpu.device first would create a second device. Bootstrap
  // its backend with a tiny Identity graph, then share ORT's actual device.
  const bootstrapModel = new Uint8Array([8,8,18,33,118,105,115,105,111,110,97,114,121,45,110,97,116,105,118,101,45,100,101,118,105,99,101,45,98,111,111,116,115,116,114,97,112,58,77,10,16,10,1,120,18,1,121,34,8,73,100,101,110,116,105,116,121,18,23,119,101,98,103,112,117,45,100,101,118,105,99,101,45,98,111,111,116,115,116,114,97,112,90,15,10,1,120,18,10,10,8,8,1,18,4,10,2,8,1,98,15,10,1,121,18,10,10,8,8,1,18,4,10,2,8,1,66,4,10,0,16,13]);
  const bootstrap: any = {
    strategy: 'ORT Identity-session bootstrap owns the sole GPUDevice',
    modelSha256: 'b2a0840a7f7f7c55e648fa6f41dfca3df79a2dafc438d91058601c27c2a59fdc',
    modelDefinition: 'ONNX IR8/opset13 Identity, float32[1] x to float32[1] y; initialization only, no run',
    sessionsCreated: 0, sessionsReleased: 0, liveSessions: 0, requestDeviceCalls: 0,
    originalRequiredFeatures: null, requestedFeatures: null, originalRequiredLimits: null, requestedLimits: null,
    descriptorAdaptation: 'Preserve ORT descriptor; add basic timestamp-query and request adapter maxStorageBuffersPerShaderStage for native renderer',
    sameDevice: false,
  };
  const webgpuEnv = (ort.env as any).webgpu;
  if (webgpuEnv.device) throw new Error('Native experiment requires a fresh ORT context; an existing device cannot be silently reused');
  let createdDevice: GPUDevice | null = null;
  const ortAdapter = new Proxy(adapter, { get(target, key) {
    if (key === 'requestDevice') return async (descriptor: GPUDeviceDescriptor = {}) => {
      if (++bootstrap.requestDeviceCalls !== 1) throw new Error('ORT attempted multiple GPU device allocations');
      const features = [...new Set([...(descriptor.requiredFeatures ?? []), 'timestamp-query' as GPUFeatureName])];
      const limits = { ...descriptor.requiredLimits, maxStorageBuffersPerShaderStage: target.limits.maxStorageBuffersPerShaderStage };
      bootstrap.originalRequiredFeatures = [...(descriptor.requiredFeatures ?? [])];
      bootstrap.originalRequiredLimits = { ...descriptor.requiredLimits };
      bootstrap.requestedFeatures = features; bootstrap.requestedLimits = limits;
      createdDevice = await target.requestDevice({ ...descriptor, requiredFeatures: features, requiredLimits: limits });
      return createdDevice;
    };
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  webgpuEnv.adapter = ortAdapter;
  ort.env.wasm.wasmPaths = options.wasmPath ?? '/ort/';
  ort.env.wasm.numThreads = 1;
  let bootstrapSession: ort.InferenceSession | null = null;
  let device!: GPUDevice;
  try {
    bootstrapSession = await ort.InferenceSession.create(bootstrapModel, { executionProviders: ['webgpu'], enableGraphCapture: false });
    bootstrap.sessionsCreated++; bootstrap.liveSessions++;
    device = await webgpuEnv.device;
    if (!device || device !== createdDevice || webgpuEnv.adapter !== ortAdapter || bootstrap.requestDeviceCalls !== 1) {
      throw new Error('ORT bootstrap did not expose the sole requested GPU device');
    }
    for (const feature of ['shader-f16', 'timestamp-query'] as GPUFeatureName[]) {
      if (!device.features.has(feature)) throw new Error(`ORT device lacks required feature ${feature}`);
    }
    if (device.limits.maxStorageBuffersPerShaderStage !== adapter.limits.maxStorageBuffersPerShaderStage) throw new Error('ORT device lacks native renderer storage bindings');
    bootstrap.sameDevice = true;
    await bootstrapSession.release(); bootstrapSession = null;
    bootstrap.sessionsReleased++; bootstrap.liveSessions--;
  } catch (error) {
    if (bootstrapSession) { try { await bootstrapSession.release(); } catch {} }
    (createdDevice as GPUDevice | null)?.destroy();
    throw error;
  }
  const errors: string[] = [];
  let disposed = false, disposing = false, failed = false, loaded = false, hasCamera = false;
  let operation: string | null = null, active: Promise<unknown> | null = null, disposePromise: Promise<void> | null = null;
  let generator: ONNXGenerator | null = null, pointCloud: DynamicPointCloud | null = null, renderer: GaussianRenderer | null = null;
  let bound: GPUBuffer[] = [], derived: GPUBuffer[] = [], pendingDerived: GPUBuffer[] = [];
  let inferenceGeneration = 0, renderGeneration = 0, lastTime: number | null = null;
  const generatorBuffers = new Set<GPUBuffer>(), rendererBuffers = new Set<GPUBuffer>();
  const ids = new WeakMap<GPUBuffer, number>(); let nextId = 1;
  const bufferId = (b: GPUBuffer) => { if (!ids.has(b)) ids.set(b, nextId++); return ids.get(b)!; };
  const lifecycle = {
    loadAttempts: 0, loadsCompleted: 0, inferenceAttempts: 0, inferenceCompleted: 0, renderedSamples: 0, inspectionCalls: 0,
    pointCloudsCreated: 0, pointCloudsDestroyed: 0, activePointClouds: 0,
    pointCloudBuffersCreated: 0, pointCloudBuffersDestroyed: 0, livePointCloudBuffers: 0,
    generatorBuffersCreated: 0, generatorBuffersDestroyed: 0, liveGeneratorBuffers: 0,
    generatorSessionsCreated: 0, generatorSessionsReleased: 0, liveGeneratorSessions: 0,
    outputBufferRebindings: 0, rendererBufferAllocations: 0, rendererBufferBytes: 0,
    rendererGlobalCapacity: 0, rendererSteadyStateBufferAllocations: null as number | null,
    rendererSteadyStateCapacity: null as number | null, strictCountReadbacks: 0,
    failed: false, disposed: false, cleanupErrors: [] as string[],
  };
  const info: any = adapter.info ?? {};
  const metadata: any = {
    engine: 'visionary', version: '1.0.1', sourceCommit: SOURCE_COMMIT,
    sourceUrl: 'https://github.com/Visionary-Laboratory/visionary',
    ortVersion: '1.22.0', ortExecutionProvidersRequested: ['webgpu'], ortDeviceShared: true, ortNodePlacementVerified: false,
    deviceBootstrap: bootstrap,
    ortProviderEvidence: 'Native session requests WebGPU EP with preallocated GPU outputs; per-node placement is not claimed',
    graphCaptureRequested: true, graphCaptureEnabled: null, graphCaptureFallbackObserved: false, initializationAlerts: [],
    graphCaptureFallbackAllowed: options.allowGraphCaptureFallback === true,
    width, height, kernelSize, timingMode, timestampSupported: true, timestampWriteCount: timingMode === 'stages' ? 6 : 34,
    timingMethod: 'WebGPU timestamp queries for original renderer passes; performance.now for native update completion',
    dynamicUpdateMode: 'official-ONNXGenerator-direct-generate', sourcePatches: [], algorithmModified: false,
    renderPath: 'ONNXGenerator.generate → shared DynamicPointCloud GPU buffers → fresh GaussianRenderer.prepareMulti/renderMulti',
    timeTransform: 'Math.fround(requested normalized time), no scaling/modulo/clamping',
    sampleWallDefinition: 'native generate including native count readback, strict count and buffer binding verification, fresh preprocess/sort/draw, GPU completion, timestamp/visible-count readback and validation',
    inferenceWallDefinition: 'await native ONNXGenerator.generate, including its count-buffer readback',
    renderCompletionDefinition: 'fresh renderer prepare/sort/draw through GPU completion, timestamp and visible-count readback; excludes inference and binding verification',
    gpuTotalDefinition: 'first renderer preprocess start through draw end; excludes inference/count readback',
    gpuSortDefinition: 'first radix-sort start through final radix-sort end including pass gaps',
    gpuInferenceTimingAvailable: false, screenPresentationMeasured: false,
    sortBits: 32, sortingImplementation: 'upstream four-round FP32-key WebGPU radix sort',
    lod: false, background: '#000000', nativeOpacityCull: 0.02, opacityScale: 1,
    contentFinitePolicy: 'XYZ/alpha must always be finite; covariance must be finite unless finite alpha<0.02 guarantees native early return before covariance access; all raw exceptions retained', 
    gaussianCount: 0, capacity: null, modelShDegree: null, shDegree: null, colorChannels: null, colorMode: null,
    gaussianPrecision: null, colorPrecision: null, modelUrl: null, currentInputUrl: null, assetGeneration: 0,
    inferenceGeneration: 0, renderGeneration: 0, onnxInputTime: null, loadMs: null, lastError: null, lifecycle,
    gpuAdapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description,
      backend: info.backend ?? null, driver: info.driver ?? null, type: info.type ?? null, isFallbackAdapter: (adapter as any).isFallbackAdapter ?? null },
    deviceLimits: { maxBufferSize: device.limits.maxBufferSize, maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize },
    resourceOwnership: 'Generator owns six IO buffers; DynamicPointCloud owns three derived buffers; renderer allocations separately tracked; ORT internals released by session/device',
  };
  device.addEventListener('uncapturederror', (event: any) => errors.push(String(event.error?.message ?? event.error)));
  device.lost.then(info => { if (!disposing && !disposed) errors.push(`Device lost: ${info.reason}: ${info.message}`); });
  function assertHealthy() {
    if (disposed || disposing || failed || errors.length) throw new Error(metadata.lastError ?? (errors.join('\n') || 'Native adapter unavailable'));
  }
  function exclusive<T>(name: string, action: () => Promise<T>): Promise<T> {
    assertHealthy(); if (operation) throw new Error(`Cannot ${name} during ${operation}`);
    operation = name;
    const task = Promise.resolve().then(action).catch(error => {
      failed = true; lifecycle.failed = true; metadata.lastError = error instanceof Error ? error.message : String(error); throw error;
    });
    active = task; return task.finally(() => { operation = null; active = null; });
  }
  // Track allocation while preserving native GPUBuffer identity. ORT gets the real device, never this proxy.
  function trackedDevice(owner: 'renderer' | 'derived'): GPUDevice {
    return new Proxy(device, { get(target, key) {
      if (key === 'createBuffer') return (d: GPUBufferDescriptor) => {
        const b = target.createBuffer(d);
        if (owner === 'renderer') { rendererBuffers.add(b); lifecycle.rendererBufferAllocations++; lifecycle.rendererBufferBytes += b.size; }
        else { pendingDerived.push(b); lifecycle.pointCloudBuffersCreated++; lifecycle.livePointCloudBuffers++; }
        return b;
      };
      const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v;
    } });
  }
  function retirePointCloud() {
    if (pointCloud) { pointCloud.dispose(); lifecycle.pointCloudsDestroyed++; lifecycle.activePointClouds = 0; pointCloud = null; }
    for (const b of [...derived, ...pendingDerived]) { b.destroy(); lifecycle.pointCloudBuffersDestroyed++; lifecycle.livePointCloudBuffers--; }
    derived = []; pendingDerived = [];
  }
  function observeGeneratorBuffers() {
    const io = (generator as any).io;
    const buffers = [generator!.getGaussianBuffer(), generator!.getSHBuffer(), generator!.getCountBuffer(), io.cameraMatrixBuf, io.projMatrixBuf, io.timeBuf];
    if (buffers.some(b => !b) || new Set(buffers).size !== 6) throw new Error('Expected six distinct native ONNX IO buffers');
    for (const b of buffers) if (!generatorBuffers.has(b)) { generatorBuffers.add(b); lifecycle.generatorBuffersCreated++; lifecycle.liveGeneratorBuffers++; }
    return buffers.slice(0, 3) as GPUBuffer[];
  }
  function precisionCode(p: Precision) { return ({ float32: 0, float16: 1, int8: 2, uint8: 3 } as Record<string, number>)[p.dataType]; }
  function validatePrecision(p: Precision) {
    const bytes = ({ float32: 4, float16: 2, int8: 1, uint8: 1 } as Record<string, number>)[p?.dataType];
    if (!bytes || p.bytesPerElement !== bytes) throw new Error('Unsupported/mismatched native output precision');
    if (bytes === 1 && (!Number.isFinite(p.scale) || !Number.isFinite(p.zeroPoint))) throw new Error('Quantized output requires explicit quantization metadata');
  }
  function bindCurrentBuffers() {
    const buffers = observeGeneratorBuffers();
    if (bound.length && buffers.every((b, i) => b === bound[i])) return;
    // Prior GPU work has completed before retiring buffers/rebuilding derived bindings.
    const retired = bound; retirePointCloud();
    pointCloud = new DynamicPointCloud(trackedDevice('derived'), buffers[0], buffers[1], metadata.capacity,
      buffers[2], metadata.colorChannels, { gaussian: metadata.gaussianPrecision, color: metadata.colorPrecision });
    lifecycle.pointCloudsCreated++; lifecycle.activePointClouds = 1;
    const expected = new Set([(pointCloud as any).splat2DBuffer, pointCloud.uniforms.buffer, pointCloud.modelParamsUniforms.buffer]);
    if (pendingDerived.length !== 3 || expected.size !== 3 || pendingDerived.some(b => !expected.has(b))) throw new Error('Unexpected DynamicPointCloud buffer ownership');
    derived = pendingDerived; pendingDerived = [];
    if (pointCloud.colorMode !== metadata.colorMode) throw new Error('DynamicPointCloud/ONNX color interpretation mismatch');
    pointCloud.setMaxShDeg(metadata.shDegree); pointCloud.setKernelSize(kernelSize);
    pointCloud.setGaussianScaling(1); pointCloud.setOpacityScale(1); pointCloud.setPrecisionForShader();
    bound = buffers; if (retired.length) lifecycle.outputBufferRebindings++;
    for (const b of retired) if (!buffers.includes(b)) { b.destroy(); generatorBuffers.delete(b); lifecycle.generatorBuffersDestroyed++; lifecycle.liveGeneratorBuffers--; }
  }
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('WebGPU canvas unavailable'); }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque', colorSpace: 'srgb' });
  const timer = new PassTimer(device, timingMode);
  const countRead = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const visibleRead = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000), cameraAdapter = new CameraAdapter();
  const identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  function identity() { return { assetGeneration: loaded ? 1 : 0, currentInputUrl: metadata.currentInputUrl,
    gaussianCount: metadata.gaussianCount, actualCount: metadata.gaussianCount, capacity: metadata.capacity, inferenceGeneration, renderGeneration,
    outputBufferIds: bound.map(bufferId), lifecycle: { ...lifecycle, cleanupErrors: [...lifecycle.cleanupErrors] } }; }
  async function checkSharedDevice() {
    if (generator?.getDevice() !== device || await webgpuEnv.device !== device || webgpuEnv.adapter !== ortAdapter
      || bootstrap.requestDeviceCalls !== 1) throw new Error('ONNX/renderer device mismatch');
    metadata.ortDeviceShared = true;
  }
  async function readCount() {
    const e = device.createCommandEncoder({ label: 'Strict native output count check' });
    e.copyBufferToBuffer(generator!.getCountBuffer(), 0, countRead, 0, 4); device.queue.submit([e.finish()]);
    await countRead.mapAsync(GPUMapMode.READ); let n: number;
    try { n = new Int32Array(countRead.getMappedRange())[0]; } finally { countRead.unmap(); }
    lifecycle.strictCountReadbacks++;
    if (!Number.isInteger(n) || n <= 0 || n > metadata.capacity) throw new Error(`Invalid output count ${n}/${metadata.capacity}`);
    return n;
  }
  async function infer(requestedTime: number) {
    if (!loaded || !generator) throw new Error('Load ONNX before inference');
    if (!Number.isFinite(requestedTime) || requestedTime < 0 || requestedTime > 1) throw new Error('Normalized time must be finite within [0,1]');
    if (!hasCamera && metadata.cameraDependentInputs) throw new Error('Camera-dependent model requires setCamera first');
    lifecycle.inferenceAttempts++;
    const inputTime = Math.fround(requestedTime), start = performance.now();
    await generator.generate({ time: inputTime,
      cameraMatrix: hasCamera ? new Float32Array(cameraAdapter.viewMatrix()) : identityMatrix.slice(),
      projectionMatrix: hasCamera ? new Float32Array(cameraAdapter.projMatrix()) : identityMatrix.slice() });
    const inferenceWallMs = performance.now() - start;
    await device.queue.onSubmittedWorkDone(); await checkSharedDevice();
    const count = await readCount(); assertHealthy();
    if (generator.getActualMaxPoints() !== metadata.capacity || generator.getDetectedColorDim() !== metadata.colorChannels
      || JSON.stringify(generator.getGaussianPrecision()) !== JSON.stringify(metadata.gaussianPrecision)
      || JSON.stringify(generator.getColorPrecision()) !== JSON.stringify(metadata.colorPrecision)) throw new Error('Native output shape/precision changed');
    bindCurrentBuffers(); metadata.gaussianCount = count; metadata.onnxInputTime = inputTime;
    inferenceGeneration++; lifecycle.inferenceCompleted++; metadata.inferenceGeneration = inferenceGeneration; lastTime = inputTime;
    return { requestedTime, onnxInputTime: inputTime, inferenceWallMs, inferenceAndBindingWallMs: performance.now() - start,
      generateCompleted: true, strictCountVerified: true };
  }
  function validateShaderPrecision() {
    const d = new DataView(pointCloud!.modelParamsUniforms.data);
    if (d.getUint32(96, true) !== precisionCode(metadata.gaussianPrecision) || d.getUint32(100, true) !== precisionCode(metadata.colorPrecision)) throw new Error('Shader precision uniforms disagree with ONNX output');
  }
  async function validationScope<T>(action: () => Promise<T>) {
    device.pushErrorScope('validation'); let result!: T, cause: unknown;
    try { result = await action(); } catch (e) { cause = e; }
    const error = await device.popErrorScope();
    if (cause) throw cause; if (error) throw new Error(`GPU validation: ${error.message}`);
    assertHealthy(); return result;
  }
  function decode(view: DataView, offset: number, p: Precision): number {
    if (p.dataType === 'float32') return view.getFloat32(offset, true);
    if (p.dataType === 'float16') {
      const h = view.getUint16(offset, true), s = h & 0x8000 ? -1 : 1, e = (h >>> 10) & 31, f = h & 1023;
      return e === 31 ? (f ? NaN : s * Infinity) : e === 0 ? s * 2 ** -14 * f / 1024 : s * 2 ** (e - 15) * (1 + f / 1024);
    }
    return ((p.dataType === 'int8' ? view.getInt8(offset) : view.getUint8(offset)) - p.zeroPoint!) * p.scale!;
  }
  async function hash(bytes: Uint8Array) {
    const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  }
  function base64(bytes: Uint8Array) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
  async function readRows(buffer: GPUBuffer, stride: number, rows: number[]): Promise<Uint8Array> {
    const slot = Math.ceil((stride + 3) / 4) * 4;
    const staging = device.createBuffer({ size: slot * rows.length, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const e = device.createCommandEncoder();
      for (let j = 0; j < rows.length; j++) {
        const off = rows[j] * stride, aligned = Math.floor(off / 4) * 4, length = Math.ceil((off - aligned + stride) / 4) * 4;
        if (aligned + length > buffer.size) throw new Error('Inspection row exceeds buffer');
        e.copyBufferToBuffer(buffer, aligned, staging, j * slot, length);
      }
      device.queue.submit([e.finish()]); await staging.mapAsync(GPUMapMode.READ);
      const mapped = new Uint8Array(staging.getMappedRange()), result = new Uint8Array(rows.length * stride);
      for (let j = 0; j < rows.length; j++) { const pad = rows[j] * stride % 4; result.set(mapped.subarray(j * slot + pad, j * slot + pad + stride), j * stride); }
      staging.unmap(); return result;
    } finally { staging.destroy(); }
  }
  return {
    metadata,
    load(modelUrl: string) {
      return exclusive('load', async () => {
        const start = performance.now(); lifecycle.loadAttempts++;
        if (loaded || generator) throw new Error('Native ONNX model must be loaded once per adapter');
        if (!modelUrl) throw new Error('Nonempty model URL required');
        await validationScope(async () => {
          // ORT's adapter/device properties are now read-only; reuse them unchanged.
          generator = new ONNXGenerator({ modelUrl, device, debugLogging: false });
          const originalAlert = globalThis.alert;
          globalThis.alert = (message?: any) => {
            metadata.initializationAlerts.push(String(message));
            if (/graph capture/i.test(String(message))) metadata.graphCaptureFallbackObserved = true;
            if (typeof originalAlert === 'function') originalAlert.call(globalThis, message);
          };
          try { await generator.initialize(device); } finally { globalThis.alert = originalAlert; }
          lifecycle.generatorSessionsCreated = 1; lifecycle.liveGeneratorSessions = 1;
          metadata.graphCaptureEnabled = !metadata.graphCaptureFallbackObserved;
          if (metadata.graphCaptureFallbackObserved && !options.allowGraphCaptureFallback) throw new Error('Graph-capture initialization fallback rejected by experiment policy');
          await checkSharedDevice();
          const inputNames = [...generator.getInputNames()], io = (generator as any).io;
          metadata.inputNames = inputNames; metadata.outputNames = [...io.session.outputNames]; metadata.outputMetadata = io.session.outputMetadata ?? null;
          if (!inputNames.length || !inputNames.some(n => /time/i.test(n) || n.toLowerCase() === 't')) throw new Error('Native dynamic model must expose time input');
          for (const n of inputNames) {
            const key = n.toLowerCase();
            if (!(key.includes('time') || key === 't' || /camera|view|matrix|projection|proj/.test(key))) throw new Error(`Unsupported native input: ${n}`);
            if (/proj/.test(key) && /camera|view|matrix/.test(key)) throw new Error(`Ambiguous native input classifier: ${n}`);
          }
          metadata.cameraDependentInputs = inputNames.some(n => !(/time/i.test(n) || n.toLowerCase() === 't'));
          metadata.capacity = generator.getActualMaxPoints(); metadata.colorChannels = generator.getDetectedColorDim(); metadata.colorMode = generator.getDetectedColorMode();
          metadata.gaussianPrecision = { ...generator.getGaussianPrecision() }; metadata.colorPrecision = { ...generator.getColorPrecision() };
          validatePrecision(metadata.gaussianPrecision); validatePrecision(metadata.colorPrecision);
          if (!Number.isInteger(metadata.capacity) || metadata.capacity <= 0) throw new Error('Invalid native capacity');
          const degree = ({ 3: 0, 12: 1, 27: 2, 48: 3 } as Record<number, number>)[metadata.colorChannels];
          if (metadata.colorMode !== 'sh' || degree === undefined) throw new Error('Unsupported native SH output; no implicit color conversion allowed');
          metadata.shDegree = degree; metadata.modelShDegree = degree;
          observeGeneratorBuffers(); bindCurrentBuffers(); validateShaderPrecision();
          renderer = new GaussianRenderer({ device: trackedDevice('renderer'), format, shDegree: degree, compressed: false, debug: false });
          await renderer.initialize(); await device.queue.onSubmittedWorkDone();
          metadata.modelUrl = modelUrl; metadata.currentInputUrl = modelUrl; loaded = true; metadata.assetGeneration = 1; lifecycle.loadsCompleted++;
        });
        metadata.loadMs = performance.now() - start;
        return { ...identity(), loadMs: metadata.loadMs, shDegree: metadata.shDegree, inputNames: metadata.inputNames, colorChannels: metadata.colorChannels };
      });
    },
    setCamera(spec: CameraSpec | THREE.PerspectiveCamera) {
      assertHealthy(); if (operation) throw new Error(`Cannot set camera during ${operation}`);
      if ('isPerspectiveCamera' in spec) camera.copy(spec); else applyCamera(camera, spec, width, height);
      if (![...camera.matrixWorldInverse.elements, ...camera.projectionMatrix.elements].every(Number.isFinite)) throw new Error('Nonfinite camera');
      const original = camera.updateProjectionMatrix; camera.updateProjectionMatrix = () => {};
      try { cameraAdapter.update(camera as any, [width, height]); } finally { camera.updateProjectionMatrix = original; }
      const focal: [number, number] = [camera.projectionMatrix.elements[0] * width / 2, camera.projectionMatrix.elements[5] * height / 2];
      cameraAdapter.projection.focal = () => focal; hasCamera = true;
      metadata.cameraMatrix = Array.from(cameraAdapter.viewMatrix()); metadata.projectionMatrix = Array.from(cameraAdapter.projMatrix());
    },
    renderSample(time: number) {
      return exclusive('sample', async () => {
        const start = performance.now();
        const result = await validationScope(async () => {
          if (!hasCamera || !renderer) throw new Error('Load model and set camera before rendering');
          const inference = await infer(time), renderStart = performance.now();
          const encoder = device.createCommandEncoder({ label: `Native dynamic renderer generation ${inferenceGeneration}` });
          const measured = timer.wrap(encoder);
          renderer.prepareMulti(measured, device.queue, [pointCloud!], { camera: cameraAdapter as any, viewport: [width, height],
            maxSHDegree: metadata.shDegree, showEnvMap: false, mipSplatting: false, kernelSize, walltime: 0 });
          validateShaderPrecision(); lifecycle.rendererGlobalCapacity = (renderer as any).globalCapacity;
          if (lifecycle.rendererSteadyStateCapacity === null) {
            lifecycle.rendererSteadyStateCapacity = lifecycle.rendererGlobalCapacity;
            lifecycle.rendererSteadyStateBufferAllocations = lifecycle.rendererBufferAllocations;
          } else if (lifecycle.rendererSteadyStateCapacity !== lifecycle.rendererGlobalCapacity
            || lifecycle.rendererSteadyStateBufferAllocations !== lifecycle.rendererBufferAllocations) throw new Error('Native renderer allocations grew after first fixed-capacity frame');
          const pass = measured.beginRenderPass({ label: 'Visionary native ONNX Gaussian draw', colorAttachments: [{
            view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
          renderer.renderMulti(pass, [pointCloud!]); pass.end(); timer.resolve(encoder);
          encoder.copyBufferToBuffer((renderer as any).drawIndirectBuffer, 4, visibleRead, 0, 4);
          device.queue.submit([encoder.finish()]); const cpuSubmitMs = performance.now() - renderStart;
          await device.queue.onSubmittedWorkDone(); const renderGpuCompleteWallMs = performance.now() - renderStart;
          const gpu = await timer.read();
          if (![gpu.prepMs, gpu.sortMs, gpu.drawMs, gpu.totalMs].every(v => v !== null && Number.isFinite(v) && v >= 0)) throw new Error('Invalid renderer GPU timestamps');
          await visibleRead.mapAsync(GPUMapMode.READ); let visibleSplats: number;
          try { visibleSplats = new Uint32Array(visibleRead.getMappedRange())[0]; } finally { visibleRead.unmap(); }
          if (visibleSplats > metadata.gaussianCount) throw new Error('Visible count exceeds current ONNX output count');
          renderGeneration++; metadata.renderGeneration = renderGeneration; lifecycle.renderedSamples++;
          return { ...inference, gpu, visibleSplats, cpuSubmitMs, renderGpuCompleteWallMs, renderCompletionMs: performance.now() - renderStart,
            sortGeneration: inferenceGeneration, freshSort: true, cameraMatrix: [...metadata.cameraMatrix], projectionMatrix: [...metadata.projectionMatrix] };
        });
        const wallMs = performance.now() - start;
        return { ...result, ...identity(), time, wallMs, e2eCompletionMs: wallMs, sampleStartMs: start, sampleEndMs: start + wallMs, timingMode };
      });
    },
    inspectContent(inspect: { time?: number; fullBounds?: boolean; sampleCount?: number; diagnosticNonfinite?: boolean } = {}) {
      return exclusive('inspect', async () => validationScope(async () => {
        lifecycle.inspectionCalls++;
        if (inspect.diagnosticNonfinite && !inspect.fullBounds) throw new Error('Nonfinite diagnostics require fullBounds and are not a measurement mode');
        if (inspect.time !== undefined || !inferenceGeneration) await infer(inspect.time ?? 0);
        if (!loaded || !bound.length) throw new Error('Load/infer model before inspection');
        await device.queue.onSubmittedWorkDone();
        const n = metadata.gaussianCount, gp: Precision = metadata.gaussianPrecision, cp: Precision = metadata.colorPrecision;
        const sampleCount = Math.min(n, inspect.sampleCount ?? 32);
        if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 4096) throw new Error('sampleCount must be an integer within [2,4096]');
        const rows = Array.from({ length: sampleCount }, (_, i) => Math.floor(i * (n - 1) / (sampleCount - 1)));
        const gbytes = await readRows(bound[0], 10 * gp.bytesPerElement, rows), cbytes = await readRows(bound[1], metadata.colorChannels * cp.bytesPerElement, rows);
        const gv = new DataView(gbytes.buffer), cv = new DataView(cbytes.buffer);
        const samples = rows.map((row, j) => ({ index: row,
          gaussian: Array.from({ length: 10 }, (_, k) => decode(gv, (j * 10 + k) * gp.bytesPerElement, gp)),
          color: Array.from({ length: metadata.colorChannels }, (_, k) => decode(cv, (j * metadata.colorChannels + k) * cp.bytesPerElement, cp)) }));
        if (!samples.every(s => [...s.gaussian, ...s.color].every(Number.isFinite))) throw new Error('Nonfinite native inspection samples');
        let bounds: any = null;
        if (inspect.fullBounds) {
          const length = Math.ceil(n * 10 * gp.bytesPerElement / 4) * 4;
          const staging = device.createBuffer({ size: length, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          try {
            const e = device.createCommandEncoder(); e.copyBufferToBuffer(bound[0], 0, staging, 0, length);
            device.queue.submit([e.finish()]); await staging.mapAsync(GPUMapMode.READ);
            const v = new DataView(staging.getMappedRange()), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
            const fieldMin = Array(10).fill(Infinity), fieldMax = Array(10).fill(-Infinity); let selected = 0;
            const fields = ['x','y','z','alpha','cov00','cov01','cov02','cov11','cov12','cov22'];
            const nonfiniteByField: Record<string, number> = Object.fromEntries(fields.map(name => [name, 0]));
            const nonfiniteExamples: any[] = []; let nonfiniteGaussianCount = 0, nonfiniteValueCount = 0;
            let nonfiniteCulledGaussianCount = 0, nonfiniteRenderableGaussianCount = 0;
            for (let i = 0; i < n; i++) {
              const values = Array.from({ length: 10 }, (_, k) => decode(v, (i * 10 + k) * gp.bytesPerElement, gp));
              const finiteStatus = nativeFiniteStatus(values);
              if (!finiteStatus.allFinite) {
                nonfiniteGaussianCount++;
                if (finiteStatus.safelyOpacityCulled) nonfiniteCulledGaussianCount++;
                else nonfiniteRenderableGaussianCount++;
                for (let k = 0; k < 10; k++) if (!Number.isFinite(values[k])) { nonfiniteByField[fields[k]]++; nonfiniteValueCount++; }
                const rowBytes = new Uint8Array(v.buffer, v.byteOffset + i * 10 * gp.bytesPerElement, 10 * gp.bytesPerElement);
                const detail = { row: i, actualCount: n, capacity: metadata.capacity, onnxInputTime: lastTime, precision: gp,
                  fields, values: values.map(String), nonfiniteFields: fields.filter((_, k) => !Number.isFinite(values[k])),
                  positionOpacityFinite: finiteStatus.positionOpacityFinite,
                  safelyOpacityCulled: finiteStatus.safelyOpacityCulled,
                  opacityPassesNativeCull: Number.isFinite(values[3]) && values[3] >= 0.02,
                  rawHex: Array.from(rowBytes, b => b.toString(16).padStart(2, '0')).join('') };
                // Preserve every exception for independent decoding. Do not sanitize or upload altered output.
                if (!finiteStatus.renderableFieldsFinite && !inspect.diagnosticNonfinite) throw new Error(`Unsafe nonfinite native Gaussian: ${JSON.stringify(detail)}`);
                nonfiniteExamples.push(detail);
              }
              for (let k = 0; k < 10; k++) if (Number.isFinite(values[k])) { fieldMin[k] = Math.min(fieldMin[k], values[k]); fieldMax[k] = Math.max(fieldMax[k], values[k]); }
              // Native WGSL uses opacity<0.02, so alpha==0.02 is included.
              // XYZ/alpha are validated even for culled points because position is accessed first.
              if (finiteStatus.positionOpacityFinite && values[3] >= 0.02) {
                selected++; for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], values[k]); max[k] = Math.max(max[k], values[k]); }
              }
            }
            if (!selected) throw new Error('No Gaussian passes native opacity threshold with finite position/alpha');
            bounds = { min, max, opacityThreshold: 0.02, selectedCount: selected, inspectedCount: n,
              allGaussianFieldsFinite: nonfiniteGaussianCount === 0,
              allRenderableGaussianFieldsFinite: nonfiniteRenderableGaussianCount === 0,
              nonfiniteCulledGaussianCount, nonfiniteRenderableGaussianCount,
              fieldNames: fields, fieldMin: fieldMin.map(v => Number.isFinite(v) ? v : null), fieldMax: fieldMax.map(v => Number.isFinite(v) ? v : null),
              diagnosticNonfiniteEnabled: inspect.diagnosticNonfinite === true,
              nonfiniteGaussianCount, nonfiniteValueCount, nonfiniteByField, nonfiniteExamples,
              definition: 'All active Gaussian means with finite XYZ/alpha and alpha>=0.02; excludes covariance footprint extent. Nonfinite covariance is allowed only for finite alpha<0.02, which natively returns before covariance access. All exceptions retained; diagnostic mode additionally records unsafe rows. GPU output unchanged' };
            staging.unmap();
          } finally { staging.destroy(); }
        }
        return { ...identity(), onnxInputTime: lastTime, outsideMeasuredSamples: true, fullBounds: bounds,
          sampleCount, rowIndices: rows, gaussianPrecision: gp, colorPrecision: cp, colorChannels: metadata.colorChannels,
          gaussianBytesBase64: base64(gbytes), colorBytesBase64: base64(cbytes), gaussianSha256: await hash(gbytes), colorSha256: await hash(cbytes), samples };
      }));
    },
    waitIdle() { return exclusive('wait', async () => { await device.queue.onSubmittedWorkDone(); assertHealthy(); }); },
    assertHealthy,
    getResourceStats() { return { ...lifecycle, cleanupErrors: [...lifecycle.cleanupErrors] }; },
    dispose(): Promise<void> {
      if (disposePromise) return disposePromise;
      disposing = true;
      disposePromise = (async () => {
        await active?.catch(() => {});
        const cleanup = async (action: () => any) => { try { await action(); } catch (e) { lifecycle.cleanupErrors.push(String(e)); } };
        await cleanup(() => device.queue.onSubmittedWorkDone());
        const session = (generator as any)?.io?.session;
        if (session) await cleanup(async () => { await session.release(); lifecycle.generatorSessionsReleased++; lifecycle.liveGeneratorSessions = 0; });
        await cleanup(() => retirePointCloud()); await cleanup(() => generator?.dispose());
        for (const b of generatorBuffers) await cleanup(() => { b.destroy(); lifecycle.generatorBuffersDestroyed++; lifecycle.liveGeneratorBuffers--; });
        generatorBuffers.clear(); bound = [];
        for (const b of rendererBuffers) await cleanup(() => b.destroy()); rendererBuffers.clear();
        for (const b of [countRead, visibleRead, timer.resolveBuffer, timer.readBuffer]) await cleanup(() => b.destroy());
        await cleanup(() => timer.querySet.destroy()); await cleanup(() => context.unconfigure()); await cleanup(() => device.destroy());
        if ((globalThis as any).gaussianRenderer === renderer) delete (globalThis as any).gaussianRenderer;
        disposed = true; lifecycle.disposed = true; metadata.disposed = true;
        if (lifecycle.cleanupErrors.length) throw new Error(`Native cleanup failed: ${lifecycle.cleanupErrors.join('; ')}`);
      })();
      return disposePromise;
    },
  };
}
