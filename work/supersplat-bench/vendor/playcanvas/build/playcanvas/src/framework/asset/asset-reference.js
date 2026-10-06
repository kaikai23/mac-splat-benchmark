class AssetReference {
		set id(value) {
				if (this.url) throw Error('Can\'t set id and url');
				this._unbind();
				this._id = value;
				this.asset = this._registry.get(this._id);
				this._bind();
		}
		get id() {
				return this._id;
		}
		set url(value) {
				if (this.id) throw Error('Can\'t set id and url');
				this._unbind();
				this._url = value;
				this.asset = this._registry.getByUrl(this._url);
				this._bind();
		}
		get url() {
				return this._url;
		}
		_bind() {
				if (this.id) {
						if (this._onAssetLoad) this._evtLoadById = this._registry.on("load:" + this.id, this._onLoad, this);
						if (this._onAssetAdd) this._evtAddById = this._registry.once("add:" + this.id, this._onAdd, this);
						if (this._onAssetRemove) this._evtRemoveById = this._registry.on("remove:" + this.id, this._onRemove, this);
						if (this._onAssetUnload) this._evtUnloadById = this._registry.on("unload:" + this.id, this._onUnload, this);
				}
				if (this.url) {
						if (this._onAssetLoad) this._evtLoadByUrl = this._registry.on("load:url:" + this.url, this._onLoad, this);
						if (this._onAssetAdd) this._evtAddByUrl = this._registry.once("add:url:" + this.url, this._onAdd, this);
						if (this._onAssetRemove) this._evtRemoveByUrl = this._registry.on("remove:url:" + this.url, this._onRemove, this);
				}
		}
		_unbind() {
				if (this.id) {
						var _this__evtLoadById, _this__evtAddById, _this__evtRemoveById, _this__evtUnloadById;
						(_this__evtLoadById = this._evtLoadById) == null ? undefined : _this__evtLoadById.off();
						this._evtLoadById = null;
						(_this__evtAddById = this._evtAddById) == null ? undefined : _this__evtAddById.off();
						this._evtAddById = null;
						(_this__evtRemoveById = this._evtRemoveById) == null ? undefined : _this__evtRemoveById.off();
						this._evtRemoveById = null;
						(_this__evtUnloadById = this._evtUnloadById) == null ? undefined : _this__evtUnloadById.off();
						this._evtUnloadById = null;
				}
				if (this.url) {
						var _this__evtLoadByUrl, _this__evtAddByUrl, _this__evtRemoveByUrl;
						(_this__evtLoadByUrl = this._evtLoadByUrl) == null ? undefined : _this__evtLoadByUrl.off();
						this._evtLoadByUrl = null;
						(_this__evtAddByUrl = this._evtAddByUrl) == null ? undefined : _this__evtAddByUrl.off();
						this._evtAddByUrl = null;
						(_this__evtRemoveByUrl = this._evtRemoveByUrl) == null ? undefined : _this__evtRemoveByUrl.off();
						this._evtRemoveByUrl = null;
				}
		}
		_onLoad(asset) {
				this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
		}
		_onAdd(asset) {
				this.asset = asset;
				this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
		}
		_onRemove(asset) {
				this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
				this.asset = null;
		}
		_onUnload(asset) {
				this._onAssetUnload.call(this._scope, this.propertyName, this.parent, asset);
		}
		constructor(propertyName, parent, registry, callbacks, scope){
				this._evtLoadById = null;
				this._evtUnloadById = null;
				this._evtAddById = null;
				this._evtRemoveById = null;
				this._evtLoadByUrl = null;
				this._evtAddByUrl = null;
				this._evtRemoveByUrl = null;
				this.propertyName = propertyName;
				this.parent = parent;
				this._scope = scope;
				this._registry = registry;
				this.id = null;
				this.url = null;
				this.asset = null;
				this._onAssetLoad = callbacks.load;
				this._onAssetAdd = callbacks.add;
				this._onAssetRemove = callbacks.remove;
				this._onAssetUnload = callbacks.unload;
		}
}

export { AssetReference };
