import { hash32Fnv1a } from '../../../core/hash.js';
import { array } from '../../../core/array-utils.js';
import { WebgpuVertexBufferLayout } from './webgpu-vertex-buffer-layout.js';
import { WebgpuPipeline } from './webgpu-pipeline.js';

var _primitiveTopology = [
		'point-list',
		'line-list',
		undefined,
		'line-strip',
		'triangle-list',
		'triangle-strip',
		undefined
];
var _blendOperation = [
		'add',
		'subtract',
		'reverse-subtract',
		'min',
		'max'
];
var _blendFactor = [
		'zero',
		'one',
		'src',
		'one-minus-src',
		'dst',
		'one-minus-dst',
		'src-alpha',
		'src-alpha-saturated',
		'one-minus-src-alpha',
		'dst-alpha',
		'one-minus-dst-alpha',
		'constant',
		'one-minus-constant'
];
var _compareFunction = [
		'never',
		'less',
		'equal',
		'less-equal',
		'greater',
		'not-equal',
		'greater-equal',
		'always'
];
var _cullModes = [
		'none',
		'back',
		'front'
];
var _stencilOps = [
		'keep',
		'zero',
		'replace',
		'increment-clamp',
		'increment-wrap',
		'decrement-clamp',
		'decrement-wrap',
		'invert'
];
class CacheEntry {
}
class WebgpuRenderPipeline extends WebgpuPipeline {
		get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState, depthState, cullMode, stencilEnabled, stencilFront, stencilBack) {
				var _bindGroupFormats_, _bindGroupFormats_1, _bindGroupFormats_2;
				var lookupHashes = this.lookupHashes;
				lookupHashes[0] = primitive.type;
				lookupHashes[1] = shader.id;
				lookupHashes[2] = cullMode;
				lookupHashes[3] = depthState.key;
				lookupHashes[4] = blendState.key;
				var _vertexFormat0_renderingHash;
				lookupHashes[5] = (_vertexFormat0_renderingHash = vertexFormat0 == null ? undefined : vertexFormat0.renderingHash) != null ? _vertexFormat0_renderingHash : 0;
				var _vertexFormat1_renderingHash;
				lookupHashes[6] = (_vertexFormat1_renderingHash = vertexFormat1 == null ? undefined : vertexFormat1.renderingHash) != null ? _vertexFormat1_renderingHash : 0;
				lookupHashes[7] = renderTarget.impl.key;
				var _bindGroupFormats__key;
				lookupHashes[8] = (_bindGroupFormats__key = (_bindGroupFormats_ = bindGroupFormats[0]) == null ? undefined : _bindGroupFormats_.key) != null ? _bindGroupFormats__key : 0;
				var _bindGroupFormats__key1;
				lookupHashes[9] = (_bindGroupFormats__key1 = (_bindGroupFormats_1 = bindGroupFormats[1]) == null ? undefined : _bindGroupFormats_1.key) != null ? _bindGroupFormats__key1 : 0;
				var _bindGroupFormats__key2;
				lookupHashes[10] = (_bindGroupFormats__key2 = (_bindGroupFormats_2 = bindGroupFormats[2]) == null ? undefined : _bindGroupFormats_2.key) != null ? _bindGroupFormats__key2 : 0;
				lookupHashes[11] = stencilEnabled ? stencilFront.key : 0;
				lookupHashes[12] = stencilEnabled ? stencilBack.key : 0;
				var hash = hash32Fnv1a(lookupHashes);
				var cacheEntries = this.cache.get(hash);
				if (cacheEntries) {
						for(var i = 0; i < cacheEntries.length; i++){
								var entry = cacheEntries[i];
								if (array.equals(entry.hashes, lookupHashes)) {
										return entry.pipeline;
								}
						}
				}
				var primitiveTopology = _primitiveTopology[primitive.type];
				var pipelineLayout = this.getPipelineLayout(bindGroupFormats);
				var vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);
				var cacheEntry = new CacheEntry();
				cacheEntry.hashes = new Uint32Array(lookupHashes);
				cacheEntry.pipeline = this.create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack);
				if (cacheEntries) {
						cacheEntries.push(cacheEntry);
				} else {
						cacheEntries = [
								cacheEntry
						];
				}
				this.cache.set(hash, cacheEntries);
				return cacheEntry.pipeline;
		}
		getBlend(blendState) {
				var blend;
				if (blendState.blend) {
						blend = {
								color: {
										operation: _blendOperation[blendState.colorOp],
										srcFactor: _blendFactor[blendState.colorSrcFactor],
										dstFactor: _blendFactor[blendState.colorDstFactor]
								},
								alpha: {
										operation: _blendOperation[blendState.alphaOp],
										srcFactor: _blendFactor[blendState.alphaSrcFactor],
										dstFactor: _blendFactor[blendState.alphaDstFactor]
								}
						};
				}
				return blend;
		}
		getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack) {
				var depthStencil;
				var { depth, stencil } = renderTarget;
				if (depth || stencil) {
						depthStencil = {
								format: renderTarget.impl.depthAttachment.format
						};
						if (depth) {
								depthStencil.depthWriteEnabled = depthState.write;
								depthStencil.depthCompare = _compareFunction[depthState.func];
								depthStencil.depthBias = depthState.depthBias;
								depthStencil.depthBiasSlopeScale = depthState.depthBiasSlope;
						} else {
								depthStencil.depthWriteEnabled = false;
								depthStencil.depthCompare = 'always';
						}
						if (stencil && stencilEnabled) {
								depthStencil.stencilReadMas = stencilFront.readMask;
								depthStencil.stencilWriteMask = stencilFront.writeMask;
								depthStencil.stencilFront = {
										compare: _compareFunction[stencilFront.func],
										failOp: _stencilOps[stencilFront.fail],
										passOp: _stencilOps[stencilFront.zpass],
										depthFailOp: _stencilOps[stencilFront.zfail]
								};
								depthStencil.stencilBack = {
										compare: _compareFunction[stencilBack.func],
										failOp: _stencilOps[stencilBack.fail],
										passOp: _stencilOps[stencilBack.zpass],
										depthFailOp: _stencilOps[stencilBack.zfail]
								};
						}
				}
				return depthStencil;
		}
		create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout, cullMode, stencilEnabled, stencilFront, stencilBack) {
				var wgpu = this.device.wgpu;
				var webgpuShader = shader.impl;
				var desc = {
						vertex: {
								module: webgpuShader.getVertexShaderModule(),
								entryPoint: webgpuShader.vertexEntryPoint,
								buffers: vertexBufferLayout
						},
						primitive: {
								topology: primitiveTopology,
								frontFace: 'ccw',
								cullMode: _cullModes[cullMode]
						},
						depthStencil: this.getDepthStencil(depthState, renderTarget, stencilEnabled, stencilFront, stencilBack),
						multisample: {
								count: renderTarget.samples
						},
						layout: pipelineLayout
				};
				desc.fragment = {
						module: webgpuShader.getFragmentShaderModule(),
						entryPoint: webgpuShader.fragmentEntryPoint,
						targets: []
				};
				var colorAttachments = renderTarget.impl.colorAttachments;
				if (colorAttachments.length > 0) {
						var writeMask = 0;
						if (blendState.redWrite) writeMask |= GPUColorWrite.RED;
						if (blendState.greenWrite) writeMask |= GPUColorWrite.GREEN;
						if (blendState.blueWrite) writeMask |= GPUColorWrite.BLUE;
						if (blendState.alphaWrite) writeMask |= GPUColorWrite.ALPHA;
						var blend = this.getBlend(blendState);
						colorAttachments.forEach((attachment)=>{
								desc.fragment.targets.push({
										format: attachment.format,
										writeMask: writeMask,
										blend: blend
								});
						});
				}
				var pipeline = wgpu.createRenderPipeline(desc);
				return pipeline;
		}
		constructor(device){
				super(device), this.lookupHashes = new Uint32Array(13);
				this.vertexBufferLayout = new WebgpuVertexBufferLayout();
				this.cache = new Map();
		}
}

export { WebgpuRenderPipeline };
