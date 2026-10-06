import {applyCamera,type CameraSpec} from './camera';
import * as THREE from 'three';

const canvas=document.querySelector('#view') as HTMLCanvasElement;
const status=document.querySelector('#status')!;
let adapter:any=null;
let engine='';
let width=1280,height=720;
const events:any[]=[];
const setStatus=(message:string)=>{status.textContent=message;console.log('[bench]',message);};
window.addEventListener('error',event=>events.push({type:'error',message:event.message}));
window.addEventListener('unhandledrejection',event=>events.push({type:'rejection',message:String(event.reason?.stack||event.reason)}));
const cameraCache=new Map<string,THREE.PerspectiveCamera>();
function interpolatedCamera(a:CameraSpec,b:CameraSpec,t:number){
  const get=(s:CameraSpec)=>{const key=JSON.stringify(s);if(!cameraCache.has(key))cameraCache.set(key,applyCamera(new THREE.PerspectiveCamera(),s,width,height));return cameraCache.get(key)!;};
  const ca=get(a),cb=get(b),c=ca.clone();
  c.position.lerpVectors(ca.position,cb.position,t);c.quaternion.slerpQuaternions(ca.quaternion,cb.quaternion,t);c.updateMatrixWorld(true);return c;
}
(window as any).bench={
  async init(method:string,options:any={}){
    engine=method;width=options.width||1280;height=options.height||720;
    setStatus(`Initializing ${method}`);
    if(method==='visionary'){const {createVisionary}=await import('./visionary-adapter');adapter=await createVisionary(canvas,options);}
    else throw new Error(`Unknown method ${method}`);
    return adapter.metadata;
  },
  async load(url:string){setStatus(`Loading ${engine}: ${url}`);const result=await adapter.load(url);setStatus(`${engine} loaded`);return result;},
  async sample(camera:CameraSpec){adapter.setCamera(camera);return adapter.renderSample();},
  async warmup(cameras:CameraSpec[],minimumMs=5000,minimumSamples=64){
    const start=performance.now();let count=0;const tail=[];
    while(performance.now()-start<minimumMs||count<minimumSamples){
      adapter.setCamera(cameras[count%cameras.length]);const metrics=await adapter.renderSample();
      tail.push(metrics);if(tail.length>32)tail.shift();count++;
    }
    return {elapsedMs:performance.now()-start,samples:count,lastSamples:tail};
  },
  async runViews(cameras:CameraSpec[],repeat:number){
    const samples=[];
    for(let i=0;i<cameras.length;i++){
      const idx=(i+repeat*7)%cameras.length,camera=cameras[idx];
      adapter.setCamera(camera);const metrics=await adapter.renderSample();
      samples.push({repeat,order:i,cameraIndex:idx,cameraId:camera.id,img_name:camera.img_name,...metrics});
    }
    return samples;
  },
  async runRound(cameras:CameraSpec[],repeat:number,cycles=3){
    const samples=[];
    for(let cycle=0;cycle<cycles;cycle++)for(let i=0;i<cameras.length;i++){
      const idx=(i+repeat*7+cycle*11)%cameras.length,camera=cameras[idx];
      adapter.setCamera(camera);const metrics=await adapter.renderSample();
      samples.push({repeat,cycle,order:i,cameraIndex:idx,cameraId:camera.id,img_name:camera.img_name,...metrics});
    }
    return samples;
  },
  async runRaf(cameras:CameraSpec[],frames=360,warmup=60){
    const result:any[]=[];let previous:number|undefined;let count=0;
    await new Promise<void>((resolve,reject)=>{
      function frame(now:number){try{
        const pos=count/30,idx=Math.floor(pos)%cameras.length,t=pos-Math.floor(pos);
        adapter.setCamera(interpolatedCamera(cameras[idx],cameras[(idx+1)%cameras.length],t));
        const started=performance.now();const submission=adapter.renderFrame();
        if(count>=warmup&&previous!==undefined)result.push({frame:count-warmup,intervalMs:now-previous,cpuSubmitMs:performance.now()-started,submission});
        previous=now;count++;if(count<warmup+frames)requestAnimationFrame(frame);else resolve();
      }catch(e){reject(e);}}
      requestAnimationFrame(frame);
    });
    await adapter.waitIdle?.();
    return result;
  },
  metadata(){return {...adapter?.metadata,browserUserAgent:navigator.userAgent,crossOriginIsolated,devicePixelRatio,events};},
  async dispose(){await adapter?.dispose();adapter=null;},
};
setStatus('Benchmark API ready');
