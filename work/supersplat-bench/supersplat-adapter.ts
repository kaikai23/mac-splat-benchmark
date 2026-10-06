import {
  ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8, PIXELFORMAT_DEPTH,
  TONEMAP_LINEAR, Color, Entity, Mat4, Quat, RenderTarget, Texture, Vec3,
  createGraphicsDevice, version as playcanvasVersion,
} from 'playcanvas';
import { PCApp } from '../supersplat-v2.1/src/pc-app';
import { AssetLoader } from '../supersplat-v2.1/src/asset-loader';
import { DataProcessor } from '../supersplat-v2.1/src/data-processor';
import { Events } from '../supersplat-v2.1/src/events';
import type { Splat } from '../supersplat-v2.1/src/splat';

type CameraSpec = { position: number[]; rotation: number[][]; fx: number; fy: number; width: number; height: number };
type Options = { width?: number; height?: number };
const EDITOR_COMMIT = '2f23b4b2072da694172faa26ff44fc67f2a01ca2';
const ENGINE_COMMIT = '362a874c7149ee181ba68f4cc270fc7b664d7f0b';
const delay = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Controlled stage benchmark host for the actual Editor Splat/AssetLoader classes.
 * The editor UI is not a benchmark participant. renderSample forces a fresh sort;
 * renderFrame retains the upstream asynchronous sorter scheduling.
 */
export async function createSuperSplat(canvas: HTMLCanvasElement, options: Options = {}) {
  const width = options.width ?? 1280, height = options.height ?? 720;
  canvas.width = width; canvas.height = height;
  const device: any = await createGraphicsDevice(canvas, {
    deviceTypes: ['webgl2'], antialias: false, depth: false, stencil: false,
    xrCompatible: false, powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  device.maxPixelRatio = 1;
  device.resizeCanvas(width, height);
  const gl = device.gl as WebGL2RenderingContext;
  // The external stage queries must not nest with PlayCanvas's optional profiler.
  device.gpuProfiler.enabled = false;
  const ext: any = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) throw new Error('SuperSplat stage benchmark requires EXT_disjoint_timer_query_webgl2');
  if (playcanvasVersion !== '2.5.1') throw new Error(`Expected pinned PlayCanvas 2.5.1, got ${playcanvasVersion}`);
  const app: any = new PCApp(canvas, { graphicsDevice: device });
  app.autoRender = false;
  app._allowResize = false;
  app.scene.clusteredLightingEnabled = false;
  app.off('prerender', app._firstBake, app);
  app.scene.exposure = 1;
  // Do not call app.start(): the shared benchmark owns the render loop.
  app.systems.fire('initialize', app.root);
  app.systems.fire('postInitialize', app.root);
  app.systems.fire('postPostInitialize', app.root);

  const events = new Events();
  for (const [name, value] of Object.entries({
    'view.bands': 3, selection: null, 'camera.mode': 'centers', 'camera.overlay': false,
    'view.outlineSelection': false, 'camera.bound': false,
    selectedClr: new Color(1, 1, 0, 1), unselectedClr: new Color(0, 0, 1, 0.5),
    lockedClr: new Color(0, 0, 0, 0.05),
  })) events.function(name, () => value);
  const contentRoot = new Entity('Benchmark content');
  app.root.addChild(contentRoot);
  const dataProcessor = new DataProcessor(device);
  // Splat.add/onPreRender are used unmodified; no editor picking/selection draws.
  const editorScene: any = {
    app, graphicsDevice: device, contentRoot, events, dataProcessor,
    forceRender: false, boundDirty: false,
    remove(element: any) { element.remove(); element.scene = null; },
  };
  const loader = new AssetLoader(device, app.assets, events);
  const cameraEntity = new Entity('Benchmark camera');
  cameraEntity.addComponent('camera', {
    clearColor: new Color(0, 0, 0, 0), nearClip: 0.01, farClip: 1000,
    toneMapping: TONEMAP_LINEAR, horizontalFov: false,
  });
  app.root.addChild(cameraEntity);
  const texture = (name: string, format: number) => new Texture(device, {
    name, width, height, format, mipmaps: false,
    minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST,
    addressU: ADDRESS_CLAMP_TO_EDGE, addressV: ADDRESS_CLAMP_TO_EDGE,
  });
  // Editor camera.ts uses these RGBA8/depth attachments and an explicit final blit.
  const target = new RenderTarget({
    colorBuffer: texture('cameraColor', PIXELFORMAT_RGBA8),
    depthBuffer: texture('cameraDepth', PIXELFORMAT_DEPTH), flipY: false, autoResolve: false,
  });
  cameraEntity.camera!.renderTarget = target;
  let splat: Splat | null = null;
  let disposed = false, busy = false, requestId = 0;
  let cameraSet = false;
  const position = new Vec3(), direction = new Vec3(), inverseModel = new Mat4();
  const projection = new Mat4();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');

  const metadata: Record<string, any> = {
    engine: 'supersplat', product: 'SuperSplat Editor', version: '2.1.0', sourceCommit: EDITOR_COMMIT,
    engineLibrary: 'PlayCanvas', engineVersion: playcanvasVersion, engineSourceCommit: ENGINE_COMMIT,
    backend: 'WebGL2', width, height, pixelRatio: 1, background: '#000000', maxShDegree: 3,
    lod: false, fullAsset: true, antialias: false, preserveDrawingBuffer: false,
    editorUI: false, editorMaterial: true, editorStateAndTransformTextures: true,
    editorOverlay: false, editorRings: false, assetMortonReorder: true, assetDecompress: true,
    modelCoordinateAdaptation: 'Reset the loader entity Z rotation from 180 degrees to identity; original PLY coordinates and Graphdeco camera then agree',
    nativeProjectionFootprint: 'Camera centers use the shared independent fx/fy projection, but the original PlayCanvas covariance Jacobian uses one focal value viewport.x*projection[0][0] for both axes; unequal effective fx/fy can change Gaussian footprints',
    nativeRasterRules: 'Original +0.3 covariance blur, lambda2 floor 0.1, native axis-radius cap, both-axis below-2-pixel rejection and original Editor alpha/support rules retained',
    gpuProfilerEnabled: false,
    sortingImplementation: 'PlayCanvas 2.5.1 native JavaScript Worker counting/bucket sort; adaptive 10–20 bit integer keys',
    sortRadial: false, sortBits: 'adaptive: clamp(round(log2(N/4)),10,20)',
    gpuPrepMode: 'fused-into-draw', gpuMetricMode: 'CPU key generation; no GPU depth readback',
    cpuPrepBoundary: 'Worker bounds projection, buffer allocation/clear, depth quantization and fused histogram',
    cpuSortBoundary: 'Worker histogram prefix sum and order scatter',
    cpuPostprocessBoundary: 'Worker front-camera count search and optional mapping',
    gpuDrawBoundary: 'app.render: deferred order texture upload, framebuffer clear, original Editor projection/SH/covariance/rasterization',
    gpuBlitBoundary: 'Editor RGBA8 offscreen target copy to canvas; included in gpuTotalMs and stageCostSumMs',
    gpuTimer: 'EXT_disjoint_timer_query_webgl2; disjoint samples rejected',
    syncProtocol: 'Explicit fresh current-view Worker request; await order installed; draw; output blit; gl.finish',
    wallBoundary: 'wallMs/viewCompleteWallMs end at gl.finish return, before query polling; synchronous call wall, not guaranteed physical GPU completion or display latency',
    queryReadyWallBoundary: 'queryReadyWallMs ends after awaited GPU query results; includes polling/scheduling overhead and is not display latency',
    asyncProtocol: 'Original GSplatInstance camera-change scheduling and Worker reuse; no per-frame sort await',
    measuredStageSum: 'cpuPrepMs + cpuSortMs + cpuPostprocessMs + gpuDrawMs + gpuBlitMs',
    excludedFromStageSum: 'Worker message transfer/dispatch and main-thread submission overhead; both remain in wallMs. Load, Morton reorder, static texture/SH conversion excluded after warmup',
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    validationEvidence: 'External source/worker/pilot receipts; this field does not claim a GPU pilot passed',
  };

  function assertReady() {
    if (disposed || !splat) throw new Error('SuperSplat adapter is not loaded');
    if (!cameraSet) throw new Error('Set the benchmark camera before rendering');
    if (gl.isContextLost()) throw new Error('SuperSplat WebGL context lost');
  }
  function localSortCamera() {
    const instance: any = splat!.entity.gsplat!.instance;
    const world = cameraEntity.getWorldTransform();
    world.getTranslation(position); world.getZ(direction);
    inverseModel.invert(instance.meshInstance.node.getWorldTransform());
    inverseModel.transformPoint(position, position);
    inverseModel.transformVector(direction, direction);
    return instance;
  }
  function prepareFrame() {
    // Original Splat getters update the native draw-call bound; loaded state is static.
    void splat!.worldBound;
    splat!.onPreRender();
    app.update(0);
    app.frameStart();
  }
  function drawAndBlit() {
    prepareFrame(); app.render();
    if (target.samples > 1) target.resolve(true, false);
    device.copyRenderTarget(target, null, true, false);
    app.frameEnd();
  }
  async function freshSort() {
    const instance = localSortCamera();
    const sorter = instance.sorter;
    if (!sorter.benchmarkInstrumentation) throw new Error('Use the isolated instrumented PlayCanvas module for stage samples');
    const id = ++requestId;
    // Prevent renderer.update from issuing an identical second sort after this completes.
    instance.lastCameraPosition.copy(position);
    instance.lastCameraDirection.copy(direction);
    instance.updateViewport();
    const expectedOrigin = [position.x, position.y, position.z];
    const expectedDirection = [direction.x, direction.y, direction.z];
    const start = performance.now();
    const result = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { sorter.off('updated', onUpdated); reject(new Error('SuperSplat sort timeout')); }, 120000);
      const onUpdated = () => {
        const value = sorter.benchmarkLastResult;
        if (value?.requestId !== id) return;
        clearTimeout(timer); sorter.off('updated', onUpdated); resolve(value);
      };
      sorter.on('updated', onUpdated);
      sorter.worker.postMessage({
        cameraPosition: { x: position.x, y: position.y, z: position.z },
        cameraDirection: { x: direction.x, y: direction.y, z: direction.z },
        benchmarkRequest: { requestId: id, force: true },
      });
    });
    for (const [actual, expected] of [[result.sourceOrigin, expectedOrigin], [result.sourceDirection, expectedDirection]]) {
      if (!actual || actual.some((v: number, i: number) => Math.abs(v - expected[i]) > 1e-6)) throw new Error('Sort source camera mismatch');
    }
    return { ...result, sortedViewOrigin: result.sourceOrigin, sortedViewDirection: result.sourceDirection,
      sortWallMs: performance.now() - start };
  }
  function query(callback: () => void) {
    const q = gl.createQuery();
    if (!q) throw new Error('Unable to allocate GPU timer query');
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    try { callback(); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); }
    return q;
  }
  async function readQueries(queries: WebGLQuery[]) {
    const deadline = performance.now() + 10000;
    try {
      while (!queries.every(q => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
        if (gl.isContextLost() || gl.getParameter(ext.GPU_DISJOINT_EXT)) throw new Error('Invalid SuperSplat GPU query');
        if (performance.now() > deadline) throw new Error('GPU timer read timeout');
        await delay();
      }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) throw new Error('GPU_DISJOINT_EXT');
      return queries.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    } finally { for (const q of queries) gl.deleteQuery(q); }
  }

  return {
    metadata,
    async load(url: string) {
      if (splat) throw new Error('Create a new adapter for another model');
      const start = performance.now();
      splat = await loader.loadPly({ url, filename: url.split('/').pop()!.split('?')[0] });
      splat.entity.setLocalEulerAngles(0, 0, 0);
      splat.scene = editorScene;
      splat.add();
      void splat.worldBound; // original Editor bound preprocessing, load-time only
      const instance: any = splat.entity.gsplat!.instance;
      if (instance.splat.shBands < 3) throw new Error(`Expected SH3 asset, got SH${instance.splat.shBands}`);
      metadata.numSplats = splat.splatData.numSplats;
      metadata.shBands = instance.splat.shBands;
      metadata.nativeOrderTextureFormat = 'R32UI';
      metadata.numDeleted = splat.numDeleted; metadata.numHidden = splat.numHidden;
      if (splat.numDeleted || splat.numHidden) throw new Error('Full-model benchmark asset contains editor deletion/hide state');
      metadata.loadMs = performance.now() - start;
      return { numSplats: metadata.numSplats, loadMs: metadata.loadMs, metadata };
    },
    setCamera(spec: CameraSpec | any) {
      if (busy) throw new Error('Do not mutate camera during renderSample');
      const world = new Mat4();
      if (spec.isPerspectiveCamera) {
        spec.updateMatrixWorld(true);
        world.set(spec.matrixWorld.elements); projection.set(spec.projectionMatrix.elements);
        cameraEntity.camera!.fov = spec.fov;
      } else {
        if (![spec.fx, spec.fy, spec.width, spec.height].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid intrinsics');
        const r = spec.rotation, p = spec.position;
        world.set([r[0][0], r[1][0], r[2][0], 0, -r[0][1], -r[1][1], -r[2][1], 0,
          -r[0][2], -r[1][2], -r[2][2], 0, p[0], p[1], p[2], 1]);
        const n = 0.01, f = 1000;
        projection.set([2 * spec.fx / spec.width, 0, 0, 0, 0, 2 * spec.fy / spec.height, 0, 0,
          0, 0, -(f + n) / (f - n), -1, 0, 0, -2 * f * n / (f - n), 0]);
        cameraEntity.camera!.fov = 2 * Math.atan(spec.height / (2 * spec.fy)) * 180 / Math.PI;
      }
      world.getTranslation(position);
      cameraEntity.setPosition(position);
      cameraEntity.setRotation(new Quat().setFromMat4(world));
      cameraEntity.camera!.calculateProjection = mat => mat.copy(projection);
      cameraSet = true;
    },
    async renderSample() {
      assertReady(); if (busy) throw new Error('Concurrent SuperSplat samples are unsupported');
      busy = true;
      try {
        const start = performance.now();
        const cpu = await freshSort();
        prepareFrame();
        const drawQuery = query(() => app.render());
        const blitQuery = query(() => {
          if (target.samples > 1) target.resolve(true, false);
          device.copyRenderTarget(target, null, true, false);
        });
        app.frameEnd();
        gl.finish();
        const wallMs = performance.now() - start;
        const [gpuDrawMs, gpuBlitMs] = await readQueries([drawQuery, blitQuery]);
        const queryReadyWallMs = performance.now() - start;
        const gpuTotalMs = gpuDrawMs + gpuBlitMs;
        const cpuWorkerComputeMs = cpu.cpuPrepMs + cpu.cpuSortMs + cpu.cpuPostprocessMs;
        return {
          ...cpu, gpuPrepMs: null, gpuSortMetricMs: 0, gpuSortMs: 0,
          gpuDrawMs, gpuBlitMs, gpuTotalMs, cpuWorkerComputeMs,
          stageCostSumMs: gpuTotalMs + cpuWorkerComputeMs, wallMs, viewCompleteWallMs: wallMs, queryReadyWallMs,
          visible: cpu.activeSplats, sortedSplats: cpu.sortedSplats,
          gpuPrepMode: 'fused-into-draw', gpuSortMetricMode: 'CPU',
        };
      } finally { busy = false; }
    },
    renderFrame() {
      assertReady(); const start = performance.now(); drawAndBlit();
      return { cpuSubmitMs: performance.now() - start,
        sortSequence: (splat!.entity.gsplat!.instance.sorter as any).benchmarkLastResult?.sortSequence ?? null };
    },
    // Auxiliary rAF intervals have ended before this deliberate final-view drain.
    async waitIdle() { assertReady(); await freshSort(); drawAndBlit(); gl.finish(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (splat) { splat.destroy(); splat = null; }
      target.destroyTextureBuffers(); target.destroy();
      app.destroy();
    },
  };
}
