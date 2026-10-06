import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Model } from '../../../scene/model.js';
import { ComponentSystem } from '../system.js';
import { CollisionComponent } from './component.js';
import { CollisionComponentData } from './data.js';
import { Trigger } from './trigger.js';

var mat4 = new Mat4();
var p1 = new Vec3();
var p2 = new Vec3();
var quat = new Quat();
var tempGraphNode = new GraphNode();
var _schema = [
		'enabled',
		'type',
		'halfExtents',
		'linearOffset',
		'angularOffset',
		'radius',
		'axis',
		'height',
		'convexHull',
		'asset',
		'renderAsset',
		'shape',
		'model',
		'render',
		'checkVertexDuplicates'
];
class CollisionSystemImpl {
		beforeInitialize(component, data) {
				data.shape = null;
				data.model = new Model();
				data.model.graph = new GraphNode();
		}
		afterInitialize(component, data) {
				this.recreatePhysicalShapes(component);
				component.data.initialized = true;
		}
		reset(component, data) {
				this.beforeInitialize(component, data);
				this.afterInitialize(component, data);
		}
		recreatePhysicalShapes(component) {
				var entity = component.entity;
				var data = component.data;
				if (typeof Ammo !== 'undefined') {
						if (entity.trigger) {
								entity.trigger.destroy();
								delete entity.trigger;
						}
						if (data.shape) {
								if (component._compoundParent) {
										if (component !== component._compoundParent) {
												this.system._removeCompoundChild(component._compoundParent, data.shape);
										}
										if (component._compoundParent.entity.rigidbody) {
												component._compoundParent.entity.rigidbody.activate();
										}
								}
								this.destroyShape(data);
						}
						data.shape = this.createPhysicalShape(component.entity, data);
						var firstCompoundChild = !component._compoundParent;
						if (data.type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
								component._compoundParent = component;
								entity.forEach(this._addEachDescendant, component);
						} else if (data.type !== 'compound') {
								if (!component.rigidbody) {
										component._compoundParent = null;
										var parent = entity.parent;
										while(parent){
												if (parent.collision && parent.collision.type === 'compound') {
														component._compoundParent = parent.collision;
														break;
												}
												parent = parent.parent;
										}
								}
						}
						if (component._compoundParent) {
								if (component !== component._compoundParent) {
										if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
												this.system.recreatePhysicalShapes(component._compoundParent);
										} else {
												this.system.updateCompoundChildTransform(entity, true);
												if (component._compoundParent.entity.rigidbody) {
														component._compoundParent.entity.rigidbody.activate();
												}
										}
								}
						}
						if (entity.rigidbody) {
								entity.rigidbody.disableSimulation();
								entity.rigidbody.createBody();
								if (entity.enabled && entity.rigidbody.enabled) {
										entity.rigidbody.enableSimulation();
								}
						} else if (!component._compoundParent) {
								if (!entity.trigger) {
										entity.trigger = new Trigger(this.system.app, component, data);
								} else {
										entity.trigger.initialize(data);
								}
						}
				}
		}
		createPhysicalShape(entity, data) {
				return undefined;
		}
		updateTransform(component, position, rotation, scale) {
				if (component.entity.trigger) {
						component.entity.trigger.updateTransform();
				}
		}
		destroyShape(data) {
				if (data.shape) {
						Ammo.destroy(data.shape);
						data.shape = null;
				}
		}
		beforeRemove(entity, component) {
				if (component.data.shape) {
						if (component._compoundParent && !component._compoundParent.entity._destroying) {
								this.system._removeCompoundChild(component._compoundParent, component.data.shape);
								if (component._compoundParent.entity.rigidbody) {
										component._compoundParent.entity.rigidbody.activate();
								}
						}
						component._compoundParent = null;
						this.destroyShape(component.data);
				}
		}
		remove(entity, data) {
				if (entity.rigidbody && entity.rigidbody.body) {
						entity.rigidbody.disableSimulation();
				}
				if (entity.trigger) {
						entity.trigger.destroy();
						delete entity.trigger;
				}
		}
		clone(entity, clone) {
				var src = this.system.store[entity.getGuid()];
				var data = {
						enabled: src.data.enabled,
						type: src.data.type,
						halfExtents: [
								src.data.halfExtents.x,
								src.data.halfExtents.y,
								src.data.halfExtents.z
						],
						linearOffset: [
								src.data.linearOffset.x,
								src.data.linearOffset.y,
								src.data.linearOffset.z
						],
						angularOffset: [
								src.data.angularOffset.x,
								src.data.angularOffset.y,
								src.data.angularOffset.z,
								src.data.angularOffset.w
						],
						radius: src.data.radius,
						axis: src.data.axis,
						height: src.data.height,
						convexHull: src.data.convexHull,
						asset: src.data.asset,
						renderAsset: src.data.renderAsset,
						model: src.data.model,
						render: src.data.render,
						checkVertexDuplicates: src.data.checkVertexDuplicates
				};
				return this.system.addComponent(clone, data);
		}
		constructor(system){
				this.system = system;
		}
}
class CollisionBoxSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				if (typeof Ammo !== 'undefined') {
						var he = data.halfExtents;
						var ammoHe = new Ammo.btVector3(he ? he.x : 0.5, he ? he.y : 0.5, he ? he.z : 0.5);
						var shape = new Ammo.btBoxShape(ammoHe);
						Ammo.destroy(ammoHe);
						return shape;
				}
				return undefined;
		}
}
class CollisionSphereSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				if (typeof Ammo !== 'undefined') {
						return new Ammo.btSphereShape(data.radius);
				}
				return undefined;
		}
}
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				var _data_axis;
				var axis = (_data_axis = data.axis) != null ? _data_axis : 1;
				var _data_radius;
				var radius = (_data_radius = data.radius) != null ? _data_radius : 0.5;
				var _data_height;
				var height = Math.max(((_data_height = data.height) != null ? _data_height : 2) - 2 * radius, 0);
				var shape = null;
				if (typeof Ammo !== 'undefined') {
						switch(axis){
								case 0:
										shape = new Ammo.btCapsuleShapeX(radius, height);
										break;
								case 1:
										shape = new Ammo.btCapsuleShape(radius, height);
										break;
								case 2:
										shape = new Ammo.btCapsuleShapeZ(radius, height);
										break;
						}
				}
				return shape;
		}
}
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				var _data_axis;
				var axis = (_data_axis = data.axis) != null ? _data_axis : 1;
				var _data_radius;
				var radius = (_data_radius = data.radius) != null ? _data_radius : 0.5;
				var _data_height;
				var height = (_data_height = data.height) != null ? _data_height : 1;
				var halfExtents = null;
				var shape = null;
				if (typeof Ammo !== 'undefined') {
						switch(axis){
								case 0:
										halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
										shape = new Ammo.btCylinderShapeX(halfExtents);
										break;
								case 1:
										halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
										shape = new Ammo.btCylinderShape(halfExtents);
										break;
								case 2:
										halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
										shape = new Ammo.btCylinderShapeZ(halfExtents);
										break;
						}
				}
				if (halfExtents) {
						Ammo.destroy(halfExtents);
				}
				return shape;
		}
}
class CollisionConeSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				var _data_axis;
				var axis = (_data_axis = data.axis) != null ? _data_axis : 1;
				var _data_radius;
				var radius = (_data_radius = data.radius) != null ? _data_radius : 0.5;
				var _data_height;
				var height = (_data_height = data.height) != null ? _data_height : 1;
				var shape = null;
				if (typeof Ammo !== 'undefined') {
						switch(axis){
								case 0:
										shape = new Ammo.btConeShapeX(radius, height);
										break;
								case 1:
										shape = new Ammo.btConeShape(radius, height);
										break;
								case 2:
										shape = new Ammo.btConeShapeZ(radius, height);
										break;
						}
				}
				return shape;
		}
}
class CollisionMeshSystemImpl extends CollisionSystemImpl {
		beforeInitialize(component, data) {}
		createAmmoHull(mesh, node, shape, scale) {
				var hull = new Ammo.btConvexHullShape();
				var point = new Ammo.btVector3();
				var positions = [];
				mesh.getPositions(positions);
				for(var i = 0; i < positions.length; i += 3){
						point.setValue(positions[i] * scale.x, positions[i + 1] * scale.y, positions[i + 2] * scale.z);
						hull.addPoint(point, false);
				}
				Ammo.destroy(point);
				hull.recalcLocalAabb();
				hull.setMargin(0.01);
				var transform = this.system._getNodeTransform(node);
				shape.addChildShape(transform, hull);
				Ammo.destroy(transform);
		}
		createAmmoMesh(mesh, node, shape, scale, checkDupes) {
				if (checkDupes === undefined) checkDupes = true;
				var system = this.system;
				var triMesh;
				if (system._triMeshCache[mesh.id]) {
						triMesh = system._triMeshCache[mesh.id];
				} else {
						var vb = mesh.vertexBuffer;
						var format = vb.getFormat();
						var stride, positions;
						for(var i = 0; i < format.elements.length; i++){
								var element = format.elements[i];
								if (element.name === SEMANTIC_POSITION) {
										positions = new Float32Array(vb.lock(), element.offset);
										stride = element.stride / 4;
										break;
								}
						}
						var indices = [];
						mesh.getIndices(indices);
						var numTriangles = mesh.primitive[0].count / 3;
						var v1 = new Ammo.btVector3();
						var i1, i2, i3;
						var base = mesh.primitive[0].base;
						triMesh = new Ammo.btTriangleMesh();
						system._triMeshCache[mesh.id] = triMesh;
						var vertexCache = new Map();
						var indexedArray = triMesh.getIndexedMeshArray();
						indexedArray.at(0).m_numTriangles = numTriangles;
						var sx = scale ? scale.x : 1;
						var sy = scale ? scale.y : 1;
						var sz = scale ? scale.z : 1;
						var addVertex = (index)=>{
								var x = positions[index * stride] * sx;
								var y = positions[index * stride + 1] * sy;
								var z = positions[index * stride + 2] * sz;
								var idx;
								if (checkDupes) {
										var str = x + ":" + y + ":" + z;
										idx = vertexCache.get(str);
										if (idx !== undefined) {
												return idx;
										}
										v1.setValue(x, y, z);
										idx = triMesh.findOrAddVertex(v1, false);
										vertexCache.set(str, idx);
								} else {
										v1.setValue(x, y, z);
										idx = triMesh.findOrAddVertex(v1, false);
								}
								return idx;
						};
						for(var i4 = 0; i4 < numTriangles; i4++){
								i1 = addVertex(indices[base + i4 * 3]);
								i2 = addVertex(indices[base + i4 * 3 + 1]);
								i3 = addVertex(indices[base + i4 * 3 + 2]);
								triMesh.addIndex(i1);
								triMesh.addIndex(i2);
								triMesh.addIndex(i3);
						}
						Ammo.destroy(v1);
				}
				var triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, true);
				if (!scale) {
						var scaling = system._getNodeScaling(node);
						triMeshShape.setLocalScaling(scaling);
						Ammo.destroy(scaling);
				}
				var transform = system._getNodeTransform(node);
				shape.addChildShape(transform, triMeshShape);
				Ammo.destroy(transform);
		}
		createPhysicalShape(entity, data) {
				if (typeof Ammo === 'undefined') return undefined;
				if (data.model || data.render) {
						var shape = new Ammo.btCompoundShape();
						var entityTransform = entity.getWorldTransform();
						var scale = entityTransform.getScale();
						if (data.render) {
								var meshes = data.render.meshes;
								for(var i = 0; i < meshes.length; i++){
										if (data.convexHull) {
												this.createAmmoHull(meshes[i], tempGraphNode, shape, scale);
										} else {
												this.createAmmoMesh(meshes[i], tempGraphNode, shape, scale, data.checkVertexDuplicates);
										}
								}
						} else if (data.model) {
								var meshInstances = data.model.meshInstances;
								for(var i1 = 0; i1 < meshInstances.length; i1++){
										this.createAmmoMesh(meshInstances[i1].mesh, meshInstances[i1].node, shape, null, data.checkVertexDuplicates);
								}
								var vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
								shape.setLocalScaling(vec);
								Ammo.destroy(vec);
						}
						return shape;
				}
				return undefined;
		}
		recreatePhysicalShapes(component) {
				var data = component.data;
				if (data.renderAsset || data.asset) {
						if (component.enabled && component.entity.enabled) {
								this.loadAsset(component, data.renderAsset || data.asset, data.renderAsset ? 'render' : 'model');
								return;
						}
				}
				this.doRecreatePhysicalShape(component);
		}
		loadAsset(component, id, property) {
				var data = component.data;
				var assets = this.system.app.assets;
				var previousPropertyValue = data[property];
				var onAssetFullyReady = (asset)=>{
						if (data[property] !== previousPropertyValue) {
								return;
						}
						data[property] = asset.resource;
						this.doRecreatePhysicalShape(component);
				};
				var loadAndHandleAsset = (asset)=>{
						asset.ready((asset)=>{
								if (asset.data.containerAsset) {
										var containerAsset = assets.get(asset.data.containerAsset);
										if (containerAsset.loaded) {
												onAssetFullyReady(asset);
										} else {
												containerAsset.ready(()=>{
														onAssetFullyReady(asset);
												});
												assets.load(containerAsset);
										}
								} else {
										onAssetFullyReady(asset);
								}
						});
						assets.load(asset);
				};
				var asset = assets.get(id);
				if (asset) {
						loadAndHandleAsset(asset);
				} else {
						assets.once("add:" + id, loadAndHandleAsset);
				}
		}
		doRecreatePhysicalShape(component) {
				var entity = component.entity;
				var data = component.data;
				if (data.model || data.render) {
						this.destroyShape(data);
						data.shape = this.createPhysicalShape(entity, data);
						if (entity.rigidbody) {
								entity.rigidbody.disableSimulation();
								entity.rigidbody.createBody();
								if (entity.enabled && entity.rigidbody.enabled) {
										entity.rigidbody.enableSimulation();
								}
						} else {
								if (!entity.trigger) {
										entity.trigger = new Trigger(this.system.app, component, data);
								} else {
										entity.trigger.initialize(data);
								}
						}
				} else {
						this.beforeRemove(entity, component);
						this.remove(entity, data);
				}
		}
		updateTransform(component, position, rotation, scale) {
				if (component.shape) {
						var entityTransform = component.entity.getWorldTransform();
						var worldScale = entityTransform.getScale();
						var previousScale = component.shape.getLocalScaling();
						if (worldScale.x !== previousScale.x() || worldScale.y !== previousScale.y() || worldScale.z !== previousScale.z()) {
								this.doRecreatePhysicalShape(component);
						}
				}
				super.updateTransform(component, position, rotation, scale);
		}
		destroyShape(data) {
				if (!data.shape) {
						return;
				}
				var numShapes = data.shape.getNumChildShapes();
				for(var i = 0; i < numShapes; i++){
						var shape = data.shape.getChildShape(i);
						Ammo.destroy(shape);
				}
				Ammo.destroy(data.shape);
				data.shape = null;
		}
}
class CollisionCompoundSystemImpl extends CollisionSystemImpl {
		createPhysicalShape(entity, data) {
				if (typeof Ammo !== 'undefined') {
						return new Ammo.btCompoundShape();
				}
				return undefined;
		}
		_addEachDescendant(entity) {
				if (!entity.collision || entity.rigidbody) {
						return;
				}
				entity.collision._compoundParent = this;
				if (entity !== this.entity) {
						entity.collision.system.recreatePhysicalShapes(entity.collision);
				}
		}
		_updateEachDescendant(entity) {
				if (!entity.collision) {
						return;
				}
				if (entity.collision._compoundParent !== this) {
						return;
				}
				entity.collision._compoundParent = null;
				if (entity !== this.entity && !entity.rigidbody) {
						entity.collision.system.recreatePhysicalShapes(entity.collision);
				}
		}
		_updateEachDescendantTransform(entity) {
				if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent) {
						return;
				}
				this.collision.system.updateCompoundChildTransform(entity, false);
		}
}
class CollisionComponentSystem extends ComponentSystem {
		initializeComponentData(component, _data, properties) {
				properties = [
						'type',
						'halfExtents',
						'radius',
						'axis',
						'height',
						'convexHull',
						'shape',
						'model',
						'asset',
						'render',
						'renderAsset',
						'enabled',
						'linearOffset',
						'angularOffset',
						'checkVertexDuplicates'
				];
				var data = {};
				for(var i = 0, len = properties.length; i < len; i++){
						var property = properties[i];
						data[property] = _data[property];
				}
				var idx;
				if (_data.hasOwnProperty('asset')) {
						idx = properties.indexOf('model');
						if (idx !== -1) {
								properties.splice(idx, 1);
						}
						idx = properties.indexOf('render');
						if (idx !== -1) {
								properties.splice(idx, 1);
						}
				} else if (_data.hasOwnProperty('model')) {
						idx = properties.indexOf('asset');
						if (idx !== -1) {
								properties.splice(idx, 1);
						}
				}
				if (!data.type) {
						data.type = component.data.type;
				}
				component.data.type = data.type;
				if (Array.isArray(data.halfExtents)) {
						data.halfExtents = new Vec3(data.halfExtents);
				}
				if (Array.isArray(data.linearOffset)) {
						data.linearOffset = new Vec3(data.linearOffset);
				}
				if (Array.isArray(data.angularOffset)) {
						var values = data.angularOffset;
						if (values.length === 3) {
								data.angularOffset = new Quat().setFromEulerAngles(values[0], values[1], values[2]);
						} else {
								data.angularOffset = new Quat(data.angularOffset);
						}
				}
				var impl = this._createImplementation(data.type);
				impl.beforeInitialize(component, data);
				super.initializeComponentData(component, data, properties);
				impl.afterInitialize(component, data);
		}
		_createImplementation(type) {
				if (this.implementations[type] === undefined) {
						var impl;
						switch(type){
								case 'box':
										impl = new CollisionBoxSystemImpl(this);
										break;
								case 'sphere':
										impl = new CollisionSphereSystemImpl(this);
										break;
								case 'capsule':
										impl = new CollisionCapsuleSystemImpl(this);
										break;
								case 'cylinder':
										impl = new CollisionCylinderSystemImpl(this);
										break;
								case 'cone':
										impl = new CollisionConeSystemImpl(this);
										break;
								case 'mesh':
										impl = new CollisionMeshSystemImpl(this);
										break;
								case 'compound':
										impl = new CollisionCompoundSystemImpl(this);
										break;
						}
						this.implementations[type] = impl;
				}
				return this.implementations[type];
		}
		_getImplementation(entity) {
				return this.implementations[entity.collision.data.type];
		}
		cloneComponent(entity, clone) {
				return this._getImplementation(entity).clone(entity, clone);
		}
		onBeforeRemove(entity, component) {
				this.implementations[component.data.type].beforeRemove(entity, component);
				component.onBeforeRemove();
		}
		onRemove(entity, data) {
				this.implementations[data.type].remove(entity, data);
		}
		updateCompoundChildTransform(entity, forceUpdate) {
				var parentComponent = entity.collision._compoundParent;
				if (parentComponent === entity.collision) return;
				if (entity.enabled && entity.collision.enabled && (entity._dirtyLocal || forceUpdate)) {
						var transform = this._getNodeTransform(entity, parentComponent.entity);
						var idx = parentComponent.getCompoundChildShapeIndex(entity.collision.shape);
						if (idx === null) {
								parentComponent.shape.addChildShape(transform, entity.collision.data.shape);
						} else {
								parentComponent.shape.updateChildTransform(idx, transform, true);
						}
						Ammo.destroy(transform);
				}
		}
		_removeCompoundChild(collision, shape) {
				if (collision.shape.getNumChildShapes() === 0) {
						return;
				}
				if (collision.shape.removeChildShape) {
						collision.shape.removeChildShape(shape);
				} else {
						var ind = collision.getCompoundChildShapeIndex(shape);
						if (ind !== null) {
								collision.shape.removeChildShapeByIndex(ind);
						}
				}
		}
		onTransformChanged(component, position, rotation, scale) {
				this.implementations[component.data.type].updateTransform(component, position, rotation, scale);
		}
		changeType(component, previousType, newType) {
				this.implementations[previousType].beforeRemove(component.entity, component);
				this.implementations[previousType].remove(component.entity, component.data);
				this._createImplementation(newType).reset(component, component.data);
		}
		recreatePhysicalShapes(component) {
				this.implementations[component.data.type].recreatePhysicalShapes(component);
		}
		_calculateNodeRelativeTransform(node, relative) {
				if (node === relative) {
						var scale = node.getWorldTransform().getScale();
						mat4.setScale(scale.x, scale.y, scale.z);
				} else {
						this._calculateNodeRelativeTransform(node.parent, relative);
						mat4.mul(node.getLocalTransform());
				}
		}
		_getNodeScaling(node) {
				var wtm = node.getWorldTransform();
				var scl = wtm.getScale();
				return new Ammo.btVector3(scl.x, scl.y, scl.z);
		}
		_getNodeTransform(node, relative) {
				var pos, rot;
				if (relative) {
						this._calculateNodeRelativeTransform(node, relative);
						pos = p1;
						rot = quat;
						mat4.getTranslation(pos);
						rot.setFromMat4(mat4);
				} else {
						pos = node.getPosition();
						rot = node.getRotation();
				}
				var ammoQuat = new Ammo.btQuaternion();
				var transform = new Ammo.btTransform();
				transform.setIdentity();
				var origin = transform.getOrigin();
				var component = node.collision;
				if (component && component._hasOffset) {
						var lo = component.data.linearOffset;
						var ao = component.data.angularOffset;
						var newOrigin = p2;
						quat.copy(rot).transformVector(lo, newOrigin);
						newOrigin.add(pos);
						quat.copy(rot).mul(ao);
						origin.setValue(newOrigin.x, newOrigin.y, newOrigin.z);
						ammoQuat.setValue(quat.x, quat.y, quat.z, quat.w);
				} else {
						origin.setValue(pos.x, pos.y, pos.z);
						ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
				}
				transform.setRotation(ammoQuat);
				Ammo.destroy(ammoQuat);
				return transform;
		}
		destroy() {
				for(var key in this._triMeshCache){
						Ammo.destroy(this._triMeshCache[key]);
				}
				this._triMeshCache = null;
				super.destroy();
		}
		constructor(app){
				super(app);
				this.id = 'collision';
				this.ComponentType = CollisionComponent;
				this.DataType = CollisionComponentData;
				this.schema = _schema;
				this.implementations = {};
				this._triMeshCache = {};
				this.on('beforeremove', this.onBeforeRemove, this);
				this.on('remove', this.onRemove, this);
		}
}

export { CollisionComponentSystem };
