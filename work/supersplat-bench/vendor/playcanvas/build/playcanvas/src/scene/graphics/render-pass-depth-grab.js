import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

var _depthUniformName = 'uSceneDepthMap';
class RenderPassDepthGrab extends RenderPass {
		destroy() {
				super.destroy();
				this.releaseRenderTarget(this.depthRenderTarget);
		}
		shouldReallocate(targetRT, sourceTexture) {
				var width = (sourceTexture == null ? undefined : sourceTexture.width) || this.device.width;
				var height = (sourceTexture == null ? undefined : sourceTexture.height) || this.device.height;
				return !targetRT || width !== targetRT.width || height !== targetRT.height;
		}
		allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth) {
				var texture = new Texture(device, {
						name: _depthUniformName,
						format,
						width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
						height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				if (renderTarget) {
						renderTarget.destroyFrameBuffers();
						if (isDepth) {
								renderTarget._depthBuffer = texture;
						} else {
								renderTarget._colorBuffer = texture;
								renderTarget._colorBuffers = [
										texture
								];
						}
				} else {
						renderTarget = new RenderTarget({
								name: 'DepthGrabRT',
								colorBuffer: isDepth ? null : texture,
								depthBuffer: isDepth ? texture : null,
								depth: !isDepth,
								stencil: device.supportsStencil,
								autoResolve: false
						});
				}
				return renderTarget;
		}
		releaseRenderTarget(rt) {
				if (rt) {
						rt.destroyTextureBuffers();
						rt.destroy();
				}
		}
		before() {
				var _camera_renderTarget, _camera_renderTarget1;
				var camera = this.camera;
				var device = this.device;
				var _camera_renderTarget2;
				var destinationRt = (_camera_renderTarget2 = camera == null ? undefined : camera.renderTarget) != null ? _camera_renderTarget2 : device.backBuffer;
				var useDepthBuffer = true;
				var format = destinationRt.stencil ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH;
				if (device.isWebGPU) {
						var numSamples = destinationRt.samples;
						if (numSamples > 1) {
								format = PIXELFORMAT_R32F;
								useDepthBuffer = false;
						}
				}
				var _camera_renderTarget_depthBuffer;
				var sourceTexture = (_camera_renderTarget_depthBuffer = (_camera_renderTarget = camera.renderTarget) == null ? undefined : _camera_renderTarget.depthBuffer) != null ? _camera_renderTarget_depthBuffer : (_camera_renderTarget1 = camera.renderTarget) == null ? undefined : _camera_renderTarget1.colorBuffer;
				if (this.shouldReallocate(this.depthRenderTarget, sourceTexture)) {
						this.releaseRenderTarget(this.depthRenderTarget);
						this.depthRenderTarget = this.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, format, useDepthBuffer);
				}
				var colorBuffer = useDepthBuffer ? this.depthRenderTarget.depthBuffer : this.depthRenderTarget.colorBuffer;
				device.scope.resolve(_depthUniformName).setValue(colorBuffer);
		}
		execute() {
				var device = this.device;
				if (device.isWebGL2 && device.renderTarget.samples > 1) {
						var src = device.renderTarget.impl._glFrameBuffer;
						var dest = this.depthRenderTarget;
						device.renderTarget = dest;
						device.updateBegin();
						this.depthRenderTarget.impl.internalResolve(device, src, dest.impl._glFrameBuffer, this.depthRenderTarget, device.gl.DEPTH_BUFFER_BIT);
				} else {
						device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
				}
		}
		constructor(device, camera){
				super(device), this.depthRenderTarget = null, this.camera = null;
				this.camera = camera;
		}
}

export { RenderPassDepthGrab };
