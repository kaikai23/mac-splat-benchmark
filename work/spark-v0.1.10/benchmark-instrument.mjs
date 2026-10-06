import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const COMMIT='792d6d193db8b79ed4d1f32ef65cca9ec93f0896';
const sha=x=>createHash('sha256').update(x).digest('hex');
const upstream=fs.readFileSync(path.join(root,'dist/spark.module.js'),'utf8');
assert.equal(sha(upstream),'e2841904c3facdf2ab5177b13b4827cdc72118cb8b613673ca08d8e983c5bf9d');
const replaceOnce=(text,before,after)=>{assert.equal(text.split(before).length,2,`Expected one occurrence: ${before.slice(0,100)}`);return text.replace(before,after);};
const match=[...upstream.matchAll(/^const (jsContent(?:\$\d+)?) = (.+);$/gm)];assert.equal(match.length,1);
const workerOriginal=vm.runInNewContext(match[0][2],Object.create(null),{timeout:2000});
assert.ok(workerOriginal.includes('case "sort32Splats":')&&workerOriginal.includes('case "sortDoubleSplats":'));
let worker=workerOriginal;
for(const fn of ['sort_splats','sort32_splats']){
  const token=`activeSplats: ${fn}(numSplats, readback, ordering)`;
  assert.equal(worker.split(token).length,2);
  const at=worker.indexOf(token),start=worker.lastIndexOf('      result = {',at);
  assert.ok(start>0&&at-start<200);
  worker=worker.slice(0,start)+`      const benchmarkSortStarted = performance.now();\n      const benchmarkActiveSplats = ${fn}(numSplats, readback, ordering);\n      const benchmarkSortMs = performance.now() - benchmarkSortStarted;\n`+worker.slice(start);
  worker=replaceOnce(worker,token,'activeSplats: benchmarkActiveSplats,\n        benchmarkSortMs');
}
const start=upstream.indexOf('  async sortUpdate({'),end=upstream.indexOf('  updateDisplay({',start);
assert.ok(start>0&&end>start);const originalRegion=upstream.slice(start,end);let region=originalRegion;
region=replaceOnce(region,'    this.sortingCheck = true;','    this.sortingCheck = true;\n    const benchmarkStarted = performance.now();\n    let benchmarkTiming = null;');
region=replaceOnce(region,'      await reader.renderReadback({','      const benchmarkReadbackStarted = performance.now();\n      await reader.renderReadback({');
region=replaceOnce(region,'      const result = await withWorker(async (worker) => {','      const benchmarkReadbackMs = performance.now() - benchmarkReadbackStarted;\n      const benchmarkRpcStarted = performance.now();\n      const result = await withWorker(async (worker) => {');
region=replaceOnce(region,'      if (sort32) {\n        this.readback32 = result.readback;','      const benchmarkRpcMs = performance.now() - benchmarkRpcStarted;\n      benchmarkTiming = {cpuSortMs: result.benchmarkSortMs, metricReadbackWallMs: benchmarkReadbackMs, workerRoundtripMs: benchmarkRpcMs, sortBits: sort32 ? 32 : 16};\n      if (sort32) {\n        this.readback32 = result.readback;');
region=replaceOnce(region,'    this.updateDisplay({','    const benchmarkUploadStarted = performance.now();\n    this.updateDisplay({');
region=replaceOnce(region,'    this.sortingCheck = false;',`    this.benchmarkLastSort = {
      ...benchmarkTiming,
      orderingUploadWallMs: performance.now() - benchmarkUploadStarted,
      sortUpdateWallMs: performance.now() - benchmarkStarted,
      numSplats, sortedSplats: activeSplats,
      sequence: (this.benchmarkLastSort?.sequence ?? 0) + 1,
      completedAt: performance.now(),
      sortedViewOrigin: new THREE.Vector3().setFromMatrixPosition(viewToWorld).toArray(),
      sortedViewDirection: new THREE.Vector3(0, 0, -1).transformDirection(viewToWorld).toArray(),
      mappingVersion: accumulator.mappingVersion,
    };
    this.sortingCheck = false;`);
let bundle=replaceOnce(upstream,originalRegion,region);
bundle=replaceOnce(bundle,match[0][0],`const ${match[0][1]} = ${JSON.stringify(worker)};`);
const wasmHashes=t=>[...t.matchAll(/data:application\/wasm;base64,([A-Za-z0-9+/=]+)/g)].map(m=>sha(Buffer.from(m[1],'base64')));
assert.deepEqual(wasmHashes(bundle),wasmHashes(upstream));assert.equal(wasmHashes(bundle).length,2);
assert.equal(replaceOnce(replaceOnce(bundle,region,originalRegion),`const ${match[0][1]} = ${JSON.stringify(worker)};`,match[0][0]),upstream);
function save(name,text){const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);}
save('dist/spark.benchmark.js',bundle);
// Compact readable patches omit the unchanged embedded WASM payload.
const workerRegion=t=>t.slice(t.indexOf('case "sortDoubleSplats":'),t.indexOf('case "transcodeSpz":'));
assert.ok(workerRegion(workerOriginal).length>100&&workerRegion(worker).includes('benchmarkSortMs'));
save('source-before/worker-sort-region.js',workerRegion(workerOriginal));save('source-after/worker-sort-region.js',workerRegion(worker));
save('source-before/viewpoint-sort-update.js',originalRegion);save('source-after/viewpoint-sort-update.js',region);
let patch='';for(const name of ['worker-sort-region.js','viewpoint-sort-update.js']){try{patch+=execFileSync('git',['diff','--no-index','--no-ext-diff','--',`source-before/${name}`,`source-after/${name}`],{cwd:root,encoding:'utf8'});}catch(e){if(e.status!==1)throw e;patch+=e.stdout;}}
save('benchmark.patch',patch);
const provenance={schema:'spark-0.1.10-native-timing-v1',repository:'https://github.com/sparkjsdev/spark',tag:'v0.1.10',version:'0.1.10',commit:COMMIT,
  modificationId:'spark-0.1.10-timers-v1',upstreamBundleSha256:sha(upstream),instrumentedBundleSha256:sha(bundle),
  upstreamWorkerSha256:sha(workerOriginal),instrumentedWorkerSha256:sha(worker),embeddedWasmSha256:wasmHashes(bundle),embeddedWasmUnchanged:true,
  sourcePatch:'benchmark.patch',sourcePatchSha256:sha(patch),buildScriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  inverseSourceEditsVerified:true,originalSourceModified:false,metadataLocation:'SparkRenderer.defaultView.benchmarkLastSort',
  nativeSortPaths:{sort32_true:'SparkViewpoint -> sort32Splats Worker RPC -> official sort32_splats WASM',sort32_false:'SparkViewpoint -> sortDoubleSplats Worker RPC -> official sort_splats WASM'},
  defaultCaveat:'The source API comment says default true, but runtime fallback is this.sort32 ?? false. The selected experiment must record its actual option and resulting native path.',
  cpuSortTimer:'performance.now around original WASM sort call including native JS/WASM copying; excludes GPU depth-key pass/readback and Worker RPC',
  metricReadbackWallTimer:'Wall time of original separate GPU depth-key pass plus async readback; not a separate CPU sort cost',
  orderingUploadWallTimer:'CPU wall for updateDisplay ordering InstancedBufferAttribute update; actual upload is submitted in the subsequent renderer.render draw scope; no separate GPU upload execution-time claim',
  changes:'Timing and diagnostic fields only; official JS renderer, source files and embedded WASM remain unchanged except separately generated benchmark bundle.'};
save('benchmark-provenance.json',JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({built:true,version:provenance.version,sha256:provenance.instrumentedBundleSha256,embeddedWasmUnchanged:true}));
