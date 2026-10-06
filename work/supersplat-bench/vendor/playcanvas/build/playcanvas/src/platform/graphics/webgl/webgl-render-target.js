import { PIXELFORMAT_RGBA8 } from '../constants.js';
import { getMultisampledTextureCache } from '../multi-sampled-texture-cache.js';

class FramebufferPair {
		destroy(gl) {
				if (this.msaaFB) {
						gl.deleteRenderbuffer(this.msaaFB);
						this.msaaFB = null;
				}
				if (this.resolveFB) {
						gl.deleteRenderbuffer(this.resolveFB);
						this.resolveFB = null;
				}
		}
		constructor(msaaFB, resolveFB){
				this.msaaFB = msaaFB;
				this.resolveFB = resolveFB;
		}
}
class WebglRenderTarget {
		destroy(device) {
				var _this_colorMrtFramebuffers;
				var gl = device.gl;
				this._isInitialized = false;
				if (this._glFrameBuffer) {
						if (this._glFrameBuffer !== this.suppliedColorFramebuffer) {
								gl.deleteFramebuffer(this._glFrameBuffer);
						}
						this._glFrameBuffer = null;
				}
				if (this._glDepthBuffer) {
						gl.deleteRenderbuffer(this._glDepthBuffer);
						this._glDepthBuffer = null;
				}
				if (this._glResolveFrameBuffer) {
						if (this._glResolveFrameBuffer !== this.suppliedColorFramebuffer) {
								gl.deleteFramebuffer(this._glResolveFrameBuffer);
						}
						this._glResolveFrameBuffer = null;
				}
				this._glMsaaColorBuffers.forEach((buffer)=>{
						gl.deleteRenderbuffer(buffer);
				});
				this._glMsaaColorBuffers.length = 0;
				(_this_colorMrtFramebuffers = this.colorMrtFramebuffers) == null ? undefined : _this_colorMrtFramebuffers.forEach((framebuffer)=>{
						framebuffer.destroy(gl);
				});
				this.colorMrtFramebuffers = null;
				if (this._glMsaaDepthBuffer) {
						this._glMsaaDepthBuffer = null;
						if (this.msaaDepthBufferKey) {
								getMultisampledTextureCache(device).release(this.msaaDepthBufferKey);
						}
				}
				this.suppliedColorFramebuffer = undefined;
		}
		get initialized() {
				return this._isInitialized;
		}
		init(device, target) {
				var gl = device.gl;
				this._isInitialized = true;
				var buffers = [];
				if (this.suppliedColorFramebuffer !== undefined) {
						this._glFrameBuffer = this.suppliedColorFramebuffer;
				} else {
						var _target__colorBuffers;
						this._glFrameBuffer = gl.createFramebuffer();
						device.setFramebuffer(this._glFrameBuffer);
						var _target__colorBuffers_length;
						var colorBufferCount = (_target__colorBuffers_length = (_target__colorBuffers = target._colorBuffers) == null ? undefined : _target__colorBuffers.length) != null ? _target__colorBuffers_length : 0;
						var attachmentBaseConstant = gl.COLOR_ATTACHMENT0;
						for(var i = 0; i < colorBufferCount; ++i){
								var colorBuffer = target.getColorBuffer(i);
								if (colorBuffer) {
										if (!colorBuffer.impl._glTexture) {
												colorBuffer._width = Math.min(colorBuffer.width, device.maxRenderBufferSize);
												colorBuffer._height = Math.min(colorBuffer.height, device.maxRenderBufferSize);
												device.setTexture(colorBuffer, 0);
										}
										gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant + i, colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, colorBuffer.impl._glTexture, target.mipLevel);
										buffers.push(attachmentBaseConstant + i);
								}
						}
						gl.drawBuffers(buffers);
						var depthBuffer = target._depthBuffer;
						if (depthBuffer || target._depth) {
								var attachmentPoint = target._stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
								if (depthBuffer) {
										if (!depthBuffer.impl._glTexture) {
												depthBuffer._width = Math.min(depthBuffer.width, device.maxRenderBufferSize);
												depthBuffer._height = Math.min(depthBuffer.height, device.maxRenderBufferSize);
												device.setTexture(depthBuffer, 0);
										}
										gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._depthBuffer.impl._glTexture, target.mipLevel);
								} else {
										var willRenderMsaa = target._samples > 1;
										if (!willRenderMsaa) {
												if (!this._glDepthBuffer) {
														this._glDepthBuffer = gl.createRenderbuffer();
												}
												var internalFormat = target._stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT32F;
												gl.bindRenderbuffer(gl.RENDERBUFFER, this._glDepthBuffer);
												gl.renderbufferStorage(gl.RENDERBUFFER, internalFormat, target.width, target.height);
												gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachmentPoint, gl.RENDERBUFFER, this._glDepthBuffer);
												gl.bindRenderbuffer(gl.RENDERBUFFER, null);
										}
								}
						}
				}
				if (target._samples > 1) {
						var _target__colorBuffers1;
						this._glResolveFrameBuffer = this._glFrameBuffer;
						this._glFrameBuffer = gl.createFramebuffer();
						device.setFramebuffer(this._glFrameBuffer);
						var _target__colorBuffers_length1;
						var colorBufferCount1 = (_target__colorBuffers_length1 = (_target__colorBuffers1 = target._colorBuffers) == null ? undefined : _target__colorBuffers1.length) != null ? _target__colorBuffers_length1 : 0;
						if (this.suppliedColorFramebuffer !== undefined) {
								var buffer = gl.createRenderbuffer();
								this._glMsaaColorBuffers.push(buffer);
								var internalFormat1 = device.backBufferFormat === PIXELFORMAT_RGBA8 ? gl.RGBA8 : gl.RGB8;
								gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
								gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, internalFormat1, target.width, target.height);
								gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);
						} else {
								for(var i1 = 0; i1 < colorBufferCount1; ++i1){
										var colorBuffer1 = target.getColorBuffer(i1);
										if (colorBuffer1) {
												var buffer1 = gl.createRenderbuffer();
												this._glMsaaColorBuffers.push(buffer1);
												gl.bindRenderbuffer(gl.RENDERBUFFER, buffer1);
												gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer1.impl._glInternalFormat, target.width, target.height);
												gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i1, gl.RENDERBUFFER, buffer1);
										}
								}
						}
						if (target._depth) {
								var internalFormat2 = target._stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT32F;
								var attachmentPoint1 = target._stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
								var key;
								var depthBuffer1 = target._depthBuffer;
								if (depthBuffer1) {
										key = depthBuffer1.id + ":" + target.width + ":" + target.height + ":" + target._samples + ":" + internalFormat2 + ":" + attachmentPoint1;
										this._glMsaaDepthBuffer = getMultisampledTextureCache(device).get(key);
								}
								if (!this._glMsaaDepthBuffer) {
										this._glMsaaDepthBuffer = gl.createRenderbuffer();
										gl.bindRenderbuffer(gl.RENDERBUFFER, this._glMsaaDepthBuffer);
										gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, internalFormat2, target.width, target.height);
										this._glMsaaDepthBuffer.destroy = function() {
												gl.deleteRenderbuffer(this);
										};
										if (depthBuffer1) {
												getMultisampledTextureCache(device).set(key, this._glMsaaDepthBuffer);
										}
								}
								this.msaaDepthBufferKey = key;
								gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachmentPoint1, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
						}
						if (colorBufferCount1 > 1) {
								this._createMsaaMrtFramebuffers(device, target, colorBufferCount1);
								device.setFramebuffer(this._glFrameBuffer);
								gl.drawBuffers(buffers);
						}
				}
		}
		_createMsaaMrtFramebuffers(device, target, colorBufferCount) {
				var gl = device.gl;
				this.colorMrtFramebuffers = [];
				for(var i = 0; i < colorBufferCount; ++i){
						var colorBuffer = target.getColorBuffer(i);
						var srcFramebuffer = gl.createFramebuffer();
						device.setFramebuffer(srcFramebuffer);
						var buffer = this._glMsaaColorBuffers[i];
						gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
						gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
						gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);
						gl.drawBuffers([
								gl.COLOR_ATTACHMENT0
						]);
						var dstFramebuffer = gl.createFramebuffer();
						device.setFramebuffer(dstFramebuffer);
						gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, colorBuffer.impl._glTexture, 0);
						this.colorMrtFramebuffers[i] = new FramebufferPair(srcFramebuffer, dstFramebuffer);
				}
		}
		_checkFbo(device, target, type) {
				var gl = device.gl;
				var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
				switch(status){
						case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
								break;
						case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
								break;
						case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
								break;
						case gl.FRAMEBUFFER_UNSUPPORTED:
								break;
				}
		}
		loseContext() {
				this._glFrameBuffer = null;
				this._glDepthBuffer = null;
				this._glResolveFrameBuffer = null;
				this._glMsaaColorBuffers.length = 0;
				this._glMsaaDepthBuffer = null;
				this.msaaDepthBufferKey = undefined;
				this.colorMrtFramebuffers = null;
				this.suppliedColorFramebuffer = undefined;
				this._isInitialized = false;
		}
		internalResolve(device, src, dst, target, mask) {
				device.setScissor(0, 0, target.width, target.height);
				var gl = device.gl;
				gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
				gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
				gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, mask, gl.NEAREST);
		}
		resolve(device, target, color, depth) {
				var gl = device.gl;
				if (this.colorMrtFramebuffers) {
						if (color) {
								for(var i = 0; i < this.colorMrtFramebuffers.length; i++){
										var fbPair = this.colorMrtFramebuffers[i];
										this.internalResolve(device, fbPair.msaaFB, fbPair.resolveFB, target, gl.COLOR_BUFFER_BIT);
								}
						}
						if (depth) {
								this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target, gl.DEPTH_BUFFER_BIT);
						}
				} else {
						this.internalResolve(device, this._glFrameBuffer, this._glResolveFrameBuffer, target, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0));
				}
				gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
		}
		constructor(){
				this._glFrameBuffer = null;
				this._glDepthBuffer = null;
				this._glResolveFrameBuffer = null;
				this.colorMrtFramebuffers = null;
				this._glMsaaColorBuffers = [];
				this._glMsaaDepthBuffer = null;
				this._isInitialized = false;
		}
}

export { WebglRenderTarget };
