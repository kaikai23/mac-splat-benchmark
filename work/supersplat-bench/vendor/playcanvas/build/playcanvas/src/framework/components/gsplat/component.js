import { LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';

class GSplatComponent extends Component {
		set customAabb(value) {
				var _this__instance_meshInstance, _this__instance;
				this._customAabb = value;
				(_this__instance = this._instance) == null ? undefined : (_this__instance_meshInstance = _this__instance.meshInstance) == null ? undefined : _this__instance_meshInstance.setCustomAabb(this._customAabb);
		}
		get customAabb() {
				return this._customAabb;
		}
		set instance(value) {
				var _this__instance;
				this.destroyInstance();
				this._instance = value;
				if ((_this__instance = this._instance) == null ? undefined : _this__instance.meshInstance) {
						var mi = this._instance.meshInstance;
						if (!mi.node) {
								mi.node = this.entity;
						}
						mi.setCustomAabb(this._customAabb);
						if (this._materialOptions) {
								this._instance.createMaterial(this._materialOptions);
						}
						if (this.enabled && this.entity.enabled) {
								this.addToLayers();
						}
				}
		}
		get instance() {
				return this._instance;
		}
		set materialOptions(value) {
				this._materialOptions = Object.assign({}, value);
				if (this._instance) {
						this._instance.createMaterial(this._materialOptions);
				}
		}
		get materialOptions() {
				return this._materialOptions;
		}
		get material() {
				var _this__instance;
				return (_this__instance = this._instance) == null ? undefined : _this__instance.material;
		}
		set layers(value) {
				this.removeFromLayers();
				this._layers.length = 0;
				for(var i = 0; i < value.length; i++){
						this._layers[i] = value[i];
				}
				if (!this.enabled || !this.entity.enabled) {
						return;
				}
				this.addToLayers();
		}
		get layers() {
				return this._layers;
		}
		set asset(value) {
				var id = value instanceof Asset ? value.id : value;
				if (this._assetReference.id === id) return;
				if (this._assetReference.asset && this._assetReference.asset.resource) {
						this._onGSplatAssetRemove();
				}
				this._assetReference.id = id;
				if (this._assetReference.asset) {
						this._onGSplatAssetAdded();
				}
		}
		get asset() {
				return this._assetReference.id;
		}
		assignAsset(asset) {
				var id = asset instanceof Asset ? asset.id : asset;
				this._assetReference.id = id;
		}
		destroyInstance() {
				if (this._instance) {
						var _this__instance;
						this.removeFromLayers();
						(_this__instance = this._instance) == null ? undefined : _this__instance.destroy();
						this._instance = null;
				}
		}
		addToLayers() {
				var _this_instance;
				var meshInstance = (_this_instance = this.instance) == null ? undefined : _this_instance.meshInstance;
				if (meshInstance) {
						var layers = this.system.app.scene.layers;
						for(var i = 0; i < this._layers.length; i++){
								var _layers_getLayerById;
								(_layers_getLayerById = layers.getLayerById(this._layers[i])) == null ? undefined : _layers_getLayerById.addMeshInstances([
										meshInstance
								]);
						}
				}
		}
		removeFromLayers() {
				var _this_instance;
				var meshInstance = (_this_instance = this.instance) == null ? undefined : _this_instance.meshInstance;
				if (meshInstance) {
						var layers = this.system.app.scene.layers;
						for(var i = 0; i < this._layers.length; i++){
								var _layers_getLayerById;
								(_layers_getLayerById = layers.getLayerById(this._layers[i])) == null ? undefined : _layers_getLayerById.removeMeshInstances([
										meshInstance
								]);
						}
				}
		}
		onRemoveChild() {
				this.removeFromLayers();
		}
		onInsertChild() {
				if (this._instance && this.enabled && this.entity.enabled) {
						this.addToLayers();
				}
		}
		onRemove() {
				this.destroyInstance();
				this.asset = null;
				this._assetReference.id = null;
				this.entity.off('remove', this.onRemoveChild, this);
				this.entity.off('insert', this.onInsertChild, this);
		}
		onLayersChanged(oldComp, newComp) {
				this.addToLayers();
				oldComp.off('add', this.onLayerAdded, this);
				oldComp.off('remove', this.onLayerRemoved, this);
				newComp.on('add', this.onLayerAdded, this);
				newComp.on('remove', this.onLayerRemoved, this);
		}
		onLayerAdded(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				if (this._instance) {
						layer.addMeshInstances(this._instance.meshInstance);
				}
		}
		onLayerRemoved(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				if (this._instance) {
						layer.removeMeshInstances(this._instance.meshInstance);
				}
		}
		onEnable() {
				var scene = this.system.app.scene;
				var layers = scene.layers;
				this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);
				if (layers) {
						this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
						this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
				}
				if (this._instance) {
						this.addToLayers();
				} else if (this.asset) {
						this._onGSplatAssetAdded();
				}
		}
		onDisable() {
				var _this__evtLayersChanged;
				var scene = this.system.app.scene;
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
				this.removeFromLayers();
		}
		hide() {
				if (this._instance) {
						this._instance.meshInstance.visible = false;
				}
		}
		show() {
				if (this._instance) {
						this._instance.meshInstance.visible = true;
				}
		}
		_onGSplatAssetAdded() {
				if (!this._assetReference.asset) {
						return;
				}
				if (this._assetReference.asset.resource) {
						this._onGSplatAssetLoad();
				} else if (this.enabled && this.entity.enabled) {
						this.system.app.assets.load(this._assetReference.asset);
				}
		}
		_onGSplatAssetLoad() {
				this.destroyInstance();
				var asset = this._assetReference.asset;
				if (asset) {
						this.instance = asset.resource.createInstance();
				}
		}
		_onGSplatAssetUnload() {
				this.destroyInstance();
		}
		_onGSplatAssetRemove() {
				this._onGSplatAssetUnload();
		}
		constructor(system, entity){
				super(system, entity), this._layers = [
						LAYERID_WORLD
				], this._instance = null, this._customAabb = null, this._materialOptions = null, this._evtLayersChanged = null, this._evtLayerAdded = null, this._evtLayerRemoved = null;
				this._assetReference = new AssetReference('asset', this, system.app.assets, {
						add: this._onGSplatAssetAdded,
						load: this._onGSplatAssetLoad,
						remove: this._onGSplatAssetRemove,
						unload: this._onGSplatAssetUnload
				}, this);
				entity.on('remove', this.onRemoveChild, this);
				entity.on('removehierarchy', this.onRemoveChild, this);
				entity.on('insert', this.onInsertChild, this);
				entity.on('inserthierarchy', this.onInsertChild, this);
		}
}

export { GSplatComponent };
