import {defineConfig} from '../work/bench/node_modules/vite/dist/node/index.js';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),dependencies=resolve(root,'work/bench/node_modules'),ort=resolve(here,'node_modules/onnxruntime-web/dist');
const dataRoot=resolve(process.env.DYNAMIC_DATA_ROOT||resolve(root,'data/visionary-native-dynamic'));
function files(base:string){return (req:any,res:any)=>{const target=resolve(base,'.'+decodeURIComponent((req.url||'/').split('?')[0]));if(!target.startsWith(base+sep)||!['GET','HEAD'].includes(req.method||'')){res.statusCode=403;res.end();return;}let stat;try{stat=fs.statSync(target);}catch{res.statusCode=404;res.end();return;}if(!stat.isFile()){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',target.endsWith('.wasm')?'application/wasm':target.endsWith('.mjs')?'text/javascript':target.endsWith('.json')?'application/json':'application/octet-stream');res.setHeader('Content-Length',stat.size);res.setHeader('Cache-Control','no-store');if(req.method==='HEAD'){res.end();return;}fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);};}
export default defineConfig({
  build:{outDir:resolve(root,'results/dynamic-native-build'),emptyOutDir:true},
  resolve:{alias:[
    {find:/^onnxruntime-web\/webgpu$/,replacement:resolve(ort,'ort.webgpu.bundle.min.mjs')},
    {find:/^three\/webgpu$/,replacement:resolve(dependencies,'three/build/three.webgpu.js')},
    {find:/^three$/,replacement:resolve(dependencies,'three/build/three.module.js')},
    {find:/^three\/addons\/(.*)$/,replacement:resolve(dependencies,'three/examples/jsm')+'/$1'},
    {find:/^three\/(.*)$/,replacement:resolve(dependencies,'three')+'/$1'},
    {find:/^gl-matrix$/,replacement:resolve(dependencies,'gl-matrix/esm/index.js')},
  ],dedupe:['three','gl-matrix','onnxruntime-web']},
  server:{host:'127.0.0.1',port:8781,strictPort:true,fs:{allow:[root]},headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'}},
  plugins:[{name:'native-model-runtime',configureServer(server){server.middlewares.use('/data',files(dataRoot));server.middlewares.use('/ort',files(ort));}}],
});
