import { Color } from '../../core/math/color.js';
import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Asset } from '../asset/asset.js';

var components = [
		'x',
		'y',
		'z',
		'w'
];
var vecLookup = [
		undefined,
		undefined,
		Vec2,
		Vec3,
		Vec4
];
function rawToValue(app, args, value, old) {
		switch(args.type){
				case 'boolean':
						return !!value;
				case 'number':
						if (typeof value === 'number') {
								return value;
						} else if (typeof value === 'string') {
								var v = parseInt(value, 10);
								if (isNaN(v)) return null;
								return v;
						} else if (typeof value === 'boolean') {
								return 0 + value;
						}
						return null;
				case 'json':
						{
								var result = {};
								if (Array.isArray(args.schema)) {
										if (!value || typeof value !== 'object') {
												value = {};
										}
										for(var i = 0; i < args.schema.length; i++){
												var field = args.schema[i];
												if (!field.name) continue;
												if (field.array) {
														result[field.name] = [];
														var arr = Array.isArray(value[field.name]) ? value[field.name] : [];
														for(var j = 0; j < arr.length; j++){
																result[field.name].push(rawToValue(app, field, arr[j]));
														}
												} else {
														var val = value.hasOwnProperty(field.name) ? value[field.name] : field.default;
														result[field.name] = rawToValue(app, field, val);
												}
										}
								}
								return result;
						}
				case 'asset':
						if (value instanceof Asset) {
								return value;
						} else if (typeof value === 'number') {
								return app.assets.get(value) || null;
						} else if (typeof value === 'string') {
								return app.assets.get(parseInt(value, 10)) || null;
						}
						return null;
				case 'entity':
						if (value instanceof GraphNode) {
								return value;
						} else if (typeof value === 'string') {
								return app.getEntityFromIndex(value);
						}
						return null;
				case 'rgb':
				case 'rgba':
						if (value instanceof Color) {
								if (old instanceof Color) {
										old.copy(value);
										return old;
								}
								return value.clone();
						} else if (value instanceof Array && value.length >= 3 && value.length <= 4) {
								for(var i1 = 0; i1 < value.length; i1++){
										if (typeof value[i1] !== 'number') {
												return null;
										}
								}
								if (!old) old = new Color();
								old.r = value[0];
								old.g = value[1];
								old.b = value[2];
								old.a = value.length === 3 ? 1 : value[3];
								return old;
						} else if (typeof value === 'string' && /#(?:[0-9a-f]{2}){3,4}/i.test(value)) {
								if (!old) {
										old = new Color();
								}
								old.fromString(value);
								return old;
						}
						return null;
				case 'vec2':
				case 'vec3':
				case 'vec4':
						{
								var len = parseInt(args.type.slice(3), 10);
								var vecType = vecLookup[len];
								if (value instanceof vecType) {
										if (old instanceof vecType) {
												old.copy(value);
												return old;
										}
										return value.clone();
								} else if (value instanceof Array && value.length === len) {
										for(var i2 = 0; i2 < value.length; i2++){
												if (typeof value[i2] !== 'number') {
														return null;
												}
										}
										if (!old) old = new vecType();
										for(var i3 = 0; i3 < len; i3++){
												old[components[i3]] = value[i3];
										}
										return old;
								}
								return null;
						}
				case 'curve':
						if (value) {
								var curve;
								if (value instanceof Curve || value instanceof CurveSet) {
										curve = value.clone();
								} else {
										var CurveType = value.keys[0] instanceof Array ? CurveSet : Curve;
										curve = new CurveType(value.keys);
										curve.type = value.type;
								}
								return curve;
						}
						break;
		}
		return value;
}
function attributeToValue(app, schema, value, current) {
		if (schema.array) {
				return value.map((item, index)=>rawToValue(app, schema, item, current ? current[index] : null));
		}
		return rawToValue(app, schema, value, current);
}
function assignAttributesToScript(app, attributeSchemaMap, data, script) {
		if (!data) return;
		for(var attributeName in attributeSchemaMap){
				var attributeSchema = attributeSchemaMap[attributeName];
				var dataToAssign = data[attributeName];
				if (dataToAssign === undefined) continue;
				script[attributeName] = attributeToValue(app, attributeSchema, dataToAssign, script[attributeName]);
		}
}
class ScriptAttributes {
		add(name, args) {
				if (this.index[name]) {
						return;
				} else if (ScriptAttributes.reservedNames.has(name)) {
						return;
				}
				this.index[name] = args;
				Object.defineProperty(this.scriptType.prototype, name, {
						get: function get() {
								return this.__attributes[name];
						},
						set: function set(raw) {
								var evt = 'attr';
								var evtName = "attr:" + name;
								var old = this.__attributes[name];
								var oldCopy = old;
								if (old && args.type !== 'json' && args.type !== 'entity' && old.clone) {
										if (this.hasEvent(evt) || this.hasEvent(evtName)) {
												oldCopy = old.clone();
										}
								}
								if (args.array) {
										this.__attributes[name] = [];
										if (raw) {
												for(var i = 0, len = raw.length; i < len; i++){
														this.__attributes[name].push(rawToValue(this.app, args, raw[i], old ? old[i] : null));
												}
										}
								} else {
										this.__attributes[name] = rawToValue(this.app, args, raw, old);
								}
								this.fire(evt, name, this.__attributes[name], oldCopy);
								this.fire(evtName, this.__attributes[name], oldCopy);
						}
				});
		}
		remove(name) {
				if (!this.index[name]) {
						return false;
				}
				delete this.index[name];
				delete this.scriptType.prototype[name];
				return true;
		}
		has(name) {
				return !!this.index[name];
		}
		get(name) {
				return this.index[name] || null;
		}
		constructor(scriptType){
				this.scriptType = scriptType;
				this.index = {};
		}
}
ScriptAttributes.assignAttributesToScript = assignAttributesToScript;
ScriptAttributes.attributeToValue = attributeToValue;
ScriptAttributes.reservedNames = new Set([
		'app',
		'entity',
		'enabled',
		'_enabled',
		'_enabledOld',
		'_destroyed',
		'__attributes',
		'__attributesRaw',
		"__scriptType",
		'__executionOrder',
		'_callbacks',
		'_callbackActive',
		'has',
		'get',
		'on',
		'off',
		'fire',
		'once',
		'hasEvent'
]);

export { ScriptAttributes, assignAttributesToScript };
