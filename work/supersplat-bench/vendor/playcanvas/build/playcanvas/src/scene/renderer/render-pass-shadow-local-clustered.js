import { RenderPass } from '../../platform/graphics/render-pass.js';

class RenderPassShadowLocalClustered extends RenderPass {
		update(localLights) {
				var shadowLights = this.shadowRendererLocal.shadowLights;
				var shadowCamera = this.shadowRendererLocal.prepareLights(shadowLights, localLights);
				var count = shadowLights.length;
				this.enabled = count > 0;
				if (count) {
						this.shadowRenderer.setupRenderPass(this, shadowCamera, false);
				}
		}
		execute() {
				var shadowLights = this.shadowRendererLocal.shadowLights;
				var count = shadowLights.length;
				for(var i = 0; i < count; i++){
						var light = shadowLights[i];
						for(var face = 0; face < light.numShadowFaces; face++){
								this.shadowRenderer.renderFace(light, null, face, true);
						}
				}
				shadowLights.length = 0;
		}
		constructor(device, shadowRenderer, shadowRendererLocal){
				super(device);
				this.requiresCubemaps = false;
				this.shadowRenderer = shadowRenderer;
				this.shadowRendererLocal = shadowRendererLocal;
		}
}

export { RenderPassShadowLocalClustered };
