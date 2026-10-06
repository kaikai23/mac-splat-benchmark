'use strict';
// One owned browser at a time. All three methods are measured on this Mac.
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const {spawn, execFileSync} = require('child_process');
const crypto = require('crypto');
const {now, assert, readJson, writeJson, sha, summarize, sourceHashes, powerSnapshot, inventory, browserIdentity} = require('./runner/common.cjs');
const ROOT = __dirname;
const SCENES = ['bicycle','flowers','garden','stump','treehill','room','counter','kitchen','bonsai','drjohnson','playroom','truck','train'];
const METHODS = ['visionary','spark','supersplat'];
const OPTIONS = {width:1280,height:720,shDegree:3,kernelSize:0.3,sortRadial:false,timingMode:'stages'};
const BROWSER_ARGS = ['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--enable-webgpu-developer-features','--use-angle=metal'];
const METHODS_META = {
  visionary:{version:'1.0.1',sourceCommit:'e50f3f6c7200be0516567f0830e5240dfa26d27d',backend:'WebGPU',sortBits:32,modified:true,engine:'visionary',host:'bench-visionary',port:8770},
  spark:{version:'0.1.10',sourceCommit:'792d6d193db8b79ed4d1f32ef65cca9ec93f0896',backend:'WebGL2',sortBits:16,modified:true,algorithmModified:false,instrumented:true,engine:'spark',host:'bench-spark',port:8771},
  supersplat:{version:'2.1.0',sourceCommit:'2f23b4b2072da694172faa26ff44fc67f2a01ca2',backend:'WebGL2',engineVersion:'2.5.1',engine:'supersplat',host:'supersplat-bench',port:8772}
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function argumentsFrom(argv) {
  const result = {config:'config/local.json',mode:'validate'};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    assert(['--config','--mode','--output'].includes(key), 'Unknown argument '+key);
    assert(argv[i+1]&&!argv[i+1].startsWith('--'), 'Missing value for '+key);
    result[key.slice(2)]=argv[++i];
  }
  assert(['validate','pilot','full'].includes(result.mode), 'Mode must be validate, pilot, or full');
  return result;
}
function loadInputs(config, pilot) {
  const dataRoot=path.resolve(ROOT,config.dataRoot);
  const cameraRoot=path.resolve(ROOT,config.cameraRoot||'config/cameras');
  const dataLock=readJson(path.join(ROOT,'config/data-lock.json'));
  for(const item of dataLock.manifests) assert(sha(path.join(ROOT,item.path))===item.sha256,'Locked model manifest changed: '+item.path);
  const manifest=readJson(path.join(ROOT,'config/data/manifest.json'));
  const subsets=readJson(path.join(ROOT,'config/data/subsets-manifest.json'));
  const models=[], camerasByScene={};
  for(const scene of SCENES) {
    const entry=manifest.scenes.find(s=>s.scene===scene);
    assert(entry?.ply,'Missing model '+scene);
    const cameraFile=path.join(cameraRoot,scene,'heldout_cameras.json');
    const cameras=readJson(cameraFile);assert(cameras.length>0,'Empty camera selection');
    const lockedCamera=dataLock.cameras.find(c=>c.scene===scene);
    assert(lockedCamera&&sha(cameraFile)===lockedCamera.sha256&&cameras.length===lockedCamera.views,'Locked camera selection changed: '+scene);
    camerasByScene[scene]={cameras,cameraFileSha256:sha(cameraFile)};
    for(const stride of [1,2,4,8]) {
      const model=stride===1?entry.ply:subsets.subsets.find(s=>s.scene===scene&&s.stride===stride);
      assert(model?.relative_path&&model.sha256&&model.gaussian_count,'Incomplete model identity '+scene+'/'+stride);
      const file=path.resolve(dataRoot,model.relative_path);
      assert(file.startsWith(dataRoot+path.sep)&&fs.statSync(file).size===model.bytes,'Model path/size mismatch '+scene+'/'+stride);
      models.push({scene,stride,dataset:entry.dataset,model:{relative_path:model.relative_path,bytes:model.bytes,sha256:model.sha256,gaussian_count:model.gaussian_count},file,...camerasByScene[scene]});
    }
  }
  assert(Object.values(camerasByScene).reduce((n,x)=>n+x.cameras.length,0)===378,'Expected378heldout cameras');
  const configurations=[];
  for(const stride of [1,2,4,8]) for(let si=0;si<SCENES.length;si++) {
    const scene=SCENES[si];
    if(pilot&&(!['train','bicycle'].includes(scene)||![1,8].includes(stride))) continue;
    const model=models.find(m=>m.scene===scene&&m.stride===stride);
    const rotation=(si+[1,2,4,8].indexOf(stride))%METHODS.length;
    const order=[...METHODS.slice(rotation),...METHODS.slice(0,rotation)];
    for(const method of order) configurations.push({...model,method,engine:METHODS_META[method].engine,key:`${scene}-s${stride}-${method}`});
  }
  assert(configurations.length===(pilot?12:156),'Configuration coverage mismatch');
  return {dataRoot,cameraRoot,models,configurations};
}
function assertMetadata(meta, method, expectedChip, loaded=false) {
  const def=METHODS_META[method];
  assert(meta.version===def.version&&meta.sourceCommit===def.sourceCommit,'Renderer version/commit mismatch: '+method);
  if(method==='visionary') {
    assert(meta.timestampSupported&&meta.timestampWriteCount===6,'WebGPU timestamp-query required');
    assert(meta.gpuAdapter?.vendor==='apple'&&!meta.gpuAdapter?.isFallbackAdapter,'Apple hardware WebGPU required');
    assert(String(meta.gpuAdapter?.description).includes(expectedChip),'WebGPU adapter differs from observed Apple chip');
  } else {
    assert(String(meta.renderer).includes('ANGLE Metal Renderer: '+expectedChip),'Hardware ANGLE Metal renderer differs from local chip');
    if(method.startsWith('spark')) assert(meta.sortBits===def.sortBits,'Spark sort width mismatch');
    else assert(meta.engineVersion===def.engineVersion&&(loaded?meta.shBands===3:meta.maxShDegree===3),'SuperSplat/PlayCanvas version or SH mismatch');
  }
  assert(meta.lod===false,'LoD must remain disabled');
}
function validateExisting(record, c, protocol, outputDir) {
  const same=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
  assert(record.status==='complete'&&record.protocolId===protocol.protocolId&&record.runnerSha256===protocol.runnerSha256,'Existing raw protocol/runner mismatch');
  for(const field of ['engine','method','scene','stride','dataset','cameraFileSha256'])same(record[field],c[field],'Existing raw identity mismatch: '+field);
  same(record.model,c.model,'Existing model identity mismatch');same(record.cameras,c.cameras,'Existing camera selection mismatch');
  same(record.options,{...OPTIONS,sort32:c.method==='spark'&&METHODS_META.spark.sortBits===32},'Existing rendering options mismatch');
  same(record.protocol,protocol.measurement,'Existing measurement definition mismatch');same(record.experimentHashes,protocol.experimentHashes,'Existing source hashes mismatch');
  assert(record.browserSha256===protocol.browserSha256&&protocol.browserVersion.includes(record.browserVersion),'Existing browser identity mismatch');
  same(record.browserFrameworkIdentity,protocol.browserFrameworkIdentity,'Existing Chrome framework mismatch');
  const chip=protocol.hostIdentity.hardware.SPHardwareDataType[0].chip_type;
  assertMetadata(record.initialMetadata,c.method,chip);
  assertMetadata(record.metadata,c.method,chip,true);
  assert(record.framebuffer.width===1280&&record.framebuffer.height===720&&record.framebuffer.devicePixelRatio===1&&record.framebuffer.viewportWidth===1280&&record.framebuffer.viewportHeight===760,'Existing framebuffer/viewport mismatch');
  assert(Array.isArray(record.powerViolations)&&record.powerViolations.length===0&&record.errors.length===0,'Existing runtime/power errors');
  const measurement=protocol.measurement;
  assert(record.warmup.samples>=measurement.minWarmupSamples&&record.warmup.elapsedMs>=measurement.initialWarmupMs,'Existing initial warmup incomplete');
  assert(record.rounds.length===measurement.repeats,'Existing round count mismatch');
  for(let repeat=0;repeat<measurement.repeats;repeat++) {
    const round=record.rounds[repeat];assert(round.repeat===repeat&&round.samples.length===measurement.cyclesPerRepeat*c.cameras.length&&round.sampleCount===round.samples.length,'Existing round sample count mismatch');
    if(repeat)assert(round.warmup.samples>=measurement.minBetweenRoundWarmupSamples&&round.warmup.elapsedMs>=measurement.betweenRoundWarmupMs,'Existing inter-round warmup incomplete');
    assert(Number.isFinite(round.windowElapsedMs)&&round.windowElapsedMs>0&&Math.abs(round.windowElapsedMs-(round.windowEndMs-round.windowStartMs))<1e-8,'Existing round clock mismatch');
    assert(round.completedFramesPerSecond===round.samples.length*1000/round.windowElapsedMs,'Existing round FPS mismatch');
    let previousEnd=round.windowStartMs;
    for(let i=0;i<round.samples.length;i++) {
      const sample=round.samples[i],cycle=Math.floor(i/c.cameras.length),order=i%c.cameras.length,cameraIndex=(order+repeat*7+cycle*11)%c.cameras.length,camera=c.cameras[cameraIndex];
      same([sample.repeat,sample.cycle,sample.order,sample.cameraIndex,sample.cameraId,sample.img_name],[repeat,cycle,order,cameraIndex,camera.id,camera.img_name],'Existing sample identity/order mismatch');
      assert([sample.e2eCompletionMs,sample.e2eStartMs,sample.e2eEndMs].every(Number.isFinite)&&sample.e2eCompletionMs>0&&sample.e2eStartMs>=previousEnd&&sample.e2eEndMs<=round.windowEndMs,'Existing sample chronology invalid');
      assert(Math.abs(sample.e2eCompletionMs-(sample.e2eEndMs-sample.e2eStartMs))<1e-8,'Existing sample interval mismatch');previousEnd=sample.e2eEndMs;
    }
    for(const power of [round.powerBefore,round.powerAfter])assert(power?.power.includes("Now drawing from 'AC Power'"),'Existing round AC evidence missing');
  }
  same(record.e2eCompletion,summarize(record.rounds),'Existing completion summary mismatch');
  const displayIndices=[...new Set(c.stride===1?[0,Math.floor(c.cameras.length/2),c.cameras.length-1]:[0])];
  for(const [captures,indices] of [[record.captures,displayIndices],[record.qualityCaptures,c.cameras.map((_,i)=>i)]]) {
    same(captures.map(x=>x.cameraIndex),indices,'Existing capture coverage mismatch');
    for(const capture of captures){assert(capture.img_name===c.cameras[capture.cameraIndex].img_name,'Existing capture view mismatch');const file=path.resolve(outputDir,capture.path);assert(file.startsWith(outputDir+path.sep)&&sha(file)===capture.sha256,'Existing capture bytes/path mismatch');}
  }
  assert(record.raf.length===(c.stride===1?360:0),'Existing rAF coverage mismatch');
  const telemetry=path.resolve(outputDir,record.telemetryPath);
  assert(telemetry.startsWith(outputDir+path.sep)&&sha(telemetry)===record.telemetrySha256,'Existing telemetry changed');
  for(const line of fs.readFileSync(telemetry,'utf8').trim().split('\n'))assert(JSON.parse(line).power.includes("Now drawing from 'AC Power'"),'Existing telemetry has non-AC power');
}
function checkPrerequisites(config, outputBase, host, fingerprints) {
  const setup=path.resolve(ROOT,config.validationRoot||'results/setup');
  const pilotDir=path.resolve(ROOT,config.pilotOutput||path.join(outputBase,'pilot'));
  const protocol=readJson(path.join(pilotDir,'protocol.json'));
  const cleanup=readJson(path.join(pilotDir,'runtime-cleanup.json'));
  assert(protocol.pilot===true&&protocol.expectedConfigurations===12&&protocol.expectedSamples===378,'Run the12configuration pilot before full collection');
  assert(cleanup.complete&&cleanup.passed&&cleanup.gpuLockReleased&&cleanup.children.every(x=>!x.alive),'Pilot did not finish with owned-process cleanup');
  assert(JSON.stringify(protocol.experimentHashes)===JSON.stringify(fingerprints),'Source files changed after pilot; run a new pilot before full collection');
  assert(protocol.browserSha256===host.browserSha256&&JSON.stringify(protocol.browserFrameworkIdentity)===JSON.stringify(host.browserFrameworkIdentity)&&protocol.hostIdentity.osVersion===host.osVersion,'Pilot browser/OS identity differs');
  const sources=[];
  for(const configuration of loadInputs(config,true).configurations) {
    const file=path.join(pilotDir,'raw',configuration.key+'.json');
    validateExisting(readJson(file),configuration,protocol,pilotDir);
    sources.push({path:path.relative(ROOT,file),sha256:sha(file)});
  }
  const gpuFile=path.join(setup,'gpu-probe/gpu-probe-metal.json'),gpu=readJson(gpuFile);
  assert(gpu.passed&&gpu.executableSha256===host.browserSha256,'Missing matching local GPU timer probe');
  assert(gpu.capabilities.webgpu.info.description.includes(host.hardware.SPHardwareDataType[0].chip_type),'GPU probe chip differs');
  const checks=[
    ['spark-native-sort-cpu-validation.json','passed'],
    ['supersplat-worker.json','passed'],
    ['native-prepare-lifecycle-review.json','passed']
  ];
  for(const [name,field] of checks){const file=path.join(setup,name),data=readJson(file);assert(data[field]===true,'CPU validation not passed: '+name);sources.push({path:path.relative(ROOT,file),sha256:sha(file)});}
  for(const file of [gpuFile,path.join(pilotDir,'protocol.json'),path.join(pilotDir,'runtime-cleanup.json')])sources.push({path:path.relative(ROOT,file),sha256:sha(file)});
  return {schema:'mac-three-method-prerequisites-v1',passed:true,checkedAt:now(),pilotConfigurations:12,pilotSamples:378,pilotDirectory:path.relative(ROOT,pilotDir),sources};
}
async function main() {
  const args=argumentsFrom(process.argv.slice(2));
  const config=readJson(path.resolve(ROOT,args.config));
  const pilot=args.mode==='pilot';
  const inputs=loadInputs(config,pilot);
  const outputBase=config.outputRoot||`results/${new Date().toISOString().slice(0,10)}-spark-0.1.10`;
  const outputDir=path.resolve(ROOT,args.output||path.join(outputBase,pilot?'pilot':args.mode==='validate'?'preflight':''));
  const chrome=path.resolve(ROOT,config.chromeExecutable||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  const python=config.pythonExecutable?path.resolve(ROOT,config.pythonExecutable):'python3';
  assert(process.platform==='darwin'&&process.arch==='arm64','Use native arm64 Node on the target Mac');
  assert(fs.existsSync(chrome),'Google Chrome executable missing');
  if(args.mode==='validate') {
    const checks=inputs.models.map(m=>({scene:m.scene,stride:m.stride,sha256:sha(m.file),expected:m.model.sha256}));
    assert(checks.every(x=>x.sha256===x.expected),'Model SHA256 mismatch');
    const receipt={schema:'mac-portable-input-validation-v1',passed:true,createdAt:now(),models:checks,cameras:Object.fromEntries(inputs.models.filter(x=>x.stride===1).map(x=>[x.scene,x.cameraFileSha256])),configurations:156,selectedViews:378,gpuStarted:false};
    writeJson(path.join(outputDir,'validation/input-integrity.json'),receipt);
    console.log(JSON.stringify({passed:true,models:checks.length,cameras:378,receipt:path.join(outputDir,'validation/input-integrity.json')}));return;
  }
  const repeats=pilot?1:5,cycles=pilot?1:3,warmupMs=pilot?1000:10000;
  const protocolId=pilot?'mac-spark0110-three-method-pilot-v1':'mac-spark0110-three-method-full-v1';
  const lockPath=path.join(ROOT,'results/gpu-session.lock');
  const runtime={schema:'mac-portable-owned-runtime-v1',protocolId,startedAt:now(),runnerPid:process.pid,sessionToken:crypto.randomUUID(),ownedPids:[],configurations:[],complete:false};
  let lockFd,owned=false,caffeinate,servers=[],browser,browserServer,closePromise,cleanupPromise,telemetryTimer,stopping=false;
  const guard=()=>assert(!stopping,'Run interrupted');
  const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
  const saveRuntime=()=>writeJson(path.join(outputDir,'runtime-cleanup.json'),runtime);
  const log=message=>{const line=now()+' '+message;console.log(line);fs.appendFileSync(path.join(outputDir,'run.log'),line+'\n');};
  async function exitChild(child) {
    if(!child||child.exitCode!==null||child.signalCode!==null)return;
    child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(10000)]);
    if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);}
  }
  async function closeBrowser() {
    if(closePromise)return closePromise;
    const b=browser,s=browserServer;browser=browserServer=null;
    closePromise=(async()=>{if(b)await Promise.race([b.close().catch(()=>{}),delay(10000)]);if(s){await Promise.race([s.close().catch(()=>{}),delay(10000)]);await exitChild(s.process());}})();
    try{await closePromise;}finally{closePromise=null;}
  }
  async function cleanup() {
    if(cleanupPromise)return cleanupPromise;
    cleanupPromise=(async()=>{
      if(telemetryTimer){clearInterval(telemetryTimer);telemetryTimer=null;}
      await closeBrowser();for(const server of servers)await exitChild(server);await exitChild(caffeinate);
      runtime.finishedAt=now();runtime.children=runtime.ownedPids.map(x=>({...x,alive:alive(x.pid)}));
      if(lockFd!==undefined){const mine=fs.fstatSync(lockFd);fs.closeSync(lockFd);lockFd=undefined;if(fs.existsSync(lockPath)){const current=fs.statSync(lockPath);if(mine.ino===current.ino&&mine.dev===current.dev)fs.unlinkSync(lockPath);}}
      runtime.gpuLockReleased=!fs.existsSync(lockPath);runtime.passed=runtime.complete&&runtime.children.every(x=>!x.alive)&&runtime.gpuLockReleased;
      if(owned)saveRuntime();
    })();return cleanupPromise;
  }
  function stop(signal){if(stopping)return;stopping=true;runtime.signal=signal;runtime.stopRequestedAt=now();process.exitCode=signal==='SIGINT'?130:signal==='SIGHUP'?129:143;if(owned)saveRuntime();closeBrowser().catch(()=>{});}
  process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop('SIGTERM'));process.on('SIGHUP',()=>stop('SIGHUP'));
  try {
    fs.mkdirSync(path.dirname(lockPath),{recursive:true});lockFd=fs.openSync(lockPath,'wx');fs.writeSync(lockFd,JSON.stringify({pid:process.pid,startedAt:runtime.startedAt,sessionToken:runtime.sessionToken}));owned=true;
    fs.mkdirSync(outputDir,{recursive:true});
    if(fs.existsSync(path.join(outputDir,'runtime-cleanup.json')))fs.copyFileSync(path.join(outputDir,'runtime-cleanup.json'),path.join(outputDir,`runtime-cleanup-previous-${Date.now()}.json`));
    saveRuntime();
    log('PREFLIGHT hashing52models and frozen sources before GPU startup');
    const checkedModels=inputs.models.map(m=>({relative_path:m.model.relative_path,bytes:m.model.bytes,expectedSha256:m.model.sha256,sha256:sha(m.file)}));
    assert(checkedModels.every(m=>m.sha256===m.expectedSha256),'Model integrity failed');
    const inputReceipt={schema:'mac-portable-input-validation-v1',passed:true,createdAt:now(),models:checkedModels,cameras:Object.fromEntries(inputs.models.filter(m=>m.stride===1).map(m=>[m.scene,m.cameraFileSha256])),selectedViews:378};
    const host=inventory(chrome);
    const hardware=host.hardware.SPHardwareDataType?.[0];
    const chip=hardware?.chip_type;assert(chip&&chip.startsWith('Apple '),'Expected Apple Silicon chip');
    assert(host.power.power.includes("Now drawing from 'AC Power'"),'Connect AC power before benchmarking');
    const protocolPath=path.join(outputDir,'protocol.json');
    const fingerprints=sourceHashes(ROOT);
    const prerequisites=pilot?null:checkPrerequisites(config,outputBase,host,fingerprints);
    const measurement={repeats,cyclesPerRepeat:cycles,initialWarmupMs:warmupMs,minWarmupSamples:128,betweenRoundWarmupMs:1500,minBetweenRoundWarmupSamples:32,
      cameraOrder:'(order + repeat*7 + cycle*11) mod heldoutCameraCount',
      e2eDefinition:'Browser performance.now immediately before await bench.sample(camera) through Promise completion, including setCamera, fresh sort, GPU completion waits, query readback/polling and adapter assertions. Excludes display/presentation.',
      windowDefinition:'Browser clock around complete sample loop, including camera selection and bookkeeping; excludes warmup, model load, screenshots, Node RPC and telemetry.',
      fpsDefinition:'1000 * completed sample count / sum of round.windowElapsedMs; serialized completed-frame throughput including instrumentation.',
      percentileDefinition:'Type7 linear interpolation at p*(N-1), all individual completion samples per configuration; cross-scene summaries average scene statistics.',
      qualityCapturePolicy:'Every selected heldout camera, outside timing; lossless RGB WebP; formal display PNGs reused where identities match.',
      powerPolicy:'Observed AC before load, every5seconds, before/after each round and before complete; inactive battery profile ignored; no lock-frequency claim.'};
    let protocol={schema:'mac-portable-three-method-v1',protocolId,runId:path.basename(outputDir),pilot,options:OPTIONS,browserArgs:BROWSER_ARGS,methodDefinitions:METHODS_META,
      scenes:SCENES,strides:pilot?[1,8]:[1,2,4,8],methods:METHODS,repeats,cycles,warmupMs,measurement,
      browserExecutable:chrome,browserSha256:host.browserSha256,browserVersion:host.browserVersion,browserFrameworkIdentity:host.browserFrameworkIdentity,
      experimentHashes:fingerprints,runnerSha256:sha(__filename),hostIdentity:host,powerSourceRequired:'AC Power',
      configurationOrder:inputs.configurations.map(c=>c.key),collectionOrdering:'stride-major, scene-major; rotate three method order by scene and stride; one fresh browser per configuration',
      expectedConfigurations:inputs.configurations.length,expectedSamples:inputs.configurations.reduce((s,c)=>s+c.cameras.length*repeats*cycles,0),createdAt:now()};
    if(fs.existsSync(protocolPath)) {
      const previous=readJson(protocolPath);
      for(const key of ['protocolId','options','browserArgs','methodDefinitions','experimentHashes','runnerSha256','browserSha256','browserVersion','browserFrameworkIdentity','configurationOrder','measurement'])assert(JSON.stringify(previous[key])===JSON.stringify(protocol[key]),'Resume identity/protocol changed: '+key);
      assert(previous.hostIdentity.osVersion===host.osVersion&&previous.hostIdentity.hardware.SPHardwareDataType[0].chip_type===chip,'Resume host changed');
      protocol=previous;
    } else {
      writeJson(path.join(outputDir,'validation/input-integrity.json'),inputReceipt);
      writeJson(path.join(outputDir,'environment/host-inventory.json'),host);
      if(prerequisites){writeJson(path.join(outputDir,'validation/prerequisites.json'),prerequisites);protocol.prerequisitesSha256=sha(path.join(outputDir,'validation/prerequisites.json'));}
      protocol.hostInventorySha256=sha(path.join(outputDir,'environment/host-inventory.json'));
      protocol.inputIntegritySha256=sha(path.join(outputDir,'validation/input-integrity.json'));
      writeJson(protocolPath,protocol);
    }
    const {chromium}=require(config.playwrightModule||'playwright');
    caffeinate=spawn('/usr/bin/caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});caffeinate.on('error',e=>{runtime.caffeinateError=String(e);stopping=true;});runtime.ownedPids.push({kind:'caffeinate',pid:caffeinate.pid});
    for(const {host:directory,port} of [METHODS_META.visionary,METHODS_META.spark,METHODS_META.supersplat]) {
      guard();await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
      const fd=fs.openSync(path.join(outputDir,`vite-${port}.log`),'a');
      const server=spawn(process.execPath,[path.join(ROOT,'work/bench/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:path.join(ROOT,'work',directory),env:{...process.env,BENCH_DATA_ROOT:inputs.dataRoot},stdio:['ignore',fd,fd]});fs.closeSync(fd);
      servers.push(server);runtime.ownedPids.push({kind:'vite',port,pid:server.pid});let serverError;server.on('error',e=>{serverError=e;});
      let ready=false;const deadline=Date.now()+45000;
      while(Date.now()<deadline){guard();if(serverError)throw serverError;assert(server.exitCode===null&&server.signalCode===null,'Owned Vite exited');try{await new Promise((resolve,reject)=>{const req=http.get(`http://127.0.0.1:${port}`,res=>{res.resume();res.statusCode===200?resolve():reject(Error('HTTP'+res.statusCode));});req.on('error',reject);req.setTimeout(2000,()=>req.destroy(Error('Readiness timeout')));});ready=true;break;}catch{await delay(250);}}
      assert(ready,'Vite not ready');saveRuntime();
    }
    for(const c of inputs.configurations) {
      guard();assert(servers.every(s=>s.exitCode===null&&s.signalCode===null),'Owned server exited');
      const rawPath=path.join(outputDir,'raw',c.key+'.json');
      if(fs.existsSync(rawPath)){
        const old=readJson(rawPath);validateExisting(old,c,protocol,outputDir);
        runtime.configurations.push({key:c.key,status:'complete',sha256:sha(rawPath),resumed:true});log('SKIP '+c.key);continue;
      }
      const def=METHODS_META[c.method],options={...OPTIONS,sort32:c.method==='spark'&&METHODS_META.spark.sortBits===32};
      const telemetryRelative=`telemetry/${c.key}.jsonl`,telemetryPath=path.join(outputDir,telemetryRelative);
      fs.mkdirSync(path.dirname(telemetryPath),{recursive:true});
      if(fs.existsSync(telemetryPath))fs.renameSync(telemetryPath,telemetryPath+'.previous-'+Date.now());
      const record={schemaVersion:2,protocolId,engine:c.engine,method:c.method,scene:c.scene,stride:c.stride,dataset:c.dataset,
        cameras:c.cameras,cameraFileSha256:c.cameraFileSha256,model:c.model,options,runnerSha256:protocol.runnerSha256,experimentHashes:fingerprints,
        protocol:measurement,hostIdentity:protocol.hostIdentity,browserSha256:host.browserSha256,browserFrameworkIdentity:host.browserFrameworkIdentity,
        startedAt:now(),rounds:[],captures:[],qualityCaptures:[],status:'running',powerViolations:[],errors:[],telemetryPath:telemetryRelative};
      let telemetryError;
      const powerSample=phase=>{const sample={...powerSnapshot(),phase};if(!sample.power.includes("Now drawing from 'AC Power'"))record.powerViolations.push(sample);fs.appendFileSync(telemetryPath,JSON.stringify(sample)+'\n');return sample;};
      const assertPower=()=>{if(telemetryError)throw telemetryError;assert(record.powerViolations.length===0,'AC power protocol violated');};
      try {
        log(`START ${c.key} GS=${c.model.gaussian_count} views=${c.cameras.length}`);
        const browserNow=browserIdentity(chrome);assert(browserNow.browserSha256===protocol.browserSha256&&JSON.stringify(browserNow.browserFrameworkIdentity)===JSON.stringify(protocol.browserFrameworkIdentity),'Chrome changed during collection');
        record.powerStart=powerSample('before-load');assertPower();
        telemetryTimer=setInterval(()=>{try{powerSample('interval');}catch(e){telemetryError=e;}},5000);
        // Playwright's default SIGINT handler calls process.exit(130), bypassing
        // our finally block and lock receipt. This runner owns all shutdown.
        browserServer=await chromium.launchServer({executablePath:chrome,headless:true,args:BROWSER_ARGS,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});runtime.ownedPids.push({kind:'chrome',key:c.key,pid:browserServer.process().pid});saveRuntime();guard();
        browser=await chromium.connect(browserServer.wsEndpoint());guard();record.browserVersion=browser.version();assert(protocol.browserVersion.includes(record.browserVersion),'Browser version changed');
        const page=await browser.newPage({viewport:{width:1280,height:760},deviceScaleFactor:1});page.setDefaultTimeout(120000);
        page.on('pageerror',e=>record.errors.push({type:'pageerror',message:e.stack||String(e)}));
        page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (Not Found)'))record.errors.push({type:'console',message:m.text()});});
        await page.goto(`http://127.0.0.1:${def.port}`);await page.waitForFunction(()=>!!window.bench,{timeout:30000});
        record.initialMetadata=await page.evaluate(({engine,options})=>window.bench.init(engine,options),{engine:c.engine,options});assertMetadata(record.initialMetadata,c.method,chip);
        record.framebuffer=await page.evaluate(()=>{const canvas=document.querySelector('canvas');return {width:canvas.width,height:canvas.height,devicePixelRatio,viewportWidth:innerWidth,viewportHeight:innerHeight,browserUserAgent:navigator.userAgent,crossOriginIsolated,timeOrigin:performance.timeOrigin};});
        assert(record.framebuffer.width===1280&&record.framebuffer.height===720&&record.framebuffer.devicePixelRatio===1,'Framebuffer mismatch');
        guard();record.loadInfo=await page.evaluate(url=>window.bench.load(url),'/data/'+c.model.relative_path);assert((record.loadInfo.gaussianCount??record.loadInfo.numSplats)===c.model.gaussian_count,'Loaded Gaussian count mismatch');
        guard();record.warmup=await page.evaluate(({cameras,ms})=>window.bench.warmup(cameras,ms,128),{cameras:c.cameras,ms:warmupMs});
        for(let repeat=0;repeat<repeats;repeat++){
          guard();const round={repeat,startedAt:now()};
          if(repeat>0)round.warmup=await page.evaluate(cameras=>window.bench.warmup(cameras,1500,32),c.cameras);
          round.powerBefore=powerSample('before-round-'+repeat);assertPower();
          Object.assign(round,await page.evaluate(async({cameras,repeat,cycles})=>{
            const samples=[],windowStartMs=performance.now();
            for(let cycle=0;cycle<cycles;cycle++)for(let order=0;order<cameras.length;order++){
              const cameraIndex=(order+repeat*7+cycle*11)%cameras.length,camera=cameras[cameraIndex];
              const e2eStartMs=performance.now(),metrics=await window.bench.sample(camera),e2eEndMs=performance.now();
              for(const key of ['repeat','cycle','order','cameraIndex','cameraId','img_name','e2eStartMs','e2eEndMs','e2eCompletionMs'])if(Object.hasOwn(metrics,key))throw Error('Reserved metric collision: '+key);
              samples.push({...metrics,repeat,cycle,order,cameraIndex,cameraId:camera.id,img_name:camera.img_name,e2eStartMs,e2eEndMs,e2eCompletionMs:e2eEndMs-e2eStartMs});
            }
            const windowEndMs=performance.now();return {samples,windowStartMs,windowEndMs,windowElapsedMs:windowEndMs-windowStartMs};
          },{cameras:c.cameras,repeat,cycles}));
          round.sampleCount=round.samples.length;round.completedFramesPerSecond=round.sampleCount*1000/round.windowElapsedMs;
          assert(round.sampleCount===c.cameras.length*cycles&&round.windowElapsedMs>=round.samples.reduce((sum,s)=>sum+s.e2eCompletionMs,0)-1e-6,'Round window/coverage mismatch');
          round.completedAt=now();round.powerAfter=powerSample('after-round-'+repeat);record.rounds.push(round);assertPower();
          writeJson(path.join(outputDir,'checkpoints',c.key+'.json'),record);
          log(`ROUND ${c.key} ${repeat+1}/${repeats} samples=${round.sampleCount} completedFPS=${round.completedFramesPerSecond.toFixed(3)}`);
        }
        const displayIndices=[...new Set(c.stride===1?[0,Math.floor(c.cameras.length/2),c.cameras.length-1]:[0])];
        const captureDir=path.join(outputDir,'captures');fs.mkdirSync(captureDir,{recursive:true});
        for(const index of displayIndices){guard();await page.evaluate(camera=>window.bench.sample(camera),c.cameras[index]);const relative=`captures/${c.key}-v${String(index).padStart(3,'0')}.png`;await page.locator('canvas').screenshot({path:path.join(outputDir,relative)});record.captures.push({path:relative,sha256:sha(path.join(outputDir,relative)),cameraIndex:index,img_name:c.cameras[index].img_name});}
        record.rafStartedAt=now();record.raf=c.stride===1?await page.evaluate(cameras=>window.bench.runRaf(cameras,360,60),c.cameras):[];record.rafCompletedAt=now();
        record.qualityStartedAt=now();const qualityDir=path.join(outputDir,'quality-captures');fs.mkdirSync(qualityDir,{recursive:true});
        for(let index=0;index<c.cameras.length;index++){
          guard();const temporary=path.join(qualityDir,`${c.key}-v${String(index).padStart(3,'0')}.png`),display=record.captures.find(x=>x.cameraIndex===index);
          if(display)fs.copyFileSync(path.join(outputDir,display.path),temporary);else{await page.evaluate(camera=>window.bench.sample(camera),c.cameras[index]);await page.locator('canvas').screenshot({path:temporary});}
          record.qualityCaptures.push({path:path.relative(outputDir,temporary).replace(/\.png$/,'.webp'),cameraIndex:index,img_name:c.cameras[index].img_name,source:display?'reused-formal-display-capture':'fresh-post-raf-capture',sourcePngSha256:sha(temporary)});
        }
        execFileSync(python,[path.join(ROOT,'runner/compress-captures.py'),qualityDir,c.key],{stdio:'inherit',timeout:300000});
        for(const capture of record.qualityCaptures)capture.sha256=sha(path.join(outputDir,capture.path));
        record.qualityCompletedAt=now();record.metadata=await page.evaluate(()=>window.bench.metadata());assertMetadata(record.metadata,c.method,chip,true);
        assert(record.errors.length===0&&!record.metadata.events?.length,'Browser reported runtime errors');
        guard();record.powerEnd=powerSample('before-complete');assertPower();
        clearInterval(telemetryTimer);telemetryTimer=null;record.telemetrySha256=sha(telemetryPath);
        record.e2eCompletion=summarize(record.rounds);record.completedAt=now();record.status='complete';
        validateExisting(record,c,protocol,outputDir);
        writeJson(rawPath,record);runtime.configurations.push({key:c.key,status:'complete',sha256:sha(rawPath)});saveRuntime();
        writeJson(path.join(outputDir,'progress.json'),{updatedAt:now(),protocolId,completedConfigurations:runtime.configurations.length,expectedConfigurations:inputs.configurations.length,latest:c.key,complete:runtime.configurations.length===inputs.configurations.length});log('DONE '+c.key);
      }catch(error){record.status='failed';record.error=error.stack||String(error);record.completedAt=now();writeJson(path.join(outputDir,'failures',`${c.key}-${Date.now()}.json`),record);throw error;}
      finally {if(telemetryTimer){clearInterval(telemetryTimer);telemetryTimer=null;}await closeBrowser();}
    }
    assert(runtime.configurations.length===inputs.configurations.length,'Incomplete configuration coverage');runtime.complete=true;log('ALL_REQUESTED_CONFIGURATIONS_COMPLETE');
  }catch(error){runtime.error=error.stack||String(error);console.error(runtime.error);process.exitCode=stopping?(runtime.signal==='SIGINT'?130:runtime.signal==='SIGHUP'?129:143):1;}
  finally{await cleanup();}
}
module.exports={argumentsFrom,loadInputs,assertMetadata,validateExisting,METHODS_META};
if(require.main===module)main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
