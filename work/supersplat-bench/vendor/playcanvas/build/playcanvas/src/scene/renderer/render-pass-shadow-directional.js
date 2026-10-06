import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';

class RenderPassShadowDirectional extends RenderPass {
		execute() {
				var { light, camera, shadowRenderer, allCascadesRendering } = this;
				var faceCount = light.numShadowFaces;
				var shadowUpdateOverrides = light.shadowUpdateOverrides;
				for(var face = 0; face < faceCount; face++){
						if ((shadowUpdateOverrides == null ? undefined : shadowUpdateOverrides[face]) !== SHADOWUPDATE_NONE) {
								shadowRenderer.renderFace(light, camera, face, !allCascadesRendering);
						}
						if ((shadowUpdateOverrides == null ? undefined : shadowUpdateOverrides[face]) === SHADOWUPDATE_THISFRAME) {
								shadowUpdateOverrides[face] = SHADOWUPDATE_NONE;
						}
				}
		}
		after() {
				this.shadowRenderer.renderVsm(this.light, this.camera);
		}
		constructor(device, shadowRenderer, light, camera, allCascadesRendering){
				super(device);
				this.shadowRenderer = shadowRenderer;
				this.light = light;
				this.camera = camera;
				this.allCascadesRendering = allCascadesRendering;
		}
}

export { RenderPassShadowDirectional };
