import { EventHandler } from '../../core/event-handler.js';

class Component extends EventHandler {
		static _buildAccessors(obj, schema) {
				schema.forEach((descriptor)=>{
						var name = typeof descriptor === 'object' ? descriptor.name : descriptor;
						Object.defineProperty(obj, name, {
								get: function get() {
										return this.data[name];
								},
								set: function set(value) {
										var data = this.data;
										var oldValue = data[name];
										data[name] = value;
										this.fire('set', name, oldValue, value);
								},
								configurable: true
						});
				});
				obj._accessorsBuilt = true;
		}
		buildAccessors(schema) {
				Component._buildAccessors(this, schema);
		}
		onSetEnabled(name, oldValue, newValue) {
				if (oldValue !== newValue) {
						if (this.entity.enabled) {
								if (newValue) {
										this.onEnable();
								} else {
										this.onDisable();
								}
						}
				}
		}
		onEnable() {}
		onDisable() {}
		onPostStateChange() {}
		get data() {
				var record = this.system.store[this.entity.getGuid()];
				return record ? record.data : null;
		}
		set enabled(arg) {}
		get enabled() {
				return true;
		}
		constructor(system, entity){
				super();
				this.system = system;
				this.entity = entity;
				if (this.system.schema && !this._accessorsBuilt) {
						this.buildAccessors(this.system.schema);
				}
				this.on('set', function(name, oldValue, newValue) {
						this.fire("set_" + name, name, oldValue, newValue);
				});
				this.on('set_enabled', this.onSetEnabled, this);
		}
}
Component.order = 0;

export { Component };
