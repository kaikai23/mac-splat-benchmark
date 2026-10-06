import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';
import { BindGroup } from '../platform/graphics/bind-group.js';
import { UniformBuffer } from '../platform/graphics/uniform-buffer.js';
import { SHADERDEF_NOSHADOW, SHADERDEF_BATCH, SHADERDEF_SKIN, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED_INT, SHADERDEF_SCREENSPACE, SORTKEY_FORWARD, BLEND_NORMAL, BLEND_NONE, SHADERDEF_INSTANCING, MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC, LAYER_WORLD, RENDERSTYLE_SOLID, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS } from './constants.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { LightmapCache } from './graphics/lightmap-cache.js';
import { hash32Fnv1a } from '../core/hash.js';

var id = 0;
var _tmpAabb = new BoundingBox();
var _tempBoneAabb = new BoundingBox();
var _tempSphere = new BoundingSphere();
var _meshSet = new Set();
var lookupHashes = new Uint32Array(4);
class InstancingData {
		destroy() {
				if (this._destroyVertexBuffer) {
						var _this_vertexBuffer;
						(_this_vertexBuffer = this.vertexBuffer) == null ? undefined : _this_vertexBuffer.destroy();
				}
				this.vertexBuffer = null;
		}
		constructor(numObjects){
				this.vertexBuffer = null;
				this._destroyVertexBuffer = false;
				this.count = numObjects;
		}
}
class ShaderInstance {
		getBindGroup(device) {
				if (!this.bindGroup) {
						var shader = this.shader;
						var bindGroupFormat = shader.meshBindGroupFormat;
						this.bindGroup = new BindGroup(device, bindGroupFormat);
				}
				return this.bindGroup;
		}
		getUniformBuffer(device) {
				if (!this.uniformBuffer) {
						var shader = this.shader;
						var ubFormat = shader.meshUniformBufferFormat;
						this.uniformBuffer = new UniformBuffer(device, ubFormat, false);
				}
				return this.uniformBuffer;
		}
		destroy() {
				var _this_bindGroup, _this_uniformBuffer;
				(_this_bindGroup = this.bindGroup) == null ? undefined : _this_bindGroup.destroy();
				this.bindGroup = null;
				(_this_uniformBuffer = this.uniformBuffer) == null ? undefined : _this_uniformBuffer.destroy();
				this.uniformBuffer = null;
		}
		constructor(){
				this.bindGroup = null;
				this.uniformBuffer = null;
		}
}
class MeshInstance {
		set renderStyle(renderStyle) {
				this._renderStyle = renderStyle;
				this.mesh.prepareRenderState(renderStyle);
		}
		get renderStyle() {
				return this._renderStyle;
		}
		set mesh(mesh) {
				if (mesh === this._mesh) {
						return;
				}
				if (this._mesh) {
						this._mesh.decRefCount();
				}
				this._mesh = mesh;
				if (mesh) {
						mesh.incRefCount();
				}
		}
		get mesh() {
				return this._mesh;
		}
		set aabb(aabb) {
				this._aabb = aabb;
		}
		get aabb() {
				if (!this._updateAabb) {
						return this._aabb;
				}
				if (this._updateAabbFunc) {
						return this._updateAabbFunc(this._aabb);
				}
				var localAabb = this._customAabb;
				var toWorldSpace = !!localAabb;
				if (!localAabb) {
						localAabb = _tmpAabb;
						if (this.skinInstance) {
								if (!this.mesh.boneAabb) {
										var morphTargets = this._morphInstance ? this._morphInstance.morph._targets : null;
										this.mesh._initBoneAabbs(morphTargets);
								}
								var boneUsed = this.mesh.boneUsed;
								var first = true;
								for(var i = 0; i < this.mesh.boneAabb.length; i++){
										if (boneUsed[i]) {
												_tempBoneAabb.setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);
												if (first) {
														first = false;
														localAabb.center.copy(_tempBoneAabb.center);
														localAabb.halfExtents.copy(_tempBoneAabb.halfExtents);
												} else {
														localAabb.add(_tempBoneAabb);
												}
										}
								}
								toWorldSpace = true;
						} else if (this.node._aabbVer !== this._aabbVer || this.mesh._aabbVer !== this._aabbMeshVer) {
								if (this.mesh) {
										localAabb.center.copy(this.mesh.aabb.center);
										localAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
								} else {
										localAabb.center.set(0, 0, 0);
										localAabb.halfExtents.set(0, 0, 0);
								}
								if (this.mesh && this.mesh.morph) {
										var morphAabb = this.mesh.morph.aabb;
										localAabb._expand(morphAabb.getMin(), morphAabb.getMax());
								}
								toWorldSpace = true;
								this._aabbVer = this.node._aabbVer;
								this._aabbMeshVer = this.mesh._aabbVer;
						}
				}
				if (toWorldSpace) {
						this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
				}
				return this._aabb;
		}
		clearShaders() {
				this._shaderCache.forEach((shaderInstance)=>{
						shaderInstance.destroy();
				});
				this._shaderCache.clear();
		}
		getShaderInstance(shaderPass, lightHash, scene, cameraShaderParams, viewUniformFormat, viewBindGroupFormat, sortedLights) {
				var shaderDefs = this._shaderDefs;
				lookupHashes[0] = shaderPass;
				lookupHashes[1] = lightHash;
				lookupHashes[2] = shaderDefs;
				lookupHashes[3] = cameraShaderParams.hash;
				var hash = hash32Fnv1a(lookupHashes);
				var shaderInstance = this._shaderCache.get(hash);
				if (!shaderInstance) {
						var mat = this._material;
						shaderInstance = new ShaderInstance();
						shaderInstance.shader = mat.variants.get(hash);
						shaderInstance.hashes = new Uint32Array(lookupHashes);
						if (!shaderInstance.shader) {
								var _this_mesh_vertexBuffer;
								var shader = mat.getShaderVariant({
										device: this.mesh.device,
										scene: scene,
										objDefs: shaderDefs,
										cameraShaderParams: cameraShaderParams,
										pass: shaderPass,
										sortedLights: sortedLights,
										viewUniformFormat: viewUniformFormat,
										viewBindGroupFormat: viewBindGroupFormat,
										vertexFormat: (_this_mesh_vertexBuffer = this.mesh.vertexBuffer) == null ? undefined : _this_mesh_vertexBuffer.format
								});
								mat.variants.set(hash, shader);
								shaderInstance.shader = shader;
						}
						this._shaderCache.set(hash, shaderInstance);
				}
				return shaderInstance;
		}
		set material(material) {
				this.clearShaders();
				var prevMat = this._material;
				if (prevMat) {
						prevMat.removeMeshInstanceRef(this);
				}
				this._material = material;
				if (material) {
						material.addMeshInstanceRef(this);
						this.transparent = material.transparent;
						this.updateKey();
				}
		}
		get material() {
				return this._material;
		}
		set layer(layer) {
				this._layer = layer;
				this.updateKey();
		}
		get layer() {
				return this._layer;
		}
		_updateShaderDefs(shaderDefs) {
				if (shaderDefs !== this._shaderDefs) {
						this._shaderDefs = shaderDefs;
						this.clearShaders();
				}
		}
		set calculateSortDistance(calculateSortDistance) {
				this._calculateSortDistance = calculateSortDistance;
		}
		get calculateSortDistance() {
				return this._calculateSortDistance;
		}
		set receiveShadow(val) {
				if (this._receiveShadow !== val) {
						this._receiveShadow = val;
						this._updateShaderDefs(val ? this._shaderDefs & -2 : this._shaderDefs | SHADERDEF_NOSHADOW);
				}
		}
		get receiveShadow() {
				return this._receiveShadow;
		}
		set batching(val) {
				this._updateShaderDefs(val ? this._shaderDefs | SHADERDEF_BATCH : this._shaderDefs & -16385);
		}
		get batching() {
				return (this._shaderDefs & SHADERDEF_BATCH) !== 0;
		}
		set skinInstance(val) {
				this._skinInstance = val;
				this._updateShaderDefs(val ? this._shaderDefs | SHADERDEF_SKIN : this._shaderDefs & -3);
				this._setupSkinUpdate();
		}
		get skinInstance() {
				return this._skinInstance;
		}
		set morphInstance(val) {
				var _this__morphInstance;
				(_this__morphInstance = this._morphInstance) == null ? undefined : _this__morphInstance.destroy();
				this._morphInstance = val;
				var shaderDefs = this._shaderDefs;
				shaderDefs = val && val.morph.morphPositions ? shaderDefs | SHADERDEF_MORPH_POSITION : shaderDefs & -1025;
				shaderDefs = val && val.morph.morphNormals ? shaderDefs | SHADERDEF_MORPH_NORMAL : shaderDefs & -2049;
				shaderDefs = val && val.morph.intRenderFormat ? shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED_INT : shaderDefs & -8193;
				this._updateShaderDefs(shaderDefs);
		}
		get morphInstance() {
				return this._morphInstance;
		}
		set screenSpace(val) {
				if (this._screenSpace !== val) {
						this._screenSpace = val;
						this._updateShaderDefs(val ? this._shaderDefs | SHADERDEF_SCREENSPACE : this._shaderDefs & -257);
				}
		}
		get screenSpace() {
				return this._screenSpace;
		}
		set key(val) {
				this._key[SORTKEY_FORWARD] = val;
		}
		get key() {
				return this._key[SORTKEY_FORWARD];
		}
		set mask(val) {
				var toggles = this._shaderDefs & 0x0000FFFF;
				this._updateShaderDefs(toggles | val << 16);
		}
		get mask() {
				return this._shaderDefs >> 16;
		}
		set instancingCount(value) {
				if (this.instancingData) {
						this.instancingData.count = value;
				}
		}
		get instancingCount() {
				return this.instancingData ? this.instancingData.count : 0;
		}
		destroy() {
				var _this__skinInstance, _this_morphInstance, _this_instancingData;
				var mesh = this.mesh;
				if (mesh) {
						this.mesh = null;
						if (mesh.refCount < 1) {
								mesh.destroy();
						}
				}
				this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
				this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
				(_this__skinInstance = this._skinInstance) == null ? undefined : _this__skinInstance.destroy();
				this._skinInstance = null;
				(_this_morphInstance = this.morphInstance) == null ? undefined : _this_morphInstance.destroy();
				this.morphInstance = null;
				this.clearShaders();
				this.material = null;
				(_this_instancingData = this.instancingData) == null ? undefined : _this_instancingData.destroy();
		}
		static _prepareRenderStyleForArray(meshInstances, renderStyle) {
				if (meshInstances) {
						for(var i = 0; i < meshInstances.length; i++){
								meshInstances[i]._renderStyle = renderStyle;
								var mesh = meshInstances[i].mesh;
								if (!_meshSet.has(mesh)) {
										_meshSet.add(mesh);
										mesh.prepareRenderState(renderStyle);
								}
						}
						_meshSet.clear();
				}
		}
		_isVisible(camera) {
				if (this.visible) {
						if (this.isVisibleFunc) {
								return this.isVisibleFunc(camera);
						}
						_tempSphere.center = this.aabb.center;
						_tempSphere.radius = this._aabb.halfExtents.length();
						return camera.frustum.containsSphere(_tempSphere) > 0;
				}
				return false;
		}
		updateKey() {
				var material = this.material;
				var blendType = material.alphaToCoverage || material.alphaTest ? BLEND_NORMAL : material.blendType;
				this._key[SORTKEY_FORWARD] = (this.layer & 0x0f) << 27 | (blendType === BLEND_NONE ? 1 : 0) << 26 | (material.id & 0x1ffffff) << 0;
		}
		setInstancing(vertexBuffer, cull) {
				if (cull === undefined) cull = false;
				if (vertexBuffer) {
						this.instancingData = new InstancingData(vertexBuffer.numVertices);
						this.instancingData.vertexBuffer = vertexBuffer;
						vertexBuffer.format.instancing = true;
						this.cull = cull;
				} else {
						this.instancingData = null;
						this.cull = true;
				}
				this._updateShaderDefs(vertexBuffer ? this._shaderDefs | SHADERDEF_INSTANCING : this._shaderDefs & -33);
		}
		ensureMaterial(device) {
				if (!this.material) {
						this.material = getDefaultMaterial(device);
				}
		}
		clearParameters() {
				this.parameters = {};
		}
		getParameters() {
				return this.parameters;
		}
		getParameter(name) {
				return this.parameters[name];
		}
		setParameter(name, data, passFlags) {
				if (passFlags === undefined) passFlags = 0xFFFFFFFF;
				var param = this.parameters[name];
				if (param) {
						param.data = data;
						param.passFlags = passFlags;
				} else {
						this.parameters[name] = {
								scopeId: null,
								data: data,
								passFlags: passFlags
						};
				}
		}
		setRealtimeLightmap(name, texture) {
				var old = this.getParameter(name);
				if (old === texture) {
						return;
				}
				if (old) {
						LightmapCache.decRef(old.data);
				}
				if (texture) {
						LightmapCache.incRef(texture);
						this.setParameter(name, texture);
				} else {
						this.deleteParameter(name);
				}
		}
		deleteParameter(name) {
				if (this.parameters[name]) {
						delete this.parameters[name];
				}
		}
		setParameters(device, passFlag) {
				var parameters = this.parameters;
				for(var paramName in parameters){
						var parameter = parameters[paramName];
						if (parameter.passFlags & passFlag) {
								if (!parameter.scopeId) {
										parameter.scopeId = device.scope.resolve(paramName);
								}
								parameter.scopeId.setValue(parameter.data);
						}
				}
		}
		setLightmapped(value) {
				if (value) {
						this.mask = (this.mask | MASK_AFFECT_LIGHTMAPPED) & -6;
				} else {
						this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
						this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
						this._shaderDefs &= -4289;
						this.mask = (this.mask | MASK_AFFECT_DYNAMIC) & -7;
				}
		}
		setCustomAabb(aabb) {
				if (aabb) {
						if (this._customAabb) {
								this._customAabb.copy(aabb);
						} else {
								this._customAabb = aabb.clone();
						}
				} else {
						this._customAabb = null;
						this._aabbVer = -1;
				}
				this._setupSkinUpdate();
		}
		_setupSkinUpdate() {
				if (this._skinInstance) {
						this._skinInstance._updateBeforeCull = !this._customAabb;
				}
		}
		constructor(mesh, material, node = null){
				this.castShadow = false;
				this.cull = true;
				this.drawOrder = 0;
				this.visible = true;
				this.visibleThisFrame = false;
				this.flipFacesFactor = 1;
				this.gsplatInstance = null;
				this.id = id++;
				this.isVisibleFunc = null;
				this.instancingData = null;
				this.parameters = {};
				this.pick = true;
				this.stencilFront = null;
				this.stencilBack = null;
				this.transparent = false;
				this._aabb = new BoundingBox();
				this._aabbVer = -1;
				this._aabbMeshVer = -1;
				this._customAabb = null;
				this._updateAabb = true;
				this._updateAabbFunc = null;
				this._key = [
						0,
						0
				];
				this._layer = LAYER_WORLD;
				this._material = null;
				this._skinInstance = null;
				this._morphInstance = null;
				this._receiveShadow = true;
				this._renderStyle = RENDERSTYLE_SOLID;
				this._screenSpace = false;
				this._shaderCache = new Map();
				this._shaderDefs = MASK_AFFECT_DYNAMIC << 16;
				this._calculateSortDistance = null;
				this.node = node;
				this._mesh = mesh;
				mesh.incRefCount();
				this.material = material;
				if (mesh.vertexBuffer) {
						var format = mesh.vertexBuffer.format;
						this._shaderDefs |= format.hasUv0 ? SHADERDEF_UV0 : 0;
						this._shaderDefs |= format.hasUv1 ? SHADERDEF_UV1 : 0;
						this._shaderDefs |= format.hasColor ? SHADERDEF_VCOLOR : 0;
						this._shaderDefs |= format.hasTangents ? SHADERDEF_TANGENTS : 0;
				}
				this.updateKey();
		}
}
MeshInstance.lightmapParamNames = [
		'texture_lightMap',
		'texture_dirLightMap'
];

export { MeshInstance };
