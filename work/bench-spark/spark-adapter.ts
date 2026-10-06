import * as THREE from 'three';
import {SparkRenderer,SplatMesh,SplatAccumulator,Readback} from '../spark-v0.1.10/dist/spark.benchmark.js';
import {applyCamera} from './camera';

type CameraSpec={position:number[];rotation:number[][];fx:number;fy:number;width:number;height:number};
type Options={width?:number;height?:number;sortRadial?:boolean;sort32?:boolean};
type Query={label:'prep'|'metric'|'draw';query:WebGLQuery};
const SOURCE_COMMIT='792d6d193db8b79ed4d1f32ef65cca9ec93f0896';
const delay=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

/** Native Spark0.1.10. Only timing fields are added to its official bundle. */
export async function createSpark(canvas:HTMLCanvasElement,options:Options={}){
  const width=options.width??1280,height=options.height??720;
  // The selected three-method protocol uses the actual upstream runtime default.
  if(options.sort32===true)throw new Error('This protocol requires native Spark0.1.10 default sort32=false');
  const sort32=false,sortRadial=options.sortRadial??false;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.setClearColor(0x000000,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  const gl=renderer.getContext() as WebGL2RenderingContext;
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)throw new Error('Spark requires EXT_disjoint_timer_query_webgl2');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
  const camera=new THREE.PerspectiveCamera(60,width/height,.01,10000);
  const spark:any=new SparkRenderer({renderer,autoUpdate:false,preUpdate:false,
    preBlurAmount:.3,blurAmount:0,maxStdDev:Math.sqrt(8),minPixelRadius:0,maxPixelRadius:512,
    minAlpha:.5/255,clipXY:1.4,focalAdjustment:1,
    view:{sort32,sortRadial,depthBias:1,sort360:false,stochastic:false}});
  scene.add(spark);const view:any=spark.defaultView;view.setAutoUpdate(false);
  let mesh:any=null,disposed=false,sampleInProgress=false,collecting=false,queryActive=false,asyncMode=false;
  let queries:Query[]=[];
  const metadata:Record<string,any>={engine:'spark',method:'spark',version:'0.1.10',sourceCommit:SOURCE_COMMIT,
    sourceUrl:'https://github.com/sparkjsdev/spark',modificationId:'spark-0.1.10-timers-v1',modified:true,
    modificationScope:'Timing and diagnostics plus adapter compensation of upstream synchronous prepare temporary-reference leak; native renderer/packing/sorting algorithms and WASM unchanged',
    backend:'WebGL2',threeRevision:THREE.REVISION,width,height,pixelRatio:1,background:'#000000',maxShDegree:3,
    lod:false,fullAsset:true,lodSupport:'No LoD subsystem in pinned Spark0.1.10; no2.1-only LoD option is claimed',
    sortRadial,sortBits:sort32?32:16,sort32,depthBias:1,sort360:false,stochastic:false,
    sortingImplementation:sort32?'upstream CPU WASM32 two-pass radix sort, base2^16':'upstream CPU WASM16 descending bucket sort',
    nativeSortOption:'SparkRenderer({view:{sort32}}); upstream runtime default false despite stale default-true API comment',
    gpuDepthKeyBits:sort32?32:16,depthReadbackBitsPerSplat:sort32?32:16,
    keyEncoding:sort32?'upstream floatBitsToUint depth keys':'upstream packHalf2x16, two native FP16 keys per RGBA8 word; no custom saturation/compaction',
    workerSortTimer:'performance.now around original WASM call including JS/WASM array access/copy; excludes GPU metric/readback and Worker RPC',
    gpuTimer:'EXT_disjoint_timer_query_webgl2; disjoint samples rejected',gpuMetricMode:'separate-pass',
    gpuPrepBoundary:'SplatAccumulator.generateSplats synchronous generation commands',
    gpuMetricBoundary:'Readback.process synchronous standalone depth-key draw; asynchronous readback excluded from GPU query',
    gpuExcludedTransfers:'Depth-buffer readback is outside GPU stage queries and retained in completion wall time; native ordering InstancedBufferAttribute upload is submitted within the draw query scope, not timed separately',
    orderingUploadWallDefinition:'Legacy field name: CPU updateDisplay/ordering attribute update, not measured GPU upload; actual attribute upload occurs in renderer.render draw scope',
    prepareLifecycleAdaptation:'After native synchronous prepare, release its unreleased temporary accumulator reference exactly once; require active/display identity and refCount 3 -> 2 (active plus display)',
    syncProtocol:'force fresh native generation and current-camera SparkViewpoint.prepare({update:true,forceOrigin:true}); await native WASM sort; draw; gl.finish; await GPU timer query availability',
    asyncProtocol:'native SparkRenderer.autoUpdate=true, preUpdate=false and defaultView.autoUpdate=true',
    preUpdate:false,maxStdDev:Math.sqrt(8),minAlpha:.5/255,minPixelRadius:0,maxPixelRadius:512,clipXY:1.4,
    preBlurAmount:.3,blurAmount:0,antialias:false,preserveDrawingBuffer:false,
    nativeEncoding:'upstream PackedSplats and quantized SH; same PLY does not imply identical internal precision or visibility',
    renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};

  function assertReady(){if(disposed||!mesh)throw new Error('Spark adapter disposed or model not loaded');if(gl.isContextLost())throw new Error('Spark WebGL context lost');}
  function timed<T>(label:Query['label'],callback:()=>T):T{
    if(!collecting)return callback();if(queryActive)throw new Error('Nested GPU query: '+label);
    const query=gl.createQuery();if(!query)throw new Error('GPU query allocation failed');
    queries.push({label,query});queryActive=true;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    try{return callback();}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);queryActive=false;}
  }
  const accumulatorPrototype:any=SplatAccumulator.prototype,originalGenerate=accumulatorPrototype.generateSplats;
  const generateHook=function(this:any,args:any){return args.renderer===renderer?timed('prep',()=>originalGenerate.call(this,args)):originalGenerate.call(this,args);};
  accumulatorPrototype.generateSplats=generateHook;
  const readbackPrototype:any=Readback.prototype,originalProcess=readbackPrototype.process;
  const processHook=function(this:any,args:any){return this.renderer===renderer?timed('metric',()=>originalProcess.call(this,args)):originalProcess.call(this,args);};
  readbackPrototype.process=processHook;

  async function readQueries(){
    const deadline=performance.now()+10000,values={prep:0,metric:0,draw:0};
    for(;;){
      if(gl.isContextLost()||gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('Invalid/disjoint GPU query');
      if(queries.every(q=>gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE)))break;
      if(performance.now()>deadline)throw new Error('GPU query readiness timeout');await delay();
    }
    for(const q of queries){const ms=gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6;if(!Number.isFinite(ms)||ms<0)throw new Error('Nonfinite GPU timer');values[q.label]+=ms;gl.deleteQuery(q.query);}
    queries=[];if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('GPU disjoint after query retrieval');return values;
  }
  async function waitIdle(){
    const deadline=performance.now()+15000;
    while(spark.pendingUpdate.timeoutId!==-1||view.sorting||view.pending||view.sortingCheck){if(performance.now()>deadline)throw new Error('Native Spark0.1.10 idle timeout');await delay();}
    gl.finish();
  }
  async function enterSynchronousMode(){
    if(!asyncMode)return;spark.autoUpdate=false;view.setAutoUpdate(false);
    if(spark.pendingUpdate.timeoutId!==-1){clearTimeout(spark.pendingUpdate.timeoutId);spark.pendingUpdate.timeoutId=-1;spark.pendingUpdate.scene=null;}
    await waitIdle();asyncMode=false;
  }
  return {
    metadata,
    async load(url:string){
      if(disposed||mesh)throw new Error('Each configuration requires a fresh Spark adapter');
      const started=performance.now();mesh=new SplatMesh({url,editable:false});scene.add(mesh);await mesh.initialized;
      mesh.maxSh=3;mesh.updateGenerator();scene.updateMatrixWorld(true);
      const extra=mesh.packedSplats.extra,shDegreesAvailable=extra.sh3?3:extra.sh2?2:extra.sh1?1:0;
      if(shDegreesAvailable!==3)throw new Error('SH3 source data required');
      Object.assign(metadata,{numSplats:mesh.numSplats,shDegreesAvailable,assetUrl:url,loadWallMs:performance.now()-started});
      return {numSplats:mesh.numSplats,loadWallMs:metadata.loadWallMs,shDegreesAvailable};
    },
    setCamera(spec:CameraSpec|THREE.PerspectiveCamera){
      if(sampleInProgress)throw new Error('Camera changed during sample');
      if(spec instanceof THREE.PerspectiveCamera)camera.copy(spec,false);else applyCamera(camera,spec,width,height);camera.updateMatrixWorld(true);
    },
    async renderSample(){
      assertReady();if(sampleInProgress)throw new Error('Overlapping Spark samples');await enterSynchronousMode();
      const sequenceBefore=view.benchmarkLastSort?.sequence??0;
      if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('GPU disjoint before sample');
      sampleInProgress=true;collecting=true;queries=[];const started=performance.now();
      try{
        scene.updateMatrixWorld(true);spark.needsUpdate=true;
        await view.prepare({scene,camera,update:true,forceOrigin:true});
        // Upstream 0.1.10 prepare() borrows a reference before sortUpdate, which
        // independently retains the displayed accumulator, but never releases
        // its temporary borrow. Balance only that borrow, preserving both owners.
        const preparedAccumulator=view.display?.accumulator;
        if(preparedAccumulator!==spark.active||preparedAccumulator?.refCount!==3)throw new Error('Unexpected native prepare accumulator ownership');
        spark.releaseAccumulator(preparedAccumulator);
        if(preparedAccumulator.refCount!==2)throw new Error('Native prepare temporary-reference compensation failed');
        const m=view.benchmarkLastSort;
        if(!m||m.sequence!==sequenceBefore+1||!Number.isFinite(m.cpuSortMs)||m.sortBits!==(sort32?32:16)||m.numSplats!==mesh.numSplats)throw new Error('Fresh native sort/full-asset contract failed');
        const origin=camera.getWorldPosition(new THREE.Vector3()).toArray(),direction=camera.getWorldDirection(new THREE.Vector3()).toArray();
        for(const [a,b] of [[m.sortedViewOrigin,origin],[m.sortedViewDirection,direction]])if(!Array.isArray(a)||a.length!==3||a.some((v:number,i:number)=>!Number.isFinite(v)||Math.abs(v-b[i])>1e-6))throw new Error('Sort camera differs from current camera');
        if(queries.filter(q=>q.label==='prep').length!==1||queries.filter(q=>q.label==='metric').length!==1)throw new Error('Expected one fresh prep and one standalone depth-key pass');
        timed('draw',()=>renderer.render(scene,camera));gl.finish();const viewCompleteWallMs=performance.now()-started;
        collecting=false;const gpu=await readQueries(),gpuTotalMs=gpu.prep+gpu.metric+gpu.draw;
        return {gpuPrepMs:gpu.prep,gpuSortMetricMs:gpu.metric,gpuDrawMs:gpu.draw,gpuTotalMs,
          cpuSortMs:m.cpuSortMs,metricReadbackWallMs:m.metricReadbackWallMs,workerRoundtripMs:m.workerRoundtripMs,
          workerOverheadMs:m.workerRoundtripMs-m.cpuSortMs,sortUpdateWallMs:m.sortUpdateWallMs,
          stageCostSumMs:gpuTotalMs+m.cpuSortMs,viewCompleteWallMs,
          numSplats:m.numSplats,sortedSplats:m.sortedSplats,sortSequence:m.sequence,sortBits:m.sortBits,
          sortedViewOrigin:m.sortedViewOrigin,sortedViewDirection:m.sortedViewDirection,orderingUploadWallMs:m.orderingUploadWallMs,
          prepareLifecycleCompensated:true,prepareAccumulatorRefCount:preparedAccumulator.refCount,accumulatorCount:spark.accumulatorCount,
          gpuQueryCounts:{prep:1,metric:1,draw:1}};
      }finally{collecting=false;sampleInProgress=false;for(const q of queries)gl.deleteQuery(q.query);queries=[];}
    },
    renderFrame(){
      assertReady();if(sampleInProgress)throw new Error('Async frame overlaps sample');
      if(!asyncMode){spark.autoUpdate=true;spark.preUpdate=false;view.setAutoUpdate(true);asyncMode=true;}
      const started=performance.now();renderer.render(scene,camera);return {submissionWallMs:performance.now()-started,sortSequence:view.benchmarkLastSort?.sequence??0};
    },
    waitIdle,
    async dispose(){
      if(disposed)return;await enterSynchronousMode();disposed=true;
      if(accumulatorPrototype.generateSplats===generateHook)accumulatorPrototype.generateSplats=originalGenerate;
      if(readbackPrototype.process===processHook)readbackPrototype.process=originalProcess;
      view.dispose();mesh?.dispose();renderer.dispose();renderer.forceContextLoss();
    },
  };
}
