import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { UNIFORMTYPE_MAT4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { shadowTypeInfo, LIGHTTYPE_OMNI, LIGHTTYPE_DIRECTIONAL, SORTKEY_DEPTH, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, BLUR_GAUSSIAN, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindGroupFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

var tempSet = new Set();
var shadowCamView = new Mat4();
var shadowCamViewProj = new Mat4();
var pixelOffset = new Float32Array(2);
var blurScissorRect = new Vec4(1, 1, 0, 0);
var viewportMatrix = new Mat4();
function gauss(x, sigma) {
		return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}
function gaussWeights(kernelSize) {
		var sigma = (kernelSize - 1) / (2 * 3);
		var halfWidth = (kernelSize - 1) * 0.5;
		var values = new Array(kernelSize);
		var sum = 0.0;
		for(var i = 0; i < kernelSize; ++i){
				values[i] = gauss(i - halfWidth, sigma);
				sum += values[i];
		}
		for(var i1 = 0; i1 < kernelSize; ++i1){
				values[i1] /= sum;
		}
		return values;
}
class ShadowRenderer {
		static createShadowCamera(shadowType, type, face) {
				var shadowCam = LightCamera.create('ShadowCamera', type, face);
				var shadowInfo = shadowTypeInfo.get(shadowType);
				var _shadowInfo_vsm;
				var isVsm = (_shadowInfo_vsm = shadowInfo == null ? undefined : shadowInfo.vsm) != null ? _shadowInfo_vsm : false;
				var _shadowInfo_pcf;
				var isPcf = (_shadowInfo_pcf = shadowInfo == null ? undefined : shadowInfo.pcf) != null ? _shadowInfo_pcf : false;
				if (isVsm) {
						shadowCam.clearColor = new Color(0, 0, 0, 0);
				} else {
						shadowCam.clearColor = new Color(1, 1, 1, 1);
				}
				shadowCam.clearDepthBuffer = true;
				shadowCam.clearStencilBuffer = false;
				shadowCam.clearColorBuffer = !isPcf;
				return shadowCam;
		}
		_cullShadowCastersInternal(meshInstances, visible, camera) {
				var numInstances = meshInstances.length;
				for(var i = 0; i < numInstances; i++){
						var meshInstance = meshInstances[i];
						if (meshInstance.castShadow) {
								if (!meshInstance.cull || meshInstance._isVisible(camera)) {
										meshInstance.visibleThisFrame = true;
										visible.push(meshInstance);
								}
						}
				}
		}
		cullShadowCasters(comp, light, visible, camera, casters) {
				visible.length = 0;
				if (casters) {
						this._cullShadowCastersInternal(casters, visible, camera);
				} else {
						var layers = comp.layerList;
						var len = layers.length;
						for(var i = 0; i < len; i++){
								var layer = layers[i];
								if (layer._lightsSet.has(light)) {
										if (!tempSet.has(layer)) {
												tempSet.add(layer);
												this._cullShadowCastersInternal(layer.shadowCasters, visible, camera);
										}
								}
						}
						tempSet.clear();
				}
				visible.sort(this.renderer.sortCompareDepth);
		}
		setupRenderState(device, light) {
				var isClustered = this.renderer.scene.clusteredLightingEnabled;
				var useShadowSampler = isClustered ? light._isPcf : light._isPcf && light._type !== LIGHTTYPE_OMNI;
				device.setBlendState(useShadowSampler ? this.blendStateNoWrite : this.blendStateWrite);
				device.setDepthState(light.shadowDepthState);
				device.setStencilState(null, null);
		}
		dispatchUniforms(light, shadowCam, lightRenderData, face) {
				var shadowCamNode = shadowCam._node;
				if (light._type !== LIGHTTYPE_DIRECTIONAL) {
						this.renderer.dispatchViewPos(shadowCamNode.getPosition());
						this.shadowMapLightRadiusId.setValue(light.attenuationEnd);
				}
				shadowCamView.setTRS(shadowCamNode.getPosition(), shadowCamNode.getRotation(), Vec3.ONE).invert();
				shadowCamViewProj.mul2(shadowCam.projectionMatrix, shadowCamView);
				var rectViewport = lightRenderData.shadowViewport;
				shadowCam.rect = rectViewport;
				shadowCam.scissorRect = lightRenderData.shadowScissor;
				viewportMatrix.setViewport(rectViewport.x, rectViewport.y, rectViewport.z, rectViewport.w);
				lightRenderData.shadowMatrix.mul2(viewportMatrix, shadowCamViewProj);
				if (light._type === LIGHTTYPE_DIRECTIONAL) {
						light._shadowMatrixPalette.set(lightRenderData.shadowMatrix.data, face * 16);
				}
		}
		getShadowPass(light) {
				var _this_shadowPassCache_lightType;
				var lightType = light._type;
				var shadowType = light._shadowType;
				var shadowPassInfo = (_this_shadowPassCache_lightType = this.shadowPassCache[lightType]) == null ? undefined : _this_shadowPassCache_lightType[shadowType];
				if (!shadowPassInfo) {
						var shadowPassName = "ShadowPass_" + lightType + "_" + shadowType;
						shadowPassInfo = ShaderPass.get(this.device).allocate(shadowPassName, {
								isShadow: true,
								lightType: lightType,
								shadowType: shadowType
						});
						if (!this.shadowPassCache[lightType]) {
								this.shadowPassCache[lightType] = [];
						}
						this.shadowPassCache[lightType][shadowType] = shadowPassInfo;
				}
				return shadowPassInfo.index;
		}
		submitCasters(visibleCasters, light, camera) {
				var device = this.device;
				var renderer = this.renderer;
				var scene = renderer.scene;
				var passFlags = 1 << SHADER_SHADOW;
				var shadowPass = this.getShadowPass(light);
				var cameraShaderParams = camera.shaderParams;
				var count = visibleCasters.length;
				for(var i = 0; i < count; i++){
						var meshInstance = visibleCasters[i];
						var mesh = meshInstance.mesh;
						meshInstance.ensureMaterial(device);
						var material = meshInstance.material;
						renderer.setBaseConstants(device, material);
						renderer.setSkinning(device, meshInstance);
						if (material.dirty) {
								material.updateUniforms(device, scene);
								material.dirty = false;
						}
						renderer.setupCullMode(true, 1, meshInstance);
						material.setParameters(device);
						meshInstance.setParameters(device, passFlags);
						var shaderInstance = meshInstance.getShaderInstance(shadowPass, 0, scene, cameraShaderParams, this.viewUniformFormat, this.viewBindGroupFormat);
						var shadowShader = shaderInstance.shader;
						meshInstance._key[SORTKEY_DEPTH] = shadowShader.id;
						device.setShader(shadowShader);
						renderer.setVertexBuffers(device, mesh);
						renderer.setMorphing(device, meshInstance.morphInstance);
						this.renderer.setupMeshUniformBuffers(shaderInstance, meshInstance);
						var style = meshInstance.renderStyle;
						device.setIndexBuffer(mesh.indexBuffer[style]);
						renderer.drawInstance(device, meshInstance, mesh, style);
						renderer._shadowDrawCalls++;
				}
		}
		needsShadowRendering(light) {
				var needs = light.enabled && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE && light.visibleThisFrame;
				if (light.shadowUpdateMode === SHADOWUPDATE_THISFRAME) {
						light.shadowUpdateMode = SHADOWUPDATE_NONE;
				}
				if (needs) {
						this.renderer._shadowMapUpdates += light.numShadowFaces;
				}
				return needs;
		}
		getLightRenderData(light, camera, face) {
				return light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, face);
		}
		setupRenderPass(renderPass, shadowCamera, clearRenderTarget) {
				var rt = shadowCamera.renderTarget;
				renderPass.init(rt);
				renderPass.depthStencilOps.clearDepthValue = 1;
				renderPass.depthStencilOps.clearDepth = clearRenderTarget;
				if (rt.depthBuffer) {
						renderPass.depthStencilOps.storeDepth = true;
				} else {
						renderPass.colorOps.clearValue.copy(shadowCamera.clearColor);
						renderPass.colorOps.clear = clearRenderTarget;
						renderPass.depthStencilOps.storeDepth = false;
				}
				renderPass.requiresCubemaps = false;
		}
		prepareFace(light, camera, face) {
				var type = light._type;
				var lightRenderData = this.getLightRenderData(light, camera, face);
				var shadowCam = lightRenderData.shadowCamera;
				var renderTargetIndex = type === LIGHTTYPE_DIRECTIONAL ? 0 : face;
				shadowCam.renderTarget = light._shadowMap.renderTargets[renderTargetIndex];
				return shadowCam;
		}
		renderFace(light, camera, face, clear, insideRenderPass) {
				if (insideRenderPass === undefined) insideRenderPass = true;
				var device = this.device;
				var lightRenderData = this.getLightRenderData(light, camera, face);
				var shadowCam = lightRenderData.shadowCamera;
				this.dispatchUniforms(light, shadowCam, lightRenderData, face);
				var rt = shadowCam.renderTarget;
				var renderer = this.renderer;
				renderer.setCameraUniforms(shadowCam, rt);
				if (device.supportsUniformBuffers) {
						renderer.setupViewUniformBuffers(lightRenderData.viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, 1);
				}
				if (insideRenderPass) {
						renderer.setupViewport(shadowCam, rt);
						if (clear) {
								renderer.clear(shadowCam);
						}
				} else {
						renderer.clearView(shadowCam, rt, true, false);
				}
				this.setupRenderState(device, light);
				this.submitCasters(lightRenderData.visibleCasters, light, shadowCam);
		}
		render(light, camera, insideRenderPass) {
				if (insideRenderPass === undefined) insideRenderPass = true;
				if (this.needsShadowRendering(light)) {
						var faceCount = light.numShadowFaces;
						for(var face = 0; face < faceCount; face++){
								this.prepareFace(light, camera, face);
								this.renderFace(light, camera, face, true, insideRenderPass);
						}
						this.renderVsm(light, camera);
				}
		}
		renderVsm(light, camera) {
				if (light._isVsm && light._vsmBlurSize > 1) {
						var isClustered = this.renderer.scene.clusteredLightingEnabled;
						if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
								this.applyVsmBlur(light, camera);
						}
				}
		}
		getVsmBlurShader(blurMode, filterSize) {
				var cache = this.blurVsmShader;
				var blurShader = cache[blurMode][filterSize];
				if (!blurShader) {
						this.blurVsmWeights[filterSize] = gaussWeights(filterSize);
						var blurVS = shaderChunks.fullscreenQuadVS;
						var blurFS = "#define SAMPLES " + filterSize + "\n";
						blurFS += this.blurVsmShaderCode[blurMode];
						var blurShaderName = "blurVsm" + blurMode + filterSize;
						blurShader = createShaderFromCode(this.device, blurVS, blurFS, blurShaderName);
						cache[blurMode][filterSize] = blurShader;
				}
				return blurShader;
		}
		applyVsmBlur(light, camera) {
				var device = this.device;
				device.setBlendState(BlendState.NOBLEND);
				var lightRenderData = light.getRenderData(light._type === LIGHTTYPE_DIRECTIONAL ? camera : null, 0);
				var shadowCam = lightRenderData.shadowCamera;
				var origShadowMap = shadowCam.renderTarget;
				var tempShadowMap = this.renderer.shadowMapCache.get(device, light);
				var tempRt = tempShadowMap.renderTargets[0];
				var blurMode = light.vsmBlurMode;
				var filterSize = light._vsmBlurSize;
				var blurShader = this.getVsmBlurShader(blurMode, filterSize);
				blurScissorRect.z = light._shadowResolution - 2;
				blurScissorRect.w = blurScissorRect.z;
				this.sourceId.setValue(origShadowMap.colorBuffer);
				pixelOffset[0] = 1 / light._shadowResolution;
				pixelOffset[1] = 0;
				this.pixelOffsetId.setValue(pixelOffset);
				if (blurMode === BLUR_GAUSSIAN) this.weightId.setValue(this.blurVsmWeights[filterSize]);
				drawQuadWithShader(device, tempRt, blurShader, null, blurScissorRect);
				this.sourceId.setValue(tempRt.colorBuffer);
				pixelOffset[1] = pixelOffset[0];
				pixelOffset[0] = 0;
				this.pixelOffsetId.setValue(pixelOffset);
				drawQuadWithShader(device, origShadowMap, blurShader, null, blurScissorRect);
				this.renderer.shadowMapCache.add(light, tempShadowMap);
		}
		initViewBindGroupFormat() {
				if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
						this.viewUniformFormat = new UniformBufferFormat(this.device, [
								new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4)
						]);
						this.viewBindGroupFormat = new BindGroupFormat(this.device, [
								new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
						]);
				}
		}
		frameUpdate() {
				this.initViewBindGroupFormat();
		}
		constructor(renderer, lightTextureAtlas){
				this.shadowPassCache = [];
				this.device = renderer.device;
				this.renderer = renderer;
				this.lightTextureAtlas = lightTextureAtlas;
				var scope = this.device.scope;
				this.sourceId = scope.resolve('source');
				this.pixelOffsetId = scope.resolve('pixelOffset');
				this.weightId = scope.resolve('weight[0]');
				this.blurVsmShaderCode = [
						shaderChunks.blurVSMPS,
						"#define GAUSS\n" + shaderChunks.blurVSMPS
				];
				this.blurVsmShader = [
						{},
						{}
				];
				this.blurVsmWeights = {};
				this.shadowMapLightRadiusId = scope.resolve('light_radius');
				this.viewUniformFormat = null;
				this.viewBindGroupFormat = null;
				this.blendStateWrite = new BlendState();
				this.blendStateNoWrite = new BlendState();
				this.blendStateNoWrite.setColorWrite(false, false, false, false);
		}
}

export { ShadowRenderer };
