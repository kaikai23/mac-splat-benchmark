'use strict';
// Dedicated dynamic experiment. Does not mutate the frozen static protocol.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {spawn,execFileSync}=require('child_process');
const {now,assert,readJson,writeJson,sha,quantile,summarize,sourceHashes,inventory,powerSnapshot,browserIdentity}=require('../runner/common.cjs');
const ROOT=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function deadline(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]).finally(()=>clearTimeout(timer));}
function argumentsFrom(args){const o={};for(let i=0;i<args.length;i+=2){assert(args[i].startsWith('--')&&args[i+1],'Expected --key value');o[args[i].slice(2)]=args[i+1];}for(const k of ['config','data','out','mode'])assert(o[k],`Missing --${k}`);assert(['probe','pilot','formal'].includes(o.mode),'Unknown mode');return o;}
function dynamicHashes(){return Object.fromEntries(fs.readdirSync(__dirname).filter(f=>/\.(ts|cjs|py|json|html)$/.test(f)&&!f.startsWith('report')).sort().map(f=>['dynamic-native/'+f,sha(path.join(__dirname,f))]));}
function dependencyHashes(){const files=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&/\.(js|mjs|wasm|json)$/.test(entry.name))files.push(file);}}walk(path.join(__dirname,'node_modules'));return Object.fromEntries(files.sort().map(f=>[path.relative(ROOT,f),sha(f)]));}
async function stop(child){if(!child||child.exitCode!==null||child.signalCode)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(5000)]);if(child.exitCode===null&&!child.signalCode){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}}
function power(){const p=powerSnapshot();assert(p.power.includes("'AC Power'"),'AC power required');return p;}
async function main(){
  const args=argumentsFrom(process.argv.slice(2)),config=readJson(path.resolve(args.config));
  const data=path.resolve(args.data),out=path.resolve(args.out);assert(!fs.existsSync(path.join(out,'protocol.json')),'Use a fresh output path; existing run is retained');
  fs.mkdirSync(out,{recursive:true});
  const modelLock=readJson(path.join(__dirname,'model-lock.json')),modelPath=path.join(data,modelLock.filename);
  assert(path.basename(modelLock.filename)===modelLock.filename,'Model filename must be a basename');
  assert(fs.statSync(modelPath).size===modelLock.bytes&&sha(modelPath)===modelLock.sha256,'Model identity mismatch');
  const modelInfo=require('./inspect-model.cjs').inspect(modelPath);
  assert(modelInfo.inputs.length===1&&modelInfo.inputs[0].name==='time','Expected native time-conditioned model');
  const cameraFile=path.join(__dirname,'camera.json'),camera=args.mode==='probe'?null:readJson(cameraFile);
  const host=inventory(config.chromeExecutable),hashes={...sourceHashes(ROOT),...dynamicHashes()},dependencies=dependencyHashes();
  assert(host.architecture==='arm64'&&host.platform==='darwin','Native Apple Silicon Mac required');power();
  const protocol={schema:'visionary-native-4dgs-v1',createdAt:now(),mode:args.mode,width:1280,height:720,dpr:1,
    methods:['visionary'],rounds:args.mode==='formal'?5:1,framesPerRound:150,timeSampling:'normalized t=i/149, i=0..149; no source acquisition FPS claimed',sourceHashes:hashes,dependencyHashes:dependencies,camera,cameraSha256:camera?sha(cameraFile):null,dataRoot:data,modelPath,modelLock,modelInfo,
    measurement:'Per-frame exact normalized time input, native ONNXGenerator.generate + shared GPU buffers + fresh native preprocess/sort/render + GPU completion/readback. Model fetch/session initialization and content inspection/captures excluded. Not display presentation FPS.',
    warmup:{minimumMs:10000,minimumFrames:150},betweenRounds:{minimumMs:1500,minimumFrames:30},host,
    revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()};
  if(args.mode==='formal'){
    assert(args.pilot,'Formal requires --pilot');const p=readJson(path.resolve(args.pilot,'complete.json'));
    assert(p.complete&&p.methods.length===1,'Pilot incomplete');
    const prior=readJson(path.resolve(args.pilot,'protocol.json'));
    for(const k of ['sourceHashes','dependencyHashes','cameraSha256','modelLock'])assert(JSON.stringify(prior[k])===JSON.stringify(protocol[k]),'Pilot/formal mismatch: '+k);
    assert(prior.host.browserSha256===host.browserSha256&&JSON.stringify(prior.host.browserFrameworkIdentity)===JSON.stringify(host.browserFrameworkIdentity),'Browser changed after pilot');
    const qa=readJson(path.resolve(args.pilot,'audit.json'));assert(qa.passed&&qa.complete,'Pilot independent audit required');
    for(const [file,key] of [['protocol.json','protocolSha256'],['complete.json','completeSha256'],['runtime.json','runtimeSha256']])assert(qa.sourceReceipts?.[key]===sha(path.resolve(args.pilot,file)),'Pilot audit source changed: '+file);
    for(const method of protocol.methods)assert(qa.sourceReceipts?.methods?.[method]===sha(path.resolve(args.pilot,method+'.json')),'Pilot audited method changed: '+method);
  }
  writeJson(path.join(out,'protocol.json'),protocol);
  const lockPath=path.join(ROOT,'results/gpu-session.lock');let owned=false,server,caffeine,browserServer,browser,telemetry;
  const {chromium}=require(config.playwrightModule||path.join(ROOT,'node_modules/playwright'));
  const runtime={startedAt:now(),pid:process.pid,sessionToken:crypto.randomUUID(),output:out,ownedPids:[],complete:false};
  const lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify(runtime));fs.closeSync(lock);owned=true;
  const save=()=>writeJson(path.join(out,'runtime.json'),runtime);
  let closePromise;
  async function closeBrowser(){if(closePromise)return closePromise;const client=browser,ownedServer=browserServer;browser=null;browserServer=null;if(!client&&!ownedServer)return;
    closePromise=(async()=>{if(client)await deadline(client.close(),15000,'Browser client close').catch(()=>{});if(ownedServer){await deadline(ownedServer.close(),15000,'Browser server close').catch(()=>{});await stop(ownedServer.process());}})();
    try{await closePromise;}finally{closePromise=null;}
  }
  async function cleanup(){if(telemetry)clearInterval(telemetry);await closeBrowser();await stop(server);await stop(caffeine);if(owned){assert(readJson(lockPath).sessionToken===runtime.sessionToken,'GPU lock ownership changed');fs.unlinkSync(lockPath);owned=false;}runtime.gpuLockReleased=!fs.existsSync(lockPath);runtime.ownedChildren=runtime.ownedPids.map(p=>{let alive=false;try{process.kill(p.pid,0);alive=true;}catch{}return {...p,alive};});runtime.finishedAt=now();save();}
  let interrupted=false;for(const signal of ['SIGTERM','SIGINT','SIGHUP'])process.once(signal,()=>{interrupted=true;runtime.signal=signal;save();closeBrowser().catch(e=>{runtime.cleanupError=String(e);});});
  try{
    caffeine=spawn('/usr/bin/caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});runtime.ownedPids.push({kind:'caffeinate',pid:caffeine.pid});
    const log=fs.openSync(path.join(out,'vite.log'),'a');
    server=spawn(process.execPath,[path.join(ROOT,'work/bench/node_modules/vite/bin/vite.js'),'--host','127.0.0.1'],{cwd:__dirname,env:{...process.env,DYNAMIC_DATA_ROOT:data},stdio:['ignore',log,log]});fs.closeSync(log);runtime.ownedPids.push({kind:'vite',pid:server.pid});save();
    let ready=false;for(let i=0;i<120;i++){assert(!interrupted,'Run interrupted');if(server.exitCode!==null)throw Error('Vite exited');try{const r=await fetch('http://127.0.0.1:8781');if(r.ok){ready=true;break;}}catch{}await sleep(250);}assert(ready,'Dynamic host not ready');
    const receipts=[];
    for(const method of protocol.methods){
      assert(!interrupted,'Run interrupted');power();const record={method,protocolSha256:sha(path.join(out,'protocol.json')),startedAt:now(),status:'running',errors:[],warnings:[],rounds:[],captures:[]};
      record.telemetryPath=`telemetry-${method}.json`;const powerLog={samples:[],error:null};
      const takePower=()=>{try{const p=powerSnapshot();powerLog.samples.push(p);if(!p.power.includes("'AC Power'"))powerLog.error='AC power lost';}catch(e){powerLog.error=String(e);}writeJson(path.join(out,record.telemetryPath),powerLog);};
      const guard=()=>{assert(!interrupted,'Run interrupted');assert(!powerLog.error,powerLog.error||'Power monitor failed');};
      takePower();telemetry=setInterval(takePower,5000);
      try{
        console.log(now(),'START',method);
        browserServer=await chromium.launchServer({executablePath:config.chromeExecutable,headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--enable-webgpu-developer-features','--use-angle=metal']});
        runtime.ownedPids.push({kind:'chrome',method,pid:browserServer.process().pid});save();guard();
        browser=await chromium.connect(browserServer.wsEndpoint());guard();record.browserVersion=browser.version();assert(host.browserVersion.includes(record.browserVersion),'Browser version changed');
        const page=await browser.newPage({viewport:{width:1280,height:760},deviceScaleFactor:1});page.setDefaultTimeout(120000);
        page.on('pageerror',e=>record.errors.push(e.stack||String(e)));page.on('console',m=>{const text=m.text();if(m.type()==='error'&&!text.includes('404 (Not Found)')){if(/\[W:onnxruntime:, constant_folding\.cc:\d+ ApplyImpl\] Could not find a CPU kernel and hence can't constant fold Sub node '\/Sub_9'/.test(text))record.warnings.push(text);else record.errors.push(text);}else if(m.type()==='warning')record.warnings.push(text);});
        await page.goto('http://127.0.0.1:8781');await page.waitForFunction(()=>!!window.nativeBench);
        page.on('dialog',dialog=>{record.errors.push('ORT dialog: '+dialog.message());dialog.dismiss();});
        record.initial=await deadline(page.evaluate(()=>window.nativeBench.init({width:1280,height:720})),600000,'Native initialization');guard();
        assert(record.initial.width===1280&&record.initial.height===720&&record.initial.devicePixelRatio===1&&record.initial.crossOriginIsolated,'Framebuffer/isolation mismatch');
        const gpu=JSON.stringify(record.initial.metadata);assert(!/SwiftShader|llvmpipe|software adapter/i.test(gpu),'Software GPU rejected');
        assert(/apple/i.test(gpu),'Native Apple GPU metadata required');
        record.loadInfo=await deadline(page.evaluate(url=>window.nativeBench.load(url),'/data/'+modelLock.filename),600000,'Native model load');guard();
        record.inspectionStart=await deadline(page.evaluate(diagnostic=>window.nativeBench.inspect(0,256,diagnostic),args.mode==='probe'),120000,'Initial content inspection');
        if(args.mode==='probe'){
          record.inspectionMiddle=await deadline(page.evaluate(()=>window.nativeBench.inspect(0.5,256,true)),120000,'Middle content inspection');
          record.inspectionEnd=await deadline(page.evaluate(()=>window.nativeBench.inspect(1,256,true)),120000,'End content inspection');
          const bounds=[record.inspectionStart,record.inspectionMiddle,record.inspectionEnd].map(x=>x.fullBounds);
          record.probeBounds={min:[0,1,2].map(i=>Math.min(...bounds.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...bounds.map(b=>b.max[i]))),sampledTimes:[0,0.5,1]};
          const viewSpecs=require('./probe-cameras.cjs').cameras({fullBounds:record.probeBounds});
          if(fs.existsSync(cameraFile))viewSpecs.locked_view=readJson(cameraFile);
          record.probeCameras=viewSpecs;
          for(const [view,spec] of Object.entries(viewSpecs)){
            await page.evaluate(spec=>window.nativeBench.setCamera(spec),spec);
            for(const index of [0,75,149]){
              await deadline(page.evaluate(index=>window.nativeBench.sample(index),index),120000,'Probe frame');
              const relative=`captures/${view}-${index}.png`;fs.mkdirSync(path.join(out,'captures'),{recursive:true});await page.locator('canvas').screenshot({path:path.join(out,relative)});record.captures.push({view,index,path:relative,sha256:sha(path.join(out,relative))});
            }
          }
          record.metadata=await page.evaluate(()=>window.nativeBench.metadata());assert(!record.errors.length&&!record.metadata.events.length,'Probe runtime errors');record.disposal=await deadline(page.evaluate(()=>window.nativeBench.dispose()),120000,'Probe disposal');
          takePower();guard();clearInterval(telemetry);telemetry=null;record.telemetrySha256=sha(path.join(out,record.telemetryPath));record.status='complete';record.completedAt=now();writeJson(path.join(out,'probe.json'),record);runtime.complete=true;return;
        }
        record.contentSweep=await deadline(page.evaluate(()=>window.nativeBench.validateContent()),600000,'All-time native content validation');guard();
        await page.evaluate(spec=>window.nativeBench.setCamera(spec),camera);
        record.warmup=await deadline(page.evaluate(()=>window.nativeBench.warmup(10000,150)),600000,'Initial warmup');guard();
        for(let repeat=0;repeat<protocol.rounds;repeat++){
          guard();
          const warmup=repeat?await deadline(page.evaluate(()=>window.nativeBench.warmup(1500,30)),600000,'Round warmup'):null;guard();
          const before=power();
          const round=await deadline(page.evaluate(repeat=>window.nativeBench.round(repeat),repeat),600000,'Measured round');round.warmup=warmup;round.powerBefore=before;round.powerAfter=power();
          guard();
          assert(round.samples.length===150,'Incomplete content coverage');
          record.rounds.push(round);writeJson(path.join(out,`checkpoint-${method}.json`),record);
          console.log(now(),'ROUND',method,repeat+1,'FPS',(round.samples.length*1000/round.windowElapsedMs).toFixed(3));
        }
        for(const index of [0,50,100,149]){
          const metric=await deadline(page.evaluate(index=>window.nativeBench.sample(index),index),120000,'Capture sample');guard();
          const inspection=await deadline(page.evaluate(()=>window.nativeBench.inspectCurrent(64)),120000,'Capture content inspection');
          const relative=`captures/visionary-${String(index).padStart(3,'0')}.png`;
          fs.mkdirSync(path.dirname(path.join(out,relative)),{recursive:true});await page.locator('canvas').screenshot({path:path.join(out,relative)});
          record.captures.push({index,time:index/149,path:relative,sha256:sha(path.join(out,relative)),metric,inspection});
        }
        record.metadata=await page.evaluate(()=>window.nativeBench.metadata());assert(!record.errors.length&&!record.metadata.events.length,'Runtime errors');
        record.disposal=await deadline(page.evaluate(()=>window.nativeBench.dispose()),120000,'Adapter disposal');guard();
        record.e2e=summarize(record.rounds);const samples=record.rounds.flatMap(r=>r.samples);
        record.phases=Object.fromEntries(['inferenceWallMs','renderCompletionMs'].map(k=>[k,{meanMs:samples.reduce((s,x)=>s+x[k],0)/samples.length,p50Ms:quantile(samples.map(s=>s[k]),.5),p95Ms:quantile(samples.map(s=>s[k]),.95)}]));
        takePower();guard();clearInterval(telemetry);telemetry=null;record.telemetrySha256=sha(path.join(out,record.telemetryPath));
        record.status='complete';record.completedAt=now();record.powerEnd=power();
        writeJson(path.join(out,`${method}.json`),record);receipts.push({method,sha256:sha(path.join(out,`${method}.json`))});console.log(now(),'DONE',method);
      }catch(e){record.status='failed';record.error=e.stack||String(e);writeJson(path.join(out,`failure-${method}-${Date.now()}.json`),record);throw e;}
      finally{if(telemetry){clearInterval(telemetry);telemetry=null;}await closeBrowser();}
    }
    assert(JSON.stringify(hashes)===JSON.stringify({...sourceHashes(ROOT),...dynamicHashes()}),'Sources changed during collection');
    assert(JSON.stringify(dependencies)===JSON.stringify(dependencyHashes()),'ORT runtime dependency changed during collection');
    const finalBrowser=browserIdentity(config.chromeExecutable);assert(finalBrowser.browserSha256===host.browserSha256&&JSON.stringify(finalBrowser.browserFrameworkIdentity)===JSON.stringify(host.browserFrameworkIdentity),'Browser binary changed during collection');runtime.finalBrowser=finalBrowser;
    writeJson(path.join(out,'complete.json'),{complete:true,completedAt:now(),methods:receipts});runtime.complete=true;
  }catch(e){runtime.error=e.stack||String(e);throw e;}finally{await cleanup();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={argumentsFrom};
