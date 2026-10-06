import { BUFFERUSAGE_READ, BUFFERUSAGE_COPY_DST, DEVICETYPE_WEBGPU, UNUSED_UNIFORM_NAME, DISPLAYFORMAT_LDR_SRGB, PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA8, PIXELFORMAT_SBGRA8, PIXELFORMAT_BGRA8, DISPLAYFORMAT_HDR, PIXELFORMAT_RGBA16F, semanticToLocation } from '../constants.js';
import { BindGroupFormat } from '../bind-group-format.js';
import { BindGroup } from '../bind-group.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebgpuBindGroup } from './webgpu-bind-group.js';
import { WebgpuBindGroupFormat } from './webgpu-bind-group-format.js';
import { WebgpuIndexBuffer } from './webgpu-index-buffer.js';
import { WebgpuRenderPipeline } from './webgpu-render-pipeline.js';
import { WebgpuComputePipeline } from './webgpu-compute-pipeline.js';
import { WebgpuRenderTarget } from './webgpu-render-target.js';
import { WebgpuShader } from './webgpu-shader.js';
import { WebgpuTexture } from './webgpu-texture.js';
import { WebgpuUniformBuffer } from './webgpu-uniform-buffer.js';
import { WebgpuVertexBuffer } from './webgpu-vertex-buffer.js';
import { WebgpuClearRenderer } from './webgpu-clear-renderer.js';
import { WebgpuMipmapRenderer } from './webgpu-mipmap-renderer.js';
import { WebgpuDynamicBuffers } from './webgpu-dynamic-buffers.js';
import { WebgpuGpuProfiler } from './webgpu-gpu-profiler.js';
import { WebgpuResolver } from './webgpu-resolver.js';
import { WebgpuCompute } from './webgpu-compute.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
		try {
				var info = gen[key](arg);
				var value = info.value;
		} catch (error) {
				reject(error);
				return;
		}
		if (info.done) {
				resolve(value);
		} else {
				Promise.resolve(value).then(_next, _throw);
		}
}
function _async_to_generator(fn) {
		return function() {
				var self = this, args = arguments;
				return new Promise(function(resolve, reject) {
						var gen = fn.apply(self, args);
						function _next(value) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
						}
						function _throw(err) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
						}
						_next(undefined);
				});
		};
}
var _uniqueLocations = new Map();
class WebgpuGraphicsDevice extends GraphicsDevice {
		destroy() {
				this.clearRenderer.destroy();
				this.clearRenderer = null;
				this.mipmapRenderer.destroy();
				this.mipmapRenderer = null;
				this.resolver.destroy();
				this.resolver = null;
				super.destroy();
		}
		initDeviceCaps() {
				var _this_wgpu;
				var limits = (_this_wgpu = this.wgpu) == null ? undefined : _this_wgpu.limits;
				this.limits = limits;
				this.precision = 'highp';
				this.maxPrecision = 'highp';
				this.maxSamples = 4;
				this.maxTextures = 16;
				this.maxTextureSize = limits.maxTextureDimension2D;
				this.maxCubeMapSize = limits.maxTextureDimension2D;
				this.maxVolumeSize = limits.maxTextureDimension3D;
				this.maxColorAttachments = limits.maxColorAttachments;
				this.maxPixelRatio = 1;
				this.maxAnisotropy = 16;
				this.fragmentUniformsCount = limits.maxUniformBufferBindingSize / 16;
				this.vertexUniformsCount = limits.maxUniformBufferBindingSize / 16;
				this.supportsUniformBuffers = true;
				this.supportsAreaLights = true;
				this.supportsGpuParticles = true;
				this.supportsCompute = true;
				this.textureFloatRenderable = true;
				this.textureHalfFloatRenderable = true;
				this.supportsImageBitmap = true;
				this.samples = this.backBufferAntialias ? 4 : 1;
				var wgslFeatures = navigator.gpu.wgslLanguageFeatures;
				this.supportsStorageTextureRead = wgslFeatures == null ? undefined : wgslFeatures.has('readonly_and_readwrite_storage_textures');
		}
		initWebGpu(glslangUrl, twgslUrl) {
				var _this = this;
				return _async_to_generator(function*() {
						if (!window.navigator.gpu) {
								throw new Error('Unable to retrieve GPU. Ensure you are using a browser that supports WebGPU rendering.');
						}
						var buildUrl = (srcPath)=>{
								return new URL(srcPath, window.location.href).toString();
						};
						var results = yield Promise.all([
								import(/* @vite-ignore */ /* webpackIgnore: true */ "" + buildUrl(twgslUrl)).then((module)=>twgsl(twgslUrl.replace('.js', '.wasm'))),
								import(/* @vite-ignore */ /* webpackIgnore: true */ "" + buildUrl(glslangUrl)).then((module)=>module.default())
						]);
						_this.twgsl = results[0];
						_this.glslang = results[1];
						return _this.createDevice();
				})();
		}
		createDevice() {
				var _this = this;
				return _async_to_generator(function*() {
						var _this_gpuAdapter, _this_wgpu_lost;
						var adapterOptions = {
								powerPreference: _this.initOptions.powerPreference !== 'default' ? _this.initOptions.powerPreference : undefined
						};
						_this.gpuAdapter = yield window.navigator.gpu.requestAdapter(adapterOptions);
						var requiredFeatures = [];
						var requireFeature = (feature)=>{
								var supported = _this.gpuAdapter.features.has(feature);
								if (supported) {
										requiredFeatures.push(feature);
								}
								return supported;
						};
						_this.textureFloatFilterable = requireFeature('float32-filterable');
						_this.textureFloatBlendable = requireFeature('float32-blendable');
						_this.extCompressedTextureS3TC = requireFeature('texture-compression-bc');
						_this.extCompressedTextureETC = requireFeature('texture-compression-etc2');
						_this.extCompressedTextureASTC = requireFeature('texture-compression-astc');
						_this.supportsTimestampQuery = requireFeature('timestamp-query');
						_this.supportsDepthClip = requireFeature('depth-clip-control');
						_this.supportsDepth32Stencil = requireFeature('depth32float-stencil8');
						_this.supportsIndirectFirstInstance = requireFeature('indirect-first-instance');
						_this.supportsShaderF16 = requireFeature('shader-f16');
						_this.supportsStorageRGBA8 = requireFeature('bgra8unorm-storage');
						_this.textureRG11B10Renderable = requireFeature('rg11b10ufloat-renderable');
						_this.supportsClipDistances = requireFeature('clip-distances');
						var adapterLimits = (_this_gpuAdapter = _this.gpuAdapter) == null ? undefined : _this_gpuAdapter.limits;
						var requiredLimits = {};
						if (adapterLimits) {
								for(var limitName in adapterLimits){
										if (limitName === 'minSubgroupSize' || limitName === 'maxSubgroupSize') {
												continue;
										}
										requiredLimits[limitName] = adapterLimits[limitName];
								}
						}
						var deviceDescr = {
								requiredFeatures,
								requiredLimits,
								defaultQueue: {
										label: 'Default Queue'
								}
						};
						_this.wgpu = yield _this.gpuAdapter.requestDevice(deviceDescr);
						(_this_wgpu_lost = _this.wgpu.lost) == null ? undefined : _this_wgpu_lost.then(_this.handleDeviceLost.bind(_this));
						_this.initDeviceCaps();
						_this.gpuContext = _this.canvas.getContext('webgpu');
						var canvasToneMapping = 'standard';
						var preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();
						var displayFormat = _this.initOptions.displayFormat;
						_this.backBufferFormat = preferredCanvasFormat === 'rgba8unorm' ? displayFormat === DISPLAYFORMAT_LDR_SRGB ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8 : displayFormat === DISPLAYFORMAT_LDR_SRGB ? PIXELFORMAT_SBGRA8 : PIXELFORMAT_BGRA8;
						_this.backBufferViewFormat = displayFormat === DISPLAYFORMAT_LDR_SRGB ? "" + preferredCanvasFormat + "-srgb" : preferredCanvasFormat;
						if (displayFormat === DISPLAYFORMAT_HDR && _this.textureFloatFilterable) {
								var hdrMediaQuery = window.matchMedia('(dynamic-range: high)');
								if (hdrMediaQuery == null ? undefined : hdrMediaQuery.matches) {
										_this.backBufferFormat = PIXELFORMAT_RGBA16F;
										_this.backBufferViewFormat = 'rgba16float';
										preferredCanvasFormat = 'rgba16float';
										_this.isHdr = true;
										canvasToneMapping = 'extended';
								}
						}
						_this.canvasConfig = {
								device: _this.wgpu,
								colorSpace: 'srgb',
								alphaMode: _this.initOptions.alpha ? 'premultiplied' : 'opaque',
								format: preferredCanvasFormat,
								toneMapping: {
										mode: canvasToneMapping
								},
								usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
								viewFormats: displayFormat === DISPLAYFORMAT_LDR_SRGB ? [
										_this.backBufferViewFormat
								] : []
						};
						_this.gpuContext.configure(_this.canvasConfig);
						_this.createBackbuffer();
						_this.clearRenderer = new WebgpuClearRenderer(_this);
						_this.mipmapRenderer = new WebgpuMipmapRenderer(_this);
						_this.resolver = new WebgpuResolver(_this);
						_this.postInit();
						return _this;
				})();
		}
		handleDeviceLost(info) {
				var _this = this, _superprop_get_loseContext = ()=>super.loseContext, _superprop_get_restoreContext = ()=>super.restoreContext;
				return _async_to_generator(function*() {
						if (info.reason !== 'destroyed') {
								_superprop_get_loseContext().call(_this);
								yield _this.createDevice();
								_superprop_get_restoreContext().call(_this);
						}
				})();
		}
		postInit() {
				super.postInit();
				this.initializeRenderState();
				this.setupPassEncoderDefaults();
				this.gpuProfiler = new WebgpuGpuProfiler(this);
				this.dynamicBuffers = new WebgpuDynamicBuffers(this, 100 * 1024, this.limits.minUniformBufferOffsetAlignment);
				this.emptyBindGroup = new BindGroup(this, new BindGroupFormat(this, []));
				this.emptyBindGroup.update();
		}
		createBackbuffer() {
				this.supportsStencil = this.initOptions.stencil;
				this.backBuffer = new RenderTarget({
						name: 'WebgpuFramebuffer',
						graphicsDevice: this,
						depth: this.initOptions.depth,
						stencil: this.supportsStencil,
						samples: this.samples
				});
				this.backBuffer.impl.isBackbuffer = true;
		}
		frameStart() {
				super.frameStart();
				this.gpuProfiler.frameStart();
				this.submit();
				var outColorBuffer = this.gpuContext.getCurrentTexture();
				if (this.backBufferSize.x !== outColorBuffer.width || this.backBufferSize.y !== outColorBuffer.height) {
						this.backBufferSize.set(outColorBuffer.width, outColorBuffer.height);
						this.backBuffer.destroy();
						this.backBuffer = null;
						this.createBackbuffer();
				}
				var rt = this.backBuffer;
				var wrt = rt.impl;
				wrt.setColorAttachment(0, undefined, this.backBufferViewFormat);
				this.initRenderTarget(rt);
				wrt.assignColorTexture(this, outColorBuffer);
		}
		frameEnd() {
				super.frameEnd();
				this.gpuProfiler.frameEnd();
				this.submit();
				if (!this.contextLost) {
						this.gpuProfiler.request();
				}
		}
		createBufferImpl(usageFlags) {
				return new WebgpuBuffer(usageFlags);
		}
		createUniformBufferImpl(uniformBuffer) {
				return new WebgpuUniformBuffer(uniformBuffer);
		}
		createVertexBufferImpl(vertexBuffer, format, options) {
				return new WebgpuVertexBuffer(vertexBuffer, format, options);
		}
		createIndexBufferImpl(indexBuffer, options) {
				return new WebgpuIndexBuffer(indexBuffer, options);
		}
		createShaderImpl(shader) {
				return new WebgpuShader(shader);
		}
		createTextureImpl(texture) {
				return new WebgpuTexture(texture);
		}
		createRenderTargetImpl(renderTarget) {
				return new WebgpuRenderTarget(renderTarget);
		}
		createBindGroupFormatImpl(bindGroupFormat) {
				return new WebgpuBindGroupFormat(bindGroupFormat);
		}
		createBindGroupImpl(bindGroup) {
				return new WebgpuBindGroup();
		}
		createComputeImpl(compute) {
				return new WebgpuCompute(compute);
		}
		setBindGroup(index, bindGroup, offsets) {
				if (this.passEncoder) {
						this.passEncoder.setBindGroup(index, bindGroup.impl.bindGroup, offsets != null ? offsets : bindGroup.uniformBufferOffsets);
						this.bindGroupFormats[index] = bindGroup.format.impl;
				}
		}
		submitVertexBuffer(vertexBuffer, slot) {
				var format = vertexBuffer.format;
				var { interleaved, elements } = format;
				var elementCount = elements.length;
				var vbBuffer = vertexBuffer.impl.buffer;
				if (interleaved) {
						this.passEncoder.setVertexBuffer(slot, vbBuffer);
						return 1;
				}
				for(var i = 0; i < elementCount; i++){
						this.passEncoder.setVertexBuffer(slot + i, vbBuffer, elements[i].offset);
				}
				return elementCount;
		}
		validateVBLocations(vb0, vb1) {
				var validateVB = (vb)=>{
						var { elements } = vb.format;
						for(var i = 0; i < elements.length; i++){
								var name = elements[i].name;
								var location = semanticToLocation[name];
								if (_uniqueLocations.has(location)) ;
								_uniqueLocations.set(location, name);
						}
				};
				validateVB(vb0);
				validateVB(vb1);
				_uniqueLocations.clear();
		}
		draw(primitive, numInstances, keepBuffers) {
				if (numInstances === undefined) numInstances = 1;
				if (this.shader.ready && !this.shader.failed) {
						var passEncoder = this.passEncoder;
						var vb0 = this.vertexBuffers[0];
						var vb1 = this.vertexBuffers[1];
						this.vertexBuffers.length = 0;
						if (vb0) {
								var vbSlot = this.submitVertexBuffer(vb0, 0);
								if (vb1) {
										this.submitVertexBuffer(vb1, vbSlot);
								}
						}
						var pipeline = this.renderPipeline.get(primitive, vb0 == null ? undefined : vb0.format, vb1 == null ? undefined : vb1.format, this.shader, this.renderTarget, this.bindGroupFormats, this.blendState, this.depthState, this.cullMode, this.stencilEnabled, this.stencilFront, this.stencilBack);
						if (this.pipeline !== pipeline) {
								this.pipeline = pipeline;
								passEncoder.setPipeline(pipeline);
						}
						var ib = this.indexBuffer;
						if (ib) {
								this.indexBuffer = null;
								passEncoder.setIndexBuffer(ib.impl.buffer, ib.impl.format);
								passEncoder.drawIndexed(primitive.count, numInstances, primitive.base, 0, 0);
						} else {
								passEncoder.draw(primitive.count, numInstances, primitive.base, 0);
						}
				}
		}
		setShader(shader, asyncCompile) {
				if (shader !== this.shader) {
						this.shader = shader;
				}
		}
		setBlendState(blendState) {
				this.blendState.copy(blendState);
		}
		setDepthState(depthState) {
				this.depthState.copy(depthState);
		}
		setStencilState(stencilFront, stencilBack) {
				if (stencilFront || stencilBack) {
						this.stencilEnabled = true;
						this.stencilFront.copy(stencilFront != null ? stencilFront : StencilParameters.DEFAULT);
						this.stencilBack.copy(stencilBack != null ? stencilBack : StencilParameters.DEFAULT);
						var ref = this.stencilFront.ref;
						if (this.stencilRef !== ref) {
								this.stencilRef = ref;
								this.passEncoder.setStencilReference(ref);
						}
				} else {
						this.stencilEnabled = false;
				}
		}
		setBlendColor(r, g, b, a) {
				var c = this.blendColor;
				if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
						c.set(r, g, b, a);
						this.passEncoder.setBlendConstant(c);
				}
		}
		setCullMode(cullMode) {
				this.cullMode = cullMode;
		}
		setAlphaToCoverage(state) {}
		initializeContextCaches() {
				super.initializeContextCaches();
		}
		setupPassEncoderDefaults() {
				this.pipeline = null;
				this.stencilRef = 0;
				this.blendColor.set(0, 0, 0, 0);
		}
		_uploadDirtyTextures() {
				this.textures.forEach((texture)=>{
						if (texture._needsUpload || texture._needsMipmaps) {
								texture.upload();
						}
				});
		}
		setupTimeStampWrites(passDesc, name) {
				if (this.gpuProfiler._enabled) {
						if (this.gpuProfiler.timestampQueriesSet) {
								var slot = this.gpuProfiler.getSlot(name);
								passDesc = passDesc != null ? passDesc : {};
								passDesc.timestampWrites = {
										querySet: this.gpuProfiler.timestampQueriesSet.querySet,
										beginningOfPassWriteIndex: slot * 2,
										endOfPassWriteIndex: slot * 2 + 1
								};
						}
				}
				return passDesc;
		}
		startRenderPass(renderPass) {
				this._uploadDirtyTextures();
				var rt = renderPass.renderTarget || this.backBuffer;
				this.renderTarget = rt;
				var wrt = rt.impl;
				if (rt !== this.backBuffer) {
						this.initRenderTarget(rt);
				}
				wrt.setupForRenderPass(renderPass, rt);
				var renderPassDesc = wrt.renderPassDescriptor;
				this.setupTimeStampWrites(renderPassDesc, renderPass.name);
				var commandEncoder = this.getCommandEncoder();
				this.passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
				this.passEncoder.label = renderPass.name + "-PassEncoder RT:" + rt.name;
				this.setupPassEncoderDefaults();
				var { width, height } = rt;
				this.setViewport(0, 0, width, height);
				this.setScissor(0, 0, width, height);
				this.insideRenderPass = true;
		}
		endRenderPass(renderPass) {
				this.passEncoder.end();
				this.passEncoder = null;
				this.insideRenderPass = false;
				this.bindGroupFormats.length = 0;
				var target = this.renderTarget;
				if (target) {
						if (target.depthBuffer && renderPass.depthStencilOps.resolveDepth) {
								if (renderPass.samples > 1 && target.autoResolve) {
										var depthAttachment = target.impl.depthAttachment;
										var destTexture = target.depthBuffer.impl.gpuTexture;
										if (depthAttachment && destTexture) {
												this.resolver.resolveDepth(this.commandEncoder, depthAttachment.multisampledDepthBuffer, destTexture);
										}
								}
						}
				}
				for(var i = 0; i < renderPass.colorArrayOps.length; i++){
						var colorOps = renderPass.colorArrayOps[i];
						if (colorOps.genMipmaps) {
								this.mipmapRenderer.generate(renderPass.renderTarget._colorBuffers[i].impl);
						}
				}
		}
		startComputePass(name) {
				this.pipeline = null;
				var computePassDesc = this.setupTimeStampWrites(undefined, name);
				var commandEncoder = this.getCommandEncoder();
				this.passEncoder = commandEncoder.beginComputePass(computePassDesc);
				this.insideRenderPass = true;
		}
		endComputePass() {
				this.passEncoder.end();
				this.passEncoder = null;
				this.insideRenderPass = false;
				this.bindGroupFormats.length = 0;
		}
		computeDispatch(computes, name) {
				if (name === undefined) name = 'Unnamed';
				this.startComputePass(name);
				for(var i = 0; i < computes.length; i++){
						var compute = computes[i];
						compute.applyParameters();
						compute.impl.updateBindGroup();
				}
				for(var i1 = 0; i1 < computes.length; i1++){
						var compute1 = computes[i1];
						compute1.impl.dispatch(compute1.countX, compute1.countY, compute1.countZ);
				}
				this.endComputePass();
		}
		getCommandEncoder() {
				var commandEncoder = this.commandEncoder;
				if (!commandEncoder) {
						commandEncoder = this.wgpu.createCommandEncoder();
						this.commandEncoder = commandEncoder;
				}
				return commandEncoder;
		}
		endCommandEncoder() {
				var { commandEncoder } = this;
				if (commandEncoder) {
						var cb = commandEncoder.finish();
						this.addCommandBuffer(cb);
						this.commandEncoder = null;
				}
		}
		addCommandBuffer(commandBuffer, front) {
				if (front === undefined) front = false;
				if (front) {
						this.commandBuffers.unshift(commandBuffer);
				} else {
						this.commandBuffers.push(commandBuffer);
				}
		}
		submit() {
				this.endCommandEncoder();
				if (this.commandBuffers.length > 0) {
						this.dynamicBuffers.submit();
						this.wgpu.queue.submit(this.commandBuffers);
						this.commandBuffers.length = 0;
						this.dynamicBuffers.onCommandBuffersSubmitted();
				}
		}
		clear(options) {
				if (options.flags) {
						this.clearRenderer.clear(this, this.renderTarget, options, this.defaultClearOptions);
				}
		}
		setViewport(x, y, w, h) {
				if (this.passEncoder) {
						if (!this.renderTarget.flipY) {
								y = this.renderTarget.height - y - h;
						}
						this.vx = x;
						this.vy = y;
						this.vw = w;
						this.vh = h;
						this.passEncoder.setViewport(x, y, w, h, 0, 1);
				}
		}
		setScissor(x, y, w, h) {
				if (this.passEncoder) {
						if (!this.renderTarget.flipY) {
								y = this.renderTarget.height - y - h;
						}
						this.sx = x;
						this.sy = y;
						this.sw = w;
						this.sh = h;
						this.passEncoder.setScissorRect(x, y, w, h);
				}
		}
		clearStorageBuffer(storageBuffer, offset, size) {
				if (offset === undefined) offset = 0;
				if (size === undefined) size = storageBuffer.byteSize;
				var commandEncoder = this.getCommandEncoder();
				commandEncoder.clearBuffer(storageBuffer.buffer, offset, size);
		}
		readStorageBuffer(storageBuffer, offset, size, data, immediate) {
				if (offset === undefined) offset = 0;
				if (size === undefined) size = storageBuffer.byteSize - offset;
				if (data === undefined) data = null;
				if (immediate === undefined) immediate = false;
				var stagingBuffer = this.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
				stagingBuffer.allocate(this, size);
				var destBuffer = stagingBuffer.buffer;
				var commandEncoder = this.getCommandEncoder();
				commandEncoder.copyBufferToBuffer(storageBuffer.buffer, offset, destBuffer, 0, size);
				return this.readBuffer(stagingBuffer, size, data, immediate);
		}
		readBuffer(stagingBuffer, size, data, immediate) {
				if (data === undefined) data = null;
				if (immediate === undefined) immediate = false;
				var destBuffer = stagingBuffer.buffer;
				return new Promise((resolve, reject)=>{
						var read = ()=>{
								destBuffer == null ? undefined : destBuffer.mapAsync(GPUMapMode.READ).then(()=>{
										data != null ? data : data = new Uint8Array(size);
										var copySrc = destBuffer.getMappedRange(0, size);
										var srcType = data.constructor;
										data.set(new srcType(copySrc));
										destBuffer.unmap();
										stagingBuffer.destroy(this);
										resolve(data);
								});
						};
						if (immediate) {
								this.submit();
								read();
						} else {
								setTimeout(()=>{
										read();
								});
						}
				});
		}
		writeStorageBuffer(storageBuffer, bufferOffset, data, dataOffset, size) {
				if (bufferOffset === undefined) bufferOffset = 0;
				if (dataOffset === undefined) dataOffset = 0;
				this.wgpu.queue.writeBuffer(storageBuffer.buffer, bufferOffset, data, dataOffset, size);
		}
		copyRenderTarget(source, dest, color, depth) {
				var copySize = {
						width: source ? source.width : dest.width,
						height: source ? source.height : dest.height,
						depthOrArrayLayers: 1
				};
				var commandEncoder = this.getCommandEncoder();
				if (color) {
						var copySrc = {
								texture: source ? source.colorBuffer.impl.gpuTexture : this.backBuffer.impl.assignedColorTexture,
								mipLevel: 0
						};
						var copyDst = {
								texture: dest ? dest.colorBuffer.impl.gpuTexture : this.backBuffer.impl.assignedColorTexture,
								mipLevel: 0
						};
						commandEncoder.copyTextureToTexture(copySrc, copyDst, copySize);
				}
				if (depth) {
						var sourceRT = source ? source : this.renderTarget;
						var sourceTexture = sourceRT.impl.depthAttachment.depthTexture;
						if (source.samples > 1) {
								var destTexture = dest.colorBuffer.impl.gpuTexture;
								this.resolver.resolveDepth(commandEncoder, sourceTexture, destTexture);
						} else {
								var destTexture1 = dest ? dest.depthBuffer.impl.gpuTexture : this.renderTarget.impl.depthAttachment.depthTexture;
								var copySrc1 = {
										texture: sourceTexture,
										mipLevel: 0
								};
								var copyDst1 = {
										texture: destTexture1,
										mipLevel: 0
								};
								commandEncoder.copyTextureToTexture(copySrc1, copyDst1, copySize);
						}
				}
				return true;
		}
		constructor(canvas, options = {}){
				super(canvas, options), this.renderPipeline = new WebgpuRenderPipeline(this), this.computePipeline = new WebgpuComputePipeline(this), this.bindGroupFormats = [], this.commandEncoder = null, this.commandBuffers = [];
				options = this.initOptions;
				var _options_alpha;
				options.alpha = (_options_alpha = options.alpha) != null ? _options_alpha : true;
				var _options_antialias;
				this.backBufferAntialias = (_options_antialias = options.antialias) != null ? _options_antialias : false;
				this.isWebGPU = true;
				this._deviceType = DEVICETYPE_WEBGPU;
				this.scope.resolve(UNUSED_UNIFORM_NAME).setValue(0);
		}
}

export { WebgpuGraphicsDevice };
