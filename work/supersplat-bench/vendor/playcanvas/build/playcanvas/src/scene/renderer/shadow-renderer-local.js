import { math } from '../../core/math/math.js';
import { LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { ShadowMap } from './shadow-map.js';
import { RenderPassShadowLocalNonClustered } from './render-pass-shadow-local-non-clustered.js';

class ShadowRendererLocal {
		cull(light, comp, casters) {
				if (casters === undefined) casters = null;
				var isClustered = this.renderer.scene.clusteredLightingEnabled;
				light.visibleThisFrame = true;
				if (!isClustered) {
						if (!light._shadowMap) {
								light._shadowMap = ShadowMap.create(this.device, light);
						}
				}
				var type = light._type;
				var faceCount = type === LIGHTTYPE_SPOT ? 1 : 6;
				for(var face = 0; face < faceCount; face++){
						var lightRenderData = light.getRenderData(null, face);
						var shadowCam = lightRenderData.shadowCamera;
						shadowCam.nearClip = light.attenuationEnd / 1000;
						shadowCam.farClip = light.attenuationEnd;
						var shadowCamNode = shadowCam._node;
						var lightNode = light._node;
						shadowCamNode.setPosition(lightNode.getPosition());
						if (type === LIGHTTYPE_SPOT) {
								shadowCam.fov = light._outerConeAngle * 2;
								shadowCamNode.setRotation(lightNode.getRotation());
								shadowCamNode.rotateLocal(-90, 0, 0);
						} else if (type === LIGHTTYPE_OMNI) {
								if (isClustered) {
										var tileSize = this.shadowRenderer.lightTextureAtlas.shadowAtlasResolution * light.atlasViewport.z / 3;
										var texelSize = 2 / tileSize;
										var filterSize = texelSize * this.shadowRenderer.lightTextureAtlas.shadowEdgePixels;
										shadowCam.fov = Math.atan(1 + filterSize) * math.RAD_TO_DEG * 2;
								} else {
										shadowCam.fov = 90;
								}
						}
						this.renderer.updateCameraFrustum(shadowCam);
						this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);
				}
		}
		prepareLights(shadowLights, lights) {
				var shadowCamera;
				for(var i = 0; i < lights.length; i++){
						var light = lights[i];
						if (this.shadowRenderer.needsShadowRendering(light) && light.atlasViewportAllocated) {
								shadowLights.push(light);
								for(var face = 0; face < light.numShadowFaces; face++){
										shadowCamera = this.shadowRenderer.prepareFace(light, null, face);
								}
						}
				}
				return shadowCamera;
		}
		buildNonClusteredRenderPasses(frameGraph, localLights) {
				for(var i = 0; i < localLights.length; i++){
						var light = localLights[i];
						if (this.shadowRenderer.needsShadowRendering(light)) {
								var applyVsm = light._type === LIGHTTYPE_SPOT;
								var faceCount = light.numShadowFaces;
								for(var face = 0; face < faceCount; face++){
										var renderPass = new RenderPassShadowLocalNonClustered(this.device, this.shadowRenderer, light, face, applyVsm);
										frameGraph.addRenderPass(renderPass);
								}
						}
				}
		}
		constructor(renderer, shadowRenderer){
				this.shadowLights = [];
				this.renderer = renderer;
				this.shadowRenderer = shadowRenderer;
				this.device = renderer.device;
		}
}

export { ShadowRendererLocal };
