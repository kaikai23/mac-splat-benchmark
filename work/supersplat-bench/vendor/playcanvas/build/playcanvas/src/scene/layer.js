import { hash32Fnv1a } from '../core/hash.js';
import { LIGHTTYPE_DIRECTIONAL, LAYER_FX, SORTMODE_NONE, SORTMODE_CUSTOM, SORTMODE_BACK2FRONT, SORTMODE_FRONT2BACK, SORTMODE_MATERIALMESH, SORTKEY_FORWARD } from './constants.js';
import { Material } from './materials/material.js';

var layerCounter = 0;
var lightKeys = [];
var _tempMaterials = new Set();
function sortManual(drawCallA, drawCallB) {
		return drawCallA.drawOrder - drawCallB.drawOrder;
}
function sortMaterialMesh(drawCallA, drawCallB) {
		var keyA = drawCallA._key[SORTKEY_FORWARD];
		var keyB = drawCallB._key[SORTKEY_FORWARD];
		if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
				return drawCallB.mesh.id - drawCallA.mesh.id;
		}
		return keyB - keyA;
}
function sortBackToFront(drawCallA, drawCallB) {
		return drawCallB.zdist - drawCallA.zdist;
}
function sortFrontToBack(drawCallA, drawCallB) {
		return drawCallA.zdist - drawCallB.zdist;
}
var sortCallbacks = [
		null,
		sortManual,
		sortMaterialMesh,
		sortBackToFront,
		sortFrontToBack
];
class CulledInstances {
		constructor(){
				this.opaque = [];
				this.transparent = [];
		}
}
class Layer {
		set enabled(val) {
				if (val !== this._enabled) {
						this._dirtyComposition = true;
						this._enabled = val;
						if (val) {
								this.incrementCounter();
								if (this.onEnable) this.onEnable();
						} else {
								this.decrementCounter();
								if (this.onDisable) this.onDisable();
						}
				}
		}
		get enabled() {
				return this._enabled;
		}
		set clearColorBuffer(val) {
				this._clearColorBuffer = val;
				this._dirtyComposition = true;
		}
		get clearColorBuffer() {
				return this._clearColorBuffer;
		}
		set clearDepthBuffer(val) {
				this._clearDepthBuffer = val;
				this._dirtyComposition = true;
		}
		get clearDepthBuffer() {
				return this._clearDepthBuffer;
		}
		set clearStencilBuffer(val) {
				this._clearStencilBuffer = val;
				this._dirtyComposition = true;
		}
		get clearStencilBuffer() {
				return this._clearStencilBuffer;
		}
		get hasClusteredLights() {
				return this._clusteredLightsSet.size > 0;
		}
		get clusteredLightsSet() {
				return this._clusteredLightsSet;
		}
		incrementCounter() {
				if (this._refCounter === 0) {
						this._enabled = true;
						if (this.onEnable) this.onEnable();
				}
				this._refCounter++;
		}
		decrementCounter() {
				if (this._refCounter === 1) {
						this._enabled = false;
						if (this.onDisable) this.onDisable();
				} else if (this._refCounter === 0) {
						return;
				}
				this._refCounter--;
		}
		addMeshInstances(meshInstances, skipShadowCasters) {
				var destMeshInstances = this.meshInstances;
				var destMeshInstancesSet = this.meshInstancesSet;
				for(var i = 0; i < meshInstances.length; i++){
						var mi = meshInstances[i];
						if (!destMeshInstancesSet.has(mi)) {
								destMeshInstances.push(mi);
								destMeshInstancesSet.add(mi);
								_tempMaterials.add(mi.material);
						}
				}
				if (!skipShadowCasters) {
						this.addShadowCasters(meshInstances);
				}
				if (_tempMaterials.size > 0) {
						var sceneShaderVer = this._shaderVersion;
						_tempMaterials.forEach((mat)=>{
								if (sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
										if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
												mat.clearVariants();
										}
										mat._shaderVersion = sceneShaderVer;
								}
						});
						_tempMaterials.clear();
				}
		}
		removeMeshInstances(meshInstances, skipShadowCasters) {
				var destMeshInstances = this.meshInstances;
				var destMeshInstancesSet = this.meshInstancesSet;
				for(var i = 0; i < meshInstances.length; i++){
						var mi = meshInstances[i];
						if (destMeshInstancesSet.has(mi)) {
								destMeshInstancesSet.delete(mi);
								var j = destMeshInstances.indexOf(mi);
								if (j >= 0) {
										destMeshInstances.splice(j, 1);
								}
						}
				}
				if (!skipShadowCasters) {
						this.removeShadowCasters(meshInstances);
				}
		}
		addShadowCasters(meshInstances) {
				var shadowCasters = this.shadowCasters;
				var shadowCastersSet = this.shadowCastersSet;
				for(var i = 0; i < meshInstances.length; i++){
						var mi = meshInstances[i];
						if (mi.castShadow && !shadowCastersSet.has(mi)) {
								shadowCastersSet.add(mi);
								shadowCasters.push(mi);
						}
				}
		}
		removeShadowCasters(meshInstances) {
				var shadowCasters = this.shadowCasters;
				var shadowCastersSet = this.shadowCastersSet;
				for(var i = 0; i < meshInstances.length; i++){
						var mi = meshInstances[i];
						if (shadowCastersSet.has(mi)) {
								shadowCastersSet.delete(mi);
								var j = shadowCasters.indexOf(mi);
								if (j >= 0) {
										shadowCasters.splice(j, 1);
								}
						}
				}
		}
		clearMeshInstances(skipShadowCasters) {
				if (skipShadowCasters === undefined) skipShadowCasters = false;
				this.meshInstances.length = 0;
				this.meshInstancesSet.clear();
				if (!skipShadowCasters) {
						this.shadowCasters.length = 0;
						this.shadowCastersSet.clear();
				}
		}
		markLightsDirty() {
				this._lightHashDirty = true;
				this._lightIdHashDirty = true;
				this._splitLightsDirty = true;
		}
		hasLight(light) {
				return this._lightsSet.has(light);
		}
		addLight(light) {
				var l = light.light;
				if (!this._lightsSet.has(l)) {
						this._lightsSet.add(l);
						this._lights.push(l);
						this.markLightsDirty();
				}
				if (l.type !== LIGHTTYPE_DIRECTIONAL) {
						this._clusteredLightsSet.add(l);
				}
		}
		removeLight(light) {
				var l = light.light;
				if (this._lightsSet.has(l)) {
						this._lightsSet.delete(l);
						this._lights.splice(this._lights.indexOf(l), 1);
						this.markLightsDirty();
				}
				if (l.type !== LIGHTTYPE_DIRECTIONAL) {
						this._clusteredLightsSet.delete(l);
				}
		}
		clearLights() {
				this._lightsSet.forEach((light)=>light.removeLayer(this));
				this._lightsSet.clear();
				this._clusteredLightsSet.clear();
				this._lights.length = 0;
				this.markLightsDirty();
		}
		get splitLights() {
				if (this._splitLightsDirty) {
						this._splitLightsDirty = false;
						var splitLights = this._splitLights;
						for(var i = 0; i < splitLights.length; i++){
								splitLights[i].length = 0;
						}
						var lights = this._lights;
						for(var i1 = 0; i1 < lights.length; i1++){
								var light = lights[i1];
								if (light.enabled) {
										splitLights[light._type].push(light);
								}
						}
						for(var i2 = 0; i2 < splitLights.length; i2++){
								splitLights[i2].sort((a, b)=>a.key - b.key);
						}
				}
				return this._splitLights;
		}
		evaluateLightHash(localLights, directionalLights, useIds) {
				var hash = 0;
				var lights = this._lights;
				for(var i = 0; i < lights.length; i++){
						var isLocalLight = lights[i].type !== LIGHTTYPE_DIRECTIONAL;
						if (localLights && isLocalLight || directionalLights && !isLocalLight) {
								lightKeys.push(useIds ? lights[i].id : lights[i].key);
						}
				}
				if (lightKeys.length > 0) {
						lightKeys.sort();
						hash = hash32Fnv1a(lightKeys);
						lightKeys.length = 0;
				}
				return hash;
		}
		getLightHash(isClustered) {
				if (this._lightHashDirty) {
						this._lightHashDirty = false;
						this._lightHash = this.evaluateLightHash(!isClustered, true, false);
				}
				return this._lightHash;
		}
		getLightIdHash() {
				if (this._lightIdHashDirty) {
						this._lightIdHashDirty = false;
						this._lightIdHash = this.evaluateLightHash(true, false, true);
				}
				return this._lightIdHash;
		}
		addCamera(camera) {
				if (!this.camerasSet.has(camera.camera)) {
						this.camerasSet.add(camera.camera);
						this.cameras.push(camera);
						this._dirtyComposition = true;
				}
		}
		removeCamera(camera) {
				if (this.camerasSet.has(camera.camera)) {
						this.camerasSet.delete(camera.camera);
						var index = this.cameras.indexOf(camera);
						this.cameras.splice(index, 1);
						this._dirtyComposition = true;
				}
		}
		clearCameras() {
				this.cameras.length = 0;
				this.camerasSet.clear();
				this._dirtyComposition = true;
		}
		_calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
				for(var i = 0; i < drawCallsCount; i++){
						var drawCall = drawCalls[i];
						if (drawCall.layer <= LAYER_FX) continue;
						if (drawCall.calculateSortDistance) {
								drawCall.zdist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
								continue;
						}
						var meshPos = drawCall.aabb.center;
						var tempx = meshPos.x - camPos.x;
						var tempy = meshPos.y - camPos.y;
						var tempz = meshPos.z - camPos.z;
						drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
				}
		}
		getCulledInstances(camera) {
				var instances = this._visibleInstances.get(camera);
				if (!instances) {
						instances = new CulledInstances();
						this._visibleInstances.set(camera, instances);
				}
				return instances;
		}
		sortVisible(camera, transparent) {
				var sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
				if (sortMode === SORTMODE_NONE) {
						return;
				}
				var culledInstances = this.getCulledInstances(camera);
				var instances = transparent ? culledInstances.transparent : culledInstances.opaque;
				var cameraNode = camera.node;
				if (sortMode === SORTMODE_CUSTOM) {
						var sortPos = cameraNode.getPosition();
						var sortDir = cameraNode.forward;
						if (this.customCalculateSortValues) {
								this.customCalculateSortValues(instances, instances.length, sortPos, sortDir);
						}
						if (this.customSortCallback) {
								instances.sort(this.customSortCallback);
						}
				} else {
						if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
								var sortPos1 = cameraNode.getPosition();
								var sortDir1 = cameraNode.forward;
								this._calculateSortDistances(instances, instances.length, sortPos1, sortDir1);
						}
						instances.sort(sortCallbacks[sortMode]);
				}
		}
		constructor(options = {}){
				this.meshInstances = [];
				this.meshInstancesSet = new Set();
				this.shadowCasters = [];
				this.shadowCastersSet = new Set();
				this._visibleInstances = new WeakMap();
				this._lights = [];
				this._lightsSet = new Set();
				this._clusteredLightsSet = new Set();
				this._splitLights = [
						[],
						[],
						[]
				];
				this._splitLightsDirty = true;
				this.requiresLightCube = false;
				this.cameras = [];
				this.camerasSet = new Set();
				this._dirtyComposition = false;
				if (options.id !== undefined) {
						this.id = options.id;
						layerCounter = Math.max(this.id + 1, layerCounter);
				} else {
						this.id = layerCounter++;
				}
				this.name = options.name;
				var _options_enabled;
				this._enabled = (_options_enabled = options.enabled) != null ? _options_enabled : true;
				this._refCounter = this._enabled ? 1 : 0;
				var _options_opaqueSortMode;
				this.opaqueSortMode = (_options_opaqueSortMode = options.opaqueSortMode) != null ? _options_opaqueSortMode : SORTMODE_MATERIALMESH;
				var _options_transparentSortMode;
				this.transparentSortMode = (_options_transparentSortMode = options.transparentSortMode) != null ? _options_transparentSortMode : SORTMODE_BACK2FRONT;
				if (options.renderTarget) {
						this.renderTarget = options.renderTarget;
				}
				this._clearColorBuffer = !!options.clearColorBuffer;
				this._clearDepthBuffer = !!options.clearDepthBuffer;
				this._clearStencilBuffer = !!options.clearStencilBuffer;
				this.onEnable = options.onEnable;
				this.onDisable = options.onDisable;
				if (this._enabled && this.onEnable) {
						this.onEnable();
				}
				this.customSortCallback = null;
				this.customCalculateSortValues = null;
				this._lightHash = 0;
				this._lightHashDirty = false;
				this._lightIdHash = 0;
				this._lightIdHashDirty = false;
				this._shaderVersion = -1;
		}
}

export { CulledInstances, Layer };
