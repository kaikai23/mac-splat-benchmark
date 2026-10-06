import { ObjectPool } from '../../../core/object-pool.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { BODYFLAG_NORESPONSE_OBJECT } from './constants.js';
import { RigidBodyComponent } from './component.js';
import { RigidBodyComponentData } from './data.js';

var ammoRayStart, ammoRayEnd;
class RaycastResult {
		constructor(entity, point, normal, hitFraction){
				this.entity = entity;
				this.point = point;
				this.normal = normal;
				this.hitFraction = hitFraction;
		}
}
class SingleContactResult {
		constructor(a, b, contactPoint){
				if (arguments.length !== 0) {
						this.a = a;
						this.b = b;
						this.impulse = contactPoint.impulse;
						this.localPointA = contactPoint.localPoint;
						this.localPointB = contactPoint.localPointOther;
						this.pointA = contactPoint.point;
						this.pointB = contactPoint.pointOther;
						this.normal = contactPoint.normal;
				} else {
						this.a = null;
						this.b = null;
						this.impulse = 0;
						this.localPointA = new Vec3();
						this.localPointB = new Vec3();
						this.pointA = new Vec3();
						this.pointB = new Vec3();
						this.normal = new Vec3();
				}
		}
}
class ContactPoint {
		constructor(localPoint = new Vec3(), localPointOther = new Vec3(), point = new Vec3(), pointOther = new Vec3(), normal = new Vec3(), impulse = 0){
				this.localPoint = localPoint;
				this.localPointOther = localPointOther;
				this.point = point;
				this.pointOther = pointOther;
				this.normal = normal;
				this.impulse = impulse;
		}
}
class ContactResult {
		constructor(other, contacts){
				this.other = other;
				this.contacts = contacts;
		}
}
var _schema = [
		'enabled'
];
class RigidBodyComponentSystem extends ComponentSystem {
		onLibraryLoaded() {
				if (typeof Ammo !== 'undefined') {
						this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
						this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
						this.overlappingPairCache = new Ammo.btDbvtBroadphase();
						this.solver = new Ammo.btSequentialImpulseConstraintSolver();
						this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);
						if (this.dynamicsWorld.setInternalTickCallback) {
								var checkForCollisionsPointer = Ammo.addFunction(this._checkForCollisions.bind(this), 'vif');
								this.dynamicsWorld.setInternalTickCallback(checkForCollisionsPointer);
						}
						ammoRayStart = new Ammo.btVector3();
						ammoRayEnd = new Ammo.btVector3();
						RigidBodyComponent.onLibraryLoaded();
						this.contactPointPool = new ObjectPool(ContactPoint, 1);
						this.contactResultPool = new ObjectPool(ContactResult, 1);
						this.singleContactResultPool = new ObjectPool(SingleContactResult, 1);
						this.app.systems.on('update', this.onUpdate, this);
				} else {
						this.app.systems.off('update', this.onUpdate, this);
				}
		}
		initializeComponentData(component, data, properties) {
				var props = [
						'mass',
						'linearDamping',
						'angularDamping',
						'linearFactor',
						'angularFactor',
						'friction',
						'rollingFriction',
						'restitution',
						'type',
						'group',
						'mask'
				];
				for (var property of props){
						if (data.hasOwnProperty(property)) {
								var value = data[property];
								if (Array.isArray(value)) {
										component[property] = new Vec3(value[0], value[1], value[2]);
								} else {
										component[property] = value;
								}
						}
				}
				super.initializeComponentData(component, data, [
						'enabled'
				]);
		}
		cloneComponent(entity, clone) {
				var rigidbody = entity.rigidbody;
				var data = {
						enabled: rigidbody.enabled,
						mass: rigidbody.mass,
						linearDamping: rigidbody.linearDamping,
						angularDamping: rigidbody.angularDamping,
						linearFactor: [
								rigidbody.linearFactor.x,
								rigidbody.linearFactor.y,
								rigidbody.linearFactor.z
						],
						angularFactor: [
								rigidbody.angularFactor.x,
								rigidbody.angularFactor.y,
								rigidbody.angularFactor.z
						],
						friction: rigidbody.friction,
						rollingFriction: rigidbody.rollingFriction,
						restitution: rigidbody.restitution,
						type: rigidbody.type,
						group: rigidbody.group,
						mask: rigidbody.mask
				};
				return this.addComponent(clone, data);
		}
		onBeforeRemove(entity, component) {
				if (component.enabled) {
						component.enabled = false;
				}
				if (component.body) {
						this.destroyBody(component.body);
						component.body = null;
				}
		}
		addBody(body, group, mask) {
				if (group !== undefined && mask !== undefined) {
						this.dynamicsWorld.addRigidBody(body, group, mask);
				} else {
						this.dynamicsWorld.addRigidBody(body);
				}
		}
		removeBody(body) {
				this.dynamicsWorld.removeRigidBody(body);
		}
		createBody(mass, shape, transform) {
				var localInertia = new Ammo.btVector3(0, 0, 0);
				if (mass !== 0) {
						shape.calculateLocalInertia(mass, localInertia);
				}
				var motionState = new Ammo.btDefaultMotionState(transform);
				var bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
				var body = new Ammo.btRigidBody(bodyInfo);
				Ammo.destroy(bodyInfo);
				Ammo.destroy(localInertia);
				return body;
		}
		destroyBody(body) {
				var motionState = body.getMotionState();
				if (motionState) {
						Ammo.destroy(motionState);
				}
				Ammo.destroy(body);
		}
		raycastFirst(start, end, options) {
				if (options === undefined) options = {};
				if (options.filterTags || options.filterCallback) {
						options.sort = true;
						return this.raycastAll(start, end, options)[0] || null;
				}
				var result = null;
				ammoRayStart.setValue(start.x, start.y, start.z);
				ammoRayEnd.setValue(end.x, end.y, end.z);
				var rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);
				if (typeof options.filterCollisionGroup === 'number') {
						rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
				}
				if (typeof options.filterCollisionMask === 'number') {
						rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
				}
				this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
				if (rayCallback.hasHit()) {
						var collisionObj = rayCallback.get_m_collisionObject();
						var body = Ammo.castObject(collisionObj, Ammo.btRigidBody);
						if (body) {
								var point = rayCallback.get_m_hitPointWorld();
								var normal = rayCallback.get_m_hitNormalWorld();
								result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), rayCallback.get_m_closestHitFraction());
						}
				}
				Ammo.destroy(rayCallback);
				return result;
		}
		raycastAll(start, end, options) {
				if (options === undefined) options = {};
				var results = [];
				ammoRayStart.setValue(start.x, start.y, start.z);
				ammoRayEnd.setValue(end.x, end.y, end.z);
				var rayCallback = new Ammo.AllHitsRayResultCallback(ammoRayStart, ammoRayEnd);
				if (typeof options.filterCollisionGroup === 'number') {
						rayCallback.set_m_collisionFilterGroup(options.filterCollisionGroup);
				}
				if (typeof options.filterCollisionMask === 'number') {
						rayCallback.set_m_collisionFilterMask(options.filterCollisionMask);
				}
				this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
				if (rayCallback.hasHit()) {
						var collisionObjs = rayCallback.get_m_collisionObjects();
						var points = rayCallback.get_m_hitPointWorld();
						var normals = rayCallback.get_m_hitNormalWorld();
						var hitFractions = rayCallback.get_m_hitFractions();
						var numHits = collisionObjs.size();
						for(var i = 0; i < numHits; i++){
								var body = Ammo.castObject(collisionObjs.at(i), Ammo.btRigidBody);
								if (body && body.entity) {
										if (options.filterTags && !body.entity.tags.has(...options.filterTags) || options.filterCallback && !options.filterCallback(body.entity)) {
												continue;
										}
										var point = points.at(i);
										var normal = normals.at(i);
										var result = new RaycastResult(body.entity, new Vec3(point.x(), point.y(), point.z()), new Vec3(normal.x(), normal.y(), normal.z()), hitFractions.at(i));
										results.push(result);
								}
						}
						if (options.sort) {
								results.sort((a, b)=>a.hitFraction - b.hitFraction);
						}
				}
				Ammo.destroy(rayCallback);
				return results;
		}
		_storeCollision(entity, other) {
				var isNewCollision = false;
				var guid = entity.getGuid();
				this.collisions[guid] = this.collisions[guid] || {
						others: [],
						entity: entity
				};
				if (this.collisions[guid].others.indexOf(other) < 0) {
						this.collisions[guid].others.push(other);
						isNewCollision = true;
				}
				this.frameCollisions[guid] = this.frameCollisions[guid] || {
						others: [],
						entity: entity
				};
				this.frameCollisions[guid].others.push(other);
				return isNewCollision;
		}
		_createContactPointFromAmmo(contactPoint) {
				var localPointA = contactPoint.get_m_localPointA();
				var localPointB = contactPoint.get_m_localPointB();
				var positionWorldOnA = contactPoint.getPositionWorldOnA();
				var positionWorldOnB = contactPoint.getPositionWorldOnB();
				var normalWorldOnB = contactPoint.get_m_normalWorldOnB();
				var contact = this.contactPointPool.allocate();
				contact.localPoint.set(localPointA.x(), localPointA.y(), localPointA.z());
				contact.localPointOther.set(localPointB.x(), localPointB.y(), localPointB.z());
				contact.point.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
				contact.pointOther.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
				contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
				contact.impulse = contactPoint.getAppliedImpulse();
				return contact;
		}
		_createReverseContactPointFromAmmo(contactPoint) {
				var localPointA = contactPoint.get_m_localPointA();
				var localPointB = contactPoint.get_m_localPointB();
				var positionWorldOnA = contactPoint.getPositionWorldOnA();
				var positionWorldOnB = contactPoint.getPositionWorldOnB();
				var normalWorldOnB = contactPoint.get_m_normalWorldOnB();
				var contact = this.contactPointPool.allocate();
				contact.localPointOther.set(localPointA.x(), localPointA.y(), localPointA.z());
				contact.localPoint.set(localPointB.x(), localPointB.y(), localPointB.z());
				contact.pointOther.set(positionWorldOnA.x(), positionWorldOnA.y(), positionWorldOnA.z());
				contact.point.set(positionWorldOnB.x(), positionWorldOnB.y(), positionWorldOnB.z());
				contact.normal.set(normalWorldOnB.x(), normalWorldOnB.y(), normalWorldOnB.z());
				contact.impulse = contactPoint.getAppliedImpulse();
				return contact;
		}
		_createSingleContactResult(a, b, contactPoint) {
				var result = this.singleContactResultPool.allocate();
				result.a = a;
				result.b = b;
				result.localPointA = contactPoint.localPoint;
				result.localPointB = contactPoint.localPointOther;
				result.pointA = contactPoint.point;
				result.pointB = contactPoint.pointOther;
				result.normal = contactPoint.normal;
				result.impulse = contactPoint.impulse;
				return result;
		}
		_createContactResult(other, contacts) {
				var result = this.contactResultPool.allocate();
				result.other = other;
				result.contacts = contacts;
				return result;
		}
		_cleanOldCollisions() {
				for(var guid in this.collisions){
						if (this.collisions.hasOwnProperty(guid)) {
								var frameCollision = this.frameCollisions[guid];
								var collision = this.collisions[guid];
								var entity = collision.entity;
								var entityCollision = entity.collision;
								var entityRigidbody = entity.rigidbody;
								var others = collision.others;
								var length = others.length;
								var i = length;
								while(i--){
										var other = others[i];
										if (!frameCollision || frameCollision.others.indexOf(other) < 0) {
												others.splice(i, 1);
												if (entity.trigger) {
														if (entityCollision) {
																entityCollision.fire('triggerleave', other);
														}
														if (other.rigidbody) {
																other.rigidbody.fire('triggerleave', entity);
														}
												} else if (!other.trigger) {
														if (entityRigidbody) {
																entityRigidbody.fire('collisionend', other);
														}
														if (entityCollision) {
																entityCollision.fire('collisionend', other);
														}
												}
										}
								}
								if (others.length === 0) {
										delete this.collisions[guid];
								}
						}
				}
		}
		_hasContactEvent(entity) {
				var c = entity.collision;
				if (c && (c.hasEvent('collisionstart') || c.hasEvent('collisionend') || c.hasEvent('contact'))) {
						return true;
				}
				var r = entity.rigidbody;
				return r && (r.hasEvent('collisionstart') || r.hasEvent('collisionend') || r.hasEvent('contact'));
		}
		_checkForCollisions(world, timeStep) {
				var dynamicsWorld = Ammo.wrapPointer(world, Ammo.btDynamicsWorld);
				var dispatcher = dynamicsWorld.getDispatcher();
				var numManifolds = dispatcher.getNumManifolds();
				this.frameCollisions = {};
				for(var i = 0; i < numManifolds; i++){
						var manifold = dispatcher.getManifoldByIndexInternal(i);
						var body0 = manifold.getBody0();
						var body1 = manifold.getBody1();
						var wb0 = Ammo.castObject(body0, Ammo.btRigidBody);
						var wb1 = Ammo.castObject(body1, Ammo.btRigidBody);
						var e0 = wb0.entity;
						var e1 = wb1.entity;
						if (!e0 || !e1) {
								continue;
						}
						var flags0 = wb0.getCollisionFlags();
						var flags1 = wb1.getCollisionFlags();
						var numContacts = manifold.getNumContacts();
						var forwardContacts = [];
						var reverseContacts = [];
						var newCollision = undefined;
						if (numContacts > 0) {
								if (flags0 & BODYFLAG_NORESPONSE_OBJECT || flags1 & BODYFLAG_NORESPONSE_OBJECT) {
										var e0Events = e0.collision && (e0.collision.hasEvent('triggerenter') || e0.collision.hasEvent('triggerleave'));
										var e1Events = e1.collision && (e1.collision.hasEvent('triggerenter') || e1.collision.hasEvent('triggerleave'));
										var e0BodyEvents = e0.rigidbody && (e0.rigidbody.hasEvent('triggerenter') || e0.rigidbody.hasEvent('triggerleave'));
										var e1BodyEvents = e1.rigidbody && (e1.rigidbody.hasEvent('triggerenter') || e1.rigidbody.hasEvent('triggerleave'));
										if (e0Events) {
												newCollision = this._storeCollision(e0, e1);
												if (newCollision && !(flags1 & BODYFLAG_NORESPONSE_OBJECT)) {
														e0.collision.fire('triggerenter', e1);
												}
										}
										if (e1Events) {
												newCollision = this._storeCollision(e1, e0);
												if (newCollision && !(flags0 & BODYFLAG_NORESPONSE_OBJECT)) {
														e1.collision.fire('triggerenter', e0);
												}
										}
										if (e0BodyEvents) {
												if (!newCollision) {
														newCollision = this._storeCollision(e1, e0);
												}
												if (newCollision) {
														e0.rigidbody.fire('triggerenter', e1);
												}
										}
										if (e1BodyEvents) {
												if (!newCollision) {
														newCollision = this._storeCollision(e0, e1);
												}
												if (newCollision) {
														e1.rigidbody.fire('triggerenter', e0);
												}
										}
								} else {
										var e0Events1 = this._hasContactEvent(e0);
										var e1Events1 = this._hasContactEvent(e1);
										var globalEvents = this.hasEvent('contact');
										if (globalEvents || e0Events1 || e1Events1) {
												for(var j = 0; j < numContacts; j++){
														var btContactPoint = manifold.getContactPoint(j);
														var contactPoint = this._createContactPointFromAmmo(btContactPoint);
														if (e0Events1 || e1Events1) {
																forwardContacts.push(contactPoint);
																var reverseContactPoint = this._createReverseContactPointFromAmmo(btContactPoint);
																reverseContacts.push(reverseContactPoint);
														}
														if (globalEvents) {
																var result = this._createSingleContactResult(e0, e1, contactPoint);
																this.fire('contact', result);
														}
												}
												if (e0Events1) {
														var forwardResult = this._createContactResult(e1, forwardContacts);
														newCollision = this._storeCollision(e0, e1);
														if (e0.collision) {
																e0.collision.fire('contact', forwardResult);
																if (newCollision) {
																		e0.collision.fire('collisionstart', forwardResult);
																}
														}
														if (e0.rigidbody) {
																e0.rigidbody.fire('contact', forwardResult);
																if (newCollision) {
																		e0.rigidbody.fire('collisionstart', forwardResult);
																}
														}
												}
												if (e1Events1) {
														var reverseResult = this._createContactResult(e0, reverseContacts);
														newCollision = this._storeCollision(e1, e0);
														if (e1.collision) {
																e1.collision.fire('contact', reverseResult);
																if (newCollision) {
																		e1.collision.fire('collisionstart', reverseResult);
																}
														}
														if (e1.rigidbody) {
																e1.rigidbody.fire('contact', reverseResult);
																if (newCollision) {
																		e1.rigidbody.fire('collisionstart', reverseResult);
																}
														}
												}
										}
								}
						}
				}
				this._cleanOldCollisions();
				this.contactPointPool.freeAll();
				this.contactResultPool.freeAll();
				this.singleContactResultPool.freeAll();
		}
		onUpdate(dt) {
				var i, len;
				this._gravityFloat32[0] = this.gravity.x;
				this._gravityFloat32[1] = this.gravity.y;
				this._gravityFloat32[2] = this.gravity.z;
				var gravity = this.dynamicsWorld.getGravity();
				if (gravity.x() !== this._gravityFloat32[0] || gravity.y() !== this._gravityFloat32[1] || gravity.z() !== this._gravityFloat32[2]) {
						gravity.setValue(this.gravity.x, this.gravity.y, this.gravity.z);
						this.dynamicsWorld.setGravity(gravity);
				}
				var triggers = this._triggers;
				for(i = 0, len = triggers.length; i < len; i++){
						triggers[i].updateTransform();
				}
				var compounds = this._compounds;
				for(i = 0, len = compounds.length; i < len; i++){
						compounds[i]._updateCompound();
				}
				var kinematic = this._kinematic;
				for(i = 0, len = kinematic.length; i < len; i++){
						kinematic[i]._updateKinematic();
				}
				this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);
				var dynamic = this._dynamic;
				for(i = 0, len = dynamic.length; i < len; i++){
						dynamic[i]._updateDynamic();
				}
				if (!this.dynamicsWorld.setInternalTickCallback) {
						this._checkForCollisions(Ammo.getPointer(this.dynamicsWorld), dt);
				}
		}
		destroy() {
				super.destroy();
				this.app.systems.off('update', this.onUpdate, this);
				if (typeof Ammo !== 'undefined') {
						Ammo.destroy(this.dynamicsWorld);
						Ammo.destroy(this.solver);
						Ammo.destroy(this.overlappingPairCache);
						Ammo.destroy(this.dispatcher);
						Ammo.destroy(this.collisionConfiguration);
						Ammo.destroy(ammoRayStart);
						Ammo.destroy(ammoRayEnd);
						this.dynamicsWorld = null;
						this.solver = null;
						this.overlappingPairCache = null;
						this.dispatcher = null;
						this.collisionConfiguration = null;
						ammoRayStart = null;
						ammoRayEnd = null;
						RigidBodyComponent.onAppDestroy();
				}
		}
		constructor(app){
				super(app), this.maxSubSteps = 10, this.fixedTimeStep = 1 / 60, this.gravity = new Vec3(0, -9.81, 0), this._gravityFloat32 = new Float32Array(3), this._dynamic = [], this._kinematic = [], this._triggers = [], this._compounds = [];
				this.id = 'rigidbody';
				this._stats = app.stats.frame;
				this.ComponentType = RigidBodyComponent;
				this.DataType = RigidBodyComponentData;
				this.contactPointPool = null;
				this.contactResultPool = null;
				this.singleContactResultPool = null;
				this.schema = _schema;
				this.collisions = {};
				this.frameCollisions = {};
				this.on('beforeremove', this.onBeforeRemove, this);
		}
}
RigidBodyComponentSystem.EVENT_CONTACT = 'contact';
Component._buildAccessors(RigidBodyComponent.prototype, _schema);

export { ContactPoint, ContactResult, RaycastResult, RigidBodyComponentSystem, SingleContactResult };
