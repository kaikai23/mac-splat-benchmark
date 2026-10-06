import { AnimClip } from '../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../scene/animation/skeleton.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class AnimationComponent extends Component {
		set animations(value) {
				this._animations = value;
				this.onSetAnimations();
		}
		get animations() {
				return this._animations;
		}
		set assets(value) {
				var assets = this._assets;
				if (assets && assets.length) {
						for(var i = 0; i < assets.length; i++){
								if (assets[i]) {
										var asset = this.system.app.assets.get(assets[i]);
										if (asset) {
												asset.off('change', this.onAssetChanged, this);
												asset.off('remove', this.onAssetRemoved, this);
												var animName = this.animationsIndex[asset.id];
												if (this.currAnim === animName) {
														this._stopCurrentAnimation();
												}
												delete this.animations[animName];
												delete this.animationsIndex[asset.id];
										}
								}
						}
				}
				this._assets = value;
				var assetIds = value.map((value)=>{
						return value instanceof Asset ? value.id : value;
				});
				this.loadAnimationAssets(assetIds);
		}
		get assets() {
				return this._assets;
		}
		set currentTime(currentTime) {
				if (this.skeleton) {
						this.skeleton.currentTime = currentTime;
						this.skeleton.addTime(0);
						this.skeleton.updateGraph();
				}
				if (this.animEvaluator) {
						var clips = this.animEvaluator.clips;
						for(var i = 0; i < clips.length; ++i){
								clips[i].time = currentTime;
						}
				}
		}
		get currentTime() {
				if (this.skeleton) {
						return this.skeleton._time;
				}
				if (this.animEvaluator) {
						var clips = this.animEvaluator.clips;
						if (clips.length > 0) {
								return clips[clips.length - 1].time;
						}
				}
				return 0;
		}
		get duration() {
				if (this.currAnim) {
						return this.animations[this.currAnim].duration;
				}
				return 0;
		}
		set loop(value) {
				this._loop = value;
				if (this.skeleton) {
						this.skeleton.looping = value;
				}
				if (this.animEvaluator) {
						for(var i = 0; i < this.animEvaluator.clips.length; ++i){
								this.animEvaluator.clips[i].loop = value;
						}
				}
		}
		get loop() {
				return this._loop;
		}
		play(name, blendTime) {
				if (blendTime === undefined) blendTime = 0;
				if (!this.enabled || !this.entity.enabled) {
						return;
				}
				if (!this.animations[name]) {
						return;
				}
				this.prevAnim = this.currAnim;
				this.currAnim = name;
				if (this.model) {
						if (!this.skeleton && !this.animEvaluator) {
								this._createAnimationController();
						}
						var prevAnim = this.animations[this.prevAnim];
						var currAnim = this.animations[this.currAnim];
						this.blending = blendTime > 0 && !!this.prevAnim;
						if (this.blending) {
								this.blend = 0;
								this.blendSpeed = 1 / blendTime;
						}
						if (this.skeleton) {
								if (this.blending) {
										this.fromSkel.animation = prevAnim;
										this.fromSkel.addTime(this.skeleton._time);
										this.toSkel.animation = currAnim;
								} else {
										this.skeleton.animation = currAnim;
								}
						}
						if (this.animEvaluator) {
								var animEvaluator = this.animEvaluator;
								if (this.blending) {
										while(animEvaluator.clips.length > 1){
												animEvaluator.removeClip(0);
										}
								} else {
										this.animEvaluator.removeClips();
								}
								var clip = new AnimClip(this.animations[this.currAnim], 0, 1.0, true, this.loop);
								clip.name = this.currAnim;
								clip.blendWeight = this.blending ? 0 : 1;
								clip.reset();
								this.animEvaluator.addClip(clip);
						}
				}
				this.playing = true;
		}
		getAnimation(name) {
				return this.animations[name];
		}
		setModel(model) {
				if (model !== this.model) {
						this._resetAnimationController();
						this.model = model;
						if (this.animations && this.currAnim && this.animations[this.currAnim]) {
								this.play(this.currAnim);
						}
				}
		}
		onSetAnimations() {
				var modelComponent = this.entity.model;
				if (modelComponent) {
						var m = modelComponent.model;
						if (m && m !== this.model) {
								this.setModel(m);
						}
				}
				if (!this.currAnim && this.activate && this.enabled && this.entity.enabled) {
						var animationNames = Object.keys(this._animations);
						if (animationNames.length > 0) {
								this.play(animationNames[0]);
						}
				}
		}
		_resetAnimationController() {
				this.skeleton = null;
				this.fromSkel = null;
				this.toSkel = null;
				this.animEvaluator = null;
		}
		_createAnimationController() {
				var model = this.model;
				var animations = this.animations;
				var hasJson = false;
				var hasGlb = false;
				for(var animation in animations){
						if (animations.hasOwnProperty(animation)) {
								var anim = animations[animation];
								if (anim.constructor === AnimTrack) {
										hasGlb = true;
								} else {
										hasJson = true;
								}
						}
				}
				var graph = model.getGraph();
				if (hasJson) {
						this.fromSkel = new Skeleton(graph);
						this.toSkel = new Skeleton(graph);
						this.skeleton = new Skeleton(graph);
						this.skeleton.looping = this.loop;
						this.skeleton.setGraph(graph);
				} else if (hasGlb) {
						this.animEvaluator = new AnimEvaluator(new DefaultAnimBinder(this.entity));
				}
		}
		loadAnimationAssets(ids) {
				if (!ids || !ids.length) {
						return;
				}
				var assets = this.system.app.assets;
				var onAssetReady = (asset)=>{
						if (asset.resources.length > 1) {
								for(var i = 0; i < asset.resources.length; i++){
										this.animations[asset.resources[i].name] = asset.resources[i];
										this.animationsIndex[asset.id] = asset.resources[i].name;
								}
						} else {
								this.animations[asset.name] = asset.resource;
								this.animationsIndex[asset.id] = asset.name;
						}
						this.animations = this.animations;
				};
				var onAssetAdd = (asset)=>{
						asset.off('change', this.onAssetChanged, this);
						asset.on('change', this.onAssetChanged, this);
						asset.off('remove', this.onAssetRemoved, this);
						asset.on('remove', this.onAssetRemoved, this);
						if (asset.resource) {
								onAssetReady(asset);
						} else {
								asset.once('load', onAssetReady, this);
								if (this.enabled && this.entity.enabled) {
										assets.load(asset);
								}
						}
				};
				for(var i = 0, l = ids.length; i < l; i++){
						var asset = assets.get(ids[i]);
						if (asset) {
								onAssetAdd(asset);
						} else {
								assets.on("add:" + ids[i], onAssetAdd);
						}
				}
		}
		onAssetChanged(asset, attribute, newValue, oldValue) {
				if (attribute === 'resource' || attribute === 'resources') {
						if (attribute === 'resources' && newValue && newValue.length === 0) {
								newValue = null;
						}
						if (newValue) {
								var restarted = false;
								if (newValue.length > 1) {
										if (oldValue && oldValue.length > 1) {
												for(var i = 0; i < oldValue.length; i++){
														delete this.animations[oldValue[i].name];
												}
										} else {
												delete this.animations[asset.name];
										}
										restarted = false;
										for(var i1 = 0; i1 < newValue.length; i1++){
												this.animations[newValue[i1].name] = newValue[i1];
												if (!restarted && this.currAnim === newValue[i1].name) {
														if (this.playing && this.enabled && this.entity.enabled) {
																restarted = true;
																this.play(newValue[i1].name);
														}
												}
										}
										if (!restarted) {
												this._stopCurrentAnimation();
												this.onSetAnimations();
										}
								} else {
										if (oldValue && oldValue.length > 1) {
												for(var i2 = 0; i2 < oldValue.length; i2++){
														delete this.animations[oldValue[i2].name];
												}
										}
										this.animations[asset.name] = newValue[0] || newValue;
										restarted = false;
										if (this.currAnim === asset.name) {
												if (this.playing && this.enabled && this.entity.enabled) {
														restarted = true;
														this.play(asset.name);
												}
										}
										if (!restarted) {
												this._stopCurrentAnimation();
												this.onSetAnimations();
										}
								}
								this.animationsIndex[asset.id] = asset.name;
						} else {
								if (oldValue.length > 1) {
										for(var i3 = 0; i3 < oldValue.length; i3++){
												delete this.animations[oldValue[i3].name];
												if (this.currAnim === oldValue[i3].name) {
														this._stopCurrentAnimation();
												}
										}
								} else {
										delete this.animations[asset.name];
										if (this.currAnim === asset.name) {
												this._stopCurrentAnimation();
										}
								}
								delete this.animationsIndex[asset.id];
						}
				}
		}
		onAssetRemoved(asset) {
				asset.off('remove', this.onAssetRemoved, this);
				if (this.animations) {
						if (asset.resources.length > 1) {
								for(var i = 0; i < asset.resources.length; i++){
										delete this.animations[asset.resources[i].name];
										if (this.currAnim === asset.resources[i].name) {
												this._stopCurrentAnimation();
										}
								}
						} else {
								delete this.animations[asset.name];
								if (this.currAnim === asset.name) {
										this._stopCurrentAnimation();
								}
						}
						delete this.animationsIndex[asset.id];
				}
		}
		_stopCurrentAnimation() {
				this.currAnim = null;
				this.playing = false;
				if (this.skeleton) {
						this.skeleton.currentTime = 0;
						this.skeleton.animation = null;
				}
				if (this.animEvaluator) {
						for(var i = 0; i < this.animEvaluator.clips.length; ++i){
								this.animEvaluator.clips[i].stop();
						}
						this.animEvaluator.update(0);
						this.animEvaluator.removeClips();
				}
		}
		onEnable() {
				super.onEnable();
				var assets = this.assets;
				var registry = this.system.app.assets;
				if (assets) {
						for(var i = 0, len = assets.length; i < len; i++){
								var asset = assets[i];
								if (!(asset instanceof Asset)) {
										asset = registry.get(asset);
								}
								if (asset && !asset.resource) {
										registry.load(asset);
								}
						}
				}
				if (this.activate && !this.currAnim) {
						var animationNames = Object.keys(this.animations);
						if (animationNames.length > 0) {
								this.play(animationNames[0]);
						}
				}
		}
		onBeforeRemove() {
				for(var i = 0; i < this.assets.length; i++){
						var asset = this.assets[i];
						if (typeof asset === 'number') {
								asset = this.system.app.assets.get(asset);
						}
						if (!asset) continue;
						asset.off('change', this.onAssetChanged, this);
						asset.off('remove', this.onAssetRemoved, this);
				}
				this.skeleton = null;
				this.fromSkel = null;
				this.toSkel = null;
				this.animEvaluator = null;
		}
		update(dt) {
				if (this.blending) {
						this.blend += dt * this.blendSpeed;
						if (this.blend >= 1) {
								this.blend = 1;
						}
				}
				if (this.playing) {
						var skeleton = this.skeleton;
						if (skeleton !== null && this.model !== null) {
								if (this.blending) {
										skeleton.blend(this.fromSkel, this.toSkel, this.blend);
								} else {
										var delta = dt * this.speed;
										skeleton.addTime(delta);
										if (this.speed > 0 && skeleton._time === skeleton.animation.duration && !this.loop) {
												this.playing = false;
										} else if (this.speed < 0 && skeleton._time === 0 && !this.loop) {
												this.playing = false;
										}
								}
								if (this.blending && this.blend === 1) {
										skeleton.animation = this.toSkel.animation;
								}
								skeleton.updateGraph();
						}
				}
				var animEvaluator = this.animEvaluator;
				if (animEvaluator) {
						for(var i = 0; i < animEvaluator.clips.length; ++i){
								var clip = animEvaluator.clips[i];
								clip.speed = this.speed;
								if (!this.playing) {
										clip.pause();
								} else {
										clip.resume();
								}
						}
						if (this.blending && animEvaluator.clips.length > 1) {
								animEvaluator.clips[1].blendWeight = this.blend;
						}
						animEvaluator.update(dt);
				}
				if (this.blending && this.blend === 1) {
						this.blending = false;
				}
		}
		constructor(...args){
				super(...args), this._animations = {}, this._assets = [], this._loop = true, this.animEvaluator = null, this.model = null, this.skeleton = null, this.fromSkel = null, this.toSkel = null, this.animationsIndex = {}, this.prevAnim = null, this.currAnim = null, this.blend = 0, this.blending = false, this.blendSpeed = 0, this.activate = true, this.speed = 1;
		}
}

export { AnimationComponent };
