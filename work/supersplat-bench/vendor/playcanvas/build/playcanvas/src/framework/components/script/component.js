import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { assignAttributesToScript, ScriptAttributes } from '../../script/script-attributes.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';
import { SCRIPT_POST_INITIALIZE, SCRIPT_INITIALIZE, SCRIPT_UPDATE, SCRIPT_POST_UPDATE, SCRIPT_SWAP } from '../../script/constants.js';
import { ScriptType } from '../../script/script-type.js';
import { getScriptName } from '../../script/script.js';

var toLowerCamelCase = (str)=>str[0].toLowerCase() + str.substring(1);
class ScriptComponent extends Component {
		set scripts(value) {
				var _this, _loop = function(key) {
						if (!value.hasOwnProperty(key)) {
								return "continue";
						}
						var script = _this._scriptsIndex[key];
						if (script) {
								if (typeof value[key].enabled === 'boolean') {
										script.once('preInitialize', ()=>{
												_this.initializeAttributes(script);
										});
										script.enabled = !!value[key].enabled;
								}
								if (typeof value[key].attributes === 'object') {
										for(var attr in value[key].attributes){
												if (ScriptAttributes.reservedNames.has(attr)) {
														continue;
												}
												if (!script.__attributes.hasOwnProperty(attr)) {
														var scriptType = _this.system.app.scripts.get(key);
														if (scriptType) {
																scriptType.attributes.add(attr, {});
														}
												}
												script[attr] = value[key].attributes[attr];
										}
								}
						} else {
								console.log(_this.order);
						}
				};
				this._scriptsData = value;
				for(var key in value)_this = this, _loop(key);
		}
		get scripts() {
				return this._scripts;
		}
		set enabled(value) {
				var oldValue = this._enabled;
				this._enabled = value;
				this.fire('set', 'enabled', oldValue, value);
		}
		get enabled() {
				return this._enabled;
		}
		onEnable() {
				this._beingEnabled = true;
				this._checkState();
				if (!this.entity._beingEnabled) {
						this.onPostStateChange();
				}
				this._beingEnabled = false;
		}
		onDisable() {
				this._checkState();
		}
		onPostStateChange() {
				var wasLooping = this._beginLooping();
				for(var i = 0, len = this.scripts.length; i < len; i++){
						var script = this.scripts[i];
						if (script._initialized && !script._postInitialized && script.enabled) {
								script._postInitialized = true;
								if (script.postInitialize) {
										this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
								}
						}
				}
				this._endLooping(wasLooping);
		}
		_beginLooping() {
				var looping = this._isLoopingThroughScripts;
				this._isLoopingThroughScripts = true;
				return looping;
		}
		_endLooping(wasLoopingBefore) {
				this._isLoopingThroughScripts = wasLoopingBefore;
				if (!this._isLoopingThroughScripts) {
						this._removeDestroyedScripts();
				}
		}
		_onSetEnabled(prop, old, value) {
				this._beingEnabled = true;
				this._checkState();
				this._beingEnabled = false;
		}
		_checkState() {
				var _this, _loop = function(i, len) {
						var script = _this.scripts[i];
						script.once('preInitialize', ()=>{
								_this.initializeAttributes(script);
						});
						script.enabled = script._enabled;
				};
				var state = this.enabled && this.entity.enabled;
				if (state === this._oldState) {
						return;
				}
				this._oldState = state;
				this.fire(state ? 'enable' : 'disable');
				this.fire('state', state);
				if (state) {
						this.system._addComponentToEnabled(this);
				} else {
						this.system._removeComponentFromEnabled(this);
				}
				var wasLooping = this._beginLooping();
				for(var i = 0, len = this.scripts.length; i < len; i++)_this = this, _loop(i);
				this._endLooping(wasLooping);
		}
		_onBeforeRemove() {
				this.fire('remove');
				var wasLooping = this._beginLooping();
				for(var i = 0; i < this.scripts.length; i++){
						var script = this.scripts[i];
						if (!script) continue;
						this.destroy(script.__scriptType.__name);
				}
				this._endLooping(wasLooping);
		}
		_removeDestroyedScripts() {
				var len = this._destroyedScripts.length;
				if (!len) return;
				for(var i = 0; i < len; i++){
						var script = this._destroyedScripts[i];
						this._removeScriptInstance(script);
				}
				this._destroyedScripts.length = 0;
				this._resetExecutionOrder(0, this._scripts.length);
		}
		_onInitializeAttributes() {
				for(var i = 0, len = this.scripts.length; i < len; i++){
						var script = this.scripts[i];
						this.initializeAttributes(script);
				}
		}
		initializeAttributes(script) {
				if (script instanceof ScriptType) {
						script.__initializeAttributes();
				} else {
						var _this_system_app_scripts;
						var name = script.__scriptType.__name;
						var data = this._attributeDataMap.get(name);
						if (!data) {
								return;
						}
						var schema = (_this_system_app_scripts = this.system.app.scripts) == null ? undefined : _this_system_app_scripts.getSchema(name);
						assignAttributesToScript(this.system.app, schema.attributes, data, script);
				}
		}
		_scriptMethod(script, method, arg) {
				script[method](arg);
		}
		_onInitialize() {
				var scripts = this._scripts;
				var wasLooping = this._beginLooping();
				for(var i = 0, len = scripts.length; i < len; i++){
						var script = scripts[i];
						if (!script._initialized && script.enabled) {
								script._initialized = true;
								if (script.initialize) {
										this._scriptMethod(script, SCRIPT_INITIALIZE);
								}
						}
				}
				this._endLooping(wasLooping);
		}
		_onPostInitialize() {
				this.onPostStateChange();
		}
		_onUpdate(dt) {
				var list = this._updateList;
				if (!list.length) return;
				var wasLooping = this._beginLooping();
				for(list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++){
						var script = list.items[list.loopIndex];
						if (script.enabled) {
								this._scriptMethod(script, SCRIPT_UPDATE, dt);
						}
				}
				this._endLooping(wasLooping);
		}
		_onPostUpdate(dt) {
				var list = this._postUpdateList;
				if (!list.length) return;
				var wasLooping = this._beginLooping();
				for(list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++){
						var script = list.items[list.loopIndex];
						if (script.enabled) {
								this._scriptMethod(script, SCRIPT_POST_UPDATE, dt);
						}
				}
				this._endLooping(wasLooping);
		}
		_insertScriptInstance(scriptInstance, index, scriptsLength) {
				if (index === -1) {
						this._scripts.push(scriptInstance);
						scriptInstance.__executionOrder = scriptsLength;
						if (scriptInstance.update) {
								this._updateList.append(scriptInstance);
						}
						if (scriptInstance.postUpdate) {
								this._postUpdateList.append(scriptInstance);
						}
				} else {
						this._scripts.splice(index, 0, scriptInstance);
						scriptInstance.__executionOrder = index;
						this._resetExecutionOrder(index + 1, scriptsLength + 1);
						if (scriptInstance.update) {
								this._updateList.insert(scriptInstance);
						}
						if (scriptInstance.postUpdate) {
								this._postUpdateList.insert(scriptInstance);
						}
				}
		}
		_removeScriptInstance(scriptInstance) {
				var idx = this._scripts.indexOf(scriptInstance);
				if (idx === -1) return idx;
				this._scripts.splice(idx, 1);
				if (scriptInstance.update) {
						this._updateList.remove(scriptInstance);
				}
				if (scriptInstance.postUpdate) {
						this._postUpdateList.remove(scriptInstance);
				}
				return idx;
		}
		_resetExecutionOrder(startIndex, scriptsLength) {
				for(var i = startIndex; i < scriptsLength; i++){
						this._scripts[i].__executionOrder = i;
				}
		}
		_resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newAttributes, duplicatedIdsMap) {
				if (attribute.array) {
						var len = oldValue.length;
						if (!len) {
								return;
						}
						var newGuidArray = oldValue.slice();
						for(var i = 0; i < len; i++){
								var guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
								if (duplicatedIdsMap[guid]) {
										newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
								}
						}
						newAttributes[attributeName] = newGuidArray;
				} else {
						if (oldValue instanceof Entity) {
								oldValue = oldValue.getGuid();
						} else if (typeof oldValue !== 'string') {
								return;
						}
						if (duplicatedIdsMap[oldValue]) {
								newAttributes[attributeName] = duplicatedIdsMap[oldValue];
						}
				}
		}
		has(nameOrType) {
				if (typeof nameOrType === 'string') {
						return !!this._scriptsIndex[nameOrType];
				}
				if (!nameOrType) return false;
				var scriptType = nameOrType;
				var scriptName = scriptType.__name;
				var scriptData = this._scriptsIndex[scriptName];
				var scriptInstance = scriptData && scriptData.instance;
				return scriptInstance instanceof scriptType;
		}
		get(nameOrType) {
				if (typeof nameOrType === 'string') {
						var data = this._scriptsIndex[nameOrType];
						return data ? data.instance : null;
				}
				if (!nameOrType) return null;
				var scriptType = nameOrType;
				var scriptName = scriptType.__name;
				var scriptData = this._scriptsIndex[scriptName];
				var scriptInstance = scriptData && scriptData.instance;
				return scriptInstance instanceof scriptType ? scriptInstance : null;
		}
		create(nameOrType, args) {
				if (args === undefined) args = {};
				var self = this;
				var scriptType = nameOrType;
				var scriptName = nameOrType;
				if (typeof scriptType === 'string') {
						scriptType = this.system.app.scripts.get(scriptType);
				} else if (scriptType) {
						var _scriptType;
						var ___name;
						scriptName = (___name = (_scriptType = scriptType).__name) != null ? ___name : _scriptType.__name = toLowerCamelCase(getScriptName(scriptType));
				}
				if (scriptType) {
						if (!this._scriptsIndex[scriptName] || !this._scriptsIndex[scriptName].instance) {
								var scriptInstance = new scriptType({
										app: this.system.app,
										entity: this.entity,
										enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
										attributes: args.attributes || {}
								});
								if (args.properties && typeof args.properties === 'object') {
										Object.assign(scriptInstance, args.properties);
								}
								if (!(scriptInstance instanceof ScriptType)) {
										this._attributeDataMap.set(scriptName, args.attributes);
								}
								var len = this._scripts.length;
								var ind = -1;
								if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind) {
										ind = args.ind;
								}
								this._insertScriptInstance(scriptInstance, ind, len);
								this._scriptsIndex[scriptName] = {
										instance: scriptInstance,
										onSwap: function onSwap() {
												self.swap(scriptName);
										}
								};
								this[scriptName] = scriptInstance;
								if (!args.preloading) {
										this.initializeAttributes(scriptInstance);
								}
								this.fire('create', scriptName, scriptInstance);
								this.fire("create:" + scriptName, scriptInstance);
								this.system.app.scripts.on("swap:" + scriptName, this._scriptsIndex[scriptName].onSwap);
								if (!args.preloading) {
										if (scriptInstance.enabled && !scriptInstance._initialized) {
												scriptInstance._initialized = true;
												if (scriptInstance.initialize) {
														this._scriptMethod(scriptInstance, SCRIPT_INITIALIZE);
												}
										}
										if (scriptInstance.enabled && !scriptInstance._postInitialized) {
												scriptInstance._postInitialized = true;
												if (scriptInstance.postInitialize) {
														this._scriptMethod(scriptInstance, SCRIPT_POST_INITIALIZE);
												}
										}
								}
								return scriptInstance;
						}
				} else {
						this._scriptsIndex[scriptName] = {
								awaiting: true,
								ind: this._scripts.length
						};
				}
				return null;
		}
		destroy(nameOrType) {
				var scriptName = nameOrType;
				var scriptType = nameOrType;
				if (typeof scriptType === 'string') {
						scriptType = this.system.app.scripts.get(scriptType);
				} else if (scriptType) {
						scriptName = scriptType.__name;
				}
				var scriptData = this._scriptsIndex[scriptName];
				delete this._scriptsIndex[scriptName];
				if (!scriptData) return false;
				this._attributeDataMap.delete(scriptName);
				var scriptInstance = scriptData.instance;
				if (scriptInstance && !scriptInstance._destroyed) {
						scriptInstance.enabled = false;
						scriptInstance._destroyed = true;
						if (!this._isLoopingThroughScripts) {
								var ind = this._removeScriptInstance(scriptInstance);
								if (ind >= 0) {
										this._resetExecutionOrder(ind, this._scripts.length);
								}
						} else {
								this._destroyedScripts.push(scriptInstance);
						}
				}
				this.system.app.scripts.off("swap:" + scriptName, scriptData.onSwap);
				delete this[scriptName];
				this.fire('destroy', scriptName, scriptInstance || null);
				this.fire("destroy:" + scriptName, scriptInstance || null);
				if (scriptInstance) {
						scriptInstance.fire('destroy');
				}
				return true;
		}
		swap(nameOrType) {
				var scriptName = nameOrType;
				var scriptType = nameOrType;
				if (typeof scriptType === 'string') {
						scriptType = this.system.app.scripts.get(scriptType);
				} else if (scriptType) {
						scriptName = scriptType.__name;
				}
				var old = this._scriptsIndex[scriptName];
				if (!old || !old.instance) return false;
				var scriptInstanceOld = old.instance;
				var ind = this._scripts.indexOf(scriptInstanceOld);
				var scriptInstance = new scriptType({
						app: this.system.app,
						entity: this.entity,
						enabled: scriptInstanceOld.enabled,
						attributes: scriptInstanceOld.__attributes
				});
				if (!scriptInstance.swap) {
						return false;
				}
				this.initializeAttributes(scriptInstance);
				this._scripts[ind] = scriptInstance;
				this._scriptsIndex[scriptName].instance = scriptInstance;
				this[scriptName] = scriptInstance;
				scriptInstance.__executionOrder = ind;
				if (scriptInstanceOld.update) {
						this._updateList.remove(scriptInstanceOld);
				}
				if (scriptInstanceOld.postUpdate) {
						this._postUpdateList.remove(scriptInstanceOld);
				}
				if (scriptInstance.update) {
						this._updateList.insert(scriptInstance);
				}
				if (scriptInstance.postUpdate) {
						this._postUpdateList.insert(scriptInstance);
				}
				this._scriptMethod(scriptInstance, SCRIPT_SWAP, scriptInstanceOld);
				this.fire('swap', scriptName, scriptInstance);
				this.fire("swap:" + scriptName, scriptInstance);
				return true;
		}
		resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {
				var newScriptComponent = this.entity.script;
				for(var scriptName in oldScriptComponent._scriptsIndex){
						var scriptType = this.system.app.scripts.get(scriptName);
						if (!scriptType) {
								continue;
						}
						var script = oldScriptComponent._scriptsIndex[scriptName];
						if (!script || !script.instance) {
								continue;
						}
						var newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
						var newAttributes = newScriptComponent[scriptName].__attributes;
						if (!newAttributesRaw && !newAttributes) {
								continue;
						}
						var useGuid = !!newAttributesRaw;
						var oldAttributes = script.instance.__attributes;
						for(var attributeName in oldAttributes){
								if (!oldAttributes[attributeName]) {
										continue;
								}
								var attribute = scriptType.attributes.get(attributeName);
								if (!attribute) {
										continue;
								}
								if (attribute.type === 'entity') {
										this._resolveEntityScriptAttribute(attribute, attributeName, oldAttributes[attributeName], useGuid, newAttributesRaw || newAttributes, duplicatedIdsMap);
								} else if (attribute.type === 'json' && Array.isArray(attribute.schema)) {
										var oldValue = oldAttributes[attributeName];
										var newJsonValue = newAttributesRaw ? newAttributesRaw[attributeName] : newAttributes[attributeName];
										for(var i = 0; i < attribute.schema.length; i++){
												var field = attribute.schema[i];
												if (field.type !== 'entity') {
														continue;
												}
												if (attribute.array) {
														for(var j = 0; j < oldValue.length; j++){
																this._resolveEntityScriptAttribute(field, field.name, oldValue[j][field.name], useGuid, newJsonValue[j], duplicatedIdsMap);
														}
												} else {
														this._resolveEntityScriptAttribute(field, field.name, oldValue[field.name], useGuid, newJsonValue, duplicatedIdsMap);
												}
										}
								}
						}
				}
		}
		move(nameOrType, ind) {
				var len = this._scripts.length;
				if (ind >= len || ind < 0) {
						return false;
				}
				var scriptType = nameOrType;
				var scriptName = nameOrType;
				if (typeof scriptName !== 'string') {
						scriptName = nameOrType.__name;
				} else {
						scriptType = null;
				}
				var scriptData = this._scriptsIndex[scriptName];
				if (!scriptData || !scriptData.instance) {
						return false;
				}
				var scriptInstance = scriptData.instance;
				if (scriptType && !(scriptInstance instanceof scriptType)) {
						return false;
				}
				var indOld = this._scripts.indexOf(scriptInstance);
				if (indOld === -1 || indOld === ind) {
						return false;
				}
				this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);
				this._resetExecutionOrder(0, len);
				this._updateList.sort();
				this._postUpdateList.sort();
				this.fire('move', scriptName, scriptInstance, ind, indOld);
				this.fire("move:" + scriptName, scriptInstance, ind, indOld);
				return true;
		}
		constructor(system, entity){
				super(system, entity), this._attributeDataMap = new Map();
				this._scripts = [];
				this._updateList = new SortedLoopArray({
						sortBy: '__executionOrder'
				});
				this._postUpdateList = new SortedLoopArray({
						sortBy: '__executionOrder'
				});
				this._scriptsIndex = {};
				this._destroyedScripts = [];
				this._destroyed = false;
				this._scriptsData = null;
				this._oldState = true;
				this._enabled = true;
				this._beingEnabled = false;
				this._isLoopingThroughScripts = false;
				this._executionOrder = -1;
				this.on('set_enabled', this._onSetEnabled, this);
		}
}
ScriptComponent.EVENT_CREATE = 'create';
ScriptComponent.EVENT_DESTROY = 'destroy';
ScriptComponent.EVENT_ENABLE = 'enable';
ScriptComponent.EVENT_DISABLE = 'disable';
ScriptComponent.EVENT_REMOVE = 'remove';
ScriptComponent.EVENT_STATE = 'state';
ScriptComponent.EVENT_MOVE = 'move';
ScriptComponent.EVENT_ERROR = 'error';

export { ScriptComponent };
