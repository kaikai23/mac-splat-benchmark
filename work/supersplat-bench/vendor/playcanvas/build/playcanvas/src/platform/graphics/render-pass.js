import { Color } from '../../core/math/color.js';
import { isIntegerPixelFormat } from './constants.js';

class ColorAttachmentOps {
		constructor(){
				this.clearValue = new Color(0, 0, 0, 1);
				this.clearValueLinear = new Color(0, 0, 0, 1);
				this.clear = false;
				this.store = false;
				this.resolve = true;
				this.genMipmaps = false;
		}
}
class DepthStencilAttachmentOps {
		constructor(){
				this.clearDepthValue = 1;
				this.clearStencilValue = 0;
				this.clearDepth = false;
				this.clearStencil = false;
				this.storeDepth = false;
				this.resolveDepth = false;
				this.storeStencil = false;
		}
}
class RenderPass {
		get colorOps() {
				return this.colorArrayOps[0];
		}
		set name(value) {
				this._name = value;
		}
		get name() {
				if (!this._name) {
						this._name = this.constructor.name;
				}
				return this._name;
		}
		set scaleX(value) {
				this._options.scaleX = value;
		}
		get scaleX() {
				return this._options.scaleX;
		}
		set scaleY(value) {
				this._options.scaleY = value;
		}
		get scaleY() {
				return this._options.scaleY;
		}
		set options(value) {
				this._options = value;
				if (value) {
						var _this_scaleX;
						this.scaleX = (_this_scaleX = this.scaleX) != null ? _this_scaleX : 1;
						var _this_scaleY;
						this.scaleY = (_this_scaleY = this.scaleY) != null ? _this_scaleY : 1;
				}
		}
		get options() {
				return this._options;
		}
		init(renderTarget, options) {
				if (renderTarget === undefined) renderTarget = null;
				this.options = options;
				this.renderTarget = renderTarget;
				this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);
				this.allocateAttachments();
				this.postInit();
		}
		allocateAttachments() {
				var _rt__colorBuffers;
				var rt = this.renderTarget;
				this.depthStencilOps = new DepthStencilAttachmentOps();
				if (rt == null ? undefined : rt.depthBuffer) {
						this.depthStencilOps.storeDepth = true;
				}
				var _rt__colorBuffers_length;
				var numColorOps = rt ? (_rt__colorBuffers_length = (_rt__colorBuffers = rt._colorBuffers) == null ? undefined : _rt__colorBuffers.length) != null ? _rt__colorBuffers_length : 0 : 1;
				this.colorArrayOps.length = 0;
				for(var i = 0; i < numColorOps; i++){
						var _this_renderTarget__colorBuffers, _this_renderTarget, _this_renderTarget1;
						var colorOps = new ColorAttachmentOps();
						this.colorArrayOps[i] = colorOps;
						if (this.samples === 1) {
								colorOps.store = true;
								colorOps.resolve = false;
						}
						var colorBuffer = (_this_renderTarget = this.renderTarget) == null ? undefined : (_this_renderTarget__colorBuffers = _this_renderTarget._colorBuffers) == null ? undefined : _this_renderTarget__colorBuffers[i];
						if (((_this_renderTarget1 = this.renderTarget) == null ? undefined : _this_renderTarget1.mipmaps) && (colorBuffer == null ? undefined : colorBuffer.mipmaps)) {
								var intFormat = isIntegerPixelFormat(colorBuffer._format);
								colorOps.genMipmaps = !intFormat;
						}
				}
		}
		destroy() {}
		postInit() {}
		frameUpdate() {
				if (this._options && this.renderTarget) {
						var _this__options_resizeSource;
						var resizeSource = (_this__options_resizeSource = this._options.resizeSource) != null ? _this__options_resizeSource : this.device.backBuffer;
						var width = Math.floor(resizeSource.width * this.scaleX);
						var height = Math.floor(resizeSource.height * this.scaleY);
						this.renderTarget.resize(width, height);
				}
		}
		before() {}
		execute() {}
		after() {}
		onEnable() {}
		onDisable() {}
		set enabled(value) {
				if (this._enabled !== value) {
						this._enabled = value;
						if (value) {
								this.onEnable();
						} else {
								this.onDisable();
						}
				}
		}
		get enabled() {
				return this._enabled;
		}
		setClearColor(color) {
				var count = this.colorArrayOps.length;
				for(var i = 0; i < count; i++){
						var colorOps = this.colorArrayOps[i];
						if (color) {
								colorOps.clearValue.copy(color);
								colorOps.clearValueLinear.linear(color);
						}
						colorOps.clear = !!color;
				}
		}
		setClearDepth(depthValue) {
				if (depthValue) {
						this.depthStencilOps.clearDepthValue = depthValue;
				}
				this.depthStencilOps.clearDepth = depthValue !== undefined;
		}
		setClearStencil(stencilValue) {
				if (stencilValue) {
						this.depthStencilOps.clearStencilValue = stencilValue;
				}
				this.depthStencilOps.clearStencil = stencilValue !== undefined;
		}
		render() {
				if (this.enabled) {
						var device = this.device;
						var realPass = this.renderTarget !== undefined;
						this.before();
						if (this.executeEnabled) {
								if (realPass && !this._skipStart) {
										device.startRenderPass(this);
								}
								this.execute();
								if (realPass && !this._skipEnd) {
										device.endRenderPass(this);
								}
						}
						this.after();
						device.renderPassIndex++;
				}
		}
		constructor(graphicsDevice){
				this._enabled = true;
				this._skipStart = false;
				this._skipEnd = false;
				this.executeEnabled = true;
				this.samples = 0;
				this.colorArrayOps = [];
				this.requiresCubemaps = true;
				this.fullSizeClearRect = true;
				this.beforePasses = [];
				this.afterPasses = [];
				this.device = graphicsDevice;
		}
}

export { RenderPass };
