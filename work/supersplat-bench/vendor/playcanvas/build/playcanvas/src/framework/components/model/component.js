import { LAYERID_WORLD } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { getShapePrimitive } from '../../graphics/primitive-cache.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class ModelComponent extends Component {
		set meshInstances(value) {
				if (!this._model) {
						return;
				}
				this._model.meshInstances = value;
		}
		get meshInstances() {
				if (!this._model) {
						return null;
				}
				return this._model.meshInstances;
		}
		set customAabb(value) {
				this._customAabb = value;
				if (this._model) {
						var mi = this._model.meshInstances;
						if (mi) {
								for(var i = 0; i < mi.length; i++){
										mi[i].setCustomAabb(this._customAabb);
								}
						}
				}
		}
		get customAabb() {
				return this._customAabb;
		}
		set type(value) {
				if (this._type === value) return;
				this._area = null;
				this._type = value;
				if (value === 'asset') {
						if (this._asset !== null) {
								this._bindModelAsset(this._asset);
						} else {
								this.model = null;
						}
				} else {
						var primData = getShapePrimitive(this.system.app.graphicsDevice, value);
						this._area = primData.area;
						var mesh = primData.mesh;
						var node = new GraphNode();
						var model = new Model();
						model.graph = node;
						model.meshInstances = [
								new MeshInstance(mesh, this._material, node)
						];
						this.model = model;
						this._asset = null;
				}
		}
		get type() {
				return this._type;
		}
		set asset(value) {
				var assets = this.system.app.assets;
				var _id = value;
				if (value instanceof Asset) {
						_id = value.id;
				}
				if (this._asset !== _id) {
						if (this._asset) {
								assets.off("add:" + this._asset, this._onModelAssetAdded, this);
								var _prev = assets.get(this._asset);
								if (_prev) {
										this._unbindModelAsset(_prev);
								}
						}
						this._asset = _id;
						if (this._asset) {
								var asset = assets.get(this._asset);
								if (!asset) {
										this.model = null;
										assets.on("add:" + this._asset, this._onModelAssetAdded, this);
								} else {
										this._bindModelAsset(asset);
								}
						} else {
								this.model = null;
						}
				}
		}
		get asset() {
				return this._asset;
		}
		set model(value) {
				if (this._model === value) {
						return;
				}
				if (value && value._immutable) {
						return;
				}
				if (this._model) {
						this._model._immutable = false;
						this.removeModelFromLayers();
						this._model.getGraph().destroy();
						delete this._model._entity;
						if (this._clonedModel) {
								this._model.destroy();
								this._clonedModel = false;
						}
				}
				this._model = value;
				if (this._model) {
						this._model._immutable = true;
						var meshInstances = this._model.meshInstances;
						for(var i = 0; i < meshInstances.length; i++){
								meshInstances[i].castShadow = this._castShadows;
								meshInstances[i].receiveShadow = this._receiveShadows;
								meshInstances[i].setCustomAabb(this._customAabb);
						}
						this.lightmapped = this._lightmapped;
						this.entity.addChild(this._model.graph);
						if (this.enabled && this.entity.enabled) {
								this.addModelToLayers();
						}
						this._model._entity = this.entity;
						if (this.entity.animation) {
								this.entity.animation.setModel(this._model);
						}
						if (this.entity.anim) {
								this.entity.anim.rebind();
						}
						if (this.type === 'asset') {
								this.mapping = this._mapping;
						} else {
								this._unsetMaterialEvents();
						}
				}
		}
		get model() {
				return this._model;
		}
		set lightmapped(value) {
				if (value !== this._lightmapped) {
						this._lightmapped = value;
						if (this._model) {
								var mi = this._model.meshInstances;
								for(var i = 0; i < mi.length; i++){
										mi[i].setLightmapped(value);
								}
						}
				}
		}
		get lightmapped() {
				return this._lightmapped;
		}
		set castShadows(value) {
				if (this._castShadows === value) return;
				var model = this._model;
				if (model) {
						var layers = this.layers;
						var scene = this.system.app.scene;
						if (this._castShadows && !value) {
								for(var i = 0; i < layers.length; i++){
										var layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
										if (!layer) continue;
										layer.removeShadowCasters(model.meshInstances);
								}
						}
						var meshInstances = model.meshInstances;
						for(var i1 = 0; i1 < meshInstances.length; i1++){
								meshInstances[i1].castShadow = value;
						}
						if (!this._castShadows && value) {
								for(var i2 = 0; i2 < layers.length; i2++){
										var layer1 = scene.layers.getLayerById(layers[i2]);
										if (!layer1) continue;
										layer1.addShadowCasters(model.meshInstances);
								}
						}
				}
				this._castShadows = value;
		}
		get castShadows() {
				return this._castShadows;
		}
		set receiveShadows(value) {
				if (this._receiveShadows === value) return;
				this._receiveShadows = value;
				if (this._model) {
						var meshInstances = this._model.meshInstances;
						for(var i = 0, len = meshInstances.length; i < len; i++){
								meshInstances[i].receiveShadow = value;
						}
				}
		}
		get receiveShadows() {
				return this._receiveShadows;
		}
		set castShadowsLightmap(value) {
				this._castShadowsLightmap = value;
		}
		get castShadowsLightmap() {
				return this._castShadowsLightmap;
		}
		set lightmapSizeMultiplier(value) {
				this._lightmapSizeMultiplier = value;
		}
		get lightmapSizeMultiplier() {
				return this._lightmapSizeMultiplier;
		}
		set layers(value) {
				var layers = this.system.app.scene.layers;
				if (this.meshInstances) {
						for(var i = 0; i < this._layers.length; i++){
								var layer = layers.getLayerById(this._layers[i]);
								if (!layer) continue;
								layer.removeMeshInstances(this.meshInstances);
						}
				}
				this._layers.length = 0;
				for(var i1 = 0; i1 < value.length; i1++){
						this._layers[i1] = value[i1];
				}
				if (!this.enabled || !this.entity.enabled || !this.meshInstances) return;
				for(var i2 = 0; i2 < this._layers.length; i2++){
						var layer1 = layers.getLayerById(this._layers[i2]);
						if (!layer1) continue;
						layer1.addMeshInstances(this.meshInstances);
				}
		}
		get layers() {
				return this._layers;
		}
		set batchGroupId(value) {
				if (this._batchGroupId === value) return;
				if (this.entity.enabled && this._batchGroupId >= 0) {
						var _this_system_app_batcher;
						(_this_system_app_batcher = this.system.app.batcher) == null ? undefined : _this_system_app_batcher.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
				}
				if (this.entity.enabled && value >= 0) {
						var _this_system_app_batcher1;
						(_this_system_app_batcher1 = this.system.app.batcher) == null ? undefined : _this_system_app_batcher1.insert(BatchGroup.MODEL, value, this.entity);
				}
				if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
						this.addModelToLayers();
				}
				this._batchGroupId = value;
		}
		get batchGroupId() {
				return this._batchGroupId;
		}
		set materialAsset(value) {
				var _id = value;
				if (value instanceof Asset) {
						_id = value.id;
				}
				var assets = this.system.app.assets;
				if (_id !== this._materialAsset) {
						if (this._materialAsset) {
								assets.off("add:" + this._materialAsset, this._onMaterialAssetAdd, this);
								var _prev = assets.get(this._materialAsset);
								if (_prev) {
										this._unbindMaterialAsset(_prev);
								}
						}
						this._materialAsset = _id;
						if (this._materialAsset) {
								var asset = assets.get(this._materialAsset);
								if (!asset) {
										this._setMaterial(this.system.defaultMaterial);
										assets.on("add:" + this._materialAsset, this._onMaterialAssetAdd, this);
								} else {
										this._bindMaterialAsset(asset);
								}
						} else {
								this._setMaterial(this.system.defaultMaterial);
						}
				}
		}
		get materialAsset() {
				return this._materialAsset;
		}
		set material(value) {
				if (this._material === value) {
						return;
				}
				this.materialAsset = null;
				this._setMaterial(value);
		}
		get material() {
				return this._material;
		}
		set mapping(value) {
				if (this._type !== 'asset') {
						return;
				}
				this._unsetMaterialEvents();
				if (!value) {
						value = {};
				}
				this._mapping = value;
				if (!this._model) return;
				var meshInstances = this._model.meshInstances;
				var modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
				var assetMapping = modelAsset ? modelAsset.data.mapping : null;
				var asset = null;
				for(var i = 0, len = meshInstances.length; i < len; i++){
						if (value[i] !== undefined) {
								if (value[i]) {
										asset = this.system.app.assets.get(value[i]);
										this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
								} else {
										meshInstances[i].material = this.system.defaultMaterial;
								}
						} else if (assetMapping) {
								if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
										if (assetMapping[i].material !== undefined) {
												asset = this.system.app.assets.get(assetMapping[i].material);
										} else if (assetMapping[i].path !== undefined) {
												var url = this._getMaterialAssetUrl(assetMapping[i].path);
												if (url) {
														asset = this.system.app.assets.getByUrl(url);
												}
										}
										this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
								} else {
										meshInstances[i].material = this.system.defaultMaterial;
								}
						}
				}
		}
		get mapping() {
				return this._mapping;
		}
		addModelToLayers() {
				var layers = this.system.app.scene.layers;
				for(var i = 0; i < this._layers.length; i++){
						var layer = layers.getLayerById(this._layers[i]);
						if (layer) {
								layer.addMeshInstances(this.meshInstances);
						}
				}
		}
		removeModelFromLayers() {
				var layers = this.system.app.scene.layers;
				for(var i = 0; i < this._layers.length; i++){
						var layer = layers.getLayerById(this._layers[i]);
						if (!layer) continue;
						layer.removeMeshInstances(this.meshInstances);
				}
		}
		onRemoveChild() {
				if (this._model) {
						this.removeModelFromLayers();
				}
		}
		onInsertChild() {
				if (this._model && this.enabled && this.entity.enabled) {
						this.addModelToLayers();
				}
		}
		onRemove() {
				this.asset = null;
				this.model = null;
				this.materialAsset = null;
				this._unsetMaterialEvents();
				this.entity.off('remove', this.onRemoveChild, this);
				this.entity.off('insert', this.onInsertChild, this);
		}
		onLayersChanged(oldComp, newComp) {
				this.addModelToLayers();
				oldComp.off('add', this.onLayerAdded, this);
				oldComp.off('remove', this.onLayerRemoved, this);
				newComp.on('add', this.onLayerAdded, this);
				newComp.on('remove', this.onLayerRemoved, this);
		}
		onLayerAdded(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				layer.addMeshInstances(this.meshInstances);
		}
		onLayerRemoved(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				layer.removeMeshInstances(this.meshInstances);
		}
		_setMaterialEvent(index, event, id, handler) {
				var evt = event + ":" + id;
				this.system.app.assets.on(evt, handler, this);
				if (!this._materialEvents) {
						this._materialEvents = [];
				}
				if (!this._materialEvents[index]) {
						this._materialEvents[index] = {};
				}
				this._materialEvents[index][evt] = {
						id: id,
						handler: handler
				};
		}
		_unsetMaterialEvents() {
				var assets = this.system.app.assets;
				var events = this._materialEvents;
				if (!events) {
						return;
				}
				for(var i = 0, len = events.length; i < len; i++){
						if (!events[i]) continue;
						var evt = events[i];
						for(var key in evt){
								assets.off(key, evt[key].handler, this);
						}
				}
				this._materialEvents = null;
		}
		_getAssetByIdOrPath(idOrPath) {
				var asset = null;
				var isPath = isNaN(parseInt(idOrPath, 10));
				if (!isPath) {
						asset = this.system.app.assets.get(idOrPath);
				} else if (this.asset) {
						var url = this._getMaterialAssetUrl(idOrPath);
						if (url) {
								asset = this.system.app.assets.getByUrl(url);
						}
				}
				return asset;
		}
		_getMaterialAssetUrl(path) {
				if (!this.asset) return null;
				var modelAsset = this.system.app.assets.get(this.asset);
				return modelAsset ? modelAsset.getAbsoluteUrl(path) : null;
		}
		_loadAndSetMeshInstanceMaterial(materialAsset, meshInstance, index) {
				var assets = this.system.app.assets;
				if (!materialAsset) {
						return;
				}
				if (materialAsset.resource) {
						meshInstance.material = materialAsset.resource;
						this._setMaterialEvent(index, 'remove', materialAsset.id, function() {
								meshInstance.material = this.system.defaultMaterial;
						});
				} else {
						this._setMaterialEvent(index, 'load', materialAsset.id, function(asset) {
								meshInstance.material = asset.resource;
								this._setMaterialEvent(index, 'remove', materialAsset.id, function() {
										meshInstance.material = this.system.defaultMaterial;
								});
						});
						if (this.enabled && this.entity.enabled) {
								assets.load(materialAsset);
						}
				}
		}
		onEnable() {
				var app = this.system.app;
				var scene = app.scene;
				var layers = scene == null ? undefined : scene.layers;
				this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);
				if (layers) {
						this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
						this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
				}
				var isAsset = this._type === 'asset';
				var asset;
				if (this._model) {
						this.addModelToLayers();
				} else if (isAsset && this._asset) {
						asset = app.assets.get(this._asset);
						if (asset && asset.resource !== this._model) {
								this._bindModelAsset(asset);
						}
				}
				if (this._materialAsset) {
						asset = app.assets.get(this._materialAsset);
						if (asset && asset.resource !== this._material) {
								this._bindMaterialAsset(asset);
						}
				}
				if (isAsset) {
						if (this._mapping) {
								for(var index in this._mapping){
										if (this._mapping[index]) {
												asset = this._getAssetByIdOrPath(this._mapping[index]);
												if (asset && !asset.resource) {
														app.assets.load(asset);
												}
										}
								}
						}
				}
				if (this._batchGroupId >= 0) {
						var _app_batcher;
						(_app_batcher = app.batcher) == null ? undefined : _app_batcher.insert(BatchGroup.MODEL, this.batchGroupId, this.entity);
				}
		}
		onDisable() {
				var _this__evtLayersChanged;
				var app = this.system.app;
				var scene = app.scene;
				var layers = scene.layers;
				(_this__evtLayersChanged = this._evtLayersChanged) == null ? undefined : _this__evtLayersChanged.off();
				this._evtLayersChanged = null;
				if (layers) {
						var _this__evtLayerAdded, _this__evtLayerRemoved;
						(_this__evtLayerAdded = this._evtLayerAdded) == null ? undefined : _this__evtLayerAdded.off();
						this._evtLayerAdded = null;
						(_this__evtLayerRemoved = this._evtLayerRemoved) == null ? undefined : _this__evtLayerRemoved.off();
						this._evtLayerRemoved = null;
				}
				if (this._batchGroupId >= 0) {
						var _app_batcher;
						(_app_batcher = app.batcher) == null ? undefined : _app_batcher.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
				}
				if (this._model) {
						this.removeModelFromLayers();
				}
		}
		hide() {
				if (this._model) {
						var instances = this._model.meshInstances;
						for(var i = 0, l = instances.length; i < l; i++){
								instances[i].visible = false;
						}
				}
		}
		show() {
				if (this._model) {
						var instances = this._model.meshInstances;
						for(var i = 0, l = instances.length; i < l; i++){
								instances[i].visible = true;
						}
				}
		}
		_bindMaterialAsset(asset) {
				asset.on('load', this._onMaterialAssetLoad, this);
				asset.on('unload', this._onMaterialAssetUnload, this);
				asset.on('remove', this._onMaterialAssetRemove, this);
				asset.on('change', this._onMaterialAssetChange, this);
				if (asset.resource) {
						this._onMaterialAssetLoad(asset);
				} else {
						if (!this.enabled || !this.entity.enabled) return;
						this.system.app.assets.load(asset);
				}
		}
		_unbindMaterialAsset(asset) {
				asset.off('load', this._onMaterialAssetLoad, this);
				asset.off('unload', this._onMaterialAssetUnload, this);
				asset.off('remove', this._onMaterialAssetRemove, this);
				asset.off('change', this._onMaterialAssetChange, this);
		}
		_onMaterialAssetAdd(asset) {
				this.system.app.assets.off("add:" + asset.id, this._onMaterialAssetAdd, this);
				if (this._materialAsset === asset.id) {
						this._bindMaterialAsset(asset);
				}
		}
		_onMaterialAssetLoad(asset) {
				this._setMaterial(asset.resource);
		}
		_onMaterialAssetUnload(asset) {
				this._setMaterial(this.system.defaultMaterial);
		}
		_onMaterialAssetRemove(asset) {
				this._onMaterialAssetUnload(asset);
		}
		_onMaterialAssetChange(asset) {}
		_bindModelAsset(asset) {
				this._unbindModelAsset(asset);
				asset.on('load', this._onModelAssetLoad, this);
				asset.on('unload', this._onModelAssetUnload, this);
				asset.on('change', this._onModelAssetChange, this);
				asset.on('remove', this._onModelAssetRemove, this);
				if (asset.resource) {
						this._onModelAssetLoad(asset);
				} else {
						if (!this.enabled || !this.entity.enabled) return;
						this.system.app.assets.load(asset);
				}
		}
		_unbindModelAsset(asset) {
				asset.off('load', this._onModelAssetLoad, this);
				asset.off('unload', this._onModelAssetUnload, this);
				asset.off('change', this._onModelAssetChange, this);
				asset.off('remove', this._onModelAssetRemove, this);
		}
		_onModelAssetAdded(asset) {
				this.system.app.assets.off("add:" + asset.id, this._onModelAssetAdded, this);
				if (asset.id === this._asset) {
						this._bindModelAsset(asset);
				}
		}
		_onModelAssetLoad(asset) {
				this.model = asset.resource.clone();
				this._clonedModel = true;
		}
		_onModelAssetUnload(asset) {
				this.model = null;
		}
		_onModelAssetChange(asset, attr, _new, _old) {
				if (attr === 'data') {
						this.mapping = this._mapping;
				}
		}
		_onModelAssetRemove(asset) {
				this.model = null;
		}
		_setMaterial(material) {
				if (this._material === material) {
						return;
				}
				this._material = material;
				var model = this._model;
				if (model && this._type !== 'asset') {
						var meshInstances = model.meshInstances;
						for(var i = 0, len = meshInstances.length; i < len; i++){
								meshInstances[i].material = material;
						}
				}
		}
		constructor(system, entity){
				super(system, entity), this._type = 'asset', this._asset = null, this._model = null, this._mapping = {}, this._castShadows = true, this._receiveShadows = true, this._materialAsset = null, this._castShadowsLightmap = true, this._lightmapped = false, this._lightmapSizeMultiplier = 1, this.isStatic = false, this._layers = [
						LAYERID_WORLD
				], this._batchGroupId = -1, this._customAabb = null, this._area = null, this._materialEvents = null, this._clonedModel = false, this._evtLayersChanged = null, this._evtLayerAdded = null, this._evtLayerRemoved = null;
				this._material = system.defaultMaterial;
				entity.on('remove', this.onRemoveChild, this);
				entity.on('removehierarchy', this.onRemoveChild, this);
				entity.on('insert', this.onInsertChild, this);
				entity.on('inserthierarchy', this.onInsertChild, this);
		}
}

export { ModelComponent };
