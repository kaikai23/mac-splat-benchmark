import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL, FOG_NONE, FOG_LINEAR, LAYERID_DEPTH } from '../constants.js';
import { Renderer } from './renderer.js';
import { LightCamera } from './light-camera.js';
import { RenderPassForward } from './render-pass-forward.js';
import { RenderPassPostprocessing } from './render-pass-postprocessing.js';

var _noLights = [
		[],
		[],
		[]
];
var tmpColor = new Color();
var _drawCallList = {
		drawCalls: [],
		shaderInstances: [],
		isNewMaterial: [],
		lightMaskChanged: [],
		clear: function clear() {
				this.drawCalls.length = 0;
				this.shaderInstances.length = 0;
				this.isNewMaterial.length = 0;
				this.lightMaskChanged.length = 0;
		}
};
function vogelDiskPrecalculationSamples(numSamples) {
		var samples = [];
		for(var i = 0; i < numSamples; ++i){
				var r = Math.sqrt(i + 0.5) / Math.sqrt(numSamples);
				samples.push(r);
		}
		return samples;
}
function vogelSpherePrecalculationSamples(numSamples) {
		var samples = [];
		for(var i = 0; i < numSamples; i++){
				var weight = i / numSamples;
				var radius = Math.sqrt(weight * weight);
				samples.push(radius);
		}
		return samples;
}
class ForwardRenderer extends Renderer {
		destroy() {
				super.destroy();
		}
		dispatchGlobalLights(scene) {
				var ambientUniform = this.ambientColor;
				tmpColor.linear(scene.ambientLight);
				ambientUniform[0] = tmpColor.r;
				ambientUniform[1] = tmpColor.g;
				ambientUniform[2] = tmpColor.b;
				if (scene.physicalUnits) {
						for(var i = 0; i < 3; i++){
								ambientUniform[i] *= scene.ambientLuminance;
						}
				}
				this.ambientId.setValue(ambientUniform);
				this.skyboxIntensityId.setValue(scene.physicalUnits ? scene.skyboxLuminance : scene.skyboxIntensity);
				this.cubeMapRotationMatrixId.setValue(scene._skyboxRotationMat3.data);
		}
		_resolveLight(scope, i) {
				var light = "light" + i;
				this.lightColorId[i] = scope.resolve("" + light + "_color");
				this.lightDir[i] = new Float32Array(3);
				this.lightDirId[i] = scope.resolve("" + light + "_direction");
				this.lightShadowMapId[i] = scope.resolve("" + light + "_shadowMap");
				this.lightShadowMatrixId[i] = scope.resolve("" + light + "_shadowMatrix");
				this.lightShadowParamsId[i] = scope.resolve("" + light + "_shadowParams");
				this.lightShadowIntensity[i] = scope.resolve("" + light + "_shadowIntensity");
				this.lightShadowSearchAreaId[i] = scope.resolve("" + light + "_shadowSearchArea");
				this.lightRadiusId[i] = scope.resolve("" + light + "_radius");
				this.lightPos[i] = new Float32Array(3);
				this.lightPosId[i] = scope.resolve("" + light + "_position");
				this.lightWidth[i] = new Float32Array(3);
				this.lightWidthId[i] = scope.resolve("" + light + "_halfWidth");
				this.lightHeight[i] = new Float32Array(3);
				this.lightHeightId[i] = scope.resolve("" + light + "_halfHeight");
				this.lightInAngleId[i] = scope.resolve("" + light + "_innerConeAngle");
				this.lightOutAngleId[i] = scope.resolve("" + light + "_outerConeAngle");
				this.lightCookieId[i] = scope.resolve("" + light + "_cookie");
				this.lightCookieIntId[i] = scope.resolve("" + light + "_cookieIntensity");
				this.lightCookieMatrixId[i] = scope.resolve("" + light + "_cookieMatrix");
				this.lightCookieOffsetId[i] = scope.resolve("" + light + "_cookieOffset");
				this.lightCameraParamsId[i] = scope.resolve("" + light + "_cameraParams");
				this.lightSoftShadowParamsId[i] = scope.resolve("" + light + "_softShadowParams");
				this.shadowMatrixPaletteId[i] = scope.resolve("" + light + "_shadowMatrixPalette[0]");
				this.shadowCascadeDistancesId[i] = scope.resolve("" + light + "_shadowCascadeDistances");
				this.shadowCascadeCountId[i] = scope.resolve("" + light + "_shadowCascadeCount");
				this.shadowCascadeBlendId[i] = scope.resolve("" + light + "_shadowCascadeBlend");
		}
		setLTCDirectionalLight(wtm, cnt, dir, campos, far) {
				this.lightPos[cnt][0] = campos.x - dir.x * far;
				this.lightPos[cnt][1] = campos.y - dir.y * far;
				this.lightPos[cnt][2] = campos.z - dir.z * far;
				this.lightPosId[cnt].setValue(this.lightPos[cnt]);
				var hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
				this.lightWidth[cnt][0] = hWidth.x * far;
				this.lightWidth[cnt][1] = hWidth.y * far;
				this.lightWidth[cnt][2] = hWidth.z * far;
				this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
				var hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
				this.lightHeight[cnt][0] = hHeight.x * far;
				this.lightHeight[cnt][1] = hHeight.y * far;
				this.lightHeight[cnt][2] = hHeight.z * far;
				this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
		}
		dispatchDirectLights(dirs, mask, camera) {
				var cnt = 0;
				var scope = this.device.scope;
				for(var i = 0; i < dirs.length; i++){
						if (!(dirs[i].mask & mask)) continue;
						var directional = dirs[i];
						var wtm = directional._node.getWorldTransform();
						if (!this.lightColorId[cnt]) {
								this._resolveLight(scope, cnt);
						}
						this.lightColorId[cnt].setValue(directional._colorLinear);
						wtm.getY(directional._direction).mulScalar(-1);
						directional._direction.normalize();
						this.lightDir[cnt][0] = directional._direction.x;
						this.lightDir[cnt][1] = directional._direction.y;
						this.lightDir[cnt][2] = directional._direction.z;
						this.lightDirId[cnt].setValue(this.lightDir[cnt]);
						if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
								this.setLTCDirectionalLight(wtm, cnt, directional._direction, camera._node.getPosition(), camera.farClip);
						}
						if (directional.castShadows) {
								var lightRenderData = directional.getRenderData(camera, 0);
								var biases = directional._getUniformBiasValues(lightRenderData);
								this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
								this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
								this.shadowMatrixPaletteId[cnt].setValue(directional._shadowMatrixPalette);
								this.shadowCascadeDistancesId[cnt].setValue(directional._shadowCascadeDistances);
								this.shadowCascadeCountId[cnt].setValue(directional.numCascades);
								this.shadowCascadeBlendId[cnt].setValue(1 - directional.cascadeBlend);
								this.lightShadowIntensity[cnt].setValue(directional.shadowIntensity);
								this.lightSoftShadowParamsId[cnt].setValue(directional._softShadowParams);
								var shadowRT = lightRenderData.shadowCamera.renderTarget;
								if (shadowRT) {
										this.lightShadowSearchAreaId[cnt].setValue(directional.penumbraSize / lightRenderData.shadowCamera.renderTarget.width * lightRenderData.projectionCompensation);
								}
								var cameraParams = directional._shadowCameraParams;
								cameraParams.length = 4;
								cameraParams[0] = 0;
								cameraParams[1] = lightRenderData.shadowCamera._farClip;
								cameraParams[2] = lightRenderData.shadowCamera._nearClip;
								cameraParams[3] = 1;
								this.lightCameraParamsId[cnt].setValue(cameraParams);
								var params = directional._shadowRenderParams;
								params.length = 4;
								params[0] = directional._shadowResolution;
								params[1] = biases.normalBias;
								params[2] = biases.bias;
								params[3] = 0;
								this.lightShadowParamsId[cnt].setValue(params);
						}
						cnt++;
				}
				return cnt;
		}
		setLTCPositionalLight(wtm, cnt) {
				var hWidth = wtm.transformVector(new Vec3(-0.5, 0, 0));
				this.lightWidth[cnt][0] = hWidth.x;
				this.lightWidth[cnt][1] = hWidth.y;
				this.lightWidth[cnt][2] = hWidth.z;
				this.lightWidthId[cnt].setValue(this.lightWidth[cnt]);
				var hHeight = wtm.transformVector(new Vec3(0, 0, 0.5));
				this.lightHeight[cnt][0] = hHeight.x;
				this.lightHeight[cnt][1] = hHeight.y;
				this.lightHeight[cnt][2] = hHeight.z;
				this.lightHeightId[cnt].setValue(this.lightHeight[cnt]);
		}
		dispatchOmniLight(scope, omni, cnt) {
				var wtm = omni._node.getWorldTransform();
				if (!this.lightColorId[cnt]) {
						this._resolveLight(scope, cnt);
				}
				this.lightRadiusId[cnt].setValue(omni.attenuationEnd);
				this.lightColorId[cnt].setValue(omni._colorLinear);
				wtm.getTranslation(omni._position);
				this.lightPos[cnt][0] = omni._position.x;
				this.lightPos[cnt][1] = omni._position.y;
				this.lightPos[cnt][2] = omni._position.z;
				this.lightPosId[cnt].setValue(this.lightPos[cnt]);
				if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
						this.setLTCPositionalLight(wtm, cnt);
				}
				if (omni.castShadows) {
						var lightRenderData = omni.getRenderData(null, 0);
						this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
						var biases = omni._getUniformBiasValues(lightRenderData);
						var params = omni._shadowRenderParams;
						params.length = 4;
						params[0] = omni._shadowResolution;
						params[1] = biases.normalBias;
						params[2] = biases.bias;
						params[3] = 1.0 / omni.attenuationEnd;
						this.lightShadowParamsId[cnt].setValue(params);
						this.lightShadowIntensity[cnt].setValue(omni.shadowIntensity);
						var pixelsPerMeter = omni.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
						this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter);
						var cameraParams = omni._shadowCameraParams;
						cameraParams.length = 4;
						cameraParams[0] = 0;
						cameraParams[1] = lightRenderData.shadowCamera._farClip;
						cameraParams[2] = lightRenderData.shadowCamera._nearClip;
						cameraParams[3] = 0;
						this.lightCameraParamsId[cnt].setValue(cameraParams);
				}
				if (omni._cookie) {
						this.lightCookieId[cnt].setValue(omni._cookie);
						this.lightShadowMatrixId[cnt].setValue(wtm.data);
						this.lightCookieIntId[cnt].setValue(omni.cookieIntensity);
				}
		}
		dispatchSpotLight(scope, spot, cnt) {
				var wtm = spot._node.getWorldTransform();
				if (!this.lightColorId[cnt]) {
						this._resolveLight(scope, cnt);
				}
				this.lightInAngleId[cnt].setValue(spot._innerConeAngleCos);
				this.lightOutAngleId[cnt].setValue(spot._outerConeAngleCos);
				this.lightRadiusId[cnt].setValue(spot.attenuationEnd);
				this.lightColorId[cnt].setValue(spot._colorLinear);
				wtm.getTranslation(spot._position);
				this.lightPos[cnt][0] = spot._position.x;
				this.lightPos[cnt][1] = spot._position.y;
				this.lightPos[cnt][2] = spot._position.z;
				this.lightPosId[cnt].setValue(this.lightPos[cnt]);
				if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
						this.setLTCPositionalLight(wtm, cnt);
				}
				wtm.getY(spot._direction).mulScalar(-1);
				spot._direction.normalize();
				this.lightDir[cnt][0] = spot._direction.x;
				this.lightDir[cnt][1] = spot._direction.y;
				this.lightDir[cnt][2] = spot._direction.z;
				this.lightDirId[cnt].setValue(this.lightDir[cnt]);
				if (spot.castShadows) {
						var lightRenderData = spot.getRenderData(null, 0);
						this.lightShadowMapId[cnt].setValue(lightRenderData.shadowBuffer);
						this.lightShadowMatrixId[cnt].setValue(lightRenderData.shadowMatrix.data);
						var biases = spot._getUniformBiasValues(lightRenderData);
						var params = spot._shadowRenderParams;
						params.length = 4;
						params[0] = spot._shadowResolution;
						params[1] = biases.normalBias;
						params[2] = biases.bias;
						params[3] = 1.0 / spot.attenuationEnd;
						this.lightShadowParamsId[cnt].setValue(params);
						this.lightShadowIntensity[cnt].setValue(spot.shadowIntensity);
						var pixelsPerMeter = spot.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
						var fov = lightRenderData.shadowCamera._fov * Math.PI / 180.0;
						var fovRatio = 1.0 / Math.tan(fov / 2.0);
						this.lightShadowSearchAreaId[cnt].setValue(pixelsPerMeter * fovRatio);
						var cameraParams = spot._shadowCameraParams;
						cameraParams.length = 4;
						cameraParams[0] = 0;
						cameraParams[1] = lightRenderData.shadowCamera._farClip;
						cameraParams[2] = lightRenderData.shadowCamera._nearClip;
						cameraParams[3] = 0;
						this.lightCameraParamsId[cnt].setValue(cameraParams);
				}
				if (spot._cookie) {
						if (!spot.castShadows) {
								var cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
								this.lightShadowMatrixId[cnt].setValue(cookieMatrix.data);
						}
						this.lightCookieId[cnt].setValue(spot._cookie);
						this.lightCookieIntId[cnt].setValue(spot.cookieIntensity);
						if (spot._cookieTransform) {
								spot._cookieTransformUniform[0] = spot._cookieTransform.x;
								spot._cookieTransformUniform[1] = spot._cookieTransform.y;
								spot._cookieTransformUniform[2] = spot._cookieTransform.z;
								spot._cookieTransformUniform[3] = spot._cookieTransform.w;
								this.lightCookieMatrixId[cnt].setValue(spot._cookieTransformUniform);
								spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
								spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
								this.lightCookieOffsetId[cnt].setValue(spot._cookieOffsetUniform);
						}
				}
		}
		dispatchLocalLights(sortedLights, mask, usedDirLights) {
				var cnt = usedDirLights;
				var scope = this.device.scope;
				var omnis = sortedLights[LIGHTTYPE_OMNI];
				var numOmnis = omnis.length;
				for(var i = 0; i < numOmnis; i++){
						var omni = omnis[i];
						if (!(omni.mask & mask)) continue;
						this.dispatchOmniLight(scope, omni, cnt);
						cnt++;
				}
				var spts = sortedLights[LIGHTTYPE_SPOT];
				var numSpts = spts.length;
				for(var i1 = 0; i1 < numSpts; i1++){
						var spot = spts[i1];
						if (!(spot.mask & mask)) continue;
						this.dispatchSpotLight(scope, spot, cnt);
						cnt++;
				}
		}
		renderForwardPrepareMaterials(camera, renderTarget, drawCalls, sortedLights, layer, pass) {
				var _camera_fog;
				var fogParams = (_camera_fog = camera.fog) != null ? _camera_fog : this.scene.fog;
				var shaderParams = camera.shaderParams;
				shaderParams.fog = fogParams.type;
				var _renderTarget_isColorBufferSrgb;
				shaderParams.srgbRenderTarget = (_renderTarget_isColorBufferSrgb = renderTarget == null ? undefined : renderTarget.isColorBufferSrgb(0)) != null ? _renderTarget_isColorBufferSrgb : false;
				var addCall = (drawCall, shaderInstance, isNewMaterial, lightMaskChanged)=>{
						_drawCallList.drawCalls.push(drawCall);
						_drawCallList.shaderInstances.push(shaderInstance);
						_drawCallList.isNewMaterial.push(isNewMaterial);
						_drawCallList.lightMaskChanged.push(lightMaskChanged);
				};
				_drawCallList.clear();
				var device = this.device;
				var scene = this.scene;
				var clusteredLightingEnabled = scene.clusteredLightingEnabled;
				var _layer_getLightHash;
				var lightHash = (_layer_getLightHash = layer == null ? undefined : layer.getLightHash(clusteredLightingEnabled)) != null ? _layer_getLightHash : 0;
				var prevMaterial = null, prevObjDefs, prevLightMask;
				var drawCallsCount = drawCalls.length;
				for(var i = 0; i < drawCallsCount; i++){
						var drawCall = drawCalls[i];
						drawCall.ensureMaterial(device);
						var material = drawCall.material;
						var objDefs = drawCall._shaderDefs;
						var lightMask = drawCall.mask;
						if (material && material === prevMaterial && objDefs !== prevObjDefs) {
								prevMaterial = null;
						}
						if (material !== prevMaterial) {
								this._materialSwitches++;
								material._scene = scene;
								if (material.dirty) {
										material.updateUniforms(device, scene);
										material.dirty = false;
								}
						}
						var shaderInstance = drawCall.getShaderInstance(pass, lightHash, scene, shaderParams, this.viewUniformFormat, this.viewBindGroupFormat, sortedLights);
						addCall(drawCall, shaderInstance, material !== prevMaterial, !prevMaterial || lightMask !== prevLightMask);
						prevMaterial = material;
						prevObjDefs = objDefs;
						prevLightMask = lightMask;
				}
				return _drawCallList;
		}
		renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces) {
				var device = this.device;
				var scene = this.scene;
				var passFlag = 1 << pass;
				var flipFactor = flipFaces ? -1 : 1;
				var clusteredLightingEnabled = scene.clusteredLightingEnabled;
				var preparedCallsCount = preparedCalls.drawCalls.length;
				for(var i = 0; i < preparedCallsCount; i++){
						var drawCall = preparedCalls.drawCalls[i];
						var newMaterial = preparedCalls.isNewMaterial[i];
						var lightMaskChanged = preparedCalls.lightMaskChanged[i];
						var shaderInstance = preparedCalls.shaderInstances[i];
						var material = drawCall.material;
						var lightMask = drawCall.mask;
						if (newMaterial) {
								var asyncCompile = false;
								device.setShader(shaderInstance.shader, asyncCompile);
								material.setParameters(device);
								if (lightMaskChanged) {
										var usedDirLights = this.dispatchDirectLights(sortedLights[LIGHTTYPE_DIRECTIONAL], lightMask, camera);
										if (!clusteredLightingEnabled) {
												this.dispatchLocalLights(sortedLights, lightMask, usedDirLights);
										}
								}
								this.alphaTestId.setValue(material.alphaTest);
								device.setBlendState(material.blendState);
								device.setDepthState(material.depthState);
								device.setAlphaToCoverage(material.alphaToCoverage);
						}
						this.setupCullMode(camera._cullFaces, flipFactor, drawCall);
						var _drawCall_stencilFront;
						var stencilFront = (_drawCall_stencilFront = drawCall.stencilFront) != null ? _drawCall_stencilFront : material.stencilFront;
						var _drawCall_stencilBack;
						var stencilBack = (_drawCall_stencilBack = drawCall.stencilBack) != null ? _drawCall_stencilBack : material.stencilBack;
						device.setStencilState(stencilFront, stencilBack);
						drawCall.setParameters(device, passFlag);
						device.scope.resolve('meshInstanceId').setValue(drawCall.id);
						var mesh = drawCall.mesh;
						this.setVertexBuffers(device, mesh);
						this.setMorphing(device, drawCall.morphInstance);
						this.setSkinning(device, drawCall);
						this.setupMeshUniformBuffers(shaderInstance, drawCall);
						var style = drawCall.renderStyle;
						device.setIndexBuffer(mesh.indexBuffer[style]);
						drawCallback == null ? undefined : drawCallback(drawCall, i);
						if (camera.xr && camera.xr.session && camera.xr.views.list.length) {
								var views = camera.xr.views;
								for(var v = 0; v < views.list.length; v++){
										var view = views.list[v];
										device.setViewport(view.viewport.x, view.viewport.y, view.viewport.z, view.viewport.w);
										this.projId.setValue(view.projMat.data);
										this.projSkyboxId.setValue(view.projMat.data);
										this.viewId.setValue(view.viewOffMat.data);
										this.viewInvId.setValue(view.viewInvOffMat.data);
										this.viewId3.setValue(view.viewMat3.data);
										this.viewProjId.setValue(view.projViewOffMat.data);
										this.viewPosId.setValue(view.positionData);
										this.viewIndexId.setValue(v);
										if (v === 0) {
												this.drawInstance(device, drawCall, mesh, style, true);
										} else {
												this.drawInstance2(device, drawCall, mesh, style);
										}
										this._forwardDrawCalls++;
								}
						} else {
								this.drawInstance(device, drawCall, mesh, style, true);
								this._forwardDrawCalls++;
						}
						if (i < preparedCallsCount - 1 && !preparedCalls.isNewMaterial[i + 1]) {
								material.setParameters(device, drawCall.parameters);
						}
				}
		}
		renderForward(camera, renderTarget, allDrawCalls, sortedLights, pass, drawCallback, layer, flipFaces) {
				var preparedCalls = this.renderForwardPrepareMaterials(camera, renderTarget, allDrawCalls, sortedLights, layer, pass);
				this.renderForwardInternal(camera, preparedCalls, sortedLights, pass, drawCallback, flipFaces);
				_drawCallList.clear();
		}
		renderForwardLayer(camera, renderTarget, layer, transparent, shaderPass, viewBindGroups, options) {
				if (options === undefined) options = {};
				var { scene, device } = this;
				var clusteredLightingEnabled = scene.clusteredLightingEnabled;
				this.setupViewport(camera, renderTarget);
				var visible, splitLights;
				if (layer) {
						layer.sortVisible(camera, transparent);
						var culledInstances = layer.getCulledInstances(camera);
						visible = transparent ? culledInstances.transparent : culledInstances.opaque;
						scene.immediate.onPreRenderLayer(layer, visible, transparent);
						if (layer.requiresLightCube) {
								this.lightCube.update(scene.ambientLight, layer._lights);
								this.constantLightCube.setValue(this.lightCube.colors);
						}
						splitLights = layer.splitLights;
				} else {
						visible = options.meshInstances;
						var _options_splitLights;
						splitLights = (_options_splitLights = options.splitLights) != null ? _options_splitLights : _noLights;
				}
				if (clusteredLightingEnabled) {
						var _options_lightClusters;
						var lightClusters = (_options_lightClusters = options.lightClusters) != null ? _options_lightClusters : this.worldClustersAllocator.empty;
						lightClusters.activate();
						if (layer) {
								if (!this.clustersDebugRendered && scene.lighting.debugLayer === layer.id) {
										this.clustersDebugRendered = true;
								}
						}
				}
				scene._activeCamera = camera;
				var _camera_fog;
				var fogParams = (_camera_fog = camera.fog) != null ? _camera_fog : this.scene.fog;
				this.setFogConstants(fogParams);
				var viewCount = this.setCameraUniforms(camera, renderTarget);
				if (device.supportsUniformBuffers) {
						this.setupViewUniformBuffers(viewBindGroups, this.viewUniformFormat, this.viewBindGroupFormat, viewCount);
				}
				var _options_clearColor;
				var clearColor = (_options_clearColor = options.clearColor) != null ? _options_clearColor : false;
				var _options_clearDepth;
				var clearDepth = (_options_clearDepth = options.clearDepth) != null ? _options_clearDepth : false;
				var _options_clearStencil;
				var clearStencil = (_options_clearStencil = options.clearStencil) != null ? _options_clearStencil : false;
				if (clearColor || clearDepth || clearStencil) {
						this.clear(camera, clearColor, clearDepth, clearStencil);
				}
				var flipFaces = !!(camera._flipFaces ^ (renderTarget == null ? undefined : renderTarget.flipY));
				var forwardDrawCalls = this._forwardDrawCalls;
				this.renderForward(camera, renderTarget, visible, splitLights, shaderPass, null, layer, flipFaces);
				if (layer) {
						layer._forwardDrawCalls += this._forwardDrawCalls - forwardDrawCalls;
				}
		}
		setFogConstants(fogParams) {
				if (fogParams.type !== FOG_NONE) {
						tmpColor.linear(fogParams.color);
						var fogUniform = this.fogColor;
						fogUniform[0] = tmpColor.r;
						fogUniform[1] = tmpColor.g;
						fogUniform[2] = tmpColor.b;
						this.fogColorId.setValue(fogUniform);
						if (fogParams.type === FOG_LINEAR) {
								this.fogStartId.setValue(fogParams.start);
								this.fogEndId.setValue(fogParams.end);
						} else {
								this.fogDensityId.setValue(fogParams.density);
						}
				}
		}
		setSceneConstants() {
				var scene = this.scene;
				this.dispatchGlobalLights(scene);
				var device = this.device;
				this._screenSize[0] = device.width;
				this._screenSize[1] = device.height;
				this._screenSize[2] = 1 / device.width;
				this._screenSize[3] = 1 / device.height;
				this.screenSizeId.setValue(this._screenSize);
				this.pcssDiskSamplesId.setValue(this.pcssDiskSamples);
				this.pcssSphereSamplesId.setValue(this.pcssSphereSamples);
		}
		buildFrameGraph(frameGraph, layerComposition) {
				var scene = this.scene;
				frameGraph.reset();
				if (scene.clusteredLightingEnabled) {
						var { shadowsEnabled, cookiesEnabled } = scene.lighting;
						this._renderPassUpdateClustered.update(frameGraph, shadowsEnabled, cookiesEnabled, this.lights, this.localLights);
						frameGraph.addRenderPass(this._renderPassUpdateClustered);
				} else {
						this._shadowRendererLocal.buildNonClusteredRenderPasses(frameGraph, this.localLights);
				}
				var startIndex = 0;
				var newStart = true;
				var renderTarget = null;
				var renderActions = layerComposition._renderActions;
				for(var i = startIndex; i < renderActions.length; i++){
						var renderAction = renderActions[i];
						var { layer, camera } = renderAction;
						if (renderAction.useCameraPasses) {
								camera.camera.renderPasses.forEach((renderPass)=>{
										frameGraph.addRenderPass(renderPass);
								});
						} else {
								var isDepthLayer = layer.id === LAYERID_DEPTH;
								var isGrabPass = isDepthLayer && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
								if (newStart) {
										newStart = false;
										startIndex = i;
										renderTarget = renderAction.renderTarget;
								}
								var nextRenderAction = renderActions[i + 1];
								var isNextLayerDepth = nextRenderAction ? !nextRenderAction.useCameraPasses && nextRenderAction.layer.id === LAYERID_DEPTH : false;
								var isNextLayerGrabPass = isNextLayerDepth && (camera.renderSceneColorMap || camera.renderSceneDepthMap);
								var nextNeedDirShadows = nextRenderAction ? nextRenderAction.firstCameraUse && this.cameraDirShadowLights.has(nextRenderAction.camera.camera) : false;
								if (!nextRenderAction || nextRenderAction.renderTarget !== renderTarget || nextNeedDirShadows || isNextLayerGrabPass || isGrabPass) {
										var isDepthOnly = isDepthLayer && startIndex === i;
										if (!isDepthOnly) {
												this.addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, i);
										}
										if (isDepthLayer) {
												if (camera.renderSceneColorMap) {
														var colorGrabPass = camera.camera.renderPassColorGrab;
														colorGrabPass.source = camera.renderTarget;
														frameGraph.addRenderPass(colorGrabPass);
												}
												if (camera.renderSceneDepthMap) {
														frameGraph.addRenderPass(camera.camera.renderPassDepthGrab);
												}
										}
										if (renderAction.triggerPostprocess && (camera == null ? undefined : camera.onPostprocessing)) {
												var renderPass = new RenderPassPostprocessing(this.device, this, renderAction);
												frameGraph.addRenderPass(renderPass);
										}
										newStart = true;
								}
						}
				}
		}
		addMainRenderPass(frameGraph, layerComposition, renderTarget, startIndex, endIndex) {
				var renderPass = new RenderPassForward(this.device, layerComposition, this.scene, this);
				renderPass.init(renderTarget);
				var renderActions = layerComposition._renderActions;
				for(var i = startIndex; i <= endIndex; i++){
						renderPass.addRenderAction(renderActions[i]);
				}
				frameGraph.addRenderPass(renderPass);
		}
		update(comp) {
				this.frameUpdate();
				this.shadowRenderer.frameUpdate();
				this.scene._updateSkyMesh();
				this.updateLayerComposition(comp);
				this.collectLights(comp);
				this.beginFrame(comp);
				this.setSceneConstants();
				this.cullComposition(comp);
				this.gpuUpdate(this.processingMeshInstances);
		}
		constructor(graphicsDevice){
				super(graphicsDevice);
				var device = this.device;
				this._forwardDrawCalls = 0;
				this._materialSwitches = 0;
				this._depthMapTime = 0;
				this._forwardTime = 0;
				this._sortTime = 0;
				var scope = device.scope;
				this.fogColorId = scope.resolve('fog_color');
				this.fogStartId = scope.resolve('fog_start');
				this.fogEndId = scope.resolve('fog_end');
				this.fogDensityId = scope.resolve('fog_density');
				this.ambientId = scope.resolve('light_globalAmbient');
				this.skyboxIntensityId = scope.resolve('skyboxIntensity');
				this.cubeMapRotationMatrixId = scope.resolve('cubeMapRotationMatrix');
				this.pcssDiskSamplesId = scope.resolve('pcssDiskSamples[0]');
				this.pcssSphereSamplesId = scope.resolve('pcssSphereSamples[0]');
				this.lightColorId = [];
				this.lightDir = [];
				this.lightDirId = [];
				this.lightShadowMapId = [];
				this.lightShadowMatrixId = [];
				this.lightShadowParamsId = [];
				this.lightShadowIntensity = [];
				this.lightRadiusId = [];
				this.lightPos = [];
				this.lightPosId = [];
				this.lightWidth = [];
				this.lightWidthId = [];
				this.lightHeight = [];
				this.lightHeightId = [];
				this.lightInAngleId = [];
				this.lightOutAngleId = [];
				this.lightCookieId = [];
				this.lightCookieIntId = [];
				this.lightCookieMatrixId = [];
				this.lightCookieOffsetId = [];
				this.lightShadowSearchAreaId = [];
				this.lightCameraParamsId = [];
				this.lightSoftShadowParamsId = [];
				this.shadowMatrixPaletteId = [];
				this.shadowCascadeDistancesId = [];
				this.shadowCascadeCountId = [];
				this.shadowCascadeBlendId = [];
				this.screenSizeId = scope.resolve('uScreenSize');
				this._screenSize = new Float32Array(4);
				this.fogColor = new Float32Array(3);
				this.ambientColor = new Float32Array(3);
				this.pcssDiskSamples = vogelDiskPrecalculationSamples(16);
				this.pcssSphereSamples = vogelSpherePrecalculationSamples(16);
		}
}

export { ForwardRenderer };
