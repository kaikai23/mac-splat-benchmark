import { Color } from '../../core/math/color.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderPassDownsample } from './render-pass-downsample.js';
import { RenderPassUpsample } from './render-pass-upsample.js';
import { math } from '../../core/math/math.js';

class RenderPassBloom extends RenderPass {
		destroy() {
				this.destroyRenderPasses();
				this.destroyRenderTargets();
		}
		destroyRenderTargets(startIndex) {
				if (startIndex === undefined) startIndex = 0;
				for(var i = startIndex; i < this.renderTargets.length; i++){
						var rt = this.renderTargets[i];
						rt.destroyTextureBuffers();
						rt.destroy();
				}
				this.renderTargets.length = 0;
		}
		destroyRenderPasses() {
				for(var i = 0; i < this.beforePasses.length; i++){
						this.beforePasses[i].destroy();
				}
				this.beforePasses.length = 0;
		}
		createRenderTarget(index) {
				return new RenderTarget({
						depth: false,
						colorBuffer: new Texture(this.device, {
								name: "BloomTexture" + index,
								width: 1,
								height: 1,
								format: this.textureFormat,
								mipmaps: false,
								minFilter: FILTER_LINEAR,
								magFilter: FILTER_LINEAR,
								addressU: ADDRESS_CLAMP_TO_EDGE,
								addressV: ADDRESS_CLAMP_TO_EDGE
						})
				});
		}
		createRenderTargets(count) {
				for(var i = 0; i < count; i++){
						var rt = i === 0 ? this.bloomRenderTarget : this.createRenderTarget(i);
						this.renderTargets.push(rt);
				}
		}
		calcMipLevels(width, height, minSize) {
				var min = Math.min(width, height);
				return Math.floor(Math.log2(min) - Math.log2(minSize));
		}
		createRenderPasses(numPasses) {
				var device = this.device;
				var passSourceTexture = this._sourceTexture;
				for(var i = 0; i < numPasses; i++){
						var pass = new RenderPassDownsample(device, passSourceTexture);
						var rt = this.renderTargets[i];
						pass.init(rt, {
								resizeSource: passSourceTexture,
								scaleX: 0.5,
								scaleY: 0.5
						});
						pass.setClearColor(Color.BLACK);
						this.beforePasses.push(pass);
						passSourceTexture = rt.colorBuffer;
				}
				passSourceTexture = this.renderTargets[numPasses - 1].colorBuffer;
				for(var i1 = numPasses - 2; i1 >= 0; i1--){
						var pass1 = new RenderPassUpsample(device, passSourceTexture);
						var rt1 = this.renderTargets[i1];
						pass1.init(rt1);
						pass1.blendState = BlendState.ADDBLEND;
						this.beforePasses.push(pass1);
						passSourceTexture = rt1.colorBuffer;
				}
		}
		onDisable() {
				var _this_renderTargets_;
				(_this_renderTargets_ = this.renderTargets[0]) == null ? undefined : _this_renderTargets_.resize(1, 1);
				this.destroyRenderPasses();
				this.destroyRenderTargets(1);
		}
		frameUpdate() {
				super.frameUpdate();
				var maxNumPasses = this.calcMipLevels(this._sourceTexture.width, this._sourceTexture.height, 1);
				var numPasses = math.clamp(maxNumPasses, 1, this.blurLevel);
				if (this.renderTargets.length !== numPasses) {
						this.destroyRenderPasses();
						this.destroyRenderTargets(1);
						this.createRenderTargets(numPasses);
						this.createRenderPasses(numPasses);
				}
		}
		constructor(device, sourceTexture, format){
				super(device), this.blurLevel = 16, this.renderTargets = [];
				this._sourceTexture = sourceTexture;
				this.textureFormat = format;
				this.bloomRenderTarget = this.createRenderTarget(0);
				this.bloomTexture = this.bloomRenderTarget.colorBuffer;
		}
}

export { RenderPassBloom };
