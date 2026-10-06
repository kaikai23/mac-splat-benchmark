const fs=require('fs'), path=require('path'), http=require('http'), crypto=require('crypto');
const root=path.resolve(__dirname,'..');const args=process.argv.slice(2);const config=JSON.parse(fs.readFileSync(path.resolve(root,args[0]||'config/local.json')));const {chromium}=require(config.playwrightModule||'playwright');
const out=path.resolve(root,args[1]||'results/gpu-probe');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{res.end('<html><body>Mac GPU capability probe</body></html>')}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const exe=config.chromeExecutable||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 const modes=['metal'];const results=[];
 for(const mode of modes.length?modes:['default','metal']){
 let browser; const record={mode,createdAt:new Date().toISOString(),headless:!mode.includes('headed'),executable:exe,executableSha256:crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex')};
 try{
 const args=['--enable-webgpu','--enable-webgl','--enable-webgpu-developer-features','--disable-background-timer-throttling','--disable-renderer-backgrounding'];
 if(mode.includes('metal'))args.push('--use-angle=metal');
 if(mode.includes('gl'))args.push('--use-angle=gl');
 record.args=args;
 browser=await chromium.launch({executablePath:exe,headless:record.headless,args});record.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 record.capabilities=await page.evaluate(async()=>{
 const r={userAgent:navigator.userAgent,secureContext:isSecureContext};
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');r.webgl2=!!gl;
 if(gl){const info=gl.getExtension('WEBGL_debug_renderer_info');r.webgl={vendor:info&&gl.getParameter(info.UNMASKED_VENDOR_WEBGL),renderer:info&&gl.getParameter(info.UNMASKED_RENDERER_WEBGL),extensions:gl.getSupportedExtensions()};const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');r.webgl.timerSupported=!!ext;
 if(ext){const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);for(let i=0;i<100;i++){gl.clearColor(i/100,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT)}gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();const begin=performance.now();while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&performance.now()-begin<10000)await new Promise(r=>setTimeout(r,10));r.webgl.queryAvailable=gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);r.webgl.disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);r.webgl.elapsedNs=r.webgl.queryAvailable?gl.getQueryParameter(q,gl.QUERY_RESULT):null;}}
 r.webgpu={present:!!navigator.gpu};if(navigator.gpu){const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});r.webgpu.adapter=!!adapter;if(adapter){r.webgpu.info={vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter};r.webgpu.features=[...adapter.features];r.webgpu.limits={maxBufferSize:adapter.limits.maxBufferSize,maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize};
 if(adapter.features.has('timestamp-query')){const d=await adapter.requestDevice({requiredFeatures:['timestamp-query']}),q=d.createQuerySet({type:'timestamp',count:2}),b=d.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read=d.createBuffer({size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});const storage=d.createBuffer({size:4*65536,usage:GPUBufferUsage.STORAGE}); const pipeline=d.createComputePipeline({layout:'auto',compute:{module:d.createShaderModule({code:'@group(0) @binding(0) var<storage,read_write> a: array<u32>; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { var x=id.x; for(var i=0u;i<20000u;i++){x=x*1664525u+1013904223u;} a[id.x]=x; }'}),entryPoint:'main'}}); const group=d.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:storage}}]}); const c=d.createCommandEncoder();const p=c.beginComputePass({timestampWrites:{querySet:q,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}});p.setPipeline(pipeline);p.setBindGroup(0,group);p.dispatchWorkgroups(1024);p.end();c.resolveQuerySet(q,0,2,b,0);c.copyBufferToBuffer(b,0,read,0,256);d.queue.submit([c.finish()]);await read.mapAsync(GPUMapMode.READ);r.webgpu.timestampValues=Array.from(new BigUint64Array(read.getMappedRange()).slice(0,2)).map(String);read.unmap();d.destroy();}}}
 return r;
 });
 const session=await browser.newBrowserCDPSession();record.systemInfo=await session.send('SystemInfo.getInfo');
 }catch(e){record.error=String(e.stack||e)}finally{if(browser)await browser.close()}
 record.passed=!record.error&&record.capabilities?.webgl?.queryAvailable&&!record.capabilities?.webgl?.disjoint&&record.capabilities?.webgl?.elapsedNs>0&&record.capabilities?.webgpu?.info?.vendor==='apple'&&record.capabilities?.webgpu?.timestampValues?.length===2&&BigInt(record.capabilities.webgpu.timestampValues[1])>BigInt(record.capabilities.webgpu.timestampValues[0]);if(!record.passed)process.exitCode=1;results.push(record);fs.writeFileSync(path.join(out,`gpu-probe-${mode}.json`),JSON.stringify(record,null,2));console.log(JSON.stringify({passed:record.passed,mode,renderer:record.capabilities?.webgl?.renderer,adapter:record.capabilities?.webgpu?.info,error:record.error}));
 }
 server.close();
})().catch(e=>{console.error(e);process.exitCode=1});
