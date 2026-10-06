/** CPU lifecycle regression: execute official methods, with GPU work stubbed. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const bundle=fs.readFileSync(path.join(root,'dist/spark.module.js'),'utf8');
assert.equal(sha(bundle),'e2841904c3facdf2ab5177b13b4827cdc72118cb8b613673ca08d8e983c5bf9d');
const threeUrl=pathToFileURL(path.resolve(root,'../bench/node_modules/three/build/three.module.js')).href;
const imports=[...bundle.matchAll(/^import .+ from "three";$/gm)];assert.equal(imports.length,2);
const localBundle=bundle.replaceAll('from "three";',`from ${JSON.stringify(threeUrl)};`);
const {SparkRenderer,SparkViewpoint,SplatAccumulator}=await import('data:text/javascript;base64,'+Buffer.from(localBundle).toString('base64'));
const THREE=await import(threeUrl);

async function exercise(compensate,requestedFrames){
  const spark=Object.create(SparkRenderer.prototype);
  spark.active=new SplatAccumulator();spark.active.refCount=1;
  spark.freeAccumulators=[new SplatAccumulator()];spark.accumulatorCount=2;spark.autoViewpoints=[];
  spark.prepareViewpoint=()=>{};
  // Stub GPU generation only; use the official allocation/release methods.
  spark.updateInternal=()=>{
    if(!spark.canAllocAccumulator())return false;
    const next=spark.maybeAllocAccumulator();spark.releaseAccumulator(spark.active);spark.active=next;return true;
  };
  const view=new SparkViewpoint({spark,autoUpdate:false});
  // Stub depth readback/WASM work only; execute official updateDisplay ownership.
  view.sortUpdate=async({accumulator,viewToWorld})=>view.updateDisplay({accumulator,viewToWorld,ordering:new Uint32Array(1),activeSplats:1});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  let completedFrames=0,maximumAccumulatorCount=2;
  const trace=[];
  for(let i=0;i<requestedFrames;i++){
    // Avoid intentionally entering the original prepare() infinite retry loop.
    if(!spark.canAllocAccumulator())break;
    await view.prepare({scene,camera,update:true,forceOrigin:true});
    const prepared=view.display.accumulator;
    assert.equal(prepared,spark.active);assert.equal(prepared.refCount,3);
    if(compensate){spark.releaseAccumulator(prepared);assert.equal(prepared.refCount,2);}
    completedFrames++;maximumAccumulatorCount=Math.max(maximumAccumulatorCount,spark.accumulatorCount);
    if(i<6)trace.push({frame:i+1,activeRefCount:prepared.refCount,totalAccumulators:spark.accumulatorCount,freeAccumulators:spark.freeAccumulators.length,canGenerateNext:spark.canAllocAccumulator()});
  }
  return {compensate,requestedFrames,completedFrames,maximumAccumulatorCount,canGenerateNext:spark.canAllocAccumulator(),trace};
}
const native=await exercise(false,6),compensated=await exercise(true,256);
assert.equal(native.completedFrames,5);assert.equal(native.canGenerateNext,false);
assert.equal(compensated.completedFrames,256);assert.equal(compensated.maximumAccumulatorCount,2);assert.equal(compensated.canGenerateNext,true);
const adapter=fs.readFileSync(path.resolve(root,'../bench-spark/spark-adapter.ts'));
const receipt={schema:'spark-0.1.10-native-prepare-lifecycle-review-v1',passed:true,browserLaunched:false,gpuWorkPerformed:false,
  upstreamVersion:'0.1.10',upstreamCommit:'792d6d193db8b79ed4d1f32ef65cca9ec93f0896',upstreamBundleSha256:sha(bundle),scriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),adapterSha256:sha(adapter),
  native,compensated,
  executedOfficialMethods:['SparkViewpoint.prepare','SparkViewpoint.updateDisplay','SparkRenderer.canAllocAccumulator','SparkRenderer.maybeAllocAccumulator','SparkRenderer.releaseAccumulator'],
  stubs:['GPU generation replaced by native allocate/release sequence','sortUpdate depth readback and WASM replaced by direct native updateDisplay'],
  diagnosis:'prepare retains a temporary reference and updateDisplay independently retains its display reference; prepare does not release its borrow. One orphan reference remains per replaced accumulator.',
  adaptation:'After native prepare succeeds, require active===display and refCount===3, release the temporary reference once with native releaseAccumulator, require refCount===2.',
  algorithmChanges:false,upstreamSourceChanges:false,
  timingClarification:'orderingUploadWallMs is CPU attribute preparation; the native InstancedBufferAttribute upload happens in renderer.render, inside draw query command scope. Depth readback remains outside GPU stage queries.',
  limitation:'This is an ownership regression test with GPU work stubbed. Fresh target-Mac GPU pilot is still required.'};
const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||path.resolve(root,'../../results/setup/native-prepare-lifecycle-review.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({passed:true,nativeCompletedFrames:native.completedFrames,compensatedCompletedFrames:compensated.completedFrames,output}));
