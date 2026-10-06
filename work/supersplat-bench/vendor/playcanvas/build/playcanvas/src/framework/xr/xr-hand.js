import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRHAND_LEFT } from './constants.js';
import { XrFinger } from './xr-finger.js';
import { XrJoint } from './xr-joint.js';

var fingerJointIds = [];
var vecA = new Vec3();
var vecB = new Vec3();
var vecC = new Vec3();
if (platform.browser && window.XRHand) {
		fingerJointIds = [
				[
						'thumb-metacarpal',
						'thumb-phalanx-proximal',
						'thumb-phalanx-distal',
						'thumb-tip'
				],
				[
						'index-finger-metacarpal',
						'index-finger-phalanx-proximal',
						'index-finger-phalanx-intermediate',
						'index-finger-phalanx-distal',
						'index-finger-tip'
				],
				[
						'middle-finger-metacarpal',
						'middle-finger-phalanx-proximal',
						'middle-finger-phalanx-intermediate',
						'middle-finger-phalanx-distal',
						'middle-finger-tip'
				],
				[
						'ring-finger-metacarpal',
						'ring-finger-phalanx-proximal',
						'ring-finger-phalanx-intermediate',
						'ring-finger-phalanx-distal',
						'ring-finger-tip'
				],
				[
						'pinky-finger-metacarpal',
						'pinky-finger-phalanx-proximal',
						'pinky-finger-phalanx-intermediate',
						'pinky-finger-phalanx-distal',
						'pinky-finger-tip'
				]
		];
}
class XrHand extends EventHandler {
		update(frame) {
				var xrInputSource = this._inputSource._xrInputSource;
				for(var j = 0; j < this._joints.length; j++){
						var joint = this._joints[j];
						var jointSpace = xrInputSource.hand.get(joint._id);
						if (jointSpace) {
								var pose = undefined;
								if (frame.session.visibilityState !== 'hidden') {
										pose = frame.getJointPose(jointSpace, this._manager._referenceSpace);
								}
								if (pose) {
										joint.update(pose);
										if (joint.wrist && !this._tracking) {
												this._tracking = true;
												this.fire('tracking');
										}
								} else if (joint.wrist) {
										if (this._tracking) {
												this._tracking = false;
												this.fire('trackinglost');
										}
										break;
								}
						}
				}
				var j1 = this._jointsById['thumb-metacarpal'];
				var j4 = this._jointsById['thumb-tip'];
				var j6 = this._jointsById['index-finger-phalanx-proximal'];
				var j9 = this._jointsById['index-finger-tip'];
				var j16 = this._jointsById['ring-finger-phalanx-proximal'];
				var j21 = this._jointsById['pinky-finger-phalanx-proximal'];
				if (j1 && j4 && j6 && j9 && j16 && j21) {
						this._inputSource._dirtyRay = true;
						this._inputSource._rayLocal.origin.lerp(j4._localPosition, j9._localPosition, 0.5);
						var jointL = j1;
						var jointR = j21;
						if (this._inputSource.handedness === XRHAND_LEFT) {
								var t = jointL;
								jointL = jointR;
								jointR = t;
						}
						vecA.sub2(jointL._localPosition, this._wrist._localPosition);
						vecB.sub2(jointR._localPosition, this._wrist._localPosition);
						vecC.cross(vecA, vecB).normalize();
						vecA.lerp(j6._localPosition, j16._localPosition, 0.5);
						vecA.sub(this._wrist._localPosition).normalize();
						this._inputSource._rayLocal.direction.lerp(vecC, vecA, 0.5).normalize();
				}
				var squeezing = this._fingerIsClosed(1) && this._fingerIsClosed(2) && this._fingerIsClosed(3) && this._fingerIsClosed(4);
				if (squeezing) {
						if (!this._inputSource._squeezing) {
								this._inputSource._squeezing = true;
								this._inputSource.fire('squeezestart');
								this._manager.input.fire('squeezestart', this._inputSource);
						}
				} else {
						if (this._inputSource._squeezing) {
								this._inputSource._squeezing = false;
								this._inputSource.fire('squeeze');
								this._manager.input.fire('squeeze', this._inputSource);
								this._inputSource.fire('squeezeend');
								this._manager.input.fire('squeezeend', this._inputSource);
						}
				}
		}
		_fingerIsClosed(index) {
				var finger = this._fingers[index];
				vecA.sub2(finger.joints[0]._localPosition, finger.joints[1]._localPosition).normalize();
				vecB.sub2(finger.joints[2]._localPosition, finger.joints[3]._localPosition).normalize();
				return vecA.dot(vecB) < -0.8;
		}
		getJointById(id) {
				return this._jointsById[id] || null;
		}
		get fingers() {
				return this._fingers;
		}
		get joints() {
				return this._joints;
		}
		get tips() {
				return this._tips;
		}
		get wrist() {
				return this._wrist;
		}
		get tracking() {
				return this._tracking;
		}
		constructor(inputSource){
				super(), this._tracking = false, this._fingers = [], this._joints = [], this._jointsById = {}, this._tips = [], this._wrist = null;
				var xrHand = inputSource._xrInputSource.hand;
				this._manager = inputSource._manager;
				this._inputSource = inputSource;
				if (xrHand.get('wrist')) {
						var joint = new XrJoint(0, 'wrist', this, null);
						this._wrist = joint;
						this._joints.push(joint);
						this._jointsById.wrist = joint;
				}
				for(var f = 0; f < fingerJointIds.length; f++){
						var finger = new XrFinger(f, this);
						for(var j = 0; j < fingerJointIds[f].length; j++){
								var jointId = fingerJointIds[f][j];
								if (!xrHand.get(jointId)) continue;
								var joint1 = new XrJoint(j, jointId, this, finger);
								this._joints.push(joint1);
								this._jointsById[jointId] = joint1;
								if (joint1.tip) {
										this._tips.push(joint1);
										finger._tip = joint1;
								}
								finger._joints.push(joint1);
						}
				}
		}
}
XrHand.EVENT_TRACKING = 'tracking';
XrHand.EVENT_TRACKINGLOST = 'trackinglost';

export { XrHand };
