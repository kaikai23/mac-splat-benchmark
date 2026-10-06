import { EventHandle } from './event-handle.js';

class EventHandler {
		initEventHandler() {
				this._callbacks = new Map();
				this._callbackActive = new Map();
		}
		_addCallback(name, callback, scope, once) {
				if (!this._callbacks.has(name)) {
						this._callbacks.set(name, []);
				}
				if (this._callbackActive.has(name)) {
						var callbackActive = this._callbackActive.get(name);
						if (callbackActive && callbackActive === this._callbacks.get(name)) {
								this._callbackActive.set(name, callbackActive.slice());
						}
				}
				var evt = new EventHandle(this, name, callback, scope, once);
				this._callbacks.get(name).push(evt);
				return evt;
		}
		on(name, callback, scope) {
				if (scope === undefined) scope = this;
				return this._addCallback(name, callback, scope, false);
		}
		once(name, callback, scope) {
				if (scope === undefined) scope = this;
				return this._addCallback(name, callback, scope, true);
		}
		off(name, callback, scope) {
				if (name) {
						if (this._callbackActive.has(name) && this._callbackActive.get(name) === this._callbacks.get(name)) {
								this._callbackActive.set(name, this._callbackActive.get(name).slice());
						}
				} else {
						for (var [key, callbacks] of this._callbackActive){
								if (!this._callbacks.has(key)) {
										continue;
								}
								if (this._callbacks.get(key) !== callbacks) {
										continue;
								}
								this._callbackActive.set(key, callbacks.slice());
						}
				}
				if (!name) {
						for (var callbacks1 of this._callbacks.values()){
								for(var i = 0; i < callbacks1.length; i++){
										callbacks1[i].removed = true;
								}
						}
						this._callbacks.clear();
				} else if (!callback) {
						var callbacks2 = this._callbacks.get(name);
						if (callbacks2) {
								for(var i1 = 0; i1 < callbacks2.length; i1++){
										callbacks2[i1].removed = true;
								}
								this._callbacks.delete(name);
						}
				} else {
						var callbacks3 = this._callbacks.get(name);
						if (!callbacks3) {
								return this;
						}
						for(var i2 = 0; i2 < callbacks3.length; i2++){
								if (callbacks3[i2].callback !== callback) {
										continue;
								}
								if (scope && callbacks3[i2].scope !== scope) {
										continue;
								}
								callbacks3[i2].removed = true;
								callbacks3.splice(i2, 1);
								i2--;
						}
						if (callbacks3.length === 0) {
								this._callbacks.delete(name);
						}
				}
				return this;
		}
		offByHandle(handle) {
				var name = handle.name;
				handle.removed = true;
				if (this._callbackActive.has(name) && this._callbackActive.get(name) === this._callbacks.get(name)) {
						this._callbackActive.set(name, this._callbackActive.get(name).slice());
				}
				var callbacks = this._callbacks.get(name);
				if (!callbacks) {
						return this;
				}
				var ind = callbacks.indexOf(handle);
				if (ind !== -1) {
						callbacks.splice(ind, 1);
						if (callbacks.length === 0) {
								this._callbacks.delete(name);
						}
				}
				return this;
		}
		fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
				if (!name) {
						return this;
				}
				var callbacksInitial = this._callbacks.get(name);
				if (!callbacksInitial) {
						return this;
				}
				var callbacks;
				if (!this._callbackActive.has(name)) {
						this._callbackActive.set(name, callbacksInitial);
				} else if (this._callbackActive.get(name) !== callbacksInitial) {
						callbacks = callbacksInitial.slice();
				}
				for(var i = 0; (callbacks || this._callbackActive.get(name)) && i < (callbacks || this._callbackActive.get(name)).length; i++){
						var evt = (callbacks || this._callbackActive.get(name))[i];
						if (!evt.callback) continue;
						evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
						if (evt._once) {
								var existingCallback = this._callbacks.get(name);
								var ind = existingCallback ? existingCallback.indexOf(evt) : -1;
								if (ind !== -1) {
										if (this._callbackActive.get(name) === existingCallback) {
												this._callbackActive.set(name, this._callbackActive.get(name).slice());
										}
										var callbacks1 = this._callbacks.get(name);
										if (!callbacks1) continue;
										callbacks1[ind].removed = true;
										callbacks1.splice(ind, 1);
										if (callbacks1.length === 0) {
												this._callbacks.delete(name);
										}
								}
						}
				}
				if (!callbacks) {
						this._callbackActive.delete(name);
				}
				return this;
		}
		hasEvent(name) {
				var _this__callbacks_get;
				return !!((_this__callbacks_get = this._callbacks.get(name)) == null ? undefined : _this__callbacks_get.length);
		}
		constructor(){
				this._callbacks = new Map();
				this._callbackActive = new Map();
		}
}

export { EventHandler };
