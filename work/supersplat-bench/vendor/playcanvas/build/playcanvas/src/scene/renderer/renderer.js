import { BlueNoise } from '../../core/math/blue-noise.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_FRONT, CULLFACE_BACK, CULLFACE_NONE, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT3, UNIFORMTYPE_VEC3, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_INT, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, BINDGROUP_VIEW, BINDGROUP_MESH, BINDGROUP_MESH_UB } from '../../platform/graphics/constants.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { BindGroup, DynamicBindGroup } from '../../platform/graphics/bind-group.js';
import { UniformFormat, UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { BindUniformBufferFormat, BindTextureFormat, BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
import { SORTKEY_FORWARD, SORTKEY_DEPTH, VIEW_CENTER, PROJECTION_ORTHOGRAPHIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, EVENT_PRECULL, EVENT_POSTCULL } from '../constants.js';
import { LightCube } from '../graphics/light-cube.js';
import { getBlueNoiseTexture } from '../graphics/noise-textures.js';
import { LightTextureAtlas } from '../lighting/light-texture-atlas.js';
import { Material } from '../materials/material.js';
import { ShadowMapCache } from './shadow-map-cache.js';
import { ShadowRendererLocal } from './shadow-renderer-local.js';
import { ShadowRendererDirectional } from './shadow-renderer-directional.js';
import { ShadowRenderer } from './shadow-renderer.js';
import { WorldClustersAllocator } from './world-clusters-allocator.js';
import { RenderPassUpdateClustered } from './render-pass-update-clustered.js';

var _skinUpdateIndex = 0;
var viewProjMat = new Mat4();
var viewInvMat = new Mat4();
var viewMat = new Mat4();
var viewMat3 = new Mat3();
var tempSphere = new BoundingSphere();
var _flipYMat = new Mat4().setScale(1, -1, 1);
var _tempLightSet = new Set();
var _tempLayerSet = new Set();
var _dynamicBindGroup = new DynamicBindGroup();
var _fixProjRangeMat = new Mat4().set([
		1,
		0,
		0,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		0.5,
		0,
		0,
		0,
		0.5,
		1
]);
var _haltonSequence = [
		new Vec2(0.5, 0.333333),
		new Vec2(0.25, 0.666667),
		new Vec2(0.75, 0.111111),
		new Vec2(0.125, 0.444444),
		new Vec2(0.625, 0.777778),
		new Vec2(0.375, 0.222222),
		new Vec2(0.875, 0.555556),
		new Vec2(0.0625, 0.888889),
		new Vec2(0.5625, 0.037037),
		new Vec2(0.3125, 0.370370),
		new Vec2(0.8125, 0.703704),
		new Vec2(0.1875, 0.148148),
		new Vec2(0.6875, 0.481481),
		new Vec2(0.4375, 0.814815),
		new Vec2(0.9375, 0.259259),
		new Vec2(0.03125, 0.592593)
];
var _tempProjMat0 = new Mat4();
var _tempProjMat1 = new Mat4();
var _tempProjMat2 = new Mat4();
var _tempProjMat3 = new Mat4();
var _tempProjMat4 = new Mat4();
var _tempProjMat5 = new Mat4();
var _tempSet = new Set();
var _tempMeshInstances = [];
var _tempMeshInstancesSkinned = [];
class Renderer {
		destroy() {
				this.shadowRenderer = null;
				this._shadowRendererLocal = null;
				this._shadowRendererDirectional = null;
				this.shadowMapCache.destroy();
				this.shadowMapCache = null;
				this._renderPassUpdateClustered.destroy();
				this._renderPassUpdateClustered = null;
				this.lightTextureAtlas.destroy();
				this.lightTextureAtlas = null;
		}
		sortCompare(drawCallA, drawCallB) {
				if (drawCallA.layer === drawCallB.layer) {
						if (drawCallA.drawOrder && drawCallB.drawOrder) {
								return drawCallA.drawOrder - drawCallB.drawOrder;
						} else if (drawCallA.zdist && drawCallB.zdist) {
								return drawCallB.zdist - drawCallA.zdist;
						} else if (drawCallA.zdist2 && drawCallB.zdist2) {
								return drawCallA.zdist2 - drawCallB.zdist2;
						}
				}
				return drawCallB._key[SORTKEY_FORWARD] - drawCallA._key[SORTKEY_FORWARD];
		}
		sortCompareMesh(drawCallA, drawCallB) {
				if (drawCallA.layer === drawCallB.layer) {
						if (drawCallA.drawOrder && drawCallB.drawOrder) {
								return drawCallA.drawOrder - drawCallB.drawOrder;
						} else if (drawCallA.zdist && drawCallB.zdist) {
								return drawCallB.zdist - drawCallA.zdist;
						}
				}
				var keyA = drawCallA._key[SORTKEY_FORWARD];
				var keyB = drawCallB._key[SORTKEY_FORWARD];
				if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
						return drawCallB.mesh.id - drawCallA.mesh.id;
				}
				return keyB - keyA;
		}
		sortCompareDepth(drawCallA, drawCallB) {
				var keyA = drawCallA._key[SORTKEY_DEPTH];
				var keyB = drawCallB._key[SORTKEY_DEPTH];
				if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
						return drawCallB.mesh.id - drawCallA.mesh.id;
				}
				return keyB - keyA;
		}
		setupViewport(camera, renderTarget) {
				var device = this.device;
				var pixelWidth = renderTarget ? renderTarget.width : device.width;
				var pixelHeight = renderTarget ? renderTarget.height : device.height;
				var rect = camera.rect;
				var x = Math.floor(rect.x * pixelWidth);
				var y = Math.floor(rect.y * pixelHeight);
				var w = Math.floor(rect.z * pixelWidth);
				var h = Math.floor(rect.w * pixelHeight);
				device.setViewport(x, y, w, h);
				if (camera._scissorRectClear) {
						var scissorRect = camera.scissorRect;
						x = Math.floor(scissorRect.x * pixelWidth);
						y = Math.floor(scissorRect.y * pixelHeight);
						w = Math.floor(scissorRect.z * pixelWidth);
						h = Math.floor(scissorRect.w * pixelHeight);
				}
				device.setScissor(x, y, w, h);
		}
		setCameraUniforms(camera, target) {
				var flipY = target == null ? undefined : target.flipY;
				var viewCount = 1;
				if (camera.xr && camera.xr.session) {
						var _camera__node_parent, _camera__node;
						var transform = ((_camera__node = camera._node) == null ? undefined : (_camera__node_parent = _camera__node.parent) == null ? undefined : _camera__node_parent.getWorldTransform()) || null;
						var views = camera.xr.views;
						viewCount = views.list.length;
						for(var v = 0; v < viewCount; v++){
								var view = views.list[v];
								view.updateTransforms(transform);
								camera.frustum.setFromMat4(view.projViewOffMat);
						}
				} else {
						var projMat = camera.projectionMatrix;
						if (camera.calculateProjection) {
								camera.calculateProjection(projMat, VIEW_CENTER);
						}
						var projMatSkybox = camera.getProjectionMatrixSkybox();
						if (flipY) {
								projMat = _tempProjMat0.mul2(_flipYMat, projMat);
								projMatSkybox = _tempProjMat1.mul2(_flipYMat, projMatSkybox);
						}
						if (this.device.isWebGPU) {
								projMat = _tempProjMat2.mul2(_fixProjRangeMat, projMat);
								projMatSkybox = _tempProjMat3.mul2(_fixProjRangeMat, projMatSkybox);
						}
						var { jitter } = camera;
						var jitterX = 0;
						var jitterY = 0;
						if (jitter > 0) {
								var targetWidth = target ? target.width : this.device.width;
								var targetHeight = target ? target.height : this.device.height;
								var offset = _haltonSequence[this.device.renderVersion % _haltonSequence.length];
								jitterX = jitter * (offset.x * 2 - 1) / targetWidth;
								jitterY = jitter * (offset.y * 2 - 1) / targetHeight;
								projMat = _tempProjMat4.copy(projMat);
								projMat.data[8] = jitterX;
								projMat.data[9] = jitterY;
								projMatSkybox = _tempProjMat5.copy(projMatSkybox);
								projMatSkybox.data[8] = jitterX;
								projMatSkybox.data[9] = jitterY;
								if (this.blueNoiseJitterVersion !== this.device.renderVersion) {
										this.blueNoiseJitterVersion = this.device.renderVersion;
										this.blueNoise.vec4(this.blueNoiseJitterVec);
								}
						}
						var jitterVec = jitter > 0 ? this.blueNoiseJitterVec : Vec4.ZERO;
						this.blueNoiseJitterData[0] = jitterVec.x;
						this.blueNoiseJitterData[1] = jitterVec.y;
						this.blueNoiseJitterData[2] = jitterVec.z;
						this.blueNoiseJitterData[3] = jitterVec.w;
						this.blueNoiseJitterId.setValue(this.blueNoiseJitterData);
						this.projId.setValue(projMat.data);
						this.projSkyboxId.setValue(projMatSkybox.data);
						if (camera.calculateTransform) {
								camera.calculateTransform(viewInvMat, VIEW_CENTER);
						} else {
								var pos = camera._node.getPosition();
								var rot = camera._node.getRotation();
								viewInvMat.setTRS(pos, rot, Vec3.ONE);
						}
						this.viewInvId.setValue(viewInvMat.data);
						viewMat.copy(viewInvMat).invert();
						this.viewId.setValue(viewMat.data);
						viewMat3.setFromMat4(viewMat);
						this.viewId3.setValue(viewMat3.data);
						viewProjMat.mul2(projMat, viewMat);
						this.viewProjId.setValue(viewProjMat.data);
						camera._storeShaderMatrices(viewProjMat, jitterX, jitterY, this.device.renderVersion);
						this.flipYId.setValue(flipY ? -1 : 1);
						this.dispatchViewPos(camera._node.getPosition());
						camera.frustum.setFromMat4(viewProjMat);
				}
				this.tbnBasis.setValue(flipY ? -1 : 1);
				var n = camera._nearClip;
				var f = camera._farClip;
				this.nearClipId.setValue(n);
				this.farClipId.setValue(f);
				this.cameraParams[0] = 1 / f;
				this.cameraParams[1] = f;
				this.cameraParams[2] = n;
				this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
				this.cameraParamsId.setValue(this.cameraParams);
				this.exposureId.setValue(this.scene.physicalUnits ? camera.getExposure() : this.scene.exposure);
				return viewCount;
		}
		clear(camera, clearColor, clearDepth, clearStencil) {
				var flags = ((clearColor != null ? clearColor : camera._clearColorBuffer) ? CLEARFLAG_COLOR : 0) | ((clearDepth != null ? clearDepth : camera._clearDepthBuffer) ? CLEARFLAG_DEPTH : 0) | ((clearStencil != null ? clearStencil : camera._clearStencilBuffer) ? CLEARFLAG_STENCIL : 0);
				if (flags) {
						var device = this.device;
						device.clear({
								color: [
										camera._clearColor.r,
										camera._clearColor.g,
										camera._clearColor.b,
										camera._clearColor.a
								],
								depth: camera._clearDepth,
								stencil: camera._clearStencil,
								flags: flags
						});
				}
		}
		setCamera(camera, target, clear, renderAction) {
				this.setCameraUniforms(camera, target);
				this.clearView(camera, target, clear, false);
		}
		clearView(camera, target, clear, forceWrite) {
				var device = this.device;
				device.setRenderTarget(target);
				device.updateBegin();
				if (forceWrite) {
						device.setColorWrite(true, true, true, true);
						device.setDepthWrite(true);
				}
				this.setupViewport(camera, target);
				if (clear) {
						var options = camera._clearOptions;
						device.clear(options ? options : {
								color: [
										camera._clearColor.r,
										camera._clearColor.g,
										camera._clearColor.b,
										camera._clearColor.a
								],
								depth: camera._clearDepth,
								flags: (camera._clearColorBuffer ? CLEARFLAG_COLOR : 0) | (camera._clearDepthBuffer ? CLEARFLAG_DEPTH : 0) | (camera._clearStencilBuffer ? CLEARFLAG_STENCIL : 0),
								stencil: camera._clearStencil
						});
				}
		}
		setupCullMode(cullFaces, flipFactor, drawCall) {
				var material = drawCall.material;
				var mode = CULLFACE_NONE;
				if (cullFaces) {
						var flipFaces = 1;
						if (material.cull === CULLFACE_FRONT || material.cull === CULLFACE_BACK) {
								flipFaces = flipFactor * drawCall.flipFacesFactor * drawCall.node.worldScaleSign;
						}
						if (flipFaces < 0) {
								mode = material.cull === CULLFACE_FRONT ? CULLFACE_BACK : CULLFACE_FRONT;
						} else {
								mode = material.cull;
						}
				}
				this.device.setCullMode(mode);
				if (mode === CULLFACE_NONE && material.cull === CULLFACE_NONE) {
						this.twoSidedLightingNegScaleFactorId.setValue(drawCall.node.worldScaleSign);
				}
		}
		updateCameraFrustum(camera) {
				if (camera.xr && camera.xr.views.list.length) {
						var view = camera.xr.views.list[0];
						viewProjMat.mul2(view.projMat, view.viewOffMat);
						camera.frustum.setFromMat4(viewProjMat);
						return;
				}
				var projMat = camera.projectionMatrix;
				if (camera.calculateProjection) {
						camera.calculateProjection(projMat, VIEW_CENTER);
				}
				if (camera.calculateTransform) {
						camera.calculateTransform(viewInvMat, VIEW_CENTER);
				} else {
						var pos = camera._node.getPosition();
						var rot = camera._node.getRotation();
						viewInvMat.setTRS(pos, rot, Vec3.ONE);
						this.viewInvId.setValue(viewInvMat.data);
				}
				viewMat.copy(viewInvMat).invert();
				viewProjMat.mul2(projMat, viewMat);
				camera.frustum.setFromMat4(viewProjMat);
		}
		setBaseConstants(device, material) {
				device.setCullMode(material.cull);
				if (material.opacityMap) {
						this.opacityMapId.setValue(material.opacityMap);
				}
				if (material.opacityMap || material.alphaTest > 0) {
						this.alphaTestId.setValue(material.alphaTest);
				}
		}
		updateCpuSkinMatrices(drawCalls) {
				_skinUpdateIndex++;
				var drawCallsCount = drawCalls.length;
				if (drawCallsCount === 0) return;
				for(var i = 0; i < drawCallsCount; i++){
						var si = drawCalls[i].skinInstance;
						if (si) {
								si.updateMatrices(drawCalls[i].node, _skinUpdateIndex);
								si._dirty = true;
						}
				}
		}
		updateGpuSkinMatrices(drawCalls) {
				for (var drawCall of drawCalls){
						var skin = drawCall.skinInstance;
						if (skin && skin._dirty) {
								skin.updateMatrixPalette(drawCall.node, _skinUpdateIndex);
								skin._dirty = false;
						}
				}
		}
		updateMorphing(drawCalls) {
				for (var drawCall of drawCalls){
						var morphInst = drawCall.morphInstance;
						if (morphInst && morphInst._dirty) {
								morphInst.update();
						}
				}
		}
		updateGSplats(drawCalls) {
				for (var drawCall of drawCalls){
						var _drawCall_gsplatInstance;
						(_drawCall_gsplatInstance = drawCall.gsplatInstance) == null ? undefined : _drawCall_gsplatInstance.update();
				}
		}
		gpuUpdate(drawCalls) {
				this.updateGpuSkinMatrices(drawCalls);
				this.updateMorphing(drawCalls);
				this.updateGSplats(drawCalls);
		}
		setVertexBuffers(device, mesh) {
				device.setVertexBuffer(mesh.vertexBuffer);
		}
		setMorphing(device, morphInstance) {
				if (morphInstance) {
						morphInstance.prepareRendering(device);
						device.setVertexBuffer(morphInstance.morph.vertexBufferIds);
						this.morphPositionTex.setValue(morphInstance.texturePositions);
						this.morphNormalTex.setValue(morphInstance.textureNormals);
						this.morphTexParams.setValue(morphInstance._textureParams);
				}
		}
		setSkinning(device, meshInstance) {
				var skinInstance = meshInstance.skinInstance;
				if (skinInstance) {
						this._skinDrawCalls++;
						var boneTexture = skinInstance.boneTexture;
						this.boneTextureId.setValue(boneTexture);
						this.boneTextureSizeId.setValue(skinInstance.boneTextureSize);
				}
		}
		dispatchViewPos(position) {
				var vp = this.viewPos;
				vp[0] = position.x;
				vp[1] = position.y;
				vp[2] = position.z;
				this.viewPosId.setValue(vp);
		}
		initViewBindGroupFormat(isClustered) {
				if (this.device.supportsUniformBuffers && !this.viewUniformFormat) {
						var uniforms = [
								new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4),
								new UniformFormat('cubeMapRotationMatrix', UNIFORMTYPE_MAT3),
								new UniformFormat('view_position', UNIFORMTYPE_VEC3),
								new UniformFormat('skyboxIntensity', UNIFORMTYPE_FLOAT),
								new UniformFormat('exposure', UNIFORMTYPE_FLOAT),
								new UniformFormat('textureBias', UNIFORMTYPE_FLOAT)
						];
						if (isClustered) {
								uniforms.push(...[
										new UniformFormat('clusterCellsCountByBoundsSize', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterTextureSize', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterBoundsMin', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterBoundsDelta', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterCellsDot', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterCellsMax', UNIFORMTYPE_VEC3),
										new UniformFormat('clusterCompressionLimit0', UNIFORMTYPE_VEC2),
										new UniformFormat('shadowAtlasParams', UNIFORMTYPE_VEC2),
										new UniformFormat('clusterMaxCells', UNIFORMTYPE_INT),
										new UniformFormat('clusterSkip', UNIFORMTYPE_FLOAT)
								]);
						}
						this.viewUniformFormat = new UniformBufferFormat(this.device, uniforms);
						var formats = [
								new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT),
								new BindTextureFormat('lightsTextureFloat', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT),
								new BindTextureFormat('lightsTexture8', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT),
								new BindTextureFormat('shadowAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_DEPTH),
								new BindTextureFormat('cookieAtlasTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT),
								new BindTextureFormat('areaLightsLutTex1', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT),
								new BindTextureFormat('areaLightsLutTex2', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT)
						];
						if (isClustered) {
								formats.push(...[
										new BindTextureFormat('clusterWorldTexture', SHADERSTAGE_FRAGMENT, TEXTUREDIMENSION_2D, SAMPLETYPE_UNFILTERABLE_FLOAT)
								]);
						}
						this.viewBindGroupFormat = new BindGroupFormat(this.device, formats);
				}
		}
		setupViewUniformBuffers(viewBindGroups, viewUniformFormat, viewBindGroupFormat, viewCount) {
				var device = this.device;
				while(viewBindGroups.length < viewCount){
						var ub = new UniformBuffer(device, viewUniformFormat, false);
						var bg = new BindGroup(device, viewBindGroupFormat, ub);
						viewBindGroups.push(bg);
				}
				var viewBindGroup = viewBindGroups[0];
				viewBindGroup.defaultUniformBuffer.update();
				viewBindGroup.update();
				device.setBindGroup(BINDGROUP_VIEW, viewBindGroup);
		}
		setupMeshUniformBuffers(shaderInstance, meshInstance) {
				var device = this.device;
				if (device.supportsUniformBuffers) {
						this.modelMatrixId.setValue(meshInstance.node.worldTransform.data);
						this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
						var meshBindGroup = shaderInstance.getBindGroup(device);
						meshBindGroup.update();
						device.setBindGroup(BINDGROUP_MESH, meshBindGroup);
						var meshUniformBuffer = shaderInstance.getUniformBuffer(device);
						meshUniformBuffer.update(_dynamicBindGroup);
						device.setBindGroup(BINDGROUP_MESH_UB, _dynamicBindGroup.bindGroup, _dynamicBindGroup.offsets);
				}
		}
		drawInstance(device, meshInstance, mesh, style, normal) {
				var modelMatrix = meshInstance.node.worldTransform;
				this.modelMatrixId.setValue(modelMatrix.data);
				if (normal) {
						this.normalMatrixId.setValue(meshInstance.node.normalMatrix.data);
				}
				var instancingData = meshInstance.instancingData;
				if (instancingData) {
						if (instancingData.count > 0) {
								this._instancedDrawCalls++;
								device.setVertexBuffer(instancingData.vertexBuffer);
								device.draw(mesh.primitive[style], instancingData.count);
						} else {
								device.clearVertexBuffer();
						}
				} else {
						device.draw(mesh.primitive[style]);
				}
		}
		drawInstance2(device, meshInstance, mesh, style) {
				var instancingData = meshInstance.instancingData;
				if (instancingData) {
						if (instancingData.count > 0) {
								this._instancedDrawCalls++;
								device.draw(mesh.primitive[style], instancingData.count, true);
						} else {
								device.clearVertexBuffer();
						}
				} else {
						device.draw(mesh.primitive[style], undefined, true);
				}
		}
		cull(camera, drawCalls, culledInstances) {
				var opaque = culledInstances.opaque;
				opaque.length = 0;
				var transparent = culledInstances.transparent;
				transparent.length = 0;
				var doCull = camera.frustumCulling;
				var count = drawCalls.length;
				for(var i = 0; i < count; i++){
						var drawCall = drawCalls[i];
						if (drawCall.visible) {
								var visible = !doCull || !drawCall.cull || drawCall._isVisible(camera);
								if (visible) {
										drawCall.visibleThisFrame = true;
										var bucket = drawCall.transparent ? transparent : opaque;
										bucket.push(drawCall);
										if (drawCall.skinInstance || drawCall.morphInstance || drawCall.gsplatInstance) {
												this.processingMeshInstances.add(drawCall);
												if (drawCall.gsplatInstance) {
														drawCall.gsplatInstance.cameras.push(camera);
												}
										}
								}
						}
				}
		}
		collectLights(comp) {
				this.lights.length = 0;
				this.localLights.length = 0;
				var stats = this.scene._stats;
				var count = comp.layerList.length;
				for(var i = 0; i < count; i++){
						var layer = comp.layerList[i];
						if (!_tempLayerSet.has(layer)) {
								_tempLayerSet.add(layer);
								var lights = layer._lights;
								for(var j = 0; j < lights.length; j++){
										var light = lights[j];
										if (!_tempLightSet.has(light)) {
												_tempLightSet.add(light);
												this.lights.push(light);
												if (light._type !== LIGHTTYPE_DIRECTIONAL) {
														this.localLights.push(light);
												}
										}
								}
						}
				}
				stats.lights = this.lights.length;
				_tempLightSet.clear();
				_tempLayerSet.clear();
		}
		cullLights(camera, lights) {
				var clusteredLightingEnabled = this.scene.clusteredLightingEnabled;
				var physicalUnits = this.scene.physicalUnits;
				for(var i = 0; i < lights.length; i++){
						var light = lights[i];
						if (light.enabled) {
								if (light._type !== LIGHTTYPE_DIRECTIONAL) {
										light.getBoundingSphere(tempSphere);
										if (camera.frustum.containsSphere(tempSphere)) {
												light.visibleThisFrame = true;
												light.usePhysicalUnits = physicalUnits;
												var screenSize = camera.getScreenSize(tempSphere);
												light.maxScreenSize = Math.max(light.maxScreenSize, screenSize);
										} else {
												if (!clusteredLightingEnabled) {
														if (light.castShadows && !light.shadowMap) {
																light.visibleThisFrame = true;
														}
												}
										}
								} else {
										light.usePhysicalUnits = this.scene.physicalUnits;
								}
						}
				}
		}
		cullShadowmaps(comp) {
				var isClustered = this.scene.clusteredLightingEnabled;
				for(var i = 0; i < this.localLights.length; i++){
						var light = this.localLights[i];
						if (light._type !== LIGHTTYPE_DIRECTIONAL) {
								if (isClustered) {
										if (light.atlasSlotUpdated && light.shadowUpdateMode === SHADOWUPDATE_NONE) {
												light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
										}
								} else {
										if (light.shadowUpdateMode === SHADOWUPDATE_NONE && light.castShadows) {
												if (!light.getRenderData(null, 0).shadowCamera.renderTarget) {
														light.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
												}
										}
								}
								if (light.visibleThisFrame && light.castShadows && light.shadowUpdateMode !== SHADOWUPDATE_NONE) {
										this._shadowRendererLocal.cull(light, comp);
								}
						}
				}
				this.cameraDirShadowLights.clear();
				var cameras = comp.cameras;
				for(var i1 = 0; i1 < cameras.length; i1++){
						var cameraComponent = cameras[i1];
						if (cameraComponent.enabled) {
								var camera = cameraComponent.camera;
								var lightList = undefined;
								var cameraLayers = camera.layers;
								for(var l = 0; l < cameraLayers.length; l++){
										var cameraLayer = comp.getLayerById(cameraLayers[l]);
										if (cameraLayer) {
												var layerDirLights = cameraLayer.splitLights[LIGHTTYPE_DIRECTIONAL];
												for(var j = 0; j < layerDirLights.length; j++){
														var light1 = layerDirLights[j];
														if (light1.castShadows && !_tempSet.has(light1)) {
																_tempSet.add(light1);
																lightList = lightList != null ? lightList : [];
																lightList.push(light1);
																this._shadowRendererDirectional.cull(light1, comp, camera);
														}
												}
										}
								}
								if (lightList) {
										this.cameraDirShadowLights.set(camera, lightList);
								}
								_tempSet.clear();
						}
				}
		}
		cullComposition(comp) {
				var { scene } = this;
				this.processingMeshInstances.clear();
				var numCameras = comp.cameras.length;
				this._camerasRendered += numCameras;
				for(var i = 0; i < numCameras; i++){
						var camera = comp.cameras[i];
						scene == null ? undefined : scene.fire(EVENT_PRECULL, camera);
						var renderTarget = camera.renderTarget;
						camera.frameUpdate(renderTarget);
						this.updateCameraFrustum(camera.camera);
						var layerIds = camera.layers;
						for(var j = 0; j < layerIds.length; j++){
								var layer = comp.getLayerById(layerIds[j]);
								if (layer && layer.enabled) {
										this.cullLights(camera.camera, layer._lights);
										var culledInstances = layer.getCulledInstances(camera.camera);
										this.cull(camera.camera, layer.meshInstances, culledInstances);
								}
						}
						scene == null ? undefined : scene.fire(EVENT_POSTCULL, camera);
				}
				if (scene.clusteredLightingEnabled) {
						this.updateLightTextureAtlas();
				}
				this.cullShadowmaps(comp);
		}
		updateShaders(drawCalls, onlyLitShaders) {
				var count = drawCalls.length;
				for(var i = 0; i < count; i++){
						var mat = drawCalls[i].material;
						if (mat) {
								if (!_tempSet.has(mat)) {
										_tempSet.add(mat);
										if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
												if (onlyLitShaders) {
														if (!mat.useLighting || mat.emitter && !mat.emitter.lighting) {
																continue;
														}
												}
												mat.clearVariants();
										}
								}
						}
				}
				_tempSet.clear();
		}
		updateFrameUniforms() {
				this.blueNoiseTextureId.setValue(getBlueNoiseTexture(this.device));
		}
		beginFrame(comp) {
				var scene = this.scene;
				var updateShaders = scene.updateShaders || this.device._shadersDirty;
				var layers = comp.layerList;
				var layerCount = layers.length;
				for(var i = 0; i < layerCount; i++){
						var layer = layers[i];
						var meshInstances = layer.meshInstances;
						var count = meshInstances.length;
						for(var j = 0; j < count; j++){
								var meshInst = meshInstances[j];
								meshInst.visibleThisFrame = false;
								if (updateShaders) {
										_tempMeshInstances.push(meshInst);
								}
								if (meshInst.skinInstance) {
										_tempMeshInstancesSkinned.push(meshInst);
								}
						}
				}
				if (updateShaders) {
						var onlyLitShaders = !scene.updateShaders || !this.device._shadersDirty;
						this.updateShaders(_tempMeshInstances, onlyLitShaders);
						scene.updateShaders = false;
						this.device._shadersDirty = false;
						scene._shaderVersion++;
				}
				this.updateFrameUniforms();
				this.updateCpuSkinMatrices(_tempMeshInstancesSkinned);
				_tempMeshInstances.length = 0;
				_tempMeshInstancesSkinned.length = 0;
				var lights = this.lights;
				var lightCount = lights.length;
				for(var i1 = 0; i1 < lightCount; i1++){
						lights[i1].beginFrame();
				}
		}
		updateLightTextureAtlas() {
				this.lightTextureAtlas.update(this.localLights, this.scene.lighting);
		}
		updateLayerComposition(comp) {
				var len = comp.layerList.length;
				var scene = this.scene;
				var shaderVersion = scene._shaderVersion;
				for(var i = 0; i < len; i++){
						var layer = comp.layerList[i];
						layer._shaderVersion = shaderVersion;
				}
				comp._update();
		}
		frameUpdate() {
				this.clustersDebugRendered = false;
				this.initViewBindGroupFormat(this.scene.clusteredLightingEnabled);
				this.dirLightShadows.clear();
		}
		constructor(graphicsDevice){
				this.clustersDebugRendered = false;
				this.processingMeshInstances = new Set();
				this.lights = [];
				this.localLights = [];
				this.cameraDirShadowLights = new Map();
				this.dirLightShadows = new Map();
				this.blueNoise = new BlueNoise(123);
				this.device = graphicsDevice;
				this.scene = null;
				this.worldClustersAllocator = new WorldClustersAllocator(graphicsDevice);
				this.lightTextureAtlas = new LightTextureAtlas(graphicsDevice);
				this.shadowMapCache = new ShadowMapCache();
				this.shadowRenderer = new ShadowRenderer(this, this.lightTextureAtlas);
				this._shadowRendererLocal = new ShadowRendererLocal(this, this.shadowRenderer);
				this._shadowRendererDirectional = new ShadowRendererDirectional(this, this.shadowRenderer);
				this._renderPassUpdateClustered = new RenderPassUpdateClustered(this.device, this, this.shadowRenderer, this._shadowRendererLocal, this.lightTextureAtlas);
				this.viewUniformFormat = null;
				this.viewBindGroupFormat = null;
				this._skinTime = 0;
				this._morphTime = 0;
				this._cullTime = 0;
				this._shadowMapTime = 0;
				this._lightClustersTime = 0;
				this._layerCompositionUpdateTime = 0;
				this._shadowDrawCalls = 0;
				this._skinDrawCalls = 0;
				this._instancedDrawCalls = 0;
				this._shadowMapUpdates = 0;
				this._numDrawCallsCulled = 0;
				this._camerasRendered = 0;
				this._lightClusters = 0;
				var scope = graphicsDevice.scope;
				this.boneTextureId = scope.resolve('texture_poseMap');
				this.boneTextureSizeId = scope.resolve('texture_poseMapSize');
				this.modelMatrixId = scope.resolve('matrix_model');
				this.normalMatrixId = scope.resolve('matrix_normal');
				this.viewInvId = scope.resolve('matrix_viewInverse');
				this.viewPos = new Float32Array(3);
				this.viewPosId = scope.resolve('view_position');
				this.projId = scope.resolve('matrix_projection');
				this.projSkyboxId = scope.resolve('matrix_projectionSkybox');
				this.viewId = scope.resolve('matrix_view');
				this.viewId3 = scope.resolve('matrix_view3');
				this.viewProjId = scope.resolve('matrix_viewProjection');
				this.flipYId = scope.resolve('projectionFlipY');
				this.tbnBasis = scope.resolve('tbnBasis');
				this.nearClipId = scope.resolve('camera_near');
				this.farClipId = scope.resolve('camera_far');
				this.cameraParams = new Float32Array(4);
				this.cameraParamsId = scope.resolve('camera_params');
				this.viewIndexId = scope.resolve('view_index');
				this.blueNoiseJitterVersion = 0;
				this.blueNoiseJitterVec = new Vec4();
				this.blueNoiseJitterData = new Float32Array(4);
				this.blueNoiseJitterId = scope.resolve('blueNoiseJitter');
				this.blueNoiseTextureId = scope.resolve('blueNoiseTex32');
				this.alphaTestId = scope.resolve('alpha_ref');
				this.opacityMapId = scope.resolve('texture_opacityMap');
				this.exposureId = scope.resolve('exposure');
				this.twoSidedLightingNegScaleFactorId = scope.resolve('twoSidedLightingNegScaleFactor');
				this.twoSidedLightingNegScaleFactorId.setValue(0);
				this.morphPositionTex = scope.resolve('morphPositionTex');
				this.morphNormalTex = scope.resolve('morphNormalTex');
				this.morphTexParams = scope.resolve('morph_tex_params');
				this.lightCube = new LightCube();
				this.constantLightCube = scope.resolve('lightCube[0]');
		}
}

export { Renderer };
