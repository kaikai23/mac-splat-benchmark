'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {sha,writeJson,assert,now}=require('../runner/common.cjs'),{inspect}=require('./inspect-model.cjs');
const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--output','Usage: node dynamic-native/prepare-model.cjs --output DATA_DIRECTORY');
const output=path.resolve(args[1]),lock=require('./model-lock.json');fs.mkdirSync(output,{recursive:true});
const file=path.join(output,lock.filename),temporary=file+'.partial';
if(!fs.existsSync(file)){
  assert(!fs.existsSync(temporary),'Partial file exists; inspect or move it before restarting');
  try{execFileSync('/usr/bin/curl',['--fail','--location','--retry','3','--max-time','900','--output',temporary,lock.url],{stdio:'inherit'});assert(fs.statSync(temporary).size===lock.bytes&&sha(temporary)===lock.sha256,'Official model size/SHA256 mismatch');fs.renameSync(temporary,file);}catch(e){throw e;}
}
assert(fs.statSync(file).size===lock.bytes&&sha(file)===lock.sha256,'Existing model size/SHA256 mismatch');
const modelInfo=inspect(file);writeJson(path.join(output,'model-info.json'),modelInfo);writeJson(path.join(output,'download-provenance.json'),{verifiedAt:now(),source:lock,modelInfo,verified:true,modelPath:file});console.log('Verified official ONNX model:',modelInfo.sha256);
