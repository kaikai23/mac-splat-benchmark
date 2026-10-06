import {defineConfig} from '../bench/node_modules/vite/dist/node/index.js';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url));
const dependencies=resolve(here,'../bench/node_modules');
const dataRoot=resolve(process.env.BENCH_DATA_ROOT || resolve(here,'../data'));
export default defineConfig({
  build:{outDir:resolve(here,'../../results/setup/builds/spark'),emptyOutDir:true},
  resolve:{alias:[
    {find:/^three\/webgpu$/,replacement:resolve(dependencies,'three/build/three.webgpu.js')},
    {find:/^three$/,replacement:resolve(dependencies,'three/build/three.module.js')},
    {find:/^three\/addons\/(.*)$/,replacement:resolve(dependencies,'three/examples/jsm')+'/$1'},
    {find:/^three\/(.*)$/,replacement:resolve(dependencies,'three')+'/$1'},
    {find:/^gl-matrix$/,replacement:resolve(dependencies,'gl-matrix/esm/index.js')},
  ],dedupe:['three','gl-matrix']},
  server:{port:8771,strictPort:true,fs:{allow:[resolve(here,'..')]},
    headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-store'}},
  plugins:[{name:'local-model-files',configureServer(server){
    server.middlewares.use('/data',(req,res,next)=>{
      const relative=decodeURIComponent((req.url||'/').split('?')[0]);
      const target=resolve(dataRoot,'.'+relative);
      if(!target.startsWith(dataRoot+sep)||!['GET','HEAD'].includes(req.method||'')){res.statusCode=403;res.end();return;}
      let stat;try{stat=fs.statSync(target);}catch{res.statusCode=404;res.end('File not ready');return;}
      if(!stat.isFile()){res.statusCode=404;res.end();return;}
      res.setHeader('Content-Type',target.endsWith('.json')?'application/json':'application/octet-stream');
      res.setHeader('Content-Length',stat.size);res.setHeader('Cache-Control','no-store');
      res.setHeader('Cross-Origin-Resource-Policy','same-origin');
      if(req.method==='HEAD'){res.end();return;}
      fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
    });
  }}],
});
