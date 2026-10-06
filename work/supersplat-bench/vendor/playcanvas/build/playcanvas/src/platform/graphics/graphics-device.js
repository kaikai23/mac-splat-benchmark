import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Color } from '../../core/math/color.js';
import { SEMANTIC_POSITION, TYPE_FLOAT32, CULLFACE_BACK, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_111110F, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, DISPLAYFORMAT_LDR, PRIMITIVE_TRIFAN, PRIMITIVE_POINTS } from './constants.js';
import { BlendState } from './blend-state.js';
import { DepthState } from './depth-state.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { StencilParameters } from './stencil-parameters.js';

function _extends() {
		_extends = Object.assign || function(target) {
				for(var i = 1; i < arguments.length; i++){
						var source = arguments[i];
						for(var key in source){
								if (Object.prototype.hasOwnProperty.call(source, key)) {
										target[key] = source[key];
								}
						}
				}
				return target;
		};
		return _extends.apply(this, arguments);
}
class GraphicsDevice extends EventHandler {
		postInit() {
				var vertexFormat = new VertexFormat(this, [
						{
								semantic: SEMANTIC_POSITION,
								components: 2,
								type: TYPE_FLOAT32
						}
				]);
				var positions = new Float32Array([
						-1,
						-1,
						1,
						-1,
						-1,
						1,
						1,
						1
				]);
				this.quadVertexBuffer = new VertexBuffer(this, vertexFormat, 4, {
						data: positions
				});
		}
		destroy() {
				var _this_quadVertexBuffer, _this_dynamicBuffers, _this_gpuProfiler;
				this.fire('destroy');
				(_this_quadVertexBuffer = this.quadVertexBuffer) == null ? undefined : _this_quadVertexBuffer.destroy();
				this.quadVertexBuffer = null;
				(_this_dynamicBuffers = this.dynamicBuffers) == null ? undefined : _this_dynamicBuffers.destroy();
				this.dynamicBuffers = null;
				(_this_gpuProfiler = this.gpuProfiler) == null ? undefined : _this_gpuProfiler.destroy();
				this.gpuProfiler = null;
		}
		onDestroyShader(shader) {
				this.fire('destroy:shader', shader);
				var idx = this.shaders.indexOf(shader);
				if (idx !== -1) {
						this.shaders.splice(idx, 1);
				}
		}
		postDestroy() {
				this.scope = null;
				this.canvas = null;
		}
		loseContext() {
				var _this_gpuProfiler;
				this.contextLost = true;
				this.backBufferSize.set(-1, -1);
				for (var texture of this.textures){
						texture.loseContext();
				}
				for (var buffer of this.buffers){
						buffer.loseContext();
				}
				for (var target of this.targets){
						target.loseContext();
				}
				(_this_gpuProfiler = this.gpuProfiler) == null ? undefined : _this_gpuProfiler.loseContext();
		}
		restoreContext() {
				var _this_gpuProfiler_restoreContext, _this_gpuProfiler;
				this.contextLost = false;
				this.initializeRenderState();
				this.initializeContextCaches();
				for (var buffer of this.buffers){
						buffer.unlock();
				}
				(_this_gpuProfiler = this.gpuProfiler) == null ? undefined : (_this_gpuProfiler_restoreContext = _this_gpuProfiler.restoreContext) == null ? undefined : _this_gpuProfiler_restoreContext.call(_this_gpuProfiler);
		}
		toJSON(key) {
				return undefined;
		}
		initializeContextCaches() {
				this.indexBuffer = null;
				this.vertexBuffers = [];
				this.shader = null;
				this.shaderValid = undefined;
				this.shaderAsyncCompile = false;
				this.renderTarget = null;
		}
		initializeRenderState() {
				this.blendState = new BlendState();
				this.depthState = new DepthState();
				this.cullMode = CULLFACE_BACK;
				this.vx = this.vy = this.vw = this.vh = 0;
				this.sx = this.sy = this.sw = this.sh = 0;
				this.blendColor = new Color(0, 0, 0, 0);
		}
		setStencilState(stencilFront, stencilBack) {}
		setBlendState(blendState) {}
		setBlendColor(r, g, b, a) {}
		setDepthState(depthState) {}
		setCullMode(cullMode) {}
		setRenderTarget(renderTarget) {
				this.renderTarget = renderTarget;
		}
		setIndexBuffer(indexBuffer) {
				this.indexBuffer = indexBuffer;
		}
		setVertexBuffer(vertexBuffer) {
				if (vertexBuffer) {
						this.vertexBuffers.push(vertexBuffer);
				}
		}
		clearVertexBuffer() {
				this.vertexBuffers.length = 0;
		}
		getRenderTarget() {
				return this.renderTarget;
		}
		initRenderTarget(target) {
				if (target.initialized) return;
				target.init();
				this.targets.add(target);
		}
		_isBrowserInterface(texture) {
				return this._isImageBrowserInterface(texture) || this._isImageCanvasInterface(texture) || this._isImageVideoInterface(texture);
		}
		_isImageBrowserInterface(texture) {
				return typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement;
		}
		_isImageCanvasInterface(texture) {
				return typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement;
		}
		_isImageVideoInterface(texture) {
				return typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement;
		}
		resizeCanvas(width, height) {
				var pixelRatio = Math.min(this._maxPixelRatio, platform.browser ? window.devicePixelRatio : 1);
				var w = Math.floor(width * pixelRatio);
				var h = Math.floor(height * pixelRatio);
				if (w !== this.canvas.width || h !== this.canvas.height) {
						this.setResolution(w, h);
				}
		}
		setResolution(width, height) {
				this.canvas.width = width;
				this.canvas.height = height;
				this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
		}
		updateClientRect() {
				if (platform.worker) {
						this.clientRect.width = this.canvas.width;
						this.clientRect.height = this.canvas.height;
				} else {
						var rect = this.canvas.getBoundingClientRect();
						this.clientRect.width = rect.width;
						this.clientRect.height = rect.height;
				}
		}
		get width() {
				return this.canvas.width;
		}
		get height() {
				return this.canvas.height;
		}
		set fullscreen(fullscreen) {}
		get fullscreen() {
				return false;
		}
		set maxPixelRatio(ratio) {
				this._maxPixelRatio = ratio;
		}
		get maxPixelRatio() {
				return this._maxPixelRatio;
		}
		get deviceType() {
				return this._deviceType;
		}
		startRenderPass(renderPass) {}
		endRenderPass(renderPass) {}
		startComputePass(name) {}
		endComputePass() {}
		frameStart() {
				this.renderPassIndex = 0;
				this.renderVersion++;
		}
		frameEnd() {}
		computeDispatch(computes, name) {
		}
		getRenderableHdrFormat(formats, filterable, samples) {
				if (formats === undefined) formats = [
						PIXELFORMAT_111110F,
						PIXELFORMAT_RGBA16F,
						PIXELFORMAT_RGBA32F
				];
				if (filterable === undefined) filterable = true;
				if (samples === undefined) samples = 1;
				for(var i = 0; i < formats.length; i++){
						var format = formats[i];
						switch(format){
								case PIXELFORMAT_111110F:
										{
												if (this.textureRG11B10Renderable) {
														return format;
												}
												break;
										}
								case PIXELFORMAT_RGBA16F:
										if (this.textureHalfFloatRenderable) {
												return format;
										}
										break;
								case PIXELFORMAT_RGBA32F:
										if (this.isWebGPU && samples > 1) {
												continue;
										}
										if (this.textureFloatRenderable && (!filterable || this.textureFloatFilterable)) {
												return format;
										}
										break;
						}
				}
				return undefined;
		}
		constructor(canvas, options){
				var _this_initOptions, _this_initOptions1, _this_initOptions2, _this_initOptions3, _this_initOptions4, _this_initOptions5;
				super(), this.backBuffer = null, this.backBufferSize = new Vec2(), this.backBufferAntialias = false, this.isWebGPU = false, this.isWebGL2 = false, this.isHdr = false, this.maxColorAttachments = 1, this.maxSamples = 1, this.supportsCompute = false, this.supportsStorageTextureRead = false, this.renderTarget = null, this.shaders = [], this.textures = [], this.targets = new Set(), this.renderVersion = 0, this.insideRenderPass = false, this.supportsUniformBuffers = false, this.supportsClipDistances = false, this.textureRG11B10Renderable = false, this.textureFloatFilterable = false, this.blendState = new BlendState(), this.depthState = new DepthState(), this.stencilEnabled = false, this.stencilFront = new StencilParameters(), this.stencilBack = new StencilParameters(), this.defaultClearOptions = {
						color: [
								0,
								0,
								0,
								1
						],
						depth: 1,
						stencil: 0,
						flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
				}, this.clientRect = {
						width: 0,
						height: 0
				}, this._shadersDirty = false;
				this.canvas = canvas;
				this.initOptions = _extends({}, options);
				var _alpha;
				(_alpha = (_this_initOptions = this.initOptions).alpha) != null ? _alpha : _this_initOptions.alpha = true;
				var _depth;
				(_depth = (_this_initOptions1 = this.initOptions).depth) != null ? _depth : _this_initOptions1.depth = true;
				var _stencil;
				(_stencil = (_this_initOptions2 = this.initOptions).stencil) != null ? _stencil : _this_initOptions2.stencil = true;
				var _antialias;
				(_antialias = (_this_initOptions3 = this.initOptions).antialias) != null ? _antialias : _this_initOptions3.antialias = true;
				var _powerPreference;
				(_powerPreference = (_this_initOptions4 = this.initOptions).powerPreference) != null ? _powerPreference : _this_initOptions4.powerPreference = 'high-performance';
				var _displayFormat;
				(_displayFormat = (_this_initOptions5 = this.initOptions).displayFormat) != null ? _displayFormat : _this_initOptions5.displayFormat = DISPLAYFORMAT_LDR;
				this._maxPixelRatio = platform.browser ? Math.min(1, window.devicePixelRatio) : 1;
				this.buffers = [];
				this._vram = {
						tex: 0,
						vb: 0,
						ib: 0,
						ub: 0,
						sb: 0
				};
				this._shaderStats = {
						vsCompiled: 0,
						fsCompiled: 0,
						linked: 0,
						materialShaders: 0,
						compileTime: 0
				};
				this.initializeContextCaches();
				this._drawCallsPerFrame = 0;
				this._shaderSwitchesPerFrame = 0;
				this._primsPerFrame = [];
				for(var i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++){
						this._primsPerFrame[i] = 0;
				}
				this._renderTargetCreationTime = 0;
				this.scope = new ScopeSpace('Device');
				this.textureBias = this.scope.resolve('textureBias');
				this.textureBias.setValue(0.0);
		}
}
GraphicsDevice.EVENT_RESIZE = 'resizecanvas';

export { GraphicsDevice };
