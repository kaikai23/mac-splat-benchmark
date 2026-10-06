import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const originalPath = path.resolve(root, 'vendor/playcanvas/build/playcanvas/src/scene/gsplat/gsplat-sorter.js');
const official = fs.readFileSync(originalPath, 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
if (sha(official) !== 'a157d1259ed5b7800e3766d68a08844e5174cafe7aebbc3137d7179e43d120e1') throw Error('Pinned official release sorter changed');
let code = official;
const edits = [];
function replace(before, after) {
  if (code.split(before).length !== 2) throw Error('Patch anchor not unique: ' + before.slice(0,70));
  code = code.replace(before, after); edits.push({before, after});
}
replace('var forceUpdate = false;', 'var forceUpdate = false;\n        var benchmarkRequest = null;\n        var benchmarkSequence = 0;');
replace('forceUpdate = false;\n\t\t\t\tlastCameraPosition.x = px;',
  'forceUpdate = false;\n                var benchmarkStart = performance.now();\n\t\t\t\tlastCameraPosition.x = px;');
replace('for(var i2 = 1; i2 < bucketCount; i2++){',
  'var benchmarkKeysDone = performance.now();\n                for(var i2 = 1; i2 < bucketCount; i2++){');
replace('var dist = (i)=>distances[order[i]] / divider + minDist;',
  'var benchmarkSortDone = performance.now();\n                var dist = (i)=>distances[order[i]] / divider + minDist;');
replace('self.postMessage({\n\t\t\t\t\t\torder: order.buffer,',
`var benchmarkEnd = performance.now();
                var benchmark = {
                    requestId: benchmarkRequest?.requestId ?? null,
                    sortSequence: ++benchmarkSequence,
                    sourceOrigin: [px, py, pz], sourceDirection: [dx, dy, dz],
                    cpuPrepMs: benchmarkKeysDone - benchmarkStart,
                    cpuSortMs: benchmarkSortDone - benchmarkKeysDone,
                    cpuPostprocessMs: benchmarkEnd - benchmarkSortDone,
                    cpuWorkerSpanMs: benchmarkEnd - benchmarkStart,
                    sortedSplats: numVertices, activeSplats: count, compareBits, bucketCount
                };
                benchmarkRequest = null;
                self.postMessage({
                        benchmark,
\t\t\t\t\t\torder: order.buffer,`);
replace('if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;',
`if (message.data.benchmarkRequest) {
                    benchmarkRequest = message.data.benchmarkRequest;
                    if (benchmarkRequest.force) forceUpdate = true;
                } else if (message.data.cameraPosition) {
                    benchmarkRequest = null;
                }
                if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;`);
replace('class GSplatSorter extends EventHandler {',
  'class GSplatSorter extends EventHandler {\n        benchmarkInstrumentation = true;\n        benchmarkLastResult = null;');
replace("this.fire('updated', message.data.count);",
  "this.benchmarkLastResult = message.data.benchmark;\n                        this.fire('updated', message.data.count);");
replace("from '../../core/event-handler.js'", "from '../vendor/playcanvas/build/playcanvas/src/core/event-handler.js'");
replace("from '../../platform/graphics/constants.js'", "from '../vendor/playcanvas/build/playcanvas/src/platform/graphics/constants.js'");

let reversed = code;
for (const {before, after} of [...edits].reverse()) {
  if (reversed.split(after).length !== 2) throw Error('Non-reversible instrumentation');
  reversed = reversed.replace(after, before);
}
if (reversed !== official) throw Error('Reverse patch mismatch');
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/gsplat-sorter.benchmark.js'), code);
fs.writeFileSync(path.join(root, 'instrumentation-edits.json'), JSON.stringify(edits, null, 2)+'\n');
const receipt = {
  schema: 'supersplat-editor-2.1.0-benchmark-instrumentation-v1',
  editorVersion: '2.1.0', editorCommit: '2f23b4b2072da694172faa26ff44fc67f2a01ca2',
  playcanvasVersion: '2.5.1', playcanvasCommit: '362a874c7149ee181ba68f4cc270fc7b664d7f0b',
  releaseSorterSha256: sha(official), instrumentedSorterSha256: sha(code),
  builderSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  reversePatchExact: true,
  algorithmChanges: 'none; original release module plus timers and benchmark-only forced-current-view request flag',
  originalReleaseTreeModified: false,
  cpuPrep: 'bounds/key quantization and fused histogram including necessary buffer clear/allocation',
  cpuSort: 'prefix sum + scatter', cpuPostprocess: 'front-camera count + optional mapping',
  validationReceipts: ['worker-verification.json', 'pilot validation written by runner'],
};
fs.writeFileSync(path.join(root, 'benchmark-provenance.json'), JSON.stringify(receipt, null, 2)+'\n');
console.log(JSON.stringify(receipt, null, 2));
