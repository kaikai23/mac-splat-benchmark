import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import assert from 'node:assert/strict';
const root = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv.find(x => x.startsWith('--output='))?.slice(9);
if (!output) throw new Error('Mac validation requires explicit --output to preserve frozen reference receipts');
if (fs.existsSync(output)) throw new Error('Refusing to overwrite Mac validation receipt');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const files = {
  source: 'vendor/engine-source/gsplat-sorter.js',
  release: 'vendor/playcanvas/build/playcanvas/src/scene/gsplat/gsplat-sorter.js',
  measured: 'dist/gsplat-sorter.benchmark.js',
};
const scripts = Object.fromEntries(Object.entries(files).map(([key, file]) => {
  const text = fs.readFileSync(path.resolve(root, file), 'utf8');
  const worker = text.slice(text.indexOf('function SortWorker()'), text.indexOf('class GSplatSorter'));
  new vm.Script(worker);
  return [key, {text, worker}];
}));
function launch(code) {
  const worker = new Worker(`const {parentPort}=require('node:worker_threads');
    globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};
    ${code}; SortWorker(); parentPort.on('message',data=>self.onmessage({data}));`, {eval:true});
  function request(data) {
    return new Promise((resolve,reject) => {
      const timer = setTimeout(()=>reject(Error('Worker timed out')),10000);
      worker.once('message', message=>{clearTimeout(timer);resolve(message);});
      worker.once('error', error=>{clearTimeout(timer);reject(error);});
      const transfer = ['order','centers','mapping'].filter(k => data[k] instanceof ArrayBuffer).map(k => data[k]);
      worker.postMessage(data, transfer);
      for (const buffer of transfer) assert.equal(buffer.byteLength,0,'actual transfer must detach');
    });
  }
  return {worker,request};
}
let seed=0x12345;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}
const tests = [
  {name:'random-front',n:5003,pos:[1,2,3],dir:[0,0,1]},
  {name:'mixed-front-back',n:16384,pos:[0,0,0],dir:[0.3,0.4,0.8660254038]},
  {name:'equal-depth-ties',n:4097,pos:[0,0,0],dir:[0,0,1],equal:true},
  {name:'mapping',n:10007,pos:[0,0,0],dir:[1,0,0],mapping:true},
  {name:'larger-adaptive-buckets',n:131073,pos:[-2,1,4],dir:[0.5,-0.5,Math.SQRT1_2]},
];
const results=[];
for(const test of tests){
  const centers=new Float32Array(test.n*3);
  for(let i=0;i<test.n;i++){centers[i*3]=random()*20-10;centers[i*3+1]=random()*20-10;centers[i*3+2]=test.equal?-3:random()*20-10;}
  const mapping=test.mapping?Uint32Array.from({length:test.n},(_,i)=>test.n-1-i):null;
  const cameraPosition=Object.fromEntries(['x','y','z'].map((key,i)=>[key,test.pos[i]]));
  const cameraDirection=Object.fromEntries(['x','y','z'].map((key,i)=>[key,test.dir[i]]));
  const outputs={};
  for(const [key,{worker:code}] of Object.entries(scripts)){
    const {worker,request}=launch(code);
    try{
      const data={order:new Uint32Array(test.n+128).buffer,centers:centers.slice().buffer,cameraPosition,cameraDirection};
      if(mapping)data.mapping=mapping.slice().buffer;
      if(key==='measured')data.benchmarkRequest={requestId:1,force:true};
      const answer=await request(data);
      outputs[key]={order:Array.from(new Uint32Array(answer.order).subarray(0,test.n)),count:answer.count};
      if(key==='measured'){
        const b=answer.benchmark;
        assert.equal(b.requestId,1); assert.equal(b.sortSequence,1);
        assert.equal(b.sortedSplats,test.n); assert.equal(b.activeSplats,answer.count);
        assert.equal(b.bucketCount,2**b.compareBits+1);
        for(const name of ['cpuPrepMs','cpuSortMs','cpuPostprocessMs','cpuWorkerSpanMs'])assert.ok(Number.isFinite(b[name])&&b[name]>=0);
        assert.ok(Math.abs(b.cpuPrepMs+b.cpuSortMs+b.cpuPostprocessMs-b.cpuWorkerSpanMs)<1e-8);
        assert.deepEqual(b.sourceOrigin,test.pos);assert.deepEqual(b.sourceDirection,test.dir);
        const repeat=await request({order:answer.order,cameraPosition,cameraDirection,benchmarkRequest:{requestId:2,force:true}});
        assert.equal(repeat.benchmark.requestId,2);assert.equal(repeat.benchmark.sortSequence,2);
        assert.deepEqual(Array.from(new Uint32Array(repeat.order).subarray(0,test.n)),outputs[key].order);
        assert.equal(repeat.count,answer.count);
      }
    }finally{await worker.terminate();}
  }
  assert.deepEqual(outputs.source,outputs.release,'Release matches source');
  assert.deepEqual(outputs.release,outputs.measured,'Instrumentation preserves full order and cull count');
  const ids=new Set(outputs.measured.order);assert.equal(ids.size,test.n,'Every ID appears once');
  results.push({name:test.name,numSplats:test.n,activeSplats:outputs.measured.count,passed:true});
}
const receipt={schema:'supersplat-worker-verification-v1',passed:true,actualWorkerThreads:true,
  fullOrderAndCountEqual:true,sourceReleaseAndInstrumentedCompared:true,repeatedIdenticalViewForced:true,
  transferDetachVerified:true,cases:results,totalKeys:tests.reduce((a,t)=>a+t.n,0),
  hashes:Object.fromEntries(Object.entries(scripts).map(([k,v])=>[k,sha(v.text)]))};
fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
