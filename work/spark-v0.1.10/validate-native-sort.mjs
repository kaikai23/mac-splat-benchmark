/** CPU-only execution of the official embedded Worker/WASM; never opens a browser. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
const bundle=fs.readFileSync(path.join(root,'dist/spark.benchmark.js'),'utf8');
const literal=[...bundle.matchAll(/^const (jsContent(?:\$\d+)?) = (.+);$/gm)];assert.equal(literal.length,1);
const worker=vm.runInNewContext(literal[0][2],Object.create(null),{timeout:2000});
const handlers=new Set(),pending=new Map();let nextId=1;
const self={location:{href:'https://local.invalid/worker.js'},addEventListener(type,fn){if(type==='message')handlers.add(fn);},removeEventListener(type,fn){if(type==='message')handlers.delete(fn);},postMessage(message){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}};
const context={self,console,performance,WebAssembly,TextDecoder,TextEncoder,URL,Response,Request,Headers,Blob,
  Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array,ArrayBuffer,DataView,
  setTimeout,clearTimeout,atob,btoa,
  fetch:async input=>{const url=String(input);assert.ok(url.startsWith('data:'),'Network is forbidden in CPU validation');return fetch(url);}};
vm.runInNewContext(worker,context,{timeout:10000});
const waitStart=Date.now();while(![...handlers].some(fn=>fn.name==='onMessage')){assert.ok(Date.now()-waitStart<10000,'Worker init timeout');await new Promise(r=>setTimeout(r,10));}
async function rpc(name,args){const id=nextId++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});for(const fn of handlers)fn({data:{id,name,args}});});}
let state=1973;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
const cases=[];
for(const bits of [16,32])for(const variant of ['edges','random','ties']){
  const size=variant==='random'?131071:variant==='ties'?4097:bits===16?65536:20;
  let input;
  if(bits===16){input=new Uint16Array(size);for(let i=0;i<size;i++)input[i]=variant==='edges'?i:variant==='random'?random()&0xffff:[0,0x3c00,0x7bff,0x7c00,0xfc00][i%5];}
  else{input=new Uint32Array(size);const edges=[0,0x80000000,1,0x007fffff,0x00800000,0x3f800000,0x3f800001,0x3f7fffff,0x477fe000,0x477ff000,0x7f7fffff,0x7f800000,0x7fc00000,0xff800000,0xffffffff,0x3f800000,0,0x40000000,0x4b000000,0xbf800000];for(let i=0;i<size;i++)input[i]=variant==='edges'?edges[i]:variant==='random'?random():edges[i%5];}
  const original=Array.from(input),threshold=bits===16?0x7c00:0x7f800000;
  const expected=original.map((value,index)=>({value,index})).filter(x=>x.value<threshold).sort((a,b)=>b.value-a.value||a.index-b.index).map(x=>x.index);
  const ordering=new Uint32Array(size),name=bits===16?'sortDoubleSplats':'sort32Splats';
  let timeout;
  const result=await Promise.race([rpc(name,{maxSplats:size,numSplats:size,readback:input,ordering}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Sort RPC timeout')),15000);})]).finally(()=>clearTimeout(timeout));
  assert.equal(result.activeSplats,expected.length);assert.deepEqual(Array.from(result.ordering.subarray(0,result.activeSplats)),expected);
  assert.deepEqual(Array.from(result.readback),original);assert.ok(Number.isFinite(result.benchmarkSortMs)&&result.benchmarkSortMs>=0);
  cases.push({bits,variant,inputCount:size,activeCount:expected.length,exactStableOrdering:true,inputUnchanged:true,timerFinite:true});
}
const report={schema:'spark-0.1.10-native-wasm-cpu-validation-v1',passed:true,browserLaunched:false,gpuWorkPerformed:false,
  selectedFormalMode:'native16: sort32=false',secondaryModeTest:'native32 is validated for source integrity only, not included as an experiment method',
  reference:'Independent stable JavaScript numeric descending key order with native unsigned infinity threshold; exhaustive65536 half-key bit patterns plus seeded random/duplicate tests',
  limitation:'Does not validate actual GPU shader output, GPU timers or rendered images; target-Mac GPU validation remains required',
  bundleSha256:sha(bundle),workerSha256:sha(worker),scriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),cases};
const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||path.resolve(root,'../../results/setup/spark-native-sort-cpu-validation.json');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,cases:cases.length,output}));
