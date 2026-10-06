import { BODYFLAG_NORESPONSE_OBJECT, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_SIMULATION } from '../rigid-body/constants.js';

var _ammoVec1, _ammoQuat, _ammoTransform;
class Trigger {
		initialize(data) {
				var entity = this.entity;
				var shape = data.shape;
				if (shape && typeof Ammo !== 'undefined') {
						if (entity.trigger) {
								entity.trigger.destroy();
						}
						var mass = 1;
						var component = this.component;
						if (component) {
								var bodyPos = component.getShapePosition();
								var bodyRot = component.getShapeRotation();
								_ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
								_ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
						} else {
								var pos = entity.getPosition();
								var rot = entity.getRotation();
								_ammoVec1.setValue(pos.x, pos.y, pos.z);
								_ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
						}
						_ammoTransform.setOrigin(_ammoVec1);
						_ammoTransform.setRotation(_ammoQuat);
						var body = this.app.systems.rigidbody.createBody(mass, shape, _ammoTransform);
						body.setRestitution(0);
						body.setFriction(0);
						body.setDamping(0, 0);
						_ammoVec1.setValue(0, 0, 0);
						body.setLinearFactor(_ammoVec1);
						body.setAngularFactor(_ammoVec1);
						body.setCollisionFlags(body.getCollisionFlags() | BODYFLAG_NORESPONSE_OBJECT);
						body.entity = entity;
						this.body = body;
						if (this.component.enabled && entity.enabled) {
								this.enable();
						}
				}
		}
		destroy() {
				if (!this.body) return;
				this.disable();
				this.app.systems.rigidbody.destroyBody(this.body);
				this.body = null;
		}
		_getEntityTransform(transform) {
				var component = this.component;
				if (component) {
						var bodyPos = component.getShapePosition();
						var bodyRot = component.getShapeRotation();
						_ammoVec1.setValue(bodyPos.x, bodyPos.y, bodyPos.z);
						_ammoQuat.setValue(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
				} else {
						var pos = this.entity.getPosition();
						var rot = this.entity.getRotation();
						_ammoVec1.setValue(pos.x, pos.y, pos.z);
						_ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
				}
				transform.setOrigin(_ammoVec1);
				transform.setRotation(_ammoQuat);
		}
		updateTransform() {
				this._getEntityTransform(_ammoTransform);
				var body = this.body;
				body.setWorldTransform(_ammoTransform);
				body.activate();
		}
		enable() {
				var body = this.body;
				if (!body) return;
				var system = this.app.systems.rigidbody;
				var idx = system._triggers.indexOf(this);
				if (idx < 0) {
						system.addBody(body, BODYGROUP_TRIGGER, BODYMASK_NOT_STATIC ^ BODYGROUP_TRIGGER);
						system._triggers.push(this);
				}
				body.forceActivationState(BODYSTATE_ACTIVE_TAG);
				this.updateTransform();
		}
		disable() {
				var body = this.body;
				if (!body) return;
				var system = this.app.systems.rigidbody;
				var idx = system._triggers.indexOf(this);
				if (idx > -1) {
						system.removeBody(body);
						system._triggers.splice(idx, 1);
				}
				body.forceActivationState(BODYSTATE_DISABLE_SIMULATION);
		}
		constructor(app, component, data){
				this.entity = component.entity;
				this.component = component;
				this.app = app;
				if (typeof Ammo !== 'undefined' && !_ammoVec1) {
						_ammoVec1 = new Ammo.btVector3();
						_ammoQuat = new Ammo.btQuaternion();
						_ammoTransform = new Ammo.btTransform();
				}
				this.initialize(data);
		}
}

export { Trigger };
