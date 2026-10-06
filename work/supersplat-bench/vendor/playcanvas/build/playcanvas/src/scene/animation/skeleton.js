import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

class InterpolatedKey {
		getTarget() {
				return this._targetNode;
		}
		setTarget(node) {
				this._targetNode = node;
		}
		constructor(){
				this._written = false;
				this._name = '';
				this._keyFrames = [];
				this._quat = new Quat();
				this._pos = new Vec3();
				this._scale = new Vec3();
				this._targetNode = null;
		}
}
class Skeleton {
		set animation(value) {
				this._animation = value;
				this.currentTime = 0;
		}
		get animation() {
				return this._animation;
		}
		set currentTime(value) {
				this._time = value;
				var numNodes = this._interpolatedKeys.length;
				for(var i = 0; i < numNodes; i++){
						var node = this._interpolatedKeys[i];
						var nodeName = node._name;
						this._currKeyIndices[nodeName] = 0;
				}
				this.addTime(0);
				this.updateGraph();
		}
		get currentTime() {
				return this._time;
		}
		get numNodes() {
				return this._interpolatedKeys.length;
		}
		addTime(delta) {
				if (this._animation !== null) {
						var nodes = this._animation._nodes;
						var duration = this._animation.duration;
						if (this._time === duration && !this.looping) {
								return;
						}
						this._time += delta;
						if (this._time > duration) {
								this._time = this.looping ? 0.0 : duration;
								for(var i = 0; i < nodes.length; i++){
										var node = nodes[i];
										var nodeName = node._name;
										this._currKeyIndices[nodeName] = 0;
								}
						} else if (this._time < 0) {
								this._time = this.looping ? duration : 0.0;
								for(var i1 = 0; i1 < nodes.length; i1++){
										var node1 = nodes[i1];
										var nodeName1 = node1._name;
										this._currKeyIndices[nodeName1] = node1._keys.length - 2;
								}
						}
						var offset = delta >= 0 ? 1 : -1;
						for(var i2 = 0; i2 < nodes.length; i2++){
								var node2 = nodes[i2];
								var nodeName2 = node2._name;
								var keys = node2._keys;
								var interpKey = this._interpolatedKeyDict[nodeName2];
								if (interpKey === undefined) {
										continue;
								}
								var foundKey = false;
								if (keys.length !== 1) {
										for(var currKeyIndex = this._currKeyIndices[nodeName2]; currKeyIndex < keys.length - 1 && currKeyIndex >= 0; currKeyIndex += offset){
												var k1 = keys[currKeyIndex];
												var k2 = keys[currKeyIndex + 1];
												if (k1.time <= this._time && k2.time >= this._time) {
														var alpha = (this._time - k1.time) / (k2.time - k1.time);
														interpKey._pos.lerp(k1.position, k2.position, alpha);
														interpKey._quat.slerp(k1.rotation, k2.rotation, alpha);
														interpKey._scale.lerp(k1.scale, k2.scale, alpha);
														interpKey._written = true;
														this._currKeyIndices[nodeName2] = currKeyIndex;
														foundKey = true;
														break;
												}
										}
								}
								if (keys.length === 1 || !foundKey && this._time === 0.0 && this.looping) {
										interpKey._pos.copy(keys[0].position);
										interpKey._quat.copy(keys[0].rotation);
										interpKey._scale.copy(keys[0].scale);
										interpKey._written = true;
								}
						}
				}
		}
		blend(skel1, skel2, alpha) {
				var numNodes = this._interpolatedKeys.length;
				for(var i = 0; i < numNodes; i++){
						var key1 = skel1._interpolatedKeys[i];
						var key2 = skel2._interpolatedKeys[i];
						var dstKey = this._interpolatedKeys[i];
						if (key1._written && key2._written) {
								dstKey._quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha);
								dstKey._pos.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha);
								dstKey._scale.lerp(key1._scale, key2._scale, alpha);
								dstKey._written = true;
						} else if (key1._written) {
								dstKey._quat.copy(key1._quat);
								dstKey._pos.copy(key1._pos);
								dstKey._scale.copy(key1._scale);
								dstKey._written = true;
						} else if (key2._written) {
								dstKey._quat.copy(key2._quat);
								dstKey._pos.copy(key2._pos);
								dstKey._scale.copy(key2._scale);
								dstKey._written = true;
						}
				}
		}
		setGraph(graph) {
				this.graph = graph;
				if (graph) {
						for(var i = 0; i < this._interpolatedKeys.length; i++){
								var interpKey = this._interpolatedKeys[i];
								var graphNode = graph.findByName(interpKey._name);
								this._interpolatedKeys[i].setTarget(graphNode);
						}
				} else {
						for(var i1 = 0; i1 < this._interpolatedKeys.length; i1++){
								this._interpolatedKeys[i1].setTarget(null);
						}
				}
		}
		updateGraph() {
				if (this.graph) {
						for(var i = 0; i < this._interpolatedKeys.length; i++){
								var interpKey = this._interpolatedKeys[i];
								if (interpKey._written) {
										var transform = interpKey.getTarget();
										transform.localPosition.copy(interpKey._pos);
										transform.localRotation.copy(interpKey._quat);
										transform.localScale.copy(interpKey._scale);
										if (!transform._dirtyLocal) {
												transform._dirtifyLocal();
										}
										interpKey._written = false;
								}
						}
				}
		}
		constructor(graph){
				this.looping = true;
				this._animation = null;
				this._time = 0;
				this._interpolatedKeys = [];
				this._interpolatedKeyDict = {};
				this._currKeyIndices = {};
				this.graph = null;
				var addInterpolatedKeys = (node)=>{
						var interpKey = new InterpolatedKey();
						interpKey._name = node.name;
						this._interpolatedKeys.push(interpKey);
						this._interpolatedKeyDict[node.name] = interpKey;
						this._currKeyIndices[node.name] = 0;
						for(var i = 0; i < node._children.length; i++){
								addInterpolatedKeys(node._children[i]);
						}
				};
				addInterpolatedKeys(graph);
		}
}

export { Skeleton };
