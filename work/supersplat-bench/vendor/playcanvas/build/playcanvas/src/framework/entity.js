import { guid } from '../core/guid.js';
import { GraphNode } from '../scene/graph-node.js';
import { getApplication } from './globals.js';

var cmpStaticOrder = (a, b)=>a.constructor.order - b.constructor.order;
var sortStaticOrder = (arr)=>arr.sort(cmpStaticOrder);
var _enableList = [];
var tmpPool = [];
var getTempArray = ()=>{
		var _tmpPool_pop;
		return (_tmpPool_pop = tmpPool.pop()) != null ? _tmpPool_pop : [];
};
var releaseTempArray = (a)=>{
		a.length = 0;
		tmpPool.push(a);
};
class Entity extends GraphNode {
		addComponent(type, data) {
				var system = this._app.systems[type];
				if (!system) {
						return null;
				}
				if (this.c[type]) {
						return null;
				}
				return system.addComponent(this, data);
		}
		removeComponent(type) {
				var system = this._app.systems[type];
				if (!system) {
						return;
				}
				if (!this.c[type]) {
						return;
				}
				system.removeComponent(this);
		}
		findComponent(type) {
				var entity = this.findOne((entity)=>{
						var _entity_c;
						return (_entity_c = entity.c) == null ? undefined : _entity_c[type];
				});
				return entity && entity.c[type];
		}
		findComponents(type) {
				return this.find((entity)=>{
						var _entity_c;
						return (_entity_c = entity.c) == null ? undefined : _entity_c[type];
				}).map((entity)=>entity.c[type]);
		}
		findScript(nameOrType) {
				var entity = this.findOne((node)=>{
						var _node_c_script, _node_c;
						return (_node_c = node.c) == null ? undefined : (_node_c_script = _node_c.script) == null ? undefined : _node_c_script.has(nameOrType);
				});
				return entity == null ? undefined : entity.c.script.get(nameOrType);
		}
		findScripts(nameOrType) {
				var entities = this.find((node)=>{
						var _node_c_script, _node_c;
						return (_node_c = node.c) == null ? undefined : (_node_c_script = _node_c.script) == null ? undefined : _node_c_script.has(nameOrType);
				});
				return entities.map((entity)=>entity.c.script.get(nameOrType));
		}
		getGuid() {
				if (!this._guid) {
						this.setGuid(guid.create());
				}
				return this._guid;
		}
		setGuid(guid) {
				var index = this._app._entityIndex;
				if (this._guid) {
						delete index[this._guid];
				}
				this._guid = guid;
				index[this._guid] = this;
		}
		_notifyHierarchyStateChanged(node, enabled) {
				var enableFirst = false;
				if (node === this && _enableList.length === 0) {
						enableFirst = true;
				}
				node._beingEnabled = true;
				node._onHierarchyStateChanged(enabled);
				if (node._onHierarchyStatePostChanged) {
						_enableList.push(node);
				}
				var c = node._children;
				for(var i = 0, len = c.length; i < len; i++){
						if (c[i]._enabled) {
								this._notifyHierarchyStateChanged(c[i], enabled);
						}
				}
				node._beingEnabled = false;
				if (enableFirst) {
						for(var i1 = 0; i1 < _enableList.length; i1++){
								_enableList[i1]._onHierarchyStatePostChanged();
						}
						_enableList.length = 0;
				}
		}
		_onHierarchyStateChanged(enabled) {
				super._onHierarchyStateChanged(enabled);
				var components = this._getSortedComponents();
				for(var i = 0; i < components.length; i++){
						var component = components[i];
						if (component.enabled) {
								if (enabled) {
										component.onEnable();
								} else {
										component.onDisable();
								}
						}
				}
				releaseTempArray(components);
		}
		_onHierarchyStatePostChanged() {
				var components = this._getSortedComponents();
				for(var i = 0; i < components.length; i++){
						components[i].onPostStateChange();
				}
				releaseTempArray(components);
		}
		findByGuid(guid) {
				if (this._guid === guid) return this;
				var e = this._app._entityIndex[guid];
				if (e && (e === this || e.isDescendantOf(this))) {
						return e;
				}
				return null;
		}
		destroy() {
				this._destroying = true;
				for(var name in this.c){
						this.c[name].enabled = false;
				}
				for(var name1 in this.c){
						this.c[name1].system.removeComponent(this);
				}
				super.destroy();
				if (this._guid) {
						delete this._app._entityIndex[this._guid];
				}
				this._destroying = false;
		}
		clone() {
				var duplicatedIdsMap = {};
				var clone = this._cloneRecursively(duplicatedIdsMap);
				duplicatedIdsMap[this.getGuid()] = clone;
				resolveDuplicatedEntityReferenceProperties(this, this, clone, duplicatedIdsMap);
				return clone;
		}
		_getSortedComponents() {
				var components = this.c;
				var sortedArray = getTempArray();
				var needSort = 0;
				for(var type in components){
						if (components.hasOwnProperty(type)) {
								var component = components[type];
								needSort |= component.constructor.order !== 0;
								sortedArray.push(component);
						}
				}
				if (needSort && sortedArray.length > 1) {
						sortStaticOrder(sortedArray);
				}
				return sortedArray;
		}
		_cloneRecursively(duplicatedIdsMap) {
				var clone = new this.constructor(undefined, this._app);
				super._cloneInternal(clone);
				for(var type in this.c){
						var component = this.c[type];
						component.system.cloneComponent(this, clone);
				}
				for(var i = 0; i < this._children.length; i++){
						var oldChild = this._children[i];
						if (oldChild instanceof Entity) {
								var newChild = oldChild._cloneRecursively(duplicatedIdsMap);
								clone.addChild(newChild);
								duplicatedIdsMap[oldChild.getGuid()] = newChild;
						}
				}
				return clone;
		}
		constructor(name, app = getApplication()){
				super(name), this.c = {}, this._destroying = false, this._guid = null, this._template = false;
				this._app = app;
		}
}
Entity.EVENT_DESTROY = 'destroy';
function resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
		if (oldEntity instanceof Entity) {
				var components = oldEntity.c;
				for(var componentName in components){
						var component = components[componentName];
						var entityProperties = component.system.getPropertiesOfType('entity');
						for(var i = 0, len = entityProperties.length; i < len; i++){
								var propertyDescriptor = entityProperties[i];
								var propertyName = propertyDescriptor.name;
								var oldEntityReferenceId = component[propertyName];
								var entityIsWithinOldSubtree = !!oldSubtreeRoot.findByGuid(oldEntityReferenceId);
								if (entityIsWithinOldSubtree) {
										var newEntityReferenceId = duplicatedIdsMap[oldEntityReferenceId].getGuid();
										if (newEntityReferenceId) {
												newEntity.c[componentName][propertyName] = newEntityReferenceId;
										}
								}
						}
				}
				if (components.script) {
						newEntity.script.resolveDuplicatedEntityReferenceProperties(components.script, duplicatedIdsMap);
				}
				if (components.render) {
						newEntity.render.resolveDuplicatedEntityReferenceProperties(components.render, duplicatedIdsMap);
				}
				if (components.button) {
						newEntity.button.resolveDuplicatedEntityReferenceProperties(components.button, duplicatedIdsMap);
				}
				if (components.scrollview) {
						newEntity.scrollview.resolveDuplicatedEntityReferenceProperties(components.scrollview, duplicatedIdsMap);
				}
				if (components.scrollbar) {
						newEntity.scrollbar.resolveDuplicatedEntityReferenceProperties(components.scrollbar, duplicatedIdsMap);
				}
				if (components.anim) {
						newEntity.anim.resolveDuplicatedEntityReferenceProperties(components.anim, duplicatedIdsMap);
				}
				var _old = oldEntity.children.filter((e)=>e instanceof Entity);
				var _new = newEntity.children.filter((e)=>e instanceof Entity);
				for(var i1 = 0, len1 = _old.length; i1 < len1; i1++){
						resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, _old[i1], _new[i1], duplicatedIdsMap);
				}
		}
}

export { Entity };
