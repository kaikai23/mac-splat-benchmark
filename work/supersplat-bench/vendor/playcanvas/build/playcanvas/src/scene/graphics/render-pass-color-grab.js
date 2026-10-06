import { FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

var _colorUniformName = 'uSceneColorMap';
class RenderPassColorGrab extends RenderPass {
		destroy() {
				super.destroy();
				this.releaseRenderTarget(this.colorRenderTarget);
		}
		shouldReallocate(targetRT, sourceTexture, sourceFormat) {
				var targetFormat = targetRT == null ? undefined : targetRT.colorBuffer.format;
				if (targetFormat !== sourceFormat) {
						return true;
				}
				var width = (sourceTexture == null ? undefined : sourceTexture.width) || this.device.width;
				var height = (sourceTexture == null ? undefined : sourceTexture.height) || this.device.height;
				return !targetRT || width !== targetRT.width || height !== targetRT.height;
		}
		allocateRenderTarget(renderTarget, sourceRenderTarget, device, format) {
				var texture = new Texture(device, {
						name: _colorUniformName,
						format,
						width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
						height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
						mipmaps: true,
						minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
						magFilter: FILTER_LINEAR,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				if (renderTarget) {
						renderTarget.destroyFrameBuffers();
						renderTarget._colorBuffer = texture;
						renderTarget._colorBuffers = [
								texture
						];
				} else {
						renderTarget = new RenderTarget({
								name: 'ColorGrabRT',
								colorBuffer: texture,
								depth: false,
								stencil: false,
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
		frameUpdate() {
				var device = this.device;
				var sourceRt = this.source;
				var _sourceRt_colorBuffer_format;
				var sourceFormat = (_sourceRt_colorBuffer_format = sourceRt == null ? undefined : sourceRt.colorBuffer.format) != null ? _sourceRt_colorBuffer_format : this.device.backBufferFormat;
				if (this.shouldReallocate(this.colorRenderTarget, sourceRt == null ? undefined : sourceRt.colorBuffer, sourceFormat)) {
						this.releaseRenderTarget(this.colorRenderTarget);
						this.colorRenderTarget = this.allocateRenderTarget(this.colorRenderTarget, sourceRt, device, sourceFormat);
				}
				var colorBuffer = this.colorRenderTarget.colorBuffer;
				device.scope.resolve(_colorUniformName).setValue(colorBuffer);
		}
		execute() {
				var device = this.device;
				var sourceRt = this.source;
				var colorBuffer = this.colorRenderTarget.colorBuffer;
				if (device.isWebGPU) {
						device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);
						device.mipmapRenderer.generate(this.colorRenderTarget.colorBuffer.impl);
				} else {
						device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);
						device.activeTexture(device.maxCombinedTextures - 1);
						device.bindTexture(colorBuffer);
						device.gl.generateMipmap(colorBuffer.impl._glTarget);
				}
		}
		constructor(...args){
				super(...args), this.colorRenderTarget = null, this.source = null;
		}
}

export { RenderPassColorGrab };
