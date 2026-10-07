import {createVisionary} from './visionary-adapter';
const canvas=document.querySelector('#view') as HTMLCanvasElement,status=document.querySelector('#status')!;
let adapter:any,camera:any;
const events:any[]=[];
window.addEventListener('error',e=>events.push({type:'error',message:e.message}));
window.addEventListener('unhandledrejection',e=>events.push({type:'rejection',message:String(e.reason?.stack||e.reason)}));
async function sample(index:number,frames=150){
  const requestedTime=index/(frames-1),e2eStartMs=performance.now();
  adapter.setCamera(camera);
  const metrics=await adapter.renderSample(requestedTime);
  const e2eEndMs=performance.now();
  return {...metrics,index,requestedTime,cameraSpec:camera,e2eStartMs,e2eEndMs,e2eCompletionMs:e2eEndMs-e2eStartMs};
}
(window as any).nativeBench={
  async init(options:any){adapter=await createVisionary(canvas,options);return {metadata:adapter.metadata,width:canvas.width,height:canvas.height,devicePixelRatio,crossOriginIsolated,userAgent:navigator.userAgent};},
  async load(url:string){const result=await adapter.load(url);status.textContent='Visionary native ONNX model loaded';return result;},
  setCamera(spec:any){camera=spec;adapter.setCamera(spec);},
  async inspect(time:number,sampleCount=64,diagnosticNonfinite=false){return adapter.inspectContent({time,sampleCount,fullBounds:sampleCount===256,diagnosticNonfinite});},
  async inspectCurrent(sampleCount=64){return adapter.inspectContent({sampleCount});},
  async validateContent(){const rows=[];for(let index=0;index<150;index++){const requestedTime=index/149;rows.push({index,requestedTime,...await adapter.inspectContent({time:requestedTime,sampleCount:2,fullBounds:true})});}return rows;},
  sample,
  async warmup(minimumMs=10000,minimumFrames=150){const start=performance.now(),before=structuredClone(adapter.metadata);let frames=0;while(performance.now()-start<minimumMs||frames<minimumFrames){await sample(frames%150);frames++;}return {frames,elapsedMs:performance.now()-start,before,after:structuredClone(adapter.metadata)};},
  async round(repeat:number){const samples=[],windowStartMs=performance.now();for(let index=0;index<150;index++)samples.push({...await sample(index),repeat});const windowEndMs=performance.now();return {repeat,samples,windowStartMs,windowEndMs,windowElapsedMs:windowEndMs-windowStartMs,metadata:structuredClone(adapter.metadata)};},
  metadata(){return {...adapter.metadata,events};},
  async dispose(){await adapter.dispose();return {metadata:adapter.metadata,events};},
};
status.textContent='Native dynamic API ready';
