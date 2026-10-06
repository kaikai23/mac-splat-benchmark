import { now } from '../../core/time.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, CHUNKAPI_1_65, CULLFACE_NONE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { PROJECTION_ORTHOGRAPHIC, GAMMA_NONE, TONEMAP_LINEAR, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, SHADOWUPDATE_REALTIME, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT, PROJECTION_PERSPECTIVE, LIGHTTYPE_OMNI, SHADER_FORWARD, SHADERDEF_LM, BAKE_COLORDIR, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from '../../scene/constants.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { LightingParams } from '../../scene/lighting/lighting-params.js';
import { WorldClusters } from '../../scene/lighting/world-clusters.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';
import { Camera } from '../../scene/camera.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { BakeLightSimple } from './bake-light-simple.js';
import { BakeLightAmbient } from './bake-light-ambient.js';
import { BakeMeshNode } from './bake-mesh-node.js';
import { LightmapCache } from '../../scene/graphics/lightmap-cache.js';
import { LightmapFilters } from './lightmap-filters.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPassLightmapper } from './render-pass-lightmapper.js';

var MAX_LIGHTMAP_SIZE = 2048;
var PASS_COLOR = 0;
var PASS_DIR = 1;
var tempVec = new Vec3();
class Lightmapper {
		destroy() {
				var _this_camera;
				LightmapCache.decRef(this.blackTex);
				this.blackTex = null;
				LightmapCache.destroy();
				this.device = null;
				this.root = null;
				this.scene = null;
				this.renderer = null;
				this.assets = null;
				(_this_camera = this.camera) == null ? undefined : _this_camera.destroy();
				this.camera = null;
		}
		initBake(device) {
				this.bakeHDR = this.scene.lightmapPixelFormat !== PIXELFORMAT_RGBA8;
				if (!this._initCalled) {
						this._initCalled = true;
						this.lightmapFilters = new LightmapFilters(device);
						this.constantBakeDir = device.scope.resolve('bakeDir');
						this.materials = [];
						this.blackTex = new Texture(this.device, {
								width: 4,
								height: 4,
								format: PIXELFORMAT_RGBA8,
								type: TEXTURETYPE_RGBM,
								name: 'lightmapBlack'
						});
						LightmapCache.incRef(this.blackTex);
						var camera = new Camera();
						camera.clearColor.set(0, 0, 0, 0);
						camera.clearColorBuffer = true;
						camera.clearDepthBuffer = false;
						camera.clearStencilBuffer = false;
						camera.frustumCulling = false;
						camera.projection = PROJECTION_ORTHOGRAPHIC;
						camera.aspectRatio = 1;
						camera.node = new GraphNode();
						this.camera = camera;
						this.camera.shaderParams.gammaCorrection = GAMMA_NONE;
						this.camera.shaderParams.toneMapping = TONEMAP_LINEAR;
				}
				if (this.scene.clusteredLightingEnabled) {
						var lightingParams = new LightingParams(device.supportsAreaLights, device.maxTextureSize, ()=>{});
						this.lightingParams = lightingParams;
						var srcParams = this.scene.lighting;
						lightingParams.shadowsEnabled = srcParams.shadowsEnabled;
						lightingParams.shadowAtlasResolution = srcParams.shadowAtlasResolution;
						lightingParams.cookiesEnabled = srcParams.cookiesEnabled;
						lightingParams.cookieAtlasResolution = srcParams.cookieAtlasResolution;
						lightingParams.areaLightsEnabled = srcParams.areaLightsEnabled;
						lightingParams.cells = new Vec3(3, 3, 3);
						lightingParams.maxLightsPerCell = 4;
						this.worldClusters = new WorldClusters(device);
						this.worldClusters.name = 'ClusterLightmapper';
				}
		}
		finishBake(bakeNodes) {
				this.materials = [];
				function destroyRT(rt) {
						LightmapCache.decRef(rt.colorBuffer);
						rt.destroy();
				}
				this.renderTargets.forEach((rt)=>{
						destroyRT(rt);
				});
				this.renderTargets.clear();
				bakeNodes.forEach((node)=>{
						node.renderTargets.forEach((rt)=>{
								destroyRT(rt);
						});
						node.renderTargets.length = 0;
				});
				this.ambientAOMaterial = null;
				if (this.worldClusters) {
						this.worldClusters.destroy();
						this.worldClusters = null;
				}
		}
		createMaterialForPass(device, scene, pass, addAmbient) {
				var material = new StandardMaterial();
				material.name = "lmMaterial-pass:" + pass + "-ambient:" + addAmbient;
				material.chunks.APIVersion = CHUNKAPI_1_65;
				var transformDefines = '#define UV1LAYOUT\n';
				material.chunks.transformVS = transformDefines + shaderChunks.transformVS;
				if (pass === PASS_COLOR) {
						var bakeLmEndChunk = shaderChunksLightmapper.bakeLmEndPS;
						if (addAmbient) {
								bakeLmEndChunk = "\n                    dDiffuseLight = ((dDiffuseLight - 0.5) * max(" + scene.ambientBakeOcclusionContrast.toFixed(1) + " + 1.0, 0.0)) + 0.5;\n                    dDiffuseLight += vec3(" + scene.ambientBakeOcclusionBrightness.toFixed(1) + ");\n                    dDiffuseLight = saturate(dDiffuseLight);\n                    dDiffuseLight *= dAmbientLight;\n                " + bakeLmEndChunk;
						} else {
								material.ambient = new Color(0, 0, 0);
						}
						material.chunks.basePS = shaderChunks.basePS + (this.bakeHDR ? '' : '\n#define LIGHTMAP_RGBM\n');
						material.chunks.endPS = bakeLmEndChunk;
						material.lightMap = this.blackTex;
				} else {
						material.chunks.basePS = "" + shaderChunks.basePS + "\nuniform sampler2D texture_dirLightMap;\nuniform float bakeDir;\n";
						material.chunks.endPS = shaderChunksLightmapper.bakeDirLmEndPS;
				}
				material.chunks.outputAlphaPS = '\n';
				material.chunks.outputAlphaOpaquePS = '\n';
				material.chunks.outputAlphaPremulPS = '\n';
				material.cull = CULLFACE_NONE;
				material.forceUv1 = true;
				material.update();
				return material;
		}
		createMaterials(device, scene, passCount) {
				for(var pass = 0; pass < passCount; pass++){
						if (!this.passMaterials[pass]) {
								this.passMaterials[pass] = this.createMaterialForPass(device, scene, pass, false);
						}
				}
				if (!this.ambientAOMaterial) {
						this.ambientAOMaterial = this.createMaterialForPass(device, scene, 0, true);
						this.ambientAOMaterial.onUpdateShader = function(options) {
								options.litOptions.lightMapWithoutAmbient = true;
								options.litOptions.separateAmbient = true;
								return options;
						};
				}
		}
		createTexture(size, name) {
				return new Texture(this.device, {
						width: size,
						height: size,
						format: this.scene.lightmapPixelFormat,
						mipmaps: false,
						type: this.bakeHDR ? TEXTURETYPE_DEFAULT : TEXTURETYPE_RGBM,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						name: name
				});
		}
		collectModels(node, bakeNodes, allNodes) {
				var _node_model, _node_model1, _node_render;
				if (!node.enabled) return;
				var meshInstances;
				if (((_node_model = node.model) == null ? undefined : _node_model.model) && ((_node_model1 = node.model) == null ? undefined : _node_model1.enabled)) {
						if (allNodes) allNodes.push(new BakeMeshNode(node));
						if (node.model.lightmapped) {
								if (bakeNodes) {
										meshInstances = node.model.model.meshInstances;
								}
						}
				}
				if ((_node_render = node.render) == null ? undefined : _node_render.enabled) {
						if (allNodes) allNodes.push(new BakeMeshNode(node));
						if (node.render.lightmapped) {
								if (bakeNodes) {
										meshInstances = node.render.meshInstances;
								}
						}
				}
				if (meshInstances) {
						var hasUv1 = true;
						for(var i = 0; i < meshInstances.length; i++){
								if (!meshInstances[i].mesh.vertexBuffer.format.hasUv1) {
										hasUv1 = false;
										break;
								}
						}
						if (hasUv1) {
								var notInstancedMeshInstances = [];
								for(var i1 = 0; i1 < meshInstances.length; i1++){
										var mesh = meshInstances[i1].mesh;
										if (this._tempSet.has(mesh)) {
												bakeNodes.push(new BakeMeshNode(node, [
														meshInstances[i1]
												]));
										} else {
												notInstancedMeshInstances.push(meshInstances[i1]);
										}
										this._tempSet.add(mesh);
								}
								this._tempSet.clear();
								if (notInstancedMeshInstances.length > 0) {
										bakeNodes.push(new BakeMeshNode(node, notInstancedMeshInstances));
								}
						}
				}
				for(var i2 = 0; i2 < node._children.length; i2++){
						this.collectModels(node._children[i2], bakeNodes, allNodes);
				}
		}
		prepareShadowCasters(nodes) {
				var casters = [];
				for(var n = 0; n < nodes.length; n++){
						var component = nodes[n].component;
						component.castShadows = component.castShadowsLightmap;
						if (component.castShadowsLightmap) {
								var meshes = nodes[n].meshInstances;
								for(var i = 0; i < meshes.length; i++){
										meshes[i].visibleThisFrame = true;
										casters.push(meshes[i]);
								}
						}
				}
				return casters;
		}
		updateTransforms(nodes) {
				for(var i = 0; i < nodes.length; i++){
						var meshInstances = nodes[i].meshInstances;
						for(var j = 0; j < meshInstances.length; j++){
								meshInstances[j].node.getWorldTransform();
						}
				}
		}
		calculateLightmapSize(node) {
				var data;
				var sizeMult = this.scene.lightmapSizeMultiplier || 16;
				var scale = tempVec;
				var srcArea, lightmapSizeMultiplier;
				if (node.model) {
						lightmapSizeMultiplier = node.model.lightmapSizeMultiplier;
						if (node.model.asset) {
								data = this.assets.get(node.model.asset).data;
								if (data.area) {
										srcArea = data.area;
								}
						} else if (node.model._area) {
								data = node.model;
								if (data._area) {
										srcArea = data._area;
								}
						}
				} else if (node.render) {
						lightmapSizeMultiplier = node.render.lightmapSizeMultiplier;
						if (node.render.type !== 'asset') {
								if (node.render._area) {
										data = node.render;
										if (data._area) {
												srcArea = data._area;
										}
								}
						}
				}
				var area = {
						x: 1,
						y: 1,
						z: 1,
						uv: 1
				};
				if (srcArea) {
						area.x = srcArea.x;
						area.y = srcArea.y;
						area.z = srcArea.z;
						area.uv = srcArea.uv;
				}
				var areaMult = lightmapSizeMultiplier || 1;
				area.x *= areaMult;
				area.y *= areaMult;
				area.z *= areaMult;
				var component = node.render || node.model;
				var bounds = this.computeNodeBounds(component.meshInstances);
				scale.copy(bounds.halfExtents);
				var totalArea = area.x * scale.y * scale.z + area.y * scale.x * scale.z + area.z * scale.x * scale.y;
				totalArea /= area.uv;
				totalArea = Math.sqrt(totalArea);
				var lightmapSize = Math.min(math.nextPowerOfTwo(totalArea * sizeMult), this.scene.lightmapMaxResolution || MAX_LIGHTMAP_SIZE);
				return lightmapSize;
		}
		setLightmapping(nodes, value, passCount, shaderDefs) {
				for(var i = 0; i < nodes.length; i++){
						var node = nodes[i];
						var meshInstances = node.meshInstances;
						for(var j = 0; j < meshInstances.length; j++){
								var meshInstance = meshInstances[j];
								meshInstance.setLightmapped(value);
								if (value) {
										if (shaderDefs) {
												meshInstance._shaderDefs |= shaderDefs;
										}
										meshInstance.mask = MASK_AFFECT_LIGHTMAPPED;
										for(var pass = 0; pass < passCount; pass++){
												var tex = node.renderTargets[pass].colorBuffer;
												tex.minFilter = FILTER_LINEAR;
												tex.magFilter = FILTER_LINEAR;
												meshInstance.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tex);
										}
								}
						}
				}
		}
		bake(nodes, mode) {
				if (mode === undefined) mode = BAKE_COLORDIR;
				var device = this.device;
				var startTime = now();
				this.scene._updateSkyMesh();
				this.stats.renderPasses = 0;
				this.stats.shadowMapTime = 0;
				this.stats.forwardTime = 0;
				var startShaders = device._shaderStats.linked;
				var startFboTime = device._renderTargetCreationTime;
				var startCompileTime = device._shaderStats.compileTime;
				var bakeNodes = [];
				var allNodes = [];
				if (nodes) {
						for(var i = 0; i < nodes.length; i++){
								this.collectModels(nodes[i], bakeNodes, null);
						}
						this.collectModels(this.root, null, allNodes);
				} else {
						this.collectModels(this.root, bakeNodes, allNodes);
				}
				if (bakeNodes.length > 0) {
						this.renderer.shadowRenderer.frameUpdate();
						var passCount = mode === BAKE_COLORDIR ? 2 : 1;
						this.setLightmapping(bakeNodes, false, passCount);
						this.initBake(device);
						this.bakeInternal(passCount, bakeNodes, allNodes);
						var shaderDefs = SHADERDEF_LM;
						if (mode === BAKE_COLORDIR) {
								shaderDefs |= SHADERDEF_DIRLM;
						}
						if (this.scene.ambientBake) {
								shaderDefs |= SHADERDEF_LMAMBIENT;
						}
						this.setLightmapping(bakeNodes, true, passCount, shaderDefs);
						this.finishBake(bakeNodes);
				}
				var nowTime = now();
				this.stats.totalRenderTime = nowTime - startTime;
				this.stats.shadersLinked = device._shaderStats.linked - startShaders;
				this.stats.compileTime = device._shaderStats.compileTime - startCompileTime;
				this.stats.fboTime = device._renderTargetCreationTime - startFboTime;
				this.stats.lightmapCount = bakeNodes.length;
		}
		allocateTextures(bakeNodes, passCount) {
				for(var i = 0; i < bakeNodes.length; i++){
						var bakeNode = bakeNodes[i];
						var size = this.calculateLightmapSize(bakeNode.node);
						for(var pass = 0; pass < passCount; pass++){
								var tex = this.createTexture(size, "lightmapper_lightmap_" + i);
								LightmapCache.incRef(tex);
								bakeNode.renderTargets[pass] = new RenderTarget({
										colorBuffer: tex,
										depth: false
								});
						}
						if (!this.renderTargets.has(size)) {
								var tex1 = this.createTexture(size, "lightmapper_temp_lightmap_" + size);
								LightmapCache.incRef(tex1);
								this.renderTargets.set(size, new RenderTarget({
										colorBuffer: tex1,
										depth: false
								}));
						}
				}
		}
		prepareLightsToBake(allLights, bakeLights) {
				if (this.scene.ambientBake) {
						var ambientLight = new BakeLightAmbient(this);
						bakeLights.push(ambientLight);
				}
				var sceneLights = this.renderer.lights;
				for(var i = 0; i < sceneLights.length; i++){
						var light = sceneLights[i];
						var bakeLight = new BakeLightSimple(this, light);
						allLights.push(bakeLight);
						if (light.enabled && (light.mask & MASK_BAKE) !== 0) {
								light.mask = MASK_BAKE | MASK_AFFECT_LIGHTMAPPED | MASK_AFFECT_DYNAMIC;
								light.shadowUpdateMode = light.type === LIGHTTYPE_DIRECTIONAL ? SHADOWUPDATE_REALTIME : SHADOWUPDATE_THISFRAME;
								bakeLights.push(bakeLight);
						}
				}
				bakeLights.sort();
		}
		restoreLights(allLights) {
				for(var i = 0; i < allLights.length; i++){
						allLights[i].restore();
				}
		}
		setupScene() {
				this.ambientLight.copy(this.scene.ambientLight);
				if (!this.scene.ambientBake) {
						this.scene.ambientLight.set(0, 0, 0);
				}
				this.renderer.setSceneConstants();
		}
		restoreScene() {
				this.scene.ambientLight.copy(this.ambientLight);
		}
		computeNodeBounds(meshInstances) {
				var bounds = new BoundingBox();
				if (meshInstances.length > 0) {
						bounds.copy(meshInstances[0].aabb);
						for(var m = 1; m < meshInstances.length; m++){
								bounds.add(meshInstances[m].aabb);
						}
				}
				return bounds;
		}
		computeNodesBounds(nodes) {
				for(var i = 0; i < nodes.length; i++){
						var meshInstances = nodes[i].meshInstances;
						nodes[i].bounds = this.computeNodeBounds(meshInstances);
				}
		}
		computeBounds(meshInstances) {
				var bounds = new BoundingBox();
				for(var i = 0; i < meshInstances.length; i++){
						bounds.copy(meshInstances[0].aabb);
						for(var m = 1; m < meshInstances.length; m++){
								bounds.add(meshInstances[m].aabb);
						}
				}
				return bounds;
		}
		backupMaterials(meshInstances) {
				for(var i = 0; i < meshInstances.length; i++){
						this.materials[i] = meshInstances[i].material;
				}
		}
		restoreMaterials(meshInstances) {
				for(var i = 0; i < meshInstances.length; i++){
						meshInstances[i].material = this.materials[i];
				}
		}
		lightCameraPrepare(device, bakeLight) {
				var light = bakeLight.light;
				var shadowCam;
				if (light.type === LIGHTTYPE_SPOT) {
						var lightRenderData = light.getRenderData(null, 0);
						shadowCam = lightRenderData.shadowCamera;
						shadowCam._node.setPosition(light._node.getPosition());
						shadowCam._node.setRotation(light._node.getRotation());
						shadowCam._node.rotateLocal(-90, 0, 0);
						shadowCam.projection = PROJECTION_PERSPECTIVE;
						shadowCam.nearClip = light.attenuationEnd / 1000;
						shadowCam.farClip = light.attenuationEnd;
						shadowCam.aspectRatio = 1;
						shadowCam.fov = light._outerConeAngle * 2;
						this.renderer.updateCameraFrustum(shadowCam);
				}
				return shadowCam;
		}
		lightCameraPrepareAndCull(bakeLight, bakeNode, shadowCam, casterBounds) {
				var light = bakeLight.light;
				var lightAffectsNode = true;
				if (light.type === LIGHTTYPE_DIRECTIONAL) {
						tempVec.copy(casterBounds.center);
						tempVec.y += casterBounds.halfExtents.y;
						this.camera.node.setPosition(tempVec);
						this.camera.node.setEulerAngles(-90, 0, 0);
						this.camera.nearClip = 0;
						this.camera.farClip = casterBounds.halfExtents.y * 2;
						var frustumSize = Math.max(casterBounds.halfExtents.x, casterBounds.halfExtents.z);
						this.camera.orthoHeight = frustumSize;
				} else {
						if (!bakeLight.lightBounds.intersects(bakeNode.bounds)) {
								lightAffectsNode = false;
						}
				}
				if (light.type === LIGHTTYPE_SPOT) {
						var nodeVisible = false;
						var meshInstances = bakeNode.meshInstances;
						for(var i = 0; i < meshInstances.length; i++){
								if (meshInstances[i]._isVisible(shadowCam)) {
										nodeVisible = true;
										break;
								}
						}
						if (!nodeVisible) {
								lightAffectsNode = false;
						}
				}
				return lightAffectsNode;
		}
		setupLightArray(lightArray, light) {
				lightArray[LIGHTTYPE_DIRECTIONAL].length = 0;
				lightArray[LIGHTTYPE_OMNI].length = 0;
				lightArray[LIGHTTYPE_SPOT].length = 0;
				lightArray[light.type][0] = light;
				light.visibleThisFrame = true;
		}
		renderShadowMap(comp, shadowMapRendered, casters, bakeLight) {
				var light = bakeLight.light;
				var isClustered = this.scene.clusteredLightingEnabled;
				var castShadow = light.castShadows && (!isClustered || this.scene.lighting.shadowsEnabled);
				if (!shadowMapRendered && castShadow) {
						if (!light.shadowMap && !isClustered) {
								light.shadowMap = this.shadowMapCache.get(this.device, light);
						}
						if (light.type === LIGHTTYPE_DIRECTIONAL) {
								this.renderer._shadowRendererDirectional.cull(light, comp, this.camera, casters);
								var shadowPass = this.renderer._shadowRendererDirectional.getLightRenderPass(light, this.camera);
								shadowPass == null ? undefined : shadowPass.render();
						} else {
								if (this.device.isWebGPU) {
										return true;
								}
								this.renderer._shadowRendererLocal.cull(light, comp, casters);
								var insideRenderPass = false;
								this.renderer.shadowRenderer.render(light, this.camera, insideRenderPass);
						}
				}
				return true;
		}
		postprocessTextures(device, bakeNodes, passCount) {
				var numDilates2x = 1;
				var dilateShader = this.lightmapFilters.getDilate(device, this.bakeHDR);
				var denoiseShader;
				var filterLightmap = this.scene.lightmapFilterEnabled;
				if (filterLightmap) {
						this.lightmapFilters.prepareDenoise(this.scene.lightmapFilterRange, this.scene.lightmapFilterSmoothness, this.bakeHDR);
						denoiseShader = this.lightmapFilters.getDenoise(this.bakeHDR);
				}
				device.setBlendState(BlendState.NOBLEND);
				device.setDepthState(DepthState.NODEPTH);
				device.setStencilState(null, null);
				for(var node = 0; node < bakeNodes.length; node++){
						var bakeNode = bakeNodes[node];
						for(var pass = 0; pass < passCount; pass++){
								var nodeRT = bakeNode.renderTargets[pass];
								var lightmap = nodeRT.colorBuffer;
								var tempRT = this.renderTargets.get(lightmap.width);
								var tempTex = tempRT.colorBuffer;
								this.lightmapFilters.prepare(lightmap.width, lightmap.height);
								for(var i = 0; i < numDilates2x; i++){
										this.lightmapFilters.setSourceTexture(lightmap);
										var bilateralFilterEnabled = filterLightmap && pass === 0 && i === 0;
										drawQuadWithShader(device, tempRT, bilateralFilterEnabled ? denoiseShader : dilateShader);
										this.lightmapFilters.setSourceTexture(tempTex);
										drawQuadWithShader(device, nodeRT, dilateShader);
								}
						}
				}
		}
		bakeInternal(passCount, bakeNodes, allNodes) {
				var scene = this.scene;
				var comp = scene.layers;
				var device = this.device;
				var clusteredLightingEnabled = scene.clusteredLightingEnabled;
				this.createMaterials(device, scene, passCount);
				this.setupScene();
				comp._update();
				this.computeNodesBounds(bakeNodes);
				this.allocateTextures(bakeNodes, passCount);
				this.renderer.collectLights(comp);
				var allLights = [], bakeLights = [];
				this.prepareLightsToBake(allLights, bakeLights);
				this.updateTransforms(allNodes);
				var casters = this.prepareShadowCasters(allNodes);
				this.renderer.updateCpuSkinMatrices(casters);
				this.renderer.gpuUpdate(casters);
				var casterBounds = this.computeBounds(casters);
				var i, j, rcv, m;
				for(i = 0; i < bakeNodes.length; i++){
						var bakeNode = bakeNodes[i];
						rcv = bakeNode.meshInstances;
						for(j = 0; j < rcv.length; j++){
								m = rcv[j];
								m.setLightmapped(false);
								m.mask = MASK_BAKE;
								m.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], this.blackTex);
								m.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], this.blackTex);
						}
				}
				for(j = 0; j < bakeLights.length; j++){
						bakeLights[j].light.enabled = false;
				}
				var lightArray = [
						[],
						[],
						[]
				];
				var pass, node;
				var shadersUpdatedOn1stPass = false;
				for(i = 0; i < bakeLights.length; i++){
						var bakeLight = bakeLights[i];
						var isAmbientLight = bakeLight instanceof BakeLightAmbient;
						var isDirectional = bakeLight.light.type === LIGHTTYPE_DIRECTIONAL;
						var numVirtualLights = bakeLight.numVirtualLights;
						if (passCount > 1 && numVirtualLights > 1 && bakeLight.light.bakeDir) {
								numVirtualLights = 1;
						}
						for(var virtualLightIndex = 0; virtualLightIndex < numVirtualLights; virtualLightIndex++){
								if (numVirtualLights > 1) {
										bakeLight.prepareVirtualLight(virtualLightIndex, numVirtualLights);
								}
								bakeLight.startBake();
								var shadowMapRendered = false;
								var shadowCam = this.lightCameraPrepare(device, bakeLight);
								for(node = 0; node < bakeNodes.length; node++){
										var bakeNode1 = bakeNodes[node];
										rcv = bakeNode1.meshInstances;
										var lightAffectsNode = this.lightCameraPrepareAndCull(bakeLight, bakeNode1, shadowCam, casterBounds);
										if (!lightAffectsNode) {
												continue;
										}
										this.setupLightArray(lightArray, bakeLight.light);
										var clusterLights = isDirectional ? [] : [
												bakeLight.light
										];
										if (clusteredLightingEnabled) {
												this.renderer.lightTextureAtlas.update(clusterLights, this.lightingParams);
										}
										shadowMapRendered = this.renderShadowMap(comp, shadowMapRendered, casters, bakeLight);
										if (clusteredLightingEnabled) {
												this.worldClusters.update(clusterLights, this.lightingParams);
										}
										this.backupMaterials(rcv);
										for(pass = 0; pass < passCount; pass++){
												if (pass > 0 && virtualLightIndex > 0) {
														break;
												}
												if (isAmbientLight && pass > 0) {
														break;
												}
												var nodeRT = bakeNode1.renderTargets[pass];
												var lightmapSize = bakeNode1.renderTargets[pass].colorBuffer.width;
												var tempRT = this.renderTargets.get(lightmapSize);
												var tempTex = tempRT.colorBuffer;
												if (pass === 0) {
														shadersUpdatedOn1stPass = scene.updateShaders;
												} else if (shadersUpdatedOn1stPass) {
														scene.updateShaders = true;
												}
												var passMaterial = this.passMaterials[pass];
												if (isAmbientLight) {
														var lastVirtualLightForPass = virtualLightIndex + 1 === numVirtualLights;
														if (lastVirtualLightForPass && pass === 0) {
																passMaterial = this.ambientAOMaterial;
														}
												}
												for(j = 0; j < rcv.length; j++){
														rcv[j].material = passMaterial;
												}
												this.renderer.updateShaders(rcv);
												if (pass === PASS_DIR) {
														this.constantBakeDir.setValue(bakeLight.light.bakeDir ? 1 : 0);
												}
												if (device.isWebGPU) {
														var renderPass = new RenderPassLightmapper(device, this.renderer, this.camera, clusteredLightingEnabled ? this.worldClusters : null, rcv, lightArray);
														renderPass.init(tempRT);
														renderPass.render();
														renderPass.destroy();
												} else {
														this.renderer.setCamera(this.camera, tempRT, true);
														if (clusteredLightingEnabled) {
																this.worldClusters.activate();
														}
														this.renderer._forwardTime = 0;
														this.renderer._shadowMapTime = 0;
														this.renderer.renderForward(this.camera, tempRT, rcv, lightArray, SHADER_FORWARD);
														device.updateEnd();
												}
												bakeNode1.renderTargets[pass] = tempRT;
												this.renderTargets.set(lightmapSize, nodeRT);
												for(j = 0; j < rcv.length; j++){
														m = rcv[j];
														m.setRealtimeLightmap(MeshInstance.lightmapParamNames[pass], tempTex);
														m._shaderDefs |= SHADERDEF_LM;
												}
										}
										this.restoreMaterials(rcv);
								}
								bakeLight.endBake(this.shadowMapCache);
						}
				}
				this.postprocessTextures(device, bakeNodes, passCount);
				for(node = 0; node < allNodes.length; node++){
						allNodes[node].restore();
				}
				this.restoreLights(allLights);
				this.restoreScene();
				if (!clusteredLightingEnabled) {
						this.shadowMapCache.clear();
				}
		}
		constructor(device, root, scene, renderer, assets){
				this.device = device;
				this.root = root;
				this.scene = scene;
				this.renderer = renderer;
				this.assets = assets;
				this.shadowMapCache = renderer.shadowMapCache;
				this._tempSet = new Set();
				this._initCalled = false;
				this.passMaterials = [];
				this.ambientAOMaterial = null;
				this.fog = '';
				this.ambientLight = new Color();
				this.renderTargets = new Map();
				this.stats = {
						renderPasses: 0,
						lightmapCount: 0,
						totalRenderTime: 0,
						forwardTime: 0,
						fboTime: 0,
						shadowMapTime: 0,
						compileTime: 0,
						shadersLinked: 0
				};
		}
}

export { Lightmapper };
