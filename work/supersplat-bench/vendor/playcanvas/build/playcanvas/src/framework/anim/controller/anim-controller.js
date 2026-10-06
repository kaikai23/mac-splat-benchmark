import { sortPriority } from '../../../core/sort.js';
import { AnimClip } from '../evaluator/anim-clip.js';
import { ANIM_STATE_START, ANIM_STATE_END, ANIM_STATE_ANY, ANIM_NOT_EQUAL_TO, ANIM_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN, ANIM_GREATER_THAN, ANIM_INTERRUPTION_NEXT_PREV, ANIM_INTERRUPTION_PREV_NEXT, ANIM_INTERRUPTION_NEXT, ANIM_INTERRUPTION_PREV, ANIM_PARAMETER_TRIGGER, ANIM_CONTROL_STATES, ANIM_INTERRUPTION_NONE } from './constants.js';
import { AnimState } from './anim-state.js';
import { AnimNode } from './anim-node.js';
import { AnimTransition } from './anim-transition.js';

function _extends() {
		_extends = Object.assign || function(target) {
				for(var i = 1; i < arguments.length; i++){
						var source = arguments[i];
						for(var key in source){
								if (Object.prototype.hasOwnProperty.call(source, key)) {
										target[key] = source[key];
								}
						}
				}
				return target;
		};
		return _extends.apply(this, arguments);
}
class AnimController {
		get animEvaluator() {
				return this._animEvaluator;
		}
		set activeState(stateName) {
				this._activeStateName = stateName;
		}
		get activeState() {
				return this._findState(this._activeStateName);
		}
		get activeStateName() {
				return this._activeStateName;
		}
		get activeStateAnimations() {
				return this.activeState.animations;
		}
		set previousState(stateName) {
				this._previousStateName = stateName;
		}
		get previousState() {
				return this._findState(this._previousStateName);
		}
		get previousStateName() {
				return this._previousStateName;
		}
		get playable() {
				var playable = true;
				for(var i = 0; i < this._stateNames.length; i++){
						if (!this._states[this._stateNames[i]].playable) {
								playable = false;
						}
				}
				return playable;
		}
		set playing(value) {
				this._playing = value;
		}
		get playing() {
				return this._playing;
		}
		get activeStateProgress() {
				return this._getActiveStateProgressForTime(this._timeInState);
		}
		get activeStateDuration() {
				if (this._activeStateDurationDirty) {
						var maxDuration = 0.0;
						for(var i = 0; i < this.activeStateAnimations.length; i++){
								var activeClip = this._animEvaluator.findClip(this.activeStateAnimations[i].name);
								if (activeClip) {
										maxDuration = Math.max(maxDuration, activeClip.track.duration);
								}
						}
						this._activeStateDuration = maxDuration;
						this._activeStateDurationDirty = false;
				}
				return this._activeStateDuration;
		}
		set activeStateCurrentTime(time) {
				this._timeInStateBefore = time;
				this._timeInState = time;
				for(var i = 0; i < this.activeStateAnimations.length; i++){
						var clip = this.animEvaluator.findClip(this.activeStateAnimations[i].name);
						if (clip) {
								clip.time = time;
						}
				}
		}
		get activeStateCurrentTime() {
				return this._timeInState;
		}
		get transitioning() {
				return this._isTransitioning;
		}
		get transitionProgress() {
				return this._currTransitionTime / this._totalTransitionTime;
		}
		get states() {
				return this._stateNames;
		}
		assignMask(mask) {
				return this._animEvaluator.assignMask(mask);
		}
		_findState(stateName) {
				return this._states[stateName];
		}
		_getActiveStateProgressForTime(time) {
				if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END || this.activeStateName === ANIM_STATE_ANY) {
						return 1.0;
				}
				var activeClip = this._animEvaluator.findClip(this.activeStateAnimations[0].name);
				if (activeClip) {
						return activeClip.progressForTime(time);
				}
				return null;
		}
		_findTransitionsFromState(stateName) {
				var transitions = this._findTransitionsFromStateCache[stateName];
				if (!transitions) {
						transitions = this._transitions.filter((transition)=>{
								return transition.from === stateName;
						});
						sortPriority(transitions);
						this._findTransitionsFromStateCache[stateName] = transitions;
				}
				return transitions;
		}
		_findTransitionsBetweenStates(sourceStateName, destinationStateName) {
				var transitions = this._findTransitionsBetweenStatesCache[sourceStateName + "->" + destinationStateName];
				if (!transitions) {
						transitions = this._transitions.filter((transition)=>{
								return transition.from === sourceStateName && transition.to === destinationStateName;
						});
						sortPriority(transitions);
						this._findTransitionsBetweenStatesCache[sourceStateName + "->" + destinationStateName] = transitions;
				}
				return transitions;
		}
		_transitionHasConditionsMet(transition) {
				var conditions = transition.conditions;
				for(var i = 0; i < conditions.length; i++){
						var condition = conditions[i];
						var parameter = this._findParameter(condition.parameterName);
						switch(condition.predicate){
								case ANIM_GREATER_THAN:
										if (!(parameter.value > condition.value)) return false;
										break;
								case ANIM_LESS_THAN:
										if (!(parameter.value < condition.value)) return false;
										break;
								case ANIM_GREATER_THAN_EQUAL_TO:
										if (!(parameter.value >= condition.value)) return false;
										break;
								case ANIM_LESS_THAN_EQUAL_TO:
										if (!(parameter.value <= condition.value)) return false;
										break;
								case ANIM_EQUAL_TO:
										if (!(parameter.value === condition.value)) return false;
										break;
								case ANIM_NOT_EQUAL_TO:
										if (!(parameter.value !== condition.value)) return false;
										break;
						}
				}
				return true;
		}
		_findTransition(from, to) {
				var transitions = [];
				if (from && to) {
						transitions = transitions.concat(this._findTransitionsBetweenStates(from, to));
				} else {
						if (!this._isTransitioning) {
								transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
								transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
						} else {
								switch(this._transitionInterruptionSource){
										case ANIM_INTERRUPTION_PREV:
												transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
												transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
												break;
										case ANIM_INTERRUPTION_NEXT:
												transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
												transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
												break;
										case ANIM_INTERRUPTION_PREV_NEXT:
												transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
												transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
												transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
												break;
										case ANIM_INTERRUPTION_NEXT_PREV:
												transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
												transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
												transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
												break;
								}
						}
				}
				transitions = transitions.filter((transition)=>{
						if (transition.to === this.activeStateName) {
								return false;
						}
						if (transition.hasExitTime) {
								var progressBefore = this._getActiveStateProgressForTime(this._timeInStateBefore);
								var progress = this._getActiveStateProgressForTime(this._timeInState);
								if (transition.exitTime < 1.0 && this.activeState.loop) {
										progressBefore -= Math.floor(progressBefore);
										progress -= Math.floor(progress);
								}
								if (progress === progressBefore) {
										if (progress !== transition.exitTime) {
												return null;
										}
								} else if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
										return null;
								}
						}
						return this._transitionHasConditionsMet(transition);
				});
				if (transitions.length > 0) {
						var transition = transitions[0];
						if (transition.to === ANIM_STATE_END) {
								var startTransition = this._findTransitionsFromState(ANIM_STATE_START)[0];
								transition.to = startTransition.to;
						}
						return transition;
				}
				return null;
		}
		updateStateFromTransition(transition) {
				var state;
				var animation;
				var clip;
				this.previousState = transition.from ? this.activeStateName : null;
				this.activeState = transition.to;
				this._activeStateDurationDirty = true;
				for(var i = 0; i < transition.conditions.length; i++){
						var condition = transition.conditions[i];
						var parameter = this._findParameter(condition.parameterName);
						if (parameter.type === ANIM_PARAMETER_TRIGGER) {
								this._consumeTrigger(condition.parameterName);
						}
				}
				if (this.previousState) {
						if (!this._isTransitioning) {
								this._transitionPreviousStates = [];
						}
						this._transitionPreviousStates.push({
								name: this._previousStateName,
								weight: 1
						});
						var interpolatedTime = Math.min(this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1, 1.0);
						for(var i1 = 0; i1 < this._transitionPreviousStates.length; i1++){
								if (!this._isTransitioning) {
										this._transitionPreviousStates[i1].weight = 1.0;
								} else if (i1 !== this._transitionPreviousStates.length - 1) {
										this._transitionPreviousStates[i1].weight *= 1.0 - interpolatedTime;
								} else {
										this._transitionPreviousStates[i1].weight = interpolatedTime;
								}
								state = this._findState(this._transitionPreviousStates[i1].name);
								for(var j = 0; j < state.animations.length; j++){
										animation = state.animations[j];
										clip = this._animEvaluator.findClip(animation.name + ".previous." + i1);
										if (!clip) {
												clip = this._animEvaluator.findClip(animation.name);
												clip.name = animation.name + ".previous." + i1;
										}
										if (i1 !== this._transitionPreviousStates.length - 1) {
												clip.pause();
										}
								}
						}
				}
				this._isTransitioning = true;
				this._totalTransitionTime = transition.time;
				this._currTransitionTime = 0;
				this._transitionInterruptionSource = transition.interruptionSource;
				var activeState = this.activeState;
				var hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;
				var timeInState = 0;
				var timeInStateBefore = 0;
				if (hasTransitionOffset) {
						var offsetTime = activeState.timelineDuration * transition.transitionOffset;
						timeInState = offsetTime;
						timeInStateBefore = offsetTime;
				}
				this._timeInState = timeInState;
				this._timeInStateBefore = timeInStateBefore;
				for(var i2 = 0; i2 < activeState.animations.length; i2++){
						clip = this._animEvaluator.findClip(activeState.animations[i2].name);
						if (!clip) {
								var speed = Number.isFinite(activeState.animations[i2].speed) ? activeState.animations[i2].speed : activeState.speed;
								clip = new AnimClip(activeState.animations[i2].animTrack, this._timeInState, speed, true, activeState.loop, this._eventHandler);
								clip.name = activeState.animations[i2].name;
								this._animEvaluator.addClip(clip);
						} else {
								clip.reset();
						}
						if (transition.time > 0) {
								clip.blendWeight = 0.0;
						} else {
								clip.blendWeight = activeState.animations[i2].normalizedWeight;
						}
						clip.play();
						if (hasTransitionOffset) {
								clip.time = activeState.timelineDuration * transition.transitionOffset;
						} else {
								var startTime = activeState.speed >= 0 ? 0 : this.activeStateDuration;
								clip.time = startTime;
						}
				}
		}
		_transitionToState(newStateName) {
				if (!this._findState(newStateName)) {
						return;
				}
				var transition = this._findTransition(this._activeStateName, newStateName);
				if (!transition) {
						this._animEvaluator.removeClips();
						transition = new AnimTransition({
								from: null,
								to: newStateName
						});
				}
				this.updateStateFromTransition(transition);
		}
		assignAnimation(pathString, animTrack, speed, loop) {
				var path = pathString.split('.');
				var state = this._findState(path[0]);
				if (!state) {
						state = new AnimState(this, path[0], speed);
						this._states[path[0]] = state;
						this._stateNames.push(path[0]);
				}
				state.addAnimation(path, animTrack);
				this._animEvaluator.updateClipTrack(state.name, animTrack);
				if (speed !== undefined) {
						state.speed = speed;
				}
				if (loop !== undefined) {
						state.loop = loop;
				}
				if (!this._playing && this._activate && this.playable) {
						this.play();
				}
				this._activeStateDurationDirty = true;
		}
		removeNodeAnimations(nodeName) {
				if (ANIM_CONTROL_STATES.indexOf(nodeName) !== -1) {
						return false;
				}
				var state = this._findState(nodeName);
				if (!state) {
						return false;
				}
				state.animations = [];
				return true;
		}
		play(stateName) {
				if (stateName) {
						this._transitionToState(stateName);
				}
				this._playing = true;
		}
		pause() {
				this._playing = false;
		}
		reset() {
				this._previousStateName = null;
				this._activeStateName = ANIM_STATE_START;
				this._playing = false;
				this._currTransitionTime = 1.0;
				this._totalTransitionTime = 1.0;
				this._isTransitioning = false;
				this._timeInState = 0;
				this._timeInStateBefore = 0;
				this._animEvaluator.removeClips();
		}
		rebind() {
				this._animEvaluator.rebind();
		}
		update(dt) {
				if (!this._playing) {
						return;
				}
				var state;
				var animation;
				var clip;
				if (this.activeState.loop || this._timeInState < this.activeStateDuration) {
						this._timeInStateBefore = this._timeInState;
						this._timeInState += dt * this.activeState.speed;
						if (!this.activeState.loop && this._timeInState > this.activeStateDuration) {
								this._timeInState = this.activeStateDuration;
								dt = this.activeStateDuration - this._timeInStateBefore;
						}
				}
				var transition = this._findTransition(this._activeStateName);
				if (transition) {
						this.updateStateFromTransition(transition);
				}
				if (this._isTransitioning) {
						this._currTransitionTime += dt;
						if (this._currTransitionTime <= this._totalTransitionTime) {
								var interpolatedTime = this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1;
								for(var i = 0; i < this._transitionPreviousStates.length; i++){
										state = this._findState(this._transitionPreviousStates[i].name);
										var stateWeight = this._transitionPreviousStates[i].weight;
										for(var j = 0; j < state.animations.length; j++){
												animation = state.animations[j];
												clip = this._animEvaluator.findClip(animation.name + ".previous." + i);
												if (clip) {
														clip.blendWeight = (1.0 - interpolatedTime) * animation.normalizedWeight * stateWeight;
												}
										}
								}
								state = this.activeState;
								for(var i1 = 0; i1 < state.animations.length; i1++){
										animation = state.animations[i1];
										this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.normalizedWeight;
								}
						} else {
								this._isTransitioning = false;
								var activeClips = this.activeStateAnimations.length;
								var totalClips = this._animEvaluator.clips.length;
								for(var i2 = 0; i2 < totalClips - activeClips; i2++){
										this._animEvaluator.removeClip(0);
								}
								this._transitionPreviousStates = [];
								state = this.activeState;
								for(var i3 = 0; i3 < state.animations.length; i3++){
										animation = state.animations[i3];
										clip = this._animEvaluator.findClip(animation.name);
										if (clip) {
												clip.blendWeight = animation.normalizedWeight;
										}
								}
						}
				} else {
						if (this.activeState._blendTree.constructor !== AnimNode) {
								state = this.activeState;
								for(var i4 = 0; i4 < state.animations.length; i4++){
										animation = state.animations[i4];
										clip = this._animEvaluator.findClip(animation.name);
										if (clip) {
												clip.blendWeight = animation.normalizedWeight;
												if (animation.parent.syncAnimations) {
														clip.speed = animation.speed;
												}
										}
								}
						}
				}
				this._animEvaluator.update(dt, this.activeState.hasAnimations);
		}
		constructor(animEvaluator, states, transitions, activate, eventHandler, findParameter, consumeTrigger){
				this._states = {};
				this._stateNames = [];
				this._findTransitionsFromStateCache = {};
				this._findTransitionsBetweenStatesCache = {};
				this._previousStateName = null;
				this._activeStateName = ANIM_STATE_START;
				this._activeStateDuration = 0;
				this._activeStateDurationDirty = true;
				this._playing = false;
				this._currTransitionTime = 1;
				this._totalTransitionTime = 1;
				this._isTransitioning = false;
				this._transitionInterruptionSource = ANIM_INTERRUPTION_NONE;
				this._transitionPreviousStates = [];
				this._timeInState = 0;
				this._timeInStateBefore = 0;
				this.findParameter = (name)=>{
						return this._findParameter(name);
				};
				this._animEvaluator = animEvaluator;
				this._eventHandler = eventHandler;
				this._findParameter = findParameter;
				this._consumeTrigger = consumeTrigger;
				for(var i = 0; i < states.length; i++){
						this._states[states[i].name] = new AnimState(this, states[i].name, states[i].speed, states[i].loop, states[i].blendTree);
						this._stateNames.push(states[i].name);
				}
				this._transitions = transitions.map((transition)=>{
						return new AnimTransition(_extends({}, transition));
				});
				this._activate = activate;
		}
}

export { AnimController };
