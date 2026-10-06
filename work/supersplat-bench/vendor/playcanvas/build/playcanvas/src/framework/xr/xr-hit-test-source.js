import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

var poolVec3 = [];
var poolQuat = [];
class XrHitTestSource extends EventHandler {
		remove() {
				if (!this._xrHitTestSource) {
						return;
				}
				var sources = this.manager.hitTest.sources;
				var ind = sources.indexOf(this);
				if (ind !== -1) sources.splice(ind, 1);
				this.onStop();
		}
		onStop() {
				this._xrHitTestSource.cancel();
				this._xrHitTestSource = null;
				this.fire('remove');
				this.manager.hitTest.fire('remove', this);
		}
		update(frame) {
				if (this._transient) {
						var transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
						for(var i = 0; i < transientResults.length; i++){
								var transientResult = transientResults[i];
								if (!transientResult.results.length) {
										continue;
								}
								var inputSource = undefined;
								if (transientResult.inputSource) {
										inputSource = this.manager.input._getByInputSource(transientResult.inputSource);
								}
								this.updateHitResults(transientResult.results, inputSource);
						}
				} else {
						var results = frame.getHitTestResults(this._xrHitTestSource);
						if (!results.length) {
								return;
						}
						this.updateHitResults(results);
				}
		}
		updateHitResults(results, inputSource) {
				if (this._inputSource && this._inputSource !== inputSource) {
						return;
				}
				var _poolVec3_pop;
				var origin = (_poolVec3_pop = poolVec3.pop()) != null ? _poolVec3_pop : new Vec3();
				if (inputSource) {
						origin.copy(inputSource.getOrigin());
				} else {
						origin.copy(this.manager.camera.getPosition());
				}
				var candidateDistance = Infinity;
				var candidateHitTestResult = null;
				var _poolVec3_pop1;
				var position = (_poolVec3_pop1 = poolVec3.pop()) != null ? _poolVec3_pop1 : new Vec3();
				var _poolQuat_pop;
				var rotation = (_poolQuat_pop = poolQuat.pop()) != null ? _poolQuat_pop : new Quat();
				for(var i = 0; i < results.length; i++){
						var pose = results[i].getPose(this.manager._referenceSpace);
						var distance = origin.distance(pose.transform.position);
						if (distance >= candidateDistance) {
								continue;
						}
						candidateDistance = distance;
						candidateHitTestResult = results[i];
						position.copy(pose.transform.position);
						rotation.copy(pose.transform.orientation);
				}
				this.fire('result', position, rotation, inputSource || this._inputSource, candidateHitTestResult);
				this.manager.hitTest.fire('result', this, position, rotation, inputSource || this._inputSource, candidateHitTestResult);
				poolVec3.push(origin);
				poolVec3.push(position);
				poolQuat.push(rotation);
		}
		constructor(manager, xrHitTestSource, transient, inputSource = null){
				super();
				this.manager = manager;
				this._xrHitTestSource = xrHitTestSource;
				this._transient = transient;
				this._inputSource = inputSource;
		}
}
XrHitTestSource.EVENT_REMOVE = 'remove';
XrHitTestSource.EVENT_RESULT = 'result';

export { XrHitTestSource };
