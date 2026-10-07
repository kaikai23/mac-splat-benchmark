'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {onnx}=require(path.join(__dirname,'node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js'));
function inspect(file){
  const bytes=fs.readFileSync(file),m=onnx.ModelProto.decode(bytes),g=m.graph;
  if(!g||!g.node.length||g.initializer.some(x=>x.externalData.length||x.dataLocation===1))throw Error('Invalid graph or external tensor data');
  const value=v=>({name:v.name,dataType:v.type.tensorType.elemType,shape:v.type.tensorType.shape.dim.map(d=>d.dimParam||Number(d.dimValue))});
  const ops={};for(const n of g.node)ops[n.opType]=(ops[n.opType]||0)+1;
  return {schema:'visionary-native-model-v1',filename:path.basename(file),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),producer:m.producerName,producerVersion:m.producerVersion,irVersion:Number(m.irVersion),graphName:g.name,docString:m.docString||g.docString,opsets:m.opsetImport.map(o=>({domain:o.domain,version:Number(o.version)})),inputs:g.input.map(value),outputs:g.output.map(value),nodeCount:g.node.length,initializerCount:g.initializer.length,operators:ops,metadata:m.metadataProps.map(x=>({key:x.key,value:x.value})),externalData:false};
}
if(require.main===module){const info=inspect(path.resolve(process.argv[2]));if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(info,null,2)+'\n');console.log(JSON.stringify(info,null,2));}
module.exports={inspect};
