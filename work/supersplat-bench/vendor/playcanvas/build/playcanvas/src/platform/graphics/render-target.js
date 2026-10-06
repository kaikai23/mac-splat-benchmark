import { isSrgbPixelFormat, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R32F } from './constants.js';
import { TextureUtils } from './texture-utils.js';

var id = 0;
class RenderTarget {
		destroy() {
				var device = this._device;
				if (device) {
						device.targets.delete(this);
						if (device.renderTarget === this) {
								device.setRenderTarget(null);
						}
						this.destroyFrameBuffers();
				}
		}
		destroyFrameBuffers() {
				var device = this._device;
				if (device) {
						this.impl.destroy(device);
				}
		}
		destroyTextureBuffers() {
				var _this__depthBuffer, _this__colorBuffers;
				(_this__depthBuffer = this._depthBuffer) == null ? undefined : _this__depthBuffer.destroy();
				this._depthBuffer = null;
				(_this__colorBuffers = this._colorBuffers) == null ? undefined : _this__colorBuffers.forEach((colorBuffer)=>{
						colorBuffer.destroy();
				});
				this._colorBuffers = null;
				this._colorBuffer = null;
		}
		resize(width, height) {
				if (this.width !== width || this.height !== height) {
						var _this__depthBuffer, _this__colorBuffers;
						if (this.mipLevel > 0) {
								return;
						}
						var device = this._device;
						this.destroyFrameBuffers();
						if (device.renderTarget === this) {
								device.setRenderTarget(null);
						}
						(_this__depthBuffer = this._depthBuffer) == null ? undefined : _this__depthBuffer.resize(width, height);
						(_this__colorBuffers = this._colorBuffers) == null ? undefined : _this__colorBuffers.forEach((colorBuffer)=>{
								colorBuffer.resize(width, height);
						});
						this.validateMrt();
						this.impl = device.createRenderTargetImpl(this);
				}
		}
		validateMrt() {}
		init() {
				this.impl.init(this._device, this);
		}
		get initialized() {
				return this.impl.initialized;
		}
		get device() {
				return this._device;
		}
		loseContext() {
				this.impl.loseContext();
		}
		resolve(color, depth) {
				if (color === undefined) color = true;
				if (depth === undefined) depth = !!this._depthBuffer;
				if (this._device && this._samples > 1) {
						this.impl.resolve(this._device, this, color, depth);
				}
		}
		copy(source, color, depth) {
				if (!this._device) {
						if (source._device) {
								this._device = source._device;
						} else {
								return false;
						}
				}
				var success = this._device.copyRenderTarget(source, this, color, depth);
				return success;
		}
		get samples() {
				return this._samples;
		}
		get depth() {
				return this._depth;
		}
		get stencil() {
				return this._stencil;
		}
		get colorBuffer() {
				return this._colorBuffer;
		}
		getColorBuffer(index) {
				var _this__colorBuffers;
				return (_this__colorBuffers = this._colorBuffers) == null ? undefined : _this__colorBuffers[index];
		}
		get depthBuffer() {
				return this._depthBuffer;
		}
		get face() {
				return this._face;
		}
		get mipLevel() {
				return this._mipLevel;
		}
		get mipmaps() {
				return this._mipmaps;
		}
		get width() {
				var _this__colorBuffer, _this__depthBuffer;
				var width = ((_this__colorBuffer = this._colorBuffer) == null ? undefined : _this__colorBuffer.width) || ((_this__depthBuffer = this._depthBuffer) == null ? undefined : _this__depthBuffer.width) || this._device.width;
				if (this._mipLevel > 0) {
						width = TextureUtils.calcLevelDimension(width, this._mipLevel);
				}
				return width;
		}
		get height() {
				var _this__colorBuffer, _this__depthBuffer;
				var height = ((_this__colorBuffer = this._colorBuffer) == null ? undefined : _this__colorBuffer.height) || ((_this__depthBuffer = this._depthBuffer) == null ? undefined : _this__depthBuffer.height) || this._device.height;
				if (this._mipLevel > 0) {
						height = TextureUtils.calcLevelDimension(height, this._mipLevel);
				}
				return height;
		}
		isColorBufferSrgb(index) {
				if (index === undefined) index = 0;
				if (this.device.backBuffer === this) {
						return isSrgbPixelFormat(this.device.backBufferFormat);
				}
				var colorBuffer = this.getColorBuffer(index);
				return colorBuffer ? isSrgbPixelFormat(colorBuffer.format) : false;
		}
		constructor(options = {}){
				var _options_colorBuffer, _options_colorBuffers, _options_depthBuffer;
				this.id = id++;
				var _options_colorBuffer_device, _ref, _ref1;
				var device = (_ref1 = (_ref = (_options_colorBuffer_device = (_options_colorBuffer = options.colorBuffer) == null ? undefined : _options_colorBuffer.device) != null ? _options_colorBuffer_device : (_options_colorBuffers = options.colorBuffers) == null ? undefined : _options_colorBuffers[0].device) != null ? _ref : (_options_depthBuffer = options.depthBuffer) == null ? undefined : _options_depthBuffer.device) != null ? _ref1 : options.graphicsDevice;
				this._device = device;
				var { maxSamples } = this._device;
				var _options_samples;
				this._samples = Math.min((_options_samples = options.samples) != null ? _options_samples : 1, maxSamples);
				if (device.isWebGPU) {
						this._samples = this._samples > 1 ? maxSamples : 1;
				}
				this._colorBuffer = options.colorBuffer;
				if (options.colorBuffer) {
						this._colorBuffers = [
								options.colorBuffer
						];
				}
				this._depthBuffer = options.depthBuffer;
				var _options_face;
				this._face = (_options_face = options.face) != null ? _options_face : 0;
				if (this._depthBuffer) {
						var format = this._depthBuffer._format;
						if (format === PIXELFORMAT_DEPTH || format === PIXELFORMAT_DEPTH16) {
								this._depth = true;
								this._stencil = false;
						} else if (format === PIXELFORMAT_DEPTHSTENCIL) {
								this._depth = true;
								this._stencil = true;
						} else if (format === PIXELFORMAT_R32F && this._depthBuffer.device.isWebGPU && this._samples > 1) {
								this._depth = true;
								this._stencil = false;
						} else {
								this._depth = false;
								this._stencil = false;
						}
				} else {
						var _options_depth;
						this._depth = (_options_depth = options.depth) != null ? _options_depth : true;
						var _options_stencil;
						this._stencil = (_options_stencil = options.stencil) != null ? _options_stencil : false;
				}
				if (options.colorBuffers) {
						if (!this._colorBuffers) {
								this._colorBuffers = [
										...options.colorBuffers
								];
								this._colorBuffer = options.colorBuffers[0];
						}
				}
				var _options_autoResolve;
				this.autoResolve = (_options_autoResolve = options.autoResolve) != null ? _options_autoResolve : true;
				this.name = options.name;
				if (!this.name) {
						var _this__colorBuffer;
						this.name = (_this__colorBuffer = this._colorBuffer) == null ? undefined : _this__colorBuffer.name;
				}
				if (!this.name) {
						var _this__depthBuffer;
						this.name = (_this__depthBuffer = this._depthBuffer) == null ? undefined : _this__depthBuffer.name;
				}
				if (!this.name) {
						this.name = 'Untitled';
				}
				var _options_flipY;
				this.flipY = (_options_flipY = options.flipY) != null ? _options_flipY : false;
				var _options_mipLevel;
				this._mipLevel = (_options_mipLevel = options.mipLevel) != null ? _options_mipLevel : 0;
				if (this._mipLevel > 0 && this._depth) {
						this._mipLevel = 0;
				}
				this._mipmaps = options.mipLevel === undefined;
				this.validateMrt();
				this.impl = device.createRenderTargetImpl(this);
		}
}

export { RenderTarget };
