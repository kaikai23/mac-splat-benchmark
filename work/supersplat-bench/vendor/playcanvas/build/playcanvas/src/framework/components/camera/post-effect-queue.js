import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { LAYERID_DEPTH } from '../../../scene/constants.js';

class PostEffectEntry {
		constructor(effect, inputTarget){
				this.effect = effect;
				this.inputTarget = inputTarget;
				this.outputTarget = null;
				this.name = effect.constructor.name;
		}
}
class PostEffectQueue {
		_allocateColorBuffer(format, name) {
				var rect = this.camera.rect;
				var renderTarget = this.destinationRenderTarget;
				var device = this.app.graphicsDevice;
				var _renderTarget_width;
				var width = Math.floor(rect.z * ((_renderTarget_width = renderTarget == null ? undefined : renderTarget.width) != null ? _renderTarget_width : device.width));
				var _renderTarget_height;
				var height = Math.floor(rect.w * ((_renderTarget_height = renderTarget == null ? undefined : renderTarget.height) != null ? _renderTarget_height : device.height));
				var colorBuffer = new Texture(device, {
						name: name,
						format: format,
						width: width,
						height: height,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				return colorBuffer;
		}
		_createOffscreenTarget(useDepth, hdr) {
				var device = this.app.graphicsDevice;
				var _this_destinationRenderTarget;
				var outputRt = (_this_destinationRenderTarget = this.destinationRenderTarget) != null ? _this_destinationRenderTarget : device.backBuffer;
				var srgb = outputRt.isColorBufferSrgb(0);
				var _ref;
				var format = (_ref = hdr && device.getRenderableHdrFormat([
						PIXELFORMAT_RGBA16F,
						PIXELFORMAT_RGBA32F
				], true)) != null ? _ref : srgb ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8;
				var name = this.camera.entity.name + "-posteffect-" + this.effects.length;
				var colorBuffer = this._allocateColorBuffer(format, name);
				return new RenderTarget({
						colorBuffer: colorBuffer,
						depth: useDepth,
						stencil: useDepth && this.app.graphicsDevice.supportsStencil,
						samples: useDepth ? device.samples : 1
				});
		}
		_resizeOffscreenTarget(rt) {
				var format = rt.colorBuffer.format;
				var name = rt.colorBuffer.name;
				rt.destroyFrameBuffers();
				rt.destroyTextureBuffers();
				rt._colorBuffer = this._allocateColorBuffer(format, name);
				rt._colorBuffers = [
						rt._colorBuffer
				];
		}
		_destroyOffscreenTarget(rt) {
				rt.destroyTextureBuffers();
				rt.destroy();
		}
		addEffect(effect) {
				var effects = this.effects;
				var isFirstEffect = effects.length === 0;
				var inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
				var newEntry = new PostEffectEntry(effect, inputTarget);
				effects.push(newEntry);
				this._sourceTarget = newEntry.inputTarget;
				if (effects.length > 1) {
						effects[effects.length - 2].outputTarget = newEntry.inputTarget;
				}
				this._newPostEffect = effect;
				if (effect.needsDepthBuffer) {
						this._requestDepthMap();
				}
				this.enable();
				this._newPostEffect = undefined;
		}
		removeEffect(effect) {
				var index = -1;
				for(var i = 0, len = this.effects.length; i < len; i++){
						if (this.effects[i].effect === effect) {
								index = i;
								break;
						}
				}
				if (index >= 0) {
						if (index > 0) {
								this.effects[index - 1].outputTarget = index + 1 < this.effects.length ? this.effects[index + 1].inputTarget : null;
						} else {
								if (this.effects.length > 1) {
										if (!this.effects[1].inputTarget._depth) {
												this._destroyOffscreenTarget(this.effects[1].inputTarget);
												this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
												this._sourceTarget = this.effects[1].inputTarget;
										}
										this.camera.renderTarget = this.effects[1].inputTarget;
								}
						}
						this._destroyOffscreenTarget(this.effects[index].inputTarget);
						this.effects.splice(index, 1);
				}
				if (this.enabled) {
						if (effect.needsDepthBuffer) {
								this._releaseDepthMap();
						}
				}
				if (this.effects.length === 0) {
						this.disable();
				}
		}
		_requestDepthMaps() {
				for(var i = 0, len = this.effects.length; i < len; i++){
						var effect = this.effects[i].effect;
						if (this._newPostEffect === effect) {
								continue;
						}
						if (effect.needsDepthBuffer) {
								this._requestDepthMap();
						}
				}
		}
		_releaseDepthMaps() {
				for(var i = 0, len = this.effects.length; i < len; i++){
						var effect = this.effects[i].effect;
						if (effect.needsDepthBuffer) {
								this._releaseDepthMap();
						}
				}
		}
		_requestDepthMap() {
				var depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
				if (depthLayer) {
						depthLayer.incrementCounter();
						this.camera.requestSceneDepthMap(true);
				}
		}
		_releaseDepthMap() {
				var depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
				if (depthLayer) {
						depthLayer.decrementCounter();
						this.camera.requestSceneDepthMap(false);
				}
		}
		destroy() {
				for(var i = 0, len = this.effects.length; i < len; i++){
						this.effects[i].inputTarget.destroy();
				}
				this.effects.length = 0;
				this.disable();
		}
		enable() {
				if (!this.enabled && this.effects.length) {
						this.enabled = true;
						this._requestDepthMaps();
						this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);
						this.destinationRenderTarget = this.camera.renderTarget;
						this.camera.renderTarget = this.effects[0].inputTarget;
						this.camera.onPostprocessing = ()=>{
								if (this.enabled) {
										var rect = null;
										var len = this.effects.length;
										if (len) {
												for(var i = 0; i < len; i++){
														var fx = this.effects[i];
														var destTarget = fx.outputTarget;
														if (i === len - 1) {
																rect = this.camera.rect;
																if (this.destinationRenderTarget) {
																		destTarget = this.destinationRenderTarget;
																}
														}
														fx.effect.render(fx.inputTarget, destTarget, rect);
												}
										}
								}
						};
				}
		}
		disable() {
				if (this.enabled) {
						this.enabled = false;
						this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);
						this._releaseDepthMaps();
						this._destroyOffscreenTarget(this._sourceTarget);
						this.camera.renderTarget = this.destinationRenderTarget;
						this.camera.onPostprocessing = null;
				}
		}
		_onCanvasResized(width, height) {
				var rect = this.camera.rect;
				var renderTarget = this.destinationRenderTarget;
				var _renderTarget_width;
				width = (_renderTarget_width = renderTarget == null ? undefined : renderTarget.width) != null ? _renderTarget_width : width;
				var _renderTarget_height;
				height = (_renderTarget_height = renderTarget == null ? undefined : renderTarget.height) != null ? _renderTarget_height : height;
				this.camera.camera.aspectRatio = width * rect.z / (height * rect.w);
				this.resizeRenderTargets();
		}
		resizeRenderTargets() {
				var device = this.app.graphicsDevice;
				var renderTarget = this.destinationRenderTarget;
				var _renderTarget_width;
				var width = (_renderTarget_width = renderTarget == null ? undefined : renderTarget.width) != null ? _renderTarget_width : device.width;
				var _renderTarget_height;
				var height = (_renderTarget_height = renderTarget == null ? undefined : renderTarget.height) != null ? _renderTarget_height : device.height;
				var rect = this.camera.rect;
				var desiredWidth = Math.floor(rect.z * width);
				var desiredHeight = Math.floor(rect.w * height);
				var effects = this.effects;
				for(var i = 0, len = effects.length; i < len; i++){
						var fx = effects[i];
						if (fx.inputTarget.width !== desiredWidth || fx.inputTarget.height !== desiredHeight) {
								this._resizeOffscreenTarget(fx.inputTarget);
						}
				}
		}
		onCameraRectChanged(name, oldValue, newValue) {
				if (this.enabled) {
						this.resizeRenderTargets();
				}
		}
		constructor(app, camera){
				this.app = app;
				this.camera = camera;
				this.destinationRenderTarget = null;
				this.effects = [];
				this.enabled = false;
				this.depthTarget = null;
				camera.on('set:rect', this.onCameraRectChanged, this);
		}
}

export { PostEffectQueue };
