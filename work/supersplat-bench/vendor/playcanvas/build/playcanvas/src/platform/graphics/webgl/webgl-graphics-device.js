import { math } from '../../../core/math/math.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, FUNC_ALWAYS, STENCILOP_KEEP, TEXPROPERTY_MIN_FILTER, TEXPROPERTY_MAG_FILTER, TEXPROPERTY_ADDRESS_U, TEXPROPERTY_ADDRESS_V, TEXPROPERTY_ADDRESS_W, TEXPROPERTY_COMPARE_ON_READ, TEXPROPERTY_COMPARE_FUNC, TEXPROPERTY_ANISOTROPY, semanticToLocation, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, getPixelFormatArrayType, CULLFACE_NONE, DEVICETYPE_WEBGL2, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_UINT, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC4, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE2D_ARRAY, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_UTEXTURE2D, UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_ITEXTURE2D_ARRAY, UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_MAT4ARRAY, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
import { WebglVertexBuffer } from './webgl-vertex-buffer.js';
import { WebglIndexBuffer } from './webgl-index-buffer.js';
import { WebglShader } from './webgl-shader.js';
import { WebglTexture } from './webgl-texture.js';
import { WebglRenderTarget } from './webgl-render-target.js';
import { BlendState } from '../blend-state.js';
import { DepthState } from '../depth-state.js';
import { StencilParameters } from '../stencil-parameters.js';
import { WebglGpuProfiler } from './webgl-gpu-profiler.js';
import { TextureUtils } from '../texture-utils.js';
import { getBuiltInTexture } from '../built-in-textures.js';

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
var invalidateAttachments = [];
class WebglGraphicsDevice extends GraphicsDevice {
		postInit() {
				super.postInit();
				this.gpuProfiler = new WebglGpuProfiler(this);
		}
		destroy() {
				super.destroy();
				var gl = this.gl;
				if (this.feedback) {
						gl.deleteTransformFeedback(this.feedback);
				}
				this.clearVertexArrayObjectCache();
				this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
				this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);
				this._contextLostHandler = null;
				this._contextRestoredHandler = null;
				this.gl = null;
				super.postDestroy();
		}
		createBackbuffer(frameBuffer) {
				this.supportsStencil = this.initOptions.stencil;
				this.backBuffer = new RenderTarget({
						name: 'WebglFramebuffer',
						graphicsDevice: this,
						depth: this.initOptions.depth,
						stencil: this.supportsStencil,
						samples: this.samples
				});
				this.backBuffer.impl.suppliedColorFramebuffer = frameBuffer;
		}
		updateBackbufferFormat(framebuffer) {
				var gl = this.gl;
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				var alphaBits = this.gl.getParameter(this.gl.ALPHA_BITS);
				this.backBufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
		}
		updateBackbuffer() {
				var resolutionChanged = this.canvas.width !== this.backBufferSize.x || this.canvas.height !== this.backBufferSize.y;
				if (this._defaultFramebufferChanged || resolutionChanged) {
						if (this._defaultFramebufferChanged) {
								this.updateBackbufferFormat(this._defaultFramebuffer);
						}
						this._defaultFramebufferChanged = false;
						this.backBufferSize.set(this.canvas.width, this.canvas.height);
						this.backBuffer.destroy();
						this.createBackbuffer(this._defaultFramebuffer);
				}
		}
		createVertexBufferImpl(vertexBuffer, format) {
				return new WebglVertexBuffer();
		}
		createIndexBufferImpl(indexBuffer) {
				return new WebglIndexBuffer(indexBuffer);
		}
		createShaderImpl(shader) {
				return new WebglShader(shader);
		}
		createTextureImpl(texture) {
				return new WebglTexture(texture);
		}
		createRenderTargetImpl(renderTarget) {
				return new WebglRenderTarget();
		}
		getPrecision() {
				var gl = this.gl;
				var precision = 'highp';
				if (gl.getShaderPrecisionFormat) {
						var vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
						var vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);
						var fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
						var fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
						if (vertexShaderPrecisionHighpFloat && vertexShaderPrecisionMediumpFloat && fragmentShaderPrecisionHighpFloat && fragmentShaderPrecisionMediumpFloat) {
								var highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
								var mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;
								if (!highpAvailable) {
										if (mediumpAvailable) {
												precision = 'mediump';
										} else {
												precision = 'lowp';
										}
								}
						}
				}
				return precision;
		}
		getExtension() {
				for(var i = 0; i < arguments.length; i++){
						if (this.supportedExtensions.indexOf(arguments[i]) !== -1) {
								return this.gl.getExtension(arguments[i]);
						}
				}
				return null;
		}
		get extDisjointTimerQuery() {
				if (!this._extDisjointTimerQuery) {
						this._extDisjointTimerQuery = this.getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
				}
				return this._extDisjointTimerQuery;
		}
		initializeExtensions() {
				var gl = this.gl;
				var _gl_getSupportedExtensions;
				this.supportedExtensions = (_gl_getSupportedExtensions = gl.getSupportedExtensions()) != null ? _gl_getSupportedExtensions : [];
				this._extDisjointTimerQuery = null;
				this.textureRG11B10Renderable = true;
				this.extColorBufferFloat = this.getExtension('EXT_color_buffer_float');
				this.extDebugRendererInfo = this.getExtension('WEBGL_debug_renderer_info');
				this.extTextureFloatLinear = this.getExtension('OES_texture_float_linear');
				this.textureFloatFilterable = !!this.extTextureFloatLinear;
				this.extFloatBlend = this.getExtension('EXT_float_blend');
				this.extTextureFilterAnisotropic = this.getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
				this.extParallelShaderCompile = this.getExtension('KHR_parallel_shader_compile');
				this.extCompressedTextureETC1 = this.getExtension('WEBGL_compressed_texture_etc1');
				this.extCompressedTextureETC = this.getExtension('WEBGL_compressed_texture_etc');
				this.extCompressedTexturePVRTC = this.getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
				this.extCompressedTextureS3TC = this.getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
				this.extCompressedTextureS3TC_SRGB = this.getExtension('WEBGL_compressed_texture_s3tc_srgb');
				this.extCompressedTextureATC = this.getExtension('WEBGL_compressed_texture_atc');
				this.extCompressedTextureASTC = this.getExtension('WEBGL_compressed_texture_astc');
				this.extTextureCompressionBPTC = this.getExtension('EXT_texture_compression_bptc');
				this.extColorBufferHalfFloat = this.getExtension('EXT_color_buffer_half_float');
		}
		initializeCapabilities() {
				var gl = this.gl;
				var ext;
				var userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
				this.maxPrecision = this.precision = this.getPrecision();
				var contextAttribs = gl.getContextAttributes();
				var _contextAttribs_antialias;
				this.supportsMsaa = (_contextAttribs_antialias = contextAttribs == null ? undefined : contextAttribs.antialias) != null ? _contextAttribs_antialias : false;
				var _contextAttribs_stencil;
				this.supportsStencil = (_contextAttribs_stencil = contextAttribs == null ? undefined : contextAttribs.stencil) != null ? _contextAttribs_stencil : false;
				this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
				this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
				this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
				this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
				this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
				this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
				this.vertexUniformsCount = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
				this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
				this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
				this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
				ext = this.extDebugRendererInfo;
				this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
				this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
				var maliRendererRegex = /\bMali-G52+/;
				var samsungModelRegex = /SM-[a-zA-Z0-9]+/;
				this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex)) && !this.unmaskedRenderer.match(maliRendererRegex);
				ext = this.extTextureFilterAnisotropic;
				this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
				var antialiasSupported = !this.forceDisableMultisampling;
				this.maxSamples = antialiasSupported ? gl.getParameter(gl.MAX_SAMPLES) : 1;
				this.maxSamples = Math.min(this.maxSamples, 4);
				this.samples = antialiasSupported && this.backBufferAntialias ? this.maxSamples : 1;
				this.supportsAreaLights = !platform.android;
				if (this.maxTextures <= 8) {
						this.supportsAreaLights = false;
				}
		}
		initializeRenderState() {
				super.initializeRenderState();
				var gl = this.gl;
				gl.disable(gl.BLEND);
				gl.blendFunc(gl.ONE, gl.ZERO);
				gl.blendEquation(gl.FUNC_ADD);
				gl.colorMask(true, true, true, true);
				gl.blendColor(0, 0, 0, 0);
				gl.enable(gl.CULL_FACE);
				this.cullFace = gl.BACK;
				gl.cullFace(gl.BACK);
				gl.enable(gl.DEPTH_TEST);
				gl.depthFunc(gl.LEQUAL);
				gl.depthMask(true);
				this.stencil = false;
				gl.disable(gl.STENCIL_TEST);
				this.stencilFuncFront = this.stencilFuncBack = FUNC_ALWAYS;
				this.stencilRefFront = this.stencilRefBack = 0;
				this.stencilMaskFront = this.stencilMaskBack = 0xFF;
				gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
				this.stencilFailFront = this.stencilFailBack = STENCILOP_KEEP;
				this.stencilZfailFront = this.stencilZfailBack = STENCILOP_KEEP;
				this.stencilZpassFront = this.stencilZpassBack = STENCILOP_KEEP;
				this.stencilWriteMaskFront = 0xFF;
				this.stencilWriteMaskBack = 0xFF;
				gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
				gl.stencilMask(0xFF);
				this.alphaToCoverage = false;
				this.raster = true;
				gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
				gl.disable(gl.RASTERIZER_DISCARD);
				this.depthBiasEnabled = false;
				gl.disable(gl.POLYGON_OFFSET_FILL);
				this.clearDepth = 1;
				gl.clearDepth(1);
				this.clearColor = new Color(0, 0, 0, 0);
				gl.clearColor(0, 0, 0, 0);
				this.clearStencil = 0;
				gl.clearStencil(0);
				gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
				gl.enable(gl.SCISSOR_TEST);
				gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
				this.unpackFlipY = false;
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				this.unpackPremultiplyAlpha = false;
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		}
		initTextureUnits(count) {
				if (count === undefined) count = 16;
				this.textureUnits = [];
				for(var i = 0; i < count; i++){
						this.textureUnits.push([
								null,
								null,
								null
						]);
				}
		}
		initializeContextCaches() {
				super.initializeContextCaches();
				this._vaoMap = new Map();
				this.boundVao = null;
				this.activeFramebuffer = null;
				this.feedback = null;
				this.transformFeedbackBuffer = null;
				this.textureUnit = 0;
				this.initTextureUnits(this.maxCombinedTextures);
		}
		loseContext() {
				super.loseContext();
				for (var shader of this.shaders){
						shader.loseContext();
				}
		}
		restoreContext() {
				this.initializeExtensions();
				this.initializeCapabilities();
				super.restoreContext();
				for (var shader of this.shaders){
						shader.restoreContext();
				}
		}
		setViewport(x, y, w, h) {
				if (this.vx !== x || this.vy !== y || this.vw !== w || this.vh !== h) {
						this.gl.viewport(x, y, w, h);
						this.vx = x;
						this.vy = y;
						this.vw = w;
						this.vh = h;
				}
		}
		setScissor(x, y, w, h) {
				if (this.sx !== x || this.sy !== y || this.sw !== w || this.sh !== h) {
						this.gl.scissor(x, y, w, h);
						this.sx = x;
						this.sy = y;
						this.sw = w;
						this.sh = h;
				}
		}
		setFramebuffer(fb) {
				if (this.activeFramebuffer !== fb) {
						var gl = this.gl;
						gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
						this.activeFramebuffer = fb;
				}
		}
		copyRenderTarget(source, dest, color, depth) {
				var _this_backBuffer, _this_backBuffer1;
				var gl = this.gl;
				if (source === this.backBuffer) {
						source = null;
				}
				if (color) {
						if (!dest) {
								if (!source._colorBuffer) {
										return false;
								}
						} else if (source) {
								if (!source._colorBuffer || !dest._colorBuffer) {
										return false;
								}
								if (source._colorBuffer._format !== dest._colorBuffer._format) {
										return false;
								}
						}
				}
				if (depth && source) {
						if (!source._depth) {
								if (!source._depthBuffer || !dest._depthBuffer) {
										return false;
								}
								if (source._depthBuffer._format !== dest._depthBuffer._format) {
										return false;
								}
						}
				}
				var prevRt = this.renderTarget;
				this.renderTarget = dest;
				this.updateBegin();
				var src = source ? source.impl._glFrameBuffer : (_this_backBuffer = this.backBuffer) == null ? undefined : _this_backBuffer.impl._glFrameBuffer;
				var dst = dest ? dest.impl._glFrameBuffer : (_this_backBuffer1 = this.backBuffer) == null ? undefined : _this_backBuffer1.impl._glFrameBuffer;
				gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
				gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
				var w = source ? source.width : dest ? dest.width : this.width;
				var h = source ? source.height : dest ? dest.height : this.height;
				gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);
				this.renderTarget = prevRt;
				gl.bindFramebuffer(gl.FRAMEBUFFER, prevRt ? prevRt.impl._glFrameBuffer : null);
				return true;
		}
		frameStart() {
				super.frameStart();
				this.updateBackbuffer();
				this.gpuProfiler.frameStart();
		}
		frameEnd() {
				super.frameEnd();
				this.gpuProfiler.frameEnd();
				this.gpuProfiler.request();
		}
		startRenderPass(renderPass) {
				var _renderPass_renderTarget;
				var rt = (_renderPass_renderTarget = renderPass.renderTarget) != null ? _renderPass_renderTarget : this.backBuffer;
				this.renderTarget = rt;
				this.updateBegin();
				var { width, height } = rt;
				this.setViewport(0, 0, width, height);
				this.setScissor(0, 0, width, height);
				var colorOps = renderPass.colorOps;
				var depthStencilOps = renderPass.depthStencilOps;
				if ((colorOps == null ? undefined : colorOps.clear) || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {
						var clearFlags = 0;
						var clearOptions = {};
						if (colorOps == null ? undefined : colorOps.clear) {
								clearFlags |= CLEARFLAG_COLOR;
								clearOptions.color = [
										colorOps.clearValue.r,
										colorOps.clearValue.g,
										colorOps.clearValue.b,
										colorOps.clearValue.a
								];
						}
						if (depthStencilOps.clearDepth) {
								clearFlags |= CLEARFLAG_DEPTH;
								clearOptions.depth = depthStencilOps.clearDepthValue;
						}
						if (depthStencilOps.clearStencil) {
								clearFlags |= CLEARFLAG_STENCIL;
								clearOptions.stencil = depthStencilOps.clearStencilValue;
						}
						clearOptions.flags = clearFlags;
						this.clear(clearOptions);
				}
				this.insideRenderPass = true;
		}
		endRenderPass(renderPass) {
				this.unbindVertexArray();
				var target = this.renderTarget;
				var colorBufferCount = renderPass.colorArrayOps.length;
				if (target) {
						var _renderPass_colorOps;
						invalidateAttachments.length = 0;
						var gl = this.gl;
						for(var i = 0; i < colorBufferCount; i++){
								var colorOps = renderPass.colorArrayOps[i];
								if (!(colorOps.store || colorOps.resolve)) {
										invalidateAttachments.push(gl.COLOR_ATTACHMENT0 + i);
								}
						}
						if (target !== this.backBuffer) {
								if (!renderPass.depthStencilOps.storeDepth) {
										invalidateAttachments.push(gl.DEPTH_ATTACHMENT);
								}
								if (!renderPass.depthStencilOps.storeStencil) {
										invalidateAttachments.push(gl.STENCIL_ATTACHMENT);
								}
						}
						if (invalidateAttachments.length > 0) {
								if (renderPass.fullSizeClearRect) {
										gl.invalidateFramebuffer(gl.DRAW_FRAMEBUFFER, invalidateAttachments);
								}
						}
						if (colorBufferCount && ((_renderPass_colorOps = renderPass.colorOps) == null ? undefined : _renderPass_colorOps.resolve)) {
								if (renderPass.samples > 1 && target.autoResolve) {
										target.resolve(true, false);
								}
						}
						if (target.depthBuffer && renderPass.depthStencilOps.resolveDepth) {
								if (renderPass.samples > 1 && target.autoResolve) {
										target.resolve(false, true);
								}
						}
						for(var i1 = 0; i1 < colorBufferCount; i1++){
								var colorOps1 = renderPass.colorArrayOps[i1];
								if (colorOps1.genMipmaps) {
										var colorBuffer = target._colorBuffers[i1];
										if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps) {
												this.activeTexture(this.maxCombinedTextures - 1);
												this.bindTexture(colorBuffer);
												this.gl.generateMipmap(colorBuffer.impl._glTarget);
										}
								}
						}
				}
				this.insideRenderPass = false;
		}
		set defaultFramebuffer(value) {
				if (this._defaultFramebuffer !== value) {
						this._defaultFramebuffer = value;
						this._defaultFramebufferChanged = true;
				}
		}
		get defaultFramebuffer() {
				return this._defaultFramebuffer;
		}
		updateBegin() {
				this.boundVao = null;
				if (this._tempEnableSafariTextureUnitWorkaround) {
						for(var unit = 0; unit < this.textureUnits.length; ++unit){
								for(var slot = 0; slot < 3; ++slot){
										this.textureUnits[unit][slot] = null;
								}
						}
				}
				var _this_renderTarget;
				var target = (_this_renderTarget = this.renderTarget) != null ? _this_renderTarget : this.backBuffer;
				var targetImpl = target.impl;
				if (!targetImpl.initialized) {
						this.initRenderTarget(target);
				}
				this.setFramebuffer(targetImpl._glFrameBuffer);
		}
		updateEnd() {
				this.unbindVertexArray();
				var target = this.renderTarget;
				if (target && target !== this.backBuffer) {
						if (target._samples > 1 && target.autoResolve) {
								target.resolve();
						}
						var colorBuffer = target._colorBuffer;
						if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps) {
								this.activeTexture(this.maxCombinedTextures - 1);
								this.bindTexture(colorBuffer);
								this.gl.generateMipmap(colorBuffer.impl._glTarget);
						}
				}
		}
		setUnpackFlipY(flipY) {
				if (this.unpackFlipY !== flipY) {
						this.unpackFlipY = flipY;
						var gl = this.gl;
						gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
				}
		}
		setUnpackPremultiplyAlpha(premultiplyAlpha) {
				if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
						this.unpackPremultiplyAlpha = premultiplyAlpha;
						var gl = this.gl;
						gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
				}
		}
		activeTexture(textureUnit) {
				if (this.textureUnit !== textureUnit) {
						this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
						this.textureUnit = textureUnit;
				}
		}
		bindTexture(texture) {
				var impl = texture.impl;
				var textureTarget = impl._glTarget;
				var textureObject = impl._glTexture;
				var textureUnit = this.textureUnit;
				var slot = this.targetToSlot[textureTarget];
				if (this.textureUnits[textureUnit][slot] !== textureObject) {
						this.gl.bindTexture(textureTarget, textureObject);
						this.textureUnits[textureUnit][slot] = textureObject;
				}
		}
		bindTextureOnUnit(texture, textureUnit) {
				var impl = texture.impl;
				var textureTarget = impl._glTarget;
				var textureObject = impl._glTexture;
				var slot = this.targetToSlot[textureTarget];
				if (this.textureUnits[textureUnit][slot] !== textureObject) {
						this.activeTexture(textureUnit);
						this.gl.bindTexture(textureTarget, textureObject);
						this.textureUnits[textureUnit][slot] = textureObject;
				}
		}
		setTextureParameters(texture) {
				var gl = this.gl;
				var flags = texture.impl.dirtyParameterFlags;
				var target = texture.impl._glTarget;
				if (flags & TEXPROPERTY_MIN_FILTER) {
						var filter = texture._minFilter;
						if (!texture._mipmaps || texture._compressed && texture._levels.length === 1) {
								if (filter === FILTER_NEAREST_MIPMAP_NEAREST || filter === FILTER_NEAREST_MIPMAP_LINEAR) {
										filter = FILTER_NEAREST;
								} else if (filter === FILTER_LINEAR_MIPMAP_NEAREST || filter === FILTER_LINEAR_MIPMAP_LINEAR) {
										filter = FILTER_LINEAR;
								}
						}
						gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.glFilter[filter]);
				}
				if (flags & TEXPROPERTY_MAG_FILTER) {
						gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
				}
				if (flags & TEXPROPERTY_ADDRESS_U) {
						gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
				}
				if (flags & TEXPROPERTY_ADDRESS_V) {
						gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
				}
				if (flags & TEXPROPERTY_ADDRESS_W) {
						gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
				}
				if (flags & TEXPROPERTY_COMPARE_ON_READ) {
						gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, texture._compareOnRead ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE);
				}
				if (flags & TEXPROPERTY_COMPARE_FUNC) {
						gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.glComparison[texture._compareFunc]);
				}
				if (flags & TEXPROPERTY_ANISOTROPY) {
						var ext = this.extTextureFilterAnisotropic;
						if (ext) {
								gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, math.clamp(Math.round(texture._anisotropy), 1, this.maxAnisotropy));
						}
				}
		}
		setTexture(texture, textureUnit) {
				var impl = texture.impl;
				if (!impl._glTexture) {
						impl.initialize(this, texture);
				}
				if (impl.dirtyParameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {
						this.activeTexture(textureUnit);
						this.bindTexture(texture);
						if (impl.dirtyParameterFlags) {
								this.setTextureParameters(texture);
								impl.dirtyParameterFlags = 0;
						}
						if (texture._needsUpload || texture._needsMipmapsUpload) {
								impl.upload(this, texture);
								texture._needsUpload = false;
								texture._needsMipmapsUpload = false;
						}
				} else {
						this.bindTextureOnUnit(texture, textureUnit);
				}
		}
		createVertexArray(vertexBuffers) {
				var key, vao;
				var useCache = vertexBuffers.length > 1;
				if (useCache) {
						key = '';
						for(var i = 0; i < vertexBuffers.length; i++){
								var vertexBuffer = vertexBuffers[i];
								key += vertexBuffer.id + vertexBuffer.format.renderingHash;
						}
						vao = this._vaoMap.get(key);
				}
				if (!vao) {
						var gl = this.gl;
						vao = gl.createVertexArray();
						gl.bindVertexArray(vao);
						gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
						for(var i1 = 0; i1 < vertexBuffers.length; i1++){
								var vertexBuffer1 = vertexBuffers[i1];
								gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer1.impl.bufferId);
								var elements = vertexBuffer1.format.elements;
								for(var j = 0; j < elements.length; j++){
										var e = elements[j];
										var loc = semanticToLocation[e.name];
										if (e.asInt) {
												gl.vertexAttribIPointer(loc, e.numComponents, this.glType[e.dataType], e.stride, e.offset);
										} else {
												gl.vertexAttribPointer(loc, e.numComponents, this.glType[e.dataType], e.normalize, e.stride, e.offset);
										}
										gl.enableVertexAttribArray(loc);
										if (vertexBuffer1.format.instancing) {
												gl.vertexAttribDivisor(loc, 1);
										}
								}
						}
						gl.bindVertexArray(null);
						gl.bindBuffer(gl.ARRAY_BUFFER, null);
						if (useCache) {
								this._vaoMap.set(key, vao);
						}
				}
				return vao;
		}
		unbindVertexArray() {
				if (this.boundVao) {
						this.boundVao = null;
						this.gl.bindVertexArray(null);
				}
		}
		setBuffers() {
				var gl = this.gl;
				var vao;
				if (this.vertexBuffers.length === 1) {
						var vertexBuffer = this.vertexBuffers[0];
						if (!vertexBuffer.impl.vao) {
								vertexBuffer.impl.vao = this.createVertexArray(this.vertexBuffers);
						}
						vao = vertexBuffer.impl.vao;
				} else {
						vao = this.createVertexArray(this.vertexBuffers);
				}
				if (this.boundVao !== vao) {
						this.boundVao = vao;
						gl.bindVertexArray(vao);
				}
				this.clearVertexBuffer();
				var bufferId = this.indexBuffer ? this.indexBuffer.impl.bufferId : null;
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
		}
		draw(primitive, numInstances, keepBuffers) {
				var gl = this.gl;
				this.activateShader(this);
				if (!this.shaderValid) {
						return;
				}
				var sampler, samplerValue, texture, numTextures;
				var uniform, scopeId, uniformVersion, programVersion;
				var shader = this.shader;
				if (!shader) {
						return;
				}
				var samplers = shader.impl.samplers;
				var uniforms = shader.impl.uniforms;
				if (!keepBuffers) {
						this.setBuffers();
				}
				var textureUnit = 0;
				for(var i = 0, len = samplers.length; i < len; i++){
						sampler = samplers[i];
						samplerValue = sampler.scopeId.value;
						if (!samplerValue) {
								var samplerName = sampler.scopeId.name;
								if (samplerName === 'uSceneDepthMap') {
										samplerValue = getBuiltInTexture(this, 'white');
								}
								if (samplerName === 'uSceneColorMap') {
										samplerValue = getBuiltInTexture(this, 'pink');
								}
								if (!samplerValue) {
										samplerValue = getBuiltInTexture(this, 'pink');
								}
						}
						if (samplerValue instanceof Texture) {
								texture = samplerValue;
								this.setTexture(texture, textureUnit);
								if (sampler.slot !== textureUnit) {
										gl.uniform1i(sampler.locationId, textureUnit);
										sampler.slot = textureUnit;
								}
								textureUnit++;
						} else {
								sampler.array.length = 0;
								numTextures = samplerValue.length;
								for(var j = 0; j < numTextures; j++){
										texture = samplerValue[j];
										this.setTexture(texture, textureUnit);
										sampler.array[j] = textureUnit;
										textureUnit++;
								}
								gl.uniform1iv(sampler.locationId, sampler.array);
						}
				}
				for(var i1 = 0, len1 = uniforms.length; i1 < len1; i1++){
						uniform = uniforms[i1];
						scopeId = uniform.scopeId;
						uniformVersion = uniform.version;
						programVersion = scopeId.versionObject.version;
						if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
								uniformVersion.globalId = programVersion.globalId;
								uniformVersion.revision = programVersion.revision;
								if (scopeId.value !== null) {
										this.commitFunction[uniform.dataType](uniform, scopeId.value);
								}
						}
				}
				if (this.transformFeedbackBuffer) {
						gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.impl.bufferId);
						gl.beginTransformFeedback(gl.POINTS);
				}
				var mode = this.glPrimitive[primitive.type];
				var count = primitive.count;
				if (primitive.indexed) {
						var indexBuffer = this.indexBuffer;
						var format = indexBuffer.impl.glFormat;
						var offset = primitive.base * indexBuffer.bytesPerIndex;
						if (numInstances > 0) {
								gl.drawElementsInstanced(mode, count, format, offset, numInstances);
						} else {
								gl.drawElements(mode, count, format, offset);
						}
				} else {
						var first = primitive.base;
						if (numInstances > 0) {
								gl.drawArraysInstanced(mode, first, count, numInstances);
						} else {
								gl.drawArrays(mode, first, count);
						}
				}
				if (this.transformFeedbackBuffer) {
						gl.endTransformFeedback();
						gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
				}
				this._drawCallsPerFrame++;
		}
		clear(options) {
				var defaultOptions = this.defaultClearOptions;
				options = options || defaultOptions;
				var _options_flags;
				var flags = (_options_flags = options.flags) != null ? _options_flags : defaultOptions.flags;
				if (flags !== 0) {
						var gl = this.gl;
						if (flags & CLEARFLAG_COLOR) {
								var _options_color;
								var color = (_options_color = options.color) != null ? _options_color : defaultOptions.color;
								var r = color[0];
								var g = color[1];
								var b = color[2];
								var a = color[3];
								var c = this.clearColor;
								if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
										this.gl.clearColor(r, g, b, a);
										this.clearColor.set(r, g, b, a);
								}
								this.setBlendState(BlendState.NOBLEND);
						}
						if (flags & CLEARFLAG_DEPTH) {
								var _options_depth;
								var depth = (_options_depth = options.depth) != null ? _options_depth : defaultOptions.depth;
								if (depth !== this.clearDepth) {
										this.gl.clearDepth(depth);
										this.clearDepth = depth;
								}
								this.setDepthState(DepthState.WRITEDEPTH);
						}
						if (flags & CLEARFLAG_STENCIL) {
								var _options_stencil;
								var stencil = (_options_stencil = options.stencil) != null ? _options_stencil : defaultOptions.stencil;
								if (stencil !== this.clearStencil) {
										this.gl.clearStencil(stencil);
										this.clearStencil = stencil;
								}
								gl.stencilMask(0xFF);
								this.stencilWriteMaskFront = 0xFF;
								this.stencilWriteMaskBack = 0xFF;
						}
						gl.clear(this.glClearFlag[flags]);
				}
		}
		submit() {
				this.gl.flush();
		}
		readPixels(x, y, w, h, pixels) {
				var gl = this.gl;
				gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		}
		readPixelsAsync(x, y, w, h, pixels) {
				var _this = this;
				return _async_to_generator(function*() {
						var _this_renderTarget_colorBuffer;
						var gl = _this.gl;
						var clientWaitAsync = (flags, interval_ms)=>{
								var sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
								_this.submit();
								return new Promise((resolve, reject)=>{
										function test() {
												var res = gl.clientWaitSync(sync, flags, 0);
												if (res === gl.WAIT_FAILED) {
														gl.deleteSync(sync);
														reject(new Error('webgl clientWaitSync sync failed'));
												} else if (res === gl.TIMEOUT_EXPIRED) {
														setTimeout(test, interval_ms);
												} else {
														gl.deleteSync(sync);
														resolve();
												}
										}
										test();
								});
						};
						var impl = (_this_renderTarget_colorBuffer = _this.renderTarget.colorBuffer) == null ? undefined : _this_renderTarget_colorBuffer.impl;
						var _impl__glFormat;
						var format = (_impl__glFormat = impl == null ? undefined : impl._glFormat) != null ? _impl__glFormat : gl.RGBA;
						var _impl__glPixelType;
						var pixelType = (_impl__glPixelType = impl == null ? undefined : impl._glPixelType) != null ? _impl__glPixelType : gl.UNSIGNED_BYTE;
						var buf = gl.createBuffer();
						gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
						gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
						gl.readPixels(x, y, w, h, format, pixelType, 0);
						gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
						yield clientWaitAsync(0, 20);
						gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
						gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
						gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
						gl.deleteBuffer(buf);
						return pixels;
				})();
		}
		readTextureAsync(texture, x, y, width, height, options) {
				var _options_face;
				var face = (_options_face = options.face) != null ? _options_face : 0;
				var _options_renderTarget;
				var renderTarget = (_options_renderTarget = options.renderTarget) != null ? _options_renderTarget : new RenderTarget({
						colorBuffer: texture,
						depth: false,
						face: face
				});
				var buffer = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, 1, texture._format));
				var _options_data;
				var data = (_options_data = options.data) != null ? _options_data : new (getPixelFormatArrayType(texture._format))(buffer);
				this.setRenderTarget(renderTarget);
				this.initRenderTarget(renderTarget);
				return new Promise((resolve, reject)=>{
						this.readPixelsAsync(x, y, width, height, data).then((data)=>{
								if (!options.renderTarget) {
										renderTarget.destroy();
								}
								resolve(data);
						}).catch(reject);
				});
		}
		setAlphaToCoverage(state) {
				if (this.alphaToCoverage !== state) {
						this.alphaToCoverage = state;
						if (state) {
								this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
						} else {
								this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
						}
				}
		}
		setTransformFeedbackBuffer(tf) {
				if (this.transformFeedbackBuffer !== tf) {
						this.transformFeedbackBuffer = tf;
						var gl = this.gl;
						if (tf) {
								if (!this.feedback) {
										this.feedback = gl.createTransformFeedback();
								}
								gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
						} else {
								gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
						}
				}
		}
		setRaster(on) {
				if (this.raster !== on) {
						this.raster = on;
						if (on) {
								this.gl.disable(this.gl.RASTERIZER_DISCARD);
						} else {
								this.gl.enable(this.gl.RASTERIZER_DISCARD);
						}
				}
		}
		setStencilTest(enable) {
				if (this.stencil !== enable) {
						var gl = this.gl;
						if (enable) {
								gl.enable(gl.STENCIL_TEST);
						} else {
								gl.disable(gl.STENCIL_TEST);
						}
						this.stencil = enable;
				}
		}
		setStencilFunc(func, ref, mask) {
				if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask || this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
						this.gl.stencilFunc(this.glComparison[func], ref, mask);
						this.stencilFuncFront = this.stencilFuncBack = func;
						this.stencilRefFront = this.stencilRefBack = ref;
						this.stencilMaskFront = this.stencilMaskBack = mask;
				}
		}
		setStencilFuncFront(func, ref, mask) {
				if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
						var gl = this.gl;
						gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
						this.stencilFuncFront = func;
						this.stencilRefFront = ref;
						this.stencilMaskFront = mask;
				}
		}
		setStencilFuncBack(func, ref, mask) {
				if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
						var gl = this.gl;
						gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
						this.stencilFuncBack = func;
						this.stencilRefBack = ref;
						this.stencilMaskBack = mask;
				}
		}
		setStencilOperation(fail, zfail, zpass, writeMask) {
				if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass || this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
						this.gl.stencilOp(this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
						this.stencilFailFront = this.stencilFailBack = fail;
						this.stencilZfailFront = this.stencilZfailBack = zfail;
						this.stencilZpassFront = this.stencilZpassBack = zpass;
				}
				if (this.stencilWriteMaskFront !== writeMask || this.stencilWriteMaskBack !== writeMask) {
						this.gl.stencilMask(writeMask);
						this.stencilWriteMaskFront = writeMask;
						this.stencilWriteMaskBack = writeMask;
				}
		}
		setStencilOperationFront(fail, zfail, zpass, writeMask) {
				if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass) {
						this.gl.stencilOpSeparate(this.gl.FRONT, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
						this.stencilFailFront = fail;
						this.stencilZfailFront = zfail;
						this.stencilZpassFront = zpass;
				}
				if (this.stencilWriteMaskFront !== writeMask) {
						this.gl.stencilMaskSeparate(this.gl.FRONT, writeMask);
						this.stencilWriteMaskFront = writeMask;
				}
		}
		setStencilOperationBack(fail, zfail, zpass, writeMask) {
				if (this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
						this.gl.stencilOpSeparate(this.gl.BACK, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
						this.stencilFailBack = fail;
						this.stencilZfailBack = zfail;
						this.stencilZpassBack = zpass;
				}
				if (this.stencilWriteMaskBack !== writeMask) {
						this.gl.stencilMaskSeparate(this.gl.BACK, writeMask);
						this.stencilWriteMaskBack = writeMask;
				}
		}
		setBlendState(blendState) {
				var currentBlendState = this.blendState;
				if (!currentBlendState.equals(blendState)) {
						var gl = this.gl;
						var { blend, colorOp, alphaOp, colorSrcFactor, colorDstFactor, alphaSrcFactor, alphaDstFactor } = blendState;
						if (currentBlendState.blend !== blend) {
								if (blend) {
										gl.enable(gl.BLEND);
								} else {
										gl.disable(gl.BLEND);
								}
						}
						if (currentBlendState.colorOp !== colorOp || currentBlendState.alphaOp !== alphaOp) {
								var glBlendEquation = this.glBlendEquation;
								gl.blendEquationSeparate(glBlendEquation[colorOp], glBlendEquation[alphaOp]);
						}
						if (currentBlendState.colorSrcFactor !== colorSrcFactor || currentBlendState.colorDstFactor !== colorDstFactor || currentBlendState.alphaSrcFactor !== alphaSrcFactor || currentBlendState.alphaDstFactor !== alphaDstFactor) {
								gl.blendFuncSeparate(this.glBlendFunctionColor[colorSrcFactor], this.glBlendFunctionColor[colorDstFactor], this.glBlendFunctionAlpha[alphaSrcFactor], this.glBlendFunctionAlpha[alphaDstFactor]);
						}
						if (currentBlendState.allWrite !== blendState.allWrite) {
								this.gl.colorMask(blendState.redWrite, blendState.greenWrite, blendState.blueWrite, blendState.alphaWrite);
						}
						currentBlendState.copy(blendState);
				}
		}
		setBlendColor(r, g, b, a) {
				var c = this.blendColor;
				if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
						this.gl.blendColor(r, g, b, a);
						c.set(r, g, b, a);
				}
		}
		setStencilState(stencilFront, stencilBack) {
				if (stencilFront || stencilBack) {
						this.setStencilTest(true);
						if (stencilFront === stencilBack) {
								this.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
								this.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
						} else {
								stencilFront != null ? stencilFront : stencilFront = StencilParameters.DEFAULT;
								this.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
								this.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
								stencilBack != null ? stencilBack : stencilBack = StencilParameters.DEFAULT;
								this.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
								this.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
						}
				} else {
						this.setStencilTest(false);
				}
		}
		setDepthState(depthState) {
				var currentDepthState = this.depthState;
				if (!currentDepthState.equals(depthState)) {
						var gl = this.gl;
						var write = depthState.write;
						if (currentDepthState.write !== write) {
								gl.depthMask(write);
						}
						var { func, test } = depthState;
						if (!test && write) {
								test = true;
								func = FUNC_ALWAYS;
						}
						if (currentDepthState.func !== func) {
								gl.depthFunc(this.glComparison[func]);
						}
						if (currentDepthState.test !== test) {
								if (test) {
										gl.enable(gl.DEPTH_TEST);
								} else {
										gl.disable(gl.DEPTH_TEST);
								}
						}
						var { depthBias, depthBiasSlope } = depthState;
						if (depthBias || depthBiasSlope) {
								if (!this.depthBiasEnabled) {
										this.depthBiasEnabled = true;
										this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
								}
								gl.polygonOffset(depthBiasSlope, depthBias);
						} else {
								if (this.depthBiasEnabled) {
										this.depthBiasEnabled = false;
										this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
								}
						}
						currentDepthState.copy(depthState);
				}
		}
		setCullMode(cullMode) {
				if (this.cullMode !== cullMode) {
						if (cullMode === CULLFACE_NONE) {
								this.gl.disable(this.gl.CULL_FACE);
						} else {
								if (this.cullMode === CULLFACE_NONE) {
										this.gl.enable(this.gl.CULL_FACE);
								}
								var mode = this.glCull[cullMode];
								if (this.cullFace !== mode) {
										this.gl.cullFace(mode);
										this.cullFace = mode;
								}
						}
						this.cullMode = cullMode;
				}
		}
		setShader(shader, asyncCompile) {
				if (asyncCompile === undefined) asyncCompile = false;
				if (shader !== this.shader) {
						this.shader = shader;
						this.shaderAsyncCompile = asyncCompile;
						this.shaderValid = undefined;
				}
		}
		activateShader(device) {
				var { shader } = this;
				var { impl } = shader;
				if (this.shaderValid === undefined) {
						if (shader.failed) {
								this.shaderValid = false;
						} else if (!shader.ready) {
								if (this.shaderAsyncCompile) {
										if (impl.isLinked(device)) {
												if (!impl.finalize(this, shader)) {
														shader.failed = true;
														this.shaderValid = false;
												}
										} else {
												this.shaderValid = false;
										}
								} else {
										if (!impl.finalize(this, shader)) {
												shader.failed = true;
												this.shaderValid = false;
										}
								}
						}
				}
				if (this.shaderValid === undefined) {
						this.gl.useProgram(impl.glProgram);
						this.shaderValid = true;
				}
		}
		clearVertexArrayObjectCache() {
				var gl = this.gl;
				this._vaoMap.forEach((item, key, mapObj)=>{
						gl.deleteVertexArray(item);
				});
				this._vaoMap.clear();
		}
		set fullscreen(fullscreen) {
				if (fullscreen) {
						var canvas = this.gl.canvas;
						canvas.requestFullscreen();
				} else {
						document.exitFullscreen();
				}
		}
		get fullscreen() {
				return !!document.fullscreenElement;
		}
		constructor(canvas, options = {}){
				super(canvas, options), this._defaultFramebuffer = null, this._defaultFramebufferChanged = false;
				options = this.initOptions;
				this.updateClientRect();
				this.initTextureUnits();
				this.contextLost = false;
				this._contextLostHandler = (event)=>{
						event.preventDefault();
						this.loseContext();
						this.fire('devicelost');
				};
				this._contextRestoredHandler = ()=>{
						this.restoreContext();
						this.fire('devicerestored');
				};
				var ua = typeof navigator !== 'undefined' && navigator.userAgent;
				this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));
				if (this.forceDisableMultisampling) {
						options.antialias = false;
				}
				if (platform.browserName === 'firefox') {
						var ua1 = typeof navigator !== 'undefined' ? navigator.userAgent : '';
						var match = ua1.match(/Firefox\/(\d+(\.\d+)*)/);
						var firefoxVersion = match ? match[1] : null;
						if (firefoxVersion) {
								var version = parseFloat(firefoxVersion);
								var disableAntialias = platform.name === 'windows' && (version >= 120 || version === 115) || platform.name === 'android' && version >= 132;
								if (disableAntialias) {
										options.antialias = false;
								}
						}
				}
				var _options_antialias;
				this.backBufferAntialias = (_options_antialias = options.antialias) != null ? _options_antialias : false;
				options.antialias = false;
				var _options_gl;
				var gl = (_options_gl = options.gl) != null ? _options_gl : canvas.getContext('webgl2', options);
				if (!gl) {
						throw new Error('WebGL not supported');
				}
				this.gl = gl;
				this.isWebGL2 = true;
				this._deviceType = DEVICETYPE_WEBGL2;
				this.updateBackbufferFormat(null);
				var isChrome = platform.browserName === 'chrome';
				var isSafari = platform.browserName === 'safari';
				var isMac = platform.browser && navigator.appVersion.indexOf('Mac') !== -1;
				this._tempEnableSafariTextureUnitWorkaround = isSafari;
				this._tempMacChromeBlitFramebufferWorkaround = isMac && isChrome && !options.alpha;
				canvas.addEventListener('webglcontextlost', this._contextLostHandler, false);
				canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler, false);
				this.initializeExtensions();
				this.initializeCapabilities();
				this.initializeRenderState();
				this.initializeContextCaches();
				this.createBackbuffer(null);
				this.supportsImageBitmap = !isSafari && typeof ImageBitmap !== 'undefined';
				this._samplerTypes = new Set([
						gl.SAMPLER_2D,
						gl.SAMPLER_CUBE,
						gl.UNSIGNED_INT_SAMPLER_2D,
						gl.INT_SAMPLER_2D,
						gl.SAMPLER_2D_SHADOW,
						gl.SAMPLER_CUBE_SHADOW,
						gl.SAMPLER_3D,
						gl.INT_SAMPLER_3D,
						gl.UNSIGNED_INT_SAMPLER_3D,
						gl.SAMPLER_2D_ARRAY,
						gl.INT_SAMPLER_2D_ARRAY,
						gl.UNSIGNED_INT_SAMPLER_2D_ARRAY
				]);
				this.glAddress = [
						gl.REPEAT,
						gl.CLAMP_TO_EDGE,
						gl.MIRRORED_REPEAT
				];
				this.glBlendEquation = [
						gl.FUNC_ADD,
						gl.FUNC_SUBTRACT,
						gl.FUNC_REVERSE_SUBTRACT,
						gl.MIN,
						gl.MAX
				];
				this.glBlendFunctionColor = [
						gl.ZERO,
						gl.ONE,
						gl.SRC_COLOR,
						gl.ONE_MINUS_SRC_COLOR,
						gl.DST_COLOR,
						gl.ONE_MINUS_DST_COLOR,
						gl.SRC_ALPHA,
						gl.SRC_ALPHA_SATURATE,
						gl.ONE_MINUS_SRC_ALPHA,
						gl.DST_ALPHA,
						gl.ONE_MINUS_DST_ALPHA,
						gl.CONSTANT_COLOR,
						gl.ONE_MINUS_CONSTANT_COLOR
				];
				this.glBlendFunctionAlpha = [
						gl.ZERO,
						gl.ONE,
						gl.SRC_COLOR,
						gl.ONE_MINUS_SRC_COLOR,
						gl.DST_COLOR,
						gl.ONE_MINUS_DST_COLOR,
						gl.SRC_ALPHA,
						gl.SRC_ALPHA_SATURATE,
						gl.ONE_MINUS_SRC_ALPHA,
						gl.DST_ALPHA,
						gl.ONE_MINUS_DST_ALPHA,
						gl.CONSTANT_ALPHA,
						gl.ONE_MINUS_CONSTANT_ALPHA
				];
				this.glComparison = [
						gl.NEVER,
						gl.LESS,
						gl.EQUAL,
						gl.LEQUAL,
						gl.GREATER,
						gl.NOTEQUAL,
						gl.GEQUAL,
						gl.ALWAYS
				];
				this.glStencilOp = [
						gl.KEEP,
						gl.ZERO,
						gl.REPLACE,
						gl.INCR,
						gl.INCR_WRAP,
						gl.DECR,
						gl.DECR_WRAP,
						gl.INVERT
				];
				this.glClearFlag = [
						0,
						gl.COLOR_BUFFER_BIT,
						gl.DEPTH_BUFFER_BIT,
						gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
						gl.STENCIL_BUFFER_BIT,
						gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT,
						gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
						gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT
				];
				this.glCull = [
						0,
						gl.BACK,
						gl.FRONT,
						gl.FRONT_AND_BACK
				];
				this.glFilter = [
						gl.NEAREST,
						gl.LINEAR,
						gl.NEAREST_MIPMAP_NEAREST,
						gl.NEAREST_MIPMAP_LINEAR,
						gl.LINEAR_MIPMAP_NEAREST,
						gl.LINEAR_MIPMAP_LINEAR
				];
				this.glPrimitive = [
						gl.POINTS,
						gl.LINES,
						gl.LINE_LOOP,
						gl.LINE_STRIP,
						gl.TRIANGLES,
						gl.TRIANGLE_STRIP,
						gl.TRIANGLE_FAN
				];
				this.glType = [
						gl.BYTE,
						gl.UNSIGNED_BYTE,
						gl.SHORT,
						gl.UNSIGNED_SHORT,
						gl.INT,
						gl.UNSIGNED_INT,
						gl.FLOAT,
						gl.HALF_FLOAT
				];
				this.pcUniformType = {};
				this.pcUniformType[gl.BOOL] = UNIFORMTYPE_BOOL;
				this.pcUniformType[gl.INT] = UNIFORMTYPE_INT;
				this.pcUniformType[gl.FLOAT] = UNIFORMTYPE_FLOAT;
				this.pcUniformType[gl.FLOAT_VEC2] = UNIFORMTYPE_VEC2;
				this.pcUniformType[gl.FLOAT_VEC3] = UNIFORMTYPE_VEC3;
				this.pcUniformType[gl.FLOAT_VEC4] = UNIFORMTYPE_VEC4;
				this.pcUniformType[gl.INT_VEC2] = UNIFORMTYPE_IVEC2;
				this.pcUniformType[gl.INT_VEC3] = UNIFORMTYPE_IVEC3;
				this.pcUniformType[gl.INT_VEC4] = UNIFORMTYPE_IVEC4;
				this.pcUniformType[gl.BOOL_VEC2] = UNIFORMTYPE_BVEC2;
				this.pcUniformType[gl.BOOL_VEC3] = UNIFORMTYPE_BVEC3;
				this.pcUniformType[gl.BOOL_VEC4] = UNIFORMTYPE_BVEC4;
				this.pcUniformType[gl.FLOAT_MAT2] = UNIFORMTYPE_MAT2;
				this.pcUniformType[gl.FLOAT_MAT3] = UNIFORMTYPE_MAT3;
				this.pcUniformType[gl.FLOAT_MAT4] = UNIFORMTYPE_MAT4;
				this.pcUniformType[gl.SAMPLER_2D] = UNIFORMTYPE_TEXTURE2D;
				this.pcUniformType[gl.SAMPLER_CUBE] = UNIFORMTYPE_TEXTURECUBE;
				this.pcUniformType[gl.UNSIGNED_INT] = UNIFORMTYPE_UINT;
				this.pcUniformType[gl.UNSIGNED_INT_VEC2] = UNIFORMTYPE_UVEC2;
				this.pcUniformType[gl.UNSIGNED_INT_VEC3] = UNIFORMTYPE_UVEC3;
				this.pcUniformType[gl.UNSIGNED_INT_VEC4] = UNIFORMTYPE_UVEC4;
				this.pcUniformType[gl.SAMPLER_2D_SHADOW] = UNIFORMTYPE_TEXTURE2D_SHADOW;
				this.pcUniformType[gl.SAMPLER_CUBE_SHADOW] = UNIFORMTYPE_TEXTURECUBE_SHADOW;
				this.pcUniformType[gl.SAMPLER_2D_ARRAY] = UNIFORMTYPE_TEXTURE2D_ARRAY;
				this.pcUniformType[gl.SAMPLER_3D] = UNIFORMTYPE_TEXTURE3D;
				this.pcUniformType[gl.INT_SAMPLER_2D] = UNIFORMTYPE_ITEXTURE2D;
				this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D] = UNIFORMTYPE_UTEXTURE2D;
				this.pcUniformType[gl.INT_SAMPLER_CUBE] = UNIFORMTYPE_ITEXTURECUBE;
				this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D] = UNIFORMTYPE_UTEXTURECUBE;
				this.pcUniformType[gl.INT_SAMPLER_3D] = UNIFORMTYPE_ITEXTURE3D;
				this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_3D] = UNIFORMTYPE_UTEXTURE3D;
				this.pcUniformType[gl.INT_SAMPLER_2D_ARRAY] = UNIFORMTYPE_ITEXTURE2D_ARRAY;
				this.pcUniformType[gl.UNSIGNED_INT_SAMPLER_2D_ARRAY] = UNIFORMTYPE_UTEXTURE2D_ARRAY;
				this.targetToSlot = {};
				this.targetToSlot[gl.TEXTURE_2D] = 0;
				this.targetToSlot[gl.TEXTURE_CUBE_MAP] = 1;
				this.targetToSlot[gl.TEXTURE_3D] = 2;
				var scopeX, scopeY, scopeZ, scopeW;
				var uniformValue;
				this.commitFunction = [];
				this.commitFunction[UNIFORMTYPE_BOOL] = function(uniform, value) {
						if (uniform.value !== value) {
								gl.uniform1i(uniform.locationId, value);
								uniform.value = value;
						}
				};
				this.commitFunction[UNIFORMTYPE_INT] = this.commitFunction[UNIFORMTYPE_BOOL];
				this.commitFunction[UNIFORMTYPE_FLOAT] = function(uniform, value) {
						if (uniform.value !== value) {
								gl.uniform1f(uniform.locationId, value);
								uniform.value = value;
						}
				};
				this.commitFunction[UNIFORMTYPE_VEC2] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
								gl.uniform2fv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
						}
				};
				this.commitFunction[UNIFORMTYPE_VEC3] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
								gl.uniform3fv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
						}
				};
				this.commitFunction[UNIFORMTYPE_VEC4] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						scopeW = value[3];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
								gl.uniform4fv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
								uniformValue[3] = scopeW;
						}
				};
				this.commitFunction[UNIFORMTYPE_IVEC2] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
								gl.uniform2iv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
						}
				};
				this.commitFunction[UNIFORMTYPE_BVEC2] = this.commitFunction[UNIFORMTYPE_IVEC2];
				this.commitFunction[UNIFORMTYPE_IVEC3] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
								gl.uniform3iv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
						}
				};
				this.commitFunction[UNIFORMTYPE_BVEC3] = this.commitFunction[UNIFORMTYPE_IVEC3];
				this.commitFunction[UNIFORMTYPE_IVEC4] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						scopeW = value[3];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
								gl.uniform4iv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
								uniformValue[3] = scopeW;
						}
				};
				this.commitFunction[UNIFORMTYPE_BVEC4] = this.commitFunction[UNIFORMTYPE_IVEC4];
				this.commitFunction[UNIFORMTYPE_MAT2] = function(uniform, value) {
						gl.uniformMatrix2fv(uniform.locationId, false, value);
				};
				this.commitFunction[UNIFORMTYPE_MAT3] = function(uniform, value) {
						gl.uniformMatrix3fv(uniform.locationId, false, value);
				};
				this.commitFunction[UNIFORMTYPE_MAT4] = function(uniform, value) {
						gl.uniformMatrix4fv(uniform.locationId, false, value);
				};
				this.commitFunction[UNIFORMTYPE_FLOATARRAY] = function(uniform, value) {
						gl.uniform1fv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_VEC2ARRAY] = function(uniform, value) {
						gl.uniform2fv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_VEC3ARRAY] = function(uniform, value) {
						gl.uniform3fv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_VEC4ARRAY] = function(uniform, value) {
						gl.uniform4fv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_UINT] = function(uniform, value) {
						if (uniform.value !== value) {
								gl.uniform1ui(uniform.locationId, value);
								uniform.value = value;
						}
				};
				this.commitFunction[UNIFORMTYPE_UVEC2] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
								gl.uniform2uiv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
						}
				};
				this.commitFunction[UNIFORMTYPE_UVEC3] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
								gl.uniform3uiv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
						}
				};
				this.commitFunction[UNIFORMTYPE_UVEC4] = function(uniform, value) {
						uniformValue = uniform.value;
						scopeX = value[0];
						scopeY = value[1];
						scopeZ = value[2];
						scopeW = value[3];
						if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
								gl.uniform4uiv(uniform.locationId, value);
								uniformValue[0] = scopeX;
								uniformValue[1] = scopeY;
								uniformValue[2] = scopeZ;
								uniformValue[3] = scopeW;
						}
				};
				this.commitFunction[UNIFORMTYPE_INTARRAY] = function(uniform, value) {
						gl.uniform1iv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_UINTARRAY] = function(uniform, value) {
						gl.uniform1uiv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_BOOLARRAY] = this.commitFunction[UNIFORMTYPE_INTARRAY];
				this.commitFunction[UNIFORMTYPE_IVEC2ARRAY] = function(uniform, value) {
						gl.uniform2iv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_UVEC2ARRAY] = function(uniform, value) {
						gl.uniform2uiv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_BVEC2ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC2ARRAY];
				this.commitFunction[UNIFORMTYPE_IVEC3ARRAY] = function(uniform, value) {
						gl.uniform3iv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_UVEC3ARRAY] = function(uniform, value) {
						gl.uniform3uiv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_BVEC3ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC3ARRAY];
				this.commitFunction[UNIFORMTYPE_IVEC4ARRAY] = function(uniform, value) {
						gl.uniform4iv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_UVEC4ARRAY] = function(uniform, value) {
						gl.uniform4uiv(uniform.locationId, value);
				};
				this.commitFunction[UNIFORMTYPE_BVEC4ARRAY] = this.commitFunction[UNIFORMTYPE_IVEC4ARRAY];
				this.commitFunction[UNIFORMTYPE_MAT4ARRAY] = function(uniform, value) {
						gl.uniformMatrix4fv(uniform.locationId, false, value);
				};
				this.constantTexSource = this.scope.resolve('source');
				this.textureFloatRenderable = !!this.extColorBufferFloat;
				this.textureHalfFloatRenderable = !!this.extColorBufferHalfFloat || !!this.extColorBufferFloat;
				this.postInit();
		}
}

export { WebglGraphicsDevice };
