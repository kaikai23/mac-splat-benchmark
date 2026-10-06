class DeviceCache {
		get(device, onCreate) {
				if (!this._cache.has(device)) {
						this._cache.set(device, onCreate());
						device.on('destroy', ()=>{
								this.remove(device);
						});
						device.on('devicelost', ()=>{
								var _this__cache_get_loseContext, _this__cache_get;
								(_this__cache_get = this._cache.get(device)) == null ? undefined : (_this__cache_get_loseContext = _this__cache_get.loseContext) == null ? undefined : _this__cache_get_loseContext.call(_this__cache_get, device);
						});
				}
				return this._cache.get(device);
		}
		remove(device) {
				var _this__cache_get_destroy, _this__cache_get;
				(_this__cache_get = this._cache.get(device)) == null ? undefined : (_this__cache_get_destroy = _this__cache_get.destroy) == null ? undefined : _this__cache_get_destroy.call(_this__cache_get, device);
				this._cache.delete(device);
		}
		constructor(){
				this._cache = new Map();
		}
}

export { DeviceCache };
