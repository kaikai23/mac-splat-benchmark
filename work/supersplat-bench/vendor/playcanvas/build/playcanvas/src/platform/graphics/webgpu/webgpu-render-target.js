import { StringIds } from '../../../core/string-ids.js';
import { getMultisampledTextureCache } from '../multi-sampled-texture-cache.js';

var stringIds = new StringIds();
class ColorAttachment {
		destroy() {
				var _this_multisampledBuffer;
				(_this_multisampledBuffer = this.multisampledBuffer) == null ? undefined : _this_multisampledBuffer.destroy();
				this.multisampledBuffer = null;
		}
}
class DepthAttachment {
		destroy(device) {
				if (this.depthTextureInternal) {
						var _this_depthTexture;
						(_this_depthTexture = this.depthTexture) == null ? undefined : _this_depthTexture.destroy();
						this.depthTexture = null;
				}
				if (this.multisampledDepthBuffer) {
						this.multisampledDepthBuffer = null;
						getMultisampledTextureCache(device).release(this.multisampledDepthBufferKey);
				}
		}
		constructor(gpuFormat){
				this.depthTexture = null;
				this.depthTextureInternal = false;
				this.multisampledDepthBuffer = null;
				this.format = gpuFormat;
				this.hasStencil = gpuFormat === 'depth24plus-stencil8';
		}
}
class WebgpuRenderTarget {
		destroy(device) {
				var _this_depthAttachment;
				this.initialized = false;
				this.assignedColorTexture = null;
				this.colorAttachments.forEach((colorAttachment)=>{
						colorAttachment.destroy();
				});
				this.colorAttachments.length = 0;
				(_this_depthAttachment = this.depthAttachment) == null ? undefined : _this_depthAttachment.destroy(device);
				this.depthAttachment = null;
		}
		updateKey() {
				var rt = this.renderTarget;
				var key = rt.samples + ":" + (this.depthAttachment ? this.depthAttachment.format : 'nodepth');
				this.colorAttachments.forEach((colorAttachment)=>{
						key += ":" + colorAttachment.format;
				});
				this.key = stringIds.get(key);
		}
		assignColorTexture(device, gpuTexture) {
				this.assignedColorTexture = gpuTexture;
				var view = gpuTexture.createView({
						format: device.backBufferViewFormat
				});
				var colorAttachment = this.renderPassDescriptor.colorAttachments[0];
				var samples = this.renderTarget.samples;
				if (samples > 1) {
						colorAttachment.resolveTarget = view;
				} else {
						colorAttachment.view = view;
				}
				this.setColorAttachment(0, undefined, device.backBufferViewFormat);
				this.updateKey();
		}
		setColorAttachment(index, multisampledBuffer, format) {
				if (!this.colorAttachments[index]) {
						this.colorAttachments[index] = new ColorAttachment();
				}
				if (multisampledBuffer) {
						this.colorAttachments[index].multisampledBuffer = multisampledBuffer;
				}
				if (format) {
						this.colorAttachments[index].format = format;
				}
		}
		init(device, renderTarget) {
				var _renderTarget__colorBuffers;
				var wgpu = device.wgpu;
				this.initDepthStencil(device, wgpu, renderTarget);
				if (renderTarget._colorBuffers) {
						renderTarget._colorBuffers.forEach((colorBuffer, index)=>{
								this.setColorAttachment(index, undefined, colorBuffer.impl.format);
						});
				}
				this.renderPassDescriptor.colorAttachments = [];
				var _renderTarget__colorBuffers_length;
				var count = this.isBackbuffer ? 1 : (_renderTarget__colorBuffers_length = (_renderTarget__colorBuffers = renderTarget._colorBuffers) == null ? undefined : _renderTarget__colorBuffers.length) != null ? _renderTarget__colorBuffers_length : 0;
				for(var i = 0; i < count; ++i){
						var _this_colorAttachments_;
						var colorAttachment = this.initColor(device, wgpu, renderTarget, i);
						var isDefaultFramebuffer = i === 0 && ((_this_colorAttachments_ = this.colorAttachments[0]) == null ? undefined : _this_colorAttachments_.format);
						if (colorAttachment.view || isDefaultFramebuffer) {
								this.renderPassDescriptor.colorAttachments.push(colorAttachment);
						}
				}
				this.updateKey();
				this.initialized = true;
		}
		initDepthStencil(device, wgpu, renderTarget) {
				var { samples, width, height, depth, depthBuffer } = renderTarget;
				if (depth || depthBuffer) {
						var renderingView;
						if (!depthBuffer) {
								this.depthAttachment = new DepthAttachment('depth24plus-stencil8');
								var depthTextureDesc = {
										size: [
												width,
												height,
												1
										],
										dimension: '2d',
										sampleCount: samples,
										format: this.depthAttachment.format,
										usage: GPUTextureUsage.RENDER_ATTACHMENT
								};
								if (samples > 1) {
										depthTextureDesc.usage |= GPUTextureUsage.TEXTURE_BINDING;
								} else {
										depthTextureDesc.usage |= GPUTextureUsage.COPY_SRC;
								}
								var depthTexture = wgpu.createTexture(depthTextureDesc);
								this.depthAttachment.depthTexture = depthTexture;
								this.depthAttachment.depthTextureInternal = true;
								renderingView = depthTexture.createView();
						} else {
								this.depthAttachment = new DepthAttachment(depthBuffer.impl.format);
								if (samples > 1) {
										var depthFormat = 'depth24plus-stencil8';
										this.depthAttachment.format = depthFormat;
										this.depthAttachment.hasStencil = depthFormat === 'depth24plus-stencil8';
										var key = depthBuffer.id + ":" + width + ":" + height + ":" + samples + ":" + depthFormat;
										var msTextures = getMultisampledTextureCache(device);
										var msDepthTexture = msTextures.get(key);
										if (!msDepthTexture) {
												var multisampledDepthDesc = {
														size: [
																width,
																height,
																1
														],
														dimension: '2d',
														sampleCount: samples,
														format: depthFormat,
														usage: GPUTextureUsage.RENDER_ATTACHMENT | (depthFormat !== depthBuffer.impl.format ? GPUTextureUsage.TEXTURE_BINDING : 0)
												};
												msDepthTexture = wgpu.createTexture(multisampledDepthDesc);
												msTextures.set(key, msDepthTexture);
										}
										this.depthAttachment.multisampledDepthBuffer = msDepthTexture;
										this.depthAttachment.multisampledDepthBufferKey = key;
										renderingView = msDepthTexture.createView();
								} else {
										var depthTexture1 = depthBuffer.impl.gpuTexture;
										this.depthAttachment.depthTexture = depthTexture1;
										renderingView = depthTexture1.createView();
								}
						}
						this.renderPassDescriptor.depthStencilAttachment = {
								view: renderingView
						};
				}
		}
		initColor(device, wgpu, renderTarget, index) {
				var colorAttachment = {};
				var { samples, width, height, mipLevel } = renderTarget;
				var colorBuffer = renderTarget.getColorBuffer(index);
				var colorView = null;
				if (colorBuffer) {
						var mipLevelCount = 1;
						if (colorBuffer.cubemap) {
								colorView = colorBuffer.impl.createView({
										dimension: '2d',
										baseArrayLayer: renderTarget.face,
										arrayLayerCount: 1,
										mipLevelCount,
										baseMipLevel: mipLevel
								});
						} else {
								colorView = colorBuffer.impl.createView({
										mipLevelCount,
										baseMipLevel: mipLevel
								});
						}
				}
				if (samples > 1) {
						var format = this.isBackbuffer ? device.backBufferViewFormat : colorBuffer.impl.format;
						var multisampledTextureDesc = {
								size: [
										width,
										height,
										1
								],
								dimension: '2d',
								sampleCount: samples,
								format: format,
								usage: GPUTextureUsage.RENDER_ATTACHMENT
						};
						var multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
						this.setColorAttachment(index, multisampledColorBuffer, multisampledTextureDesc.format);
						colorAttachment.view = multisampledColorBuffer.createView();
						colorAttachment.resolveTarget = colorView;
				} else {
						colorAttachment.view = colorView;
				}
				return colorAttachment;
		}
		setupForRenderPass(renderPass, renderTarget) {
				var _this_renderPassDescriptor_colorAttachments;
				var _this_renderPassDescriptor_colorAttachments_length;
				var count = (_this_renderPassDescriptor_colorAttachments_length = (_this_renderPassDescriptor_colorAttachments = this.renderPassDescriptor.colorAttachments) == null ? undefined : _this_renderPassDescriptor_colorAttachments.length) != null ? _this_renderPassDescriptor_colorAttachments_length : 0;
				for(var i = 0; i < count; ++i){
						var colorAttachment = this.renderPassDescriptor.colorAttachments[i];
						var colorOps = renderPass.colorArrayOps[i];
						var srgb = renderTarget.isColorBufferSrgb(i);
						colorAttachment.clearValue = srgb ? colorOps.clearValueLinear : colorOps.clearValue;
						colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
						colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
				}
				var depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
				if (depthAttachment) {
						depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
						depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
						depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
						depthAttachment.depthReadOnly = false;
						if (this.depthAttachment.hasStencil) {
								depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
								depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'load';
								depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
								depthAttachment.stencilReadOnly = false;
						}
				}
		}
		loseContext() {
				this.initialized = false;
		}
		resolve(device, target, color, depth) {}
		constructor(renderTarget){
				this.initialized = false;
				this.colorAttachments = [];
				this.depthAttachment = null;
				this.assignedColorTexture = null;
				this.renderPassDescriptor = {};
				this.isBackbuffer = false;
				this.renderTarget = renderTarget;
		}
}

export { WebgpuRenderTarget };
