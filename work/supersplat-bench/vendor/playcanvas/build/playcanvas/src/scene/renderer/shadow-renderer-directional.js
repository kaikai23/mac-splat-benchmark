import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { SHADOWUPDATE_NONE } from '../constants.js';
import { ShadowMap } from './shadow-map.js';
import { RenderPassShadowDirectional } from './render-pass-shadow-directional.js';

var visibleSceneAabb = new BoundingBox();
var center = new Vec3();
var shadowCamView = new Mat4();
var aabbPoints = [
		new Vec3(),
		new Vec3(),
		new Vec3(),
		new Vec3(),
		new Vec3(),
		new Vec3(),
		new Vec3(),
		new Vec3()
];
var _depthRange = {
		min: 0,
		max: 0
};
function getDepthRange(cameraViewMatrix, aabbMin, aabbMax) {
		aabbPoints[0].x = aabbPoints[1].x = aabbPoints[2].x = aabbPoints[3].x = aabbMin.x;
		aabbPoints[1].y = aabbPoints[3].y = aabbPoints[7].y = aabbPoints[5].y = aabbMin.y;
		aabbPoints[2].z = aabbPoints[3].z = aabbPoints[6].z = aabbPoints[7].z = aabbMin.z;
		aabbPoints[4].x = aabbPoints[5].x = aabbPoints[6].x = aabbPoints[7].x = aabbMax.x;
		aabbPoints[0].y = aabbPoints[2].y = aabbPoints[4].y = aabbPoints[6].y = aabbMax.y;
		aabbPoints[0].z = aabbPoints[1].z = aabbPoints[4].z = aabbPoints[5].z = aabbMax.z;
		var minz = 9999999999;
		var maxz = -9999999999;
		for(var i = 0; i < 8; ++i){
				cameraViewMatrix.transformPoint(aabbPoints[i], aabbPoints[i]);
				var z = aabbPoints[i].z;
				if (z < minz) minz = z;
				if (z > maxz) maxz = z;
		}
		_depthRange.min = minz;
		_depthRange.max = maxz;
		return _depthRange;
}
class ShadowRendererDirectional {
		cull(light, comp, camera, casters) {
				if (casters === undefined) casters = null;
				light.visibleThisFrame = true;
				if (!light._shadowMap) {
						light._shadowMap = ShadowMap.create(this.device, light);
				}
				var nearDist = camera._nearClip;
				this.generateSplitDistances(light, nearDist, Math.min(camera._farClip, light.shadowDistance));
				var shadowUpdateOverrides = light.shadowUpdateOverrides;
				for(var cascade = 0; cascade < light.numCascades; cascade++){
						if ((shadowUpdateOverrides == null ? undefined : shadowUpdateOverrides[cascade]) === SHADOWUPDATE_NONE) {
								break;
						}
						var lightRenderData = light.getRenderData(camera, cascade);
						var shadowCam = lightRenderData.shadowCamera;
						shadowCam.renderTarget = light._shadowMap.renderTargets[0];
						lightRenderData.shadowViewport.copy(light.cascades[cascade]);
						lightRenderData.shadowScissor.copy(light.cascades[cascade]);
						var shadowCamNode = shadowCam._node;
						var lightNode = light._node;
						shadowCamNode.setPosition(lightNode.getPosition());
						shadowCamNode.setRotation(lightNode.getRotation());
						shadowCamNode.rotateLocal(-90, 0, 0);
						var frustumNearDist = cascade === 0 ? nearDist : light._shadowCascadeDistances[cascade - 1];
						var frustumFarDist = light._shadowCascadeDistances[cascade];
						var frustumPoints = camera.getFrustumCorners(frustumNearDist, frustumFarDist);
						center.set(0, 0, 0);
						var cameraWorldMat = camera.node.getWorldTransform();
						for(var i = 0; i < 8; i++){
								cameraWorldMat.transformPoint(frustumPoints[i], frustumPoints[i]);
								center.add(frustumPoints[i]);
						}
						center.mulScalar(1 / 8);
						var radius = 0;
						for(var i1 = 0; i1 < 8; i1++){
								var dist = frustumPoints[i1].sub(center).length();
								if (dist > radius) {
										radius = dist;
								}
						}
						var right = shadowCamNode.right;
						var up = shadowCamNode.up;
						var lightDir = shadowCamNode.forward;
						var sizeRatio = 0.25 * light._shadowResolution / radius;
						var x = Math.ceil(center.dot(up) * sizeRatio) / sizeRatio;
						var y = Math.ceil(center.dot(right) * sizeRatio) / sizeRatio;
						var scaledUp = up.mulScalar(x);
						var scaledRight = right.mulScalar(y);
						var dot = center.dot(lightDir);
						var scaledDir = lightDir.mulScalar(dot);
						center.add2(scaledUp, scaledRight).add(scaledDir);
						shadowCamNode.setPosition(center);
						shadowCamNode.translateLocal(0, 0, 1000000);
						shadowCam.nearClip = 0.01;
						shadowCam.farClip = 2000000;
						shadowCam.orthoHeight = radius;
						this.renderer.updateCameraFrustum(shadowCam);
						this.shadowRenderer.cullShadowCasters(comp, light, lightRenderData.visibleCasters, shadowCam, casters);
						var emptyAabb = true;
						var visibleCasters = lightRenderData.visibleCasters;
						for(var i2 = 0; i2 < visibleCasters.length; i2++){
								var meshInstance = visibleCasters[i2];
								if (emptyAabb) {
										emptyAabb = false;
										visibleSceneAabb.copy(meshInstance.aabb);
								} else {
										visibleSceneAabb.add(meshInstance.aabb);
								}
						}
						shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
						var depthRange = getDepthRange(shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax());
						shadowCamNode.translateLocal(0, 0, depthRange.max + 0.1);
						shadowCam.farClip = depthRange.max - depthRange.min + 0.2;
						lightRenderData.projectionCompensation = radius;
				}
		}
		generateSplitDistances(light, nearDist, farDist) {
				light._shadowCascadeDistances.fill(farDist);
				for(var i = 1; i < light.numCascades; i++){
						var fraction = i / light.numCascades;
						var linearDist = nearDist + (farDist - nearDist) * fraction;
						var logDist = nearDist * (farDist / nearDist) ** fraction;
						var dist = math.lerp(linearDist, logDist, light.cascadeDistribution);
						light._shadowCascadeDistances[i - 1] = dist;
				}
		}
		getLightRenderPass(light, camera) {
				var renderPass = null;
				if (this.shadowRenderer.needsShadowRendering(light)) {
						var faceCount = light.numShadowFaces;
						var shadowUpdateOverrides = light.shadowUpdateOverrides;
						var allCascadesRendering = true;
						var shadowCamera;
						for(var face = 0; face < faceCount; face++){
								if ((shadowUpdateOverrides == null ? undefined : shadowUpdateOverrides[face]) === SHADOWUPDATE_NONE) {
										allCascadesRendering = false;
								}
								shadowCamera = this.shadowRenderer.prepareFace(light, camera, face);
						}
						renderPass = new RenderPassShadowDirectional(this.device, this.shadowRenderer, light, camera, allCascadesRendering);
						this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, allCascadesRendering);
				}
				return renderPass;
		}
		constructor(renderer, shadowRenderer){
				this.renderer = renderer;
				this.shadowRenderer = shadowRenderer;
				this.device = renderer.device;
		}
}

export { ShadowRendererDirectional };
