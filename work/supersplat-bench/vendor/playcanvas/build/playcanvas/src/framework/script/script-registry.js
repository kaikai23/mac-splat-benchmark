import { EventHandler } from '../../core/event-handler.js';

class ScriptRegistry extends EventHandler {
		destroy() {
				this.app = null;
				this.off();
		}
		addSchema(id, schema) {
				if (!schema) return;
				this._scriptSchemas.set(id, schema);
		}
		getSchema(id) {
				return this._scriptSchemas.get(id);
		}
		add(script) {
				var scriptName = script.__name;
				if (this._scripts.hasOwnProperty(scriptName)) {
						setTimeout(()=>{
								if (script.prototype.swap) {
										var old = this._scripts[scriptName];
										var ind = this._list.indexOf(old);
										this._list[ind] = script;
										this._scripts[scriptName] = script;
										this.fire('swap', scriptName, script);
										this.fire("swap:" + scriptName, script);
								} else {
										console.warn("script registry already has '" + scriptName + "' script, define 'swap' method for new script type to enable code hot swapping");
								}
						});
						return false;
				}
				this._scripts[scriptName] = script;
				this._list.push(script);
				this.fire('add', scriptName, script);
				this.fire("add:" + scriptName, script);
				setTimeout(()=>{
						if (!this._scripts.hasOwnProperty(scriptName)) {
								return;
						}
						if (!this.app || !this.app.systems || !this.app.systems.script) {
								return;
						}
						var components = this.app.systems.script._components;
						var attributes;
						var scriptInstances = [];
						var scriptInstancesInitialized = [];
						for(components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++){
								var component = components.items[components.loopIndex];
								if (component._scriptsIndex[scriptName] && component._scriptsIndex[scriptName].awaiting) {
										if (component._scriptsData && component._scriptsData[scriptName]) {
												attributes = component._scriptsData[scriptName].attributes;
										}
										var scriptInstance = component.create(scriptName, {
												preloading: true,
												ind: component._scriptsIndex[scriptName].ind,
												attributes: attributes
										});
										if (scriptInstance) {
												scriptInstances.push(scriptInstance);
										}
										for (var _$script of component.scripts){
												component.initializeAttributes(_$script);
										}
								}
						}
						for(var i = 0; i < scriptInstances.length; i++){
								if (scriptInstances[i].enabled) {
										scriptInstances[i]._initialized = true;
										scriptInstancesInitialized.push(scriptInstances[i]);
										if (scriptInstances[i].initialize) {
												scriptInstances[i].initialize();
										}
								}
						}
						for(var i1 = 0; i1 < scriptInstancesInitialized.length; i1++){
								if (!scriptInstancesInitialized[i1].enabled || scriptInstancesInitialized[i1]._postInitialized) {
										continue;
								}
								scriptInstancesInitialized[i1]._postInitialized = true;
								if (scriptInstancesInitialized[i1].postInitialize) {
										scriptInstancesInitialized[i1].postInitialize();
								}
						}
				});
				return true;
		}
		remove(nameOrType) {
				var scriptType = nameOrType;
				var scriptName = nameOrType;
				if (typeof scriptName !== 'string') {
						scriptName = scriptType.__name;
				} else {
						scriptType = this.get(scriptName);
				}
				if (this.get(scriptName) !== scriptType) {
						return false;
				}
				delete this._scripts[scriptName];
				var ind = this._list.indexOf(scriptType);
				this._list.splice(ind, 1);
				this.fire('remove', scriptName, scriptType);
				this.fire("remove:" + scriptName, scriptType);
				return true;
		}
		get(name) {
				return this._scripts[name] || null;
		}
		has(nameOrType) {
				if (typeof nameOrType === 'string') {
						return this._scripts.hasOwnProperty(nameOrType);
				}
				if (!nameOrType) return false;
				var scriptName = nameOrType.__name;
				return this._scripts[scriptName] === nameOrType;
		}
		list() {
				return this._list;
		}
		constructor(app){
				super(), this._scripts = {}, this._list = [], this._scriptSchemas = new Map();
				this.app = app;
		}
}

export { ScriptRegistry };
