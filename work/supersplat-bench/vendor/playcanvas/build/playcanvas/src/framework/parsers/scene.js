import { Entity } from '../entity.js';
import { CompressUtils } from '../../scene/compress/compress-utils.js';
import { Decompress } from '../../scene/compress/decompress.js';

class SceneParser {
		parse(data) {
				var entities = {};
				var parent = null;
				var compressed = data.compressedFormat;
				if (compressed && !data.entDecompressed) {
						data.entDecompressed = true;
						data.entities = new Decompress(data.entities, compressed).run();
				}
				for(var id in data.entities){
						var curData = data.entities[id];
						var curEnt = this._createEntity(curData, compressed);
						entities[id] = curEnt;
						if (curData.parent === null) {
								parent = curEnt;
						}
				}
				for(var id1 in data.entities){
						var curEnt1 = entities[id1];
						var children = data.entities[id1].children;
						var len = children.length;
						for(var i = 0; i < len; i++){
								var childEnt = entities[children[i]];
								if (childEnt) {
										curEnt1.addChild(childEnt);
								}
						}
				}
				this._openComponentData(parent, data.entities);
				return parent;
		}
		_createEntity(data, compressed) {
				var entity = new Entity(data.name, this._app);
				entity.setGuid(data.resource_id);
				this._setPosRotScale(entity, data, compressed);
				var _data_enabled;
				entity._enabled = (_data_enabled = data.enabled) != null ? _data_enabled : true;
				if (this._isTemplate) {
						entity._template = true;
				} else {
						entity._enabledInHierarchy = entity._enabled;
				}
				entity.template = data.template;
				if (data.tags) {
						for(var i = 0; i < data.tags.length; i++){
								entity.tags.add(data.tags[i]);
						}
				}
				return entity;
		}
		_setPosRotScale(entity, data, compressed) {
				if (compressed) {
						CompressUtils.setCompressedPRS(entity, data, compressed);
				} else {
						var p = data.position;
						var r = data.rotation;
						var s = data.scale;
						entity.setLocalPosition(p[0], p[1], p[2]);
						entity.setLocalEulerAngles(r[0], r[1], r[2]);
						entity.setLocalScale(s[0], s[1], s[2]);
				}
		}
		_openComponentData(entity, entities) {
				var systemsList = this._app.systems.list;
				var len = systemsList.length;
				var entityData = entities[entity.getGuid()];
				for(var i = 0; i < len; i++){
						var system = systemsList[i];
						var componentData = entityData.components[system.id];
						if (componentData) {
								system.addComponent(entity, componentData);
						}
				}
				len = entityData.children.length;
				var children = entity._children;
				for(var i1 = 0; i1 < len; i1++){
						if (children[i1]) {
								children[i1] = this._openComponentData(children[i1], entities);
						}
				}
				return entity;
		}
		constructor(app, isTemplate){
				this._app = app;
				this._isTemplate = isTemplate;
		}
}

export { SceneParser };
