import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ComponentSystem } from '../system.js';
import { ScriptComponent } from './component.js';
import { ScriptComponentData } from './data.js';

var METHOD_INITIALIZE_ATTRIBUTES = '_onInitializeAttributes';
var METHOD_INITIALIZE = '_onInitialize';
var METHOD_POST_INITIALIZE = '_onPostInitialize';
var METHOD_UPDATE = '_onUpdate';
var METHOD_POST_UPDATE = '_onPostUpdate';
var executionOrderCounter = 0;
class ScriptComponentSystem extends ComponentSystem {
		initializeComponentData(component, data) {
				component._executionOrder = executionOrderCounter++;
				this._components.append(component);
				if (executionOrderCounter > Number.MAX_SAFE_INTEGER) {
						this._resetExecutionOrder();
				}
				component.enabled = data.hasOwnProperty('enabled') ? !!data.enabled : true;
				if (component.enabled && component.entity.enabled) {
						this._enabledComponents.append(component);
				}
				if (data.hasOwnProperty('order') && data.hasOwnProperty("scripts")) {
						component._scriptsData = data.scripts;
						for(var i = 0; i < data.order.length; i++){
								component.create(data.order[i], {
										enabled: data.scripts[data.order[i]].enabled,
										attributes: data.scripts[data.order[i]].attributes,
										preloading: this.preloading
								});
						}
				}
		}
		cloneComponent(entity, clone) {
				var order = [];
				var scripts = {};
				for(var i = 0; i < entity.script._scripts.length; i++){
						var _entity_script__attributeDataMap;
						var scriptInstance = entity.script._scripts[i];
						var scriptName = scriptInstance.__scriptType.__name;
						order.push(scriptName);
						var attributes = ((_entity_script__attributeDataMap = entity.script._attributeDataMap) == null ? undefined : _entity_script__attributeDataMap.get(scriptName)) || {};
						for(var key in scriptInstance.__attributes){
								attributes[key] = scriptInstance.__attributes[key];
						}
						scripts[scriptName] = {
								enabled: scriptInstance._enabled,
								attributes: attributes
						};
				}
				for(var key1 in entity.script._scriptsIndex){
						if (key1.awaiting) {
								order.splice(key1.ind, 0, key1);
						}
				}
				var data = {
						enabled: entity.script.enabled,
						order: order,
						scripts: scripts
				};
				return this.addComponent(clone, data);
		}
		_resetExecutionOrder() {
				executionOrderCounter = 0;
				for(var i = 0, len = this._components.length; i < len; i++){
						this._components.items[i]._executionOrder = executionOrderCounter++;
				}
		}
		_callComponentMethod(components, name, dt) {
				for(components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++){
						components.items[components.loopIndex][name](dt);
				}
		}
		_onInitialize() {
				this.preloading = false;
				this._callComponentMethod(this._components, METHOD_INITIALIZE_ATTRIBUTES);
				this._callComponentMethod(this._enabledComponents, METHOD_INITIALIZE);
		}
		_onPostInitialize() {
				this._callComponentMethod(this._enabledComponents, METHOD_POST_INITIALIZE);
		}
		_onUpdate(dt) {
				this._callComponentMethod(this._enabledComponents, METHOD_UPDATE, dt);
		}
		_onPostUpdate(dt) {
				this._callComponentMethod(this._enabledComponents, METHOD_POST_UPDATE, dt);
		}
		_addComponentToEnabled(component) {
				this._enabledComponents.insert(component);
		}
		_removeComponentFromEnabled(component) {
				this._enabledComponents.remove(component);
		}
		_onBeforeRemove(entity, component) {
				var ind = this._components.items.indexOf(component);
				if (ind >= 0) {
						component._onBeforeRemove();
				}
				this._removeComponentFromEnabled(component);
				this._components.remove(component);
		}
		destroy() {
				super.destroy();
				this.app.systems.off('initialize', this._onInitialize, this);
				this.app.systems.off('postInitialize', this._onPostInitialize, this);
				this.app.systems.off('update', this._onUpdate, this);
				this.app.systems.off('postUpdate', this._onPostUpdate, this);
		}
		constructor(app){
				super(app);
				this.id = "script";
				this.ComponentType = ScriptComponent;
				this.DataType = ScriptComponentData;
				this._components = new SortedLoopArray({
						sortBy: '_executionOrder'
				});
				this._enabledComponents = new SortedLoopArray({
						sortBy: '_executionOrder'
				});
				this.preloading = true;
				this.on('beforeremove', this._onBeforeRemove, this);
				this.app.systems.on('initialize', this._onInitialize, this);
				this.app.systems.on('postInitialize', this._onPostInitialize, this);
				this.app.systems.on('update', this._onUpdate, this);
				this.app.systems.on('postUpdate', this._onPostUpdate, this);
		}
}

export { ScriptComponentSystem };
