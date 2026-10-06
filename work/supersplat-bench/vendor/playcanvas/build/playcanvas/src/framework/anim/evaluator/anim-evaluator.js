import { AnimTargetValue } from './anim-target-value.js';
import { AnimBlend } from './anim-blend.js';

class AnimEvaluator {
		get clips() {
				return this._clips;
		}
		addClip(clip) {
				var targets = this._targets;
				var binder = this._binder;
				var curves = clip.track.curves;
				var snapshot = clip.snapshot;
				var inputs = [];
				var outputs = [];
				for(var i = 0; i < curves.length; ++i){
						var curve = curves[i];
						var paths = curve.paths;
						for(var j = 0; j < paths.length; ++j){
								var path = paths[j];
								var resolved = binder.resolve(path);
								var target = targets[resolved && resolved.targetPath || null];
								if (!target && resolved) {
										target = {
												target: resolved,
												value: [],
												curves: 0,
												blendCounter: 0
										};
										for(var k = 0; k < target.target.components; ++k){
												target.value.push(0);
										}
										targets[resolved.targetPath] = target;
										if (binder.animComponent) {
												if (!binder.animComponent.targets[resolved.targetPath]) {
														var type = undefined;
														if (resolved.targetPath.substring(resolved.targetPath.length - 13) === 'localRotation') {
																type = AnimTargetValue.TYPE_QUAT;
														} else {
																type = AnimTargetValue.TYPE_VEC3;
														}
														binder.animComponent.targets[resolved.targetPath] = new AnimTargetValue(binder.animComponent, type);
												}
												binder.animComponent.targets[resolved.targetPath].layerCounter++;
												binder.animComponent.targets[resolved.targetPath].setMask(binder.layerIndex, 1);
										}
								}
								if (target) {
										target.curves++;
										inputs.push(snapshot._results[i]);
										outputs.push(target);
								}
						}
				}
				this._clips.push(clip);
				this._inputs.push(inputs);
				this._outputs.push(outputs);
		}
		removeClip(index) {
				var targets = this._targets;
				var binder = this._binder;
				var clips = this._clips;
				var clip = clips[index];
				var curves = clip.track.curves;
				for(var i = 0; i < curves.length; ++i){
						var curve = curves[i];
						var paths = curve.paths;
						for(var j = 0; j < paths.length; ++j){
								var path = paths[j];
								var target = this._binder.resolve(path);
								if (target) {
										target.curves--;
										if (target.curves === 0) {
												binder.unresolve(path);
												delete targets[target.targetPath];
												if (binder.animComponent) {
														binder.animComponent.targets[target.targetPath].layerCounter--;
												}
										}
								}
						}
				}
				clips.splice(index, 1);
				this._inputs.splice(index, 1);
				this._outputs.splice(index, 1);
		}
		removeClips() {
				while(this._clips.length > 0){
						this.removeClip(0);
				}
		}
		updateClipTrack(name, animTrack) {
				this._clips.forEach((clip)=>{
						if (clip.name.includes(name)) {
								clip.track = animTrack;
						}
				});
				this.rebind();
		}
		findClip(name) {
				var clips = this._clips;
				for(var i = 0; i < clips.length; ++i){
						var clip = clips[i];
						if (clip.name === name) {
								return clip;
						}
				}
				return null;
		}
		rebind() {
				this._binder.rebind();
				this._targets = {};
				var clips = [
						...this.clips
				];
				this.removeClips();
				clips.forEach((clip)=>{
						this.addClip(clip);
				});
		}
		assignMask(mask) {
				return this._binder.assignMask(mask);
		}
		update(deltaTime, outputAnimation) {
				if (outputAnimation === undefined) outputAnimation = true;
				var clips = this._clips;
				var order = clips.map((c, i)=>{
						return i;
				});
				AnimBlend.stableSort(order, (a, b)=>{
						return clips[a].blendOrder < clips[b].blendOrder;
				});
				for(var i = 0; i < order.length; ++i){
						var index = order[i];
						var clip = clips[index];
						var inputs = this._inputs[index];
						var outputs = this._outputs[index];
						var blendWeight = clip.blendWeight;
						if (blendWeight > 0.0) {
								clip._update(deltaTime);
						}
						if (!outputAnimation) break;
						var input = undefined;
						var output = undefined;
						var value = undefined;
						if (blendWeight >= 1.0) {
								for(var j = 0; j < inputs.length; ++j){
										input = inputs[j];
										output = outputs[j];
										value = output.value;
										AnimBlend.set(value, input, output.target.type);
										output.blendCounter++;
								}
						} else if (blendWeight > 0.0) {
								for(var j1 = 0; j1 < inputs.length; ++j1){
										input = inputs[j1];
										output = outputs[j1];
										value = output.value;
										if (output.blendCounter === 0) {
												AnimBlend.set(value, input, output.target.type);
										} else {
												AnimBlend.blend(value, input, blendWeight, output.target.type);
										}
										output.blendCounter++;
								}
						}
				}
				var targets = this._targets;
				var binder = this._binder;
				for(var path in targets){
						if (targets.hasOwnProperty(path)) {
								var target = targets[path];
								if (binder.animComponent && target.target.isTransform) {
										var animTarget = binder.animComponent.targets[path];
										if (animTarget.counter === animTarget.layerCounter) {
												animTarget.counter = 0;
										}
										if (!animTarget.path) {
												animTarget.path = path;
												animTarget.baseValue = target.target.get();
												animTarget.setter = target.target.set;
										}
										animTarget.updateValue(binder.layerIndex, target.value);
										animTarget.counter++;
								} else {
										target.target.set(target.value);
								}
								target.blendCounter = 0;
						}
				}
				this._binder.update(deltaTime);
		}
		constructor(binder){
				this._binder = binder;
				this._clips = [];
				this._inputs = [];
				this._outputs = [];
				this._targets = {};
		}
}

export { AnimEvaluator };
