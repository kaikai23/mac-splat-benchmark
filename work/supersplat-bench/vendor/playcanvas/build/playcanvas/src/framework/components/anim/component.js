import { Asset } from '../../asset/asset.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimController } from '../../anim/controller/anim-controller.js';
import { Component } from '../component.js';
import { AnimComponentBinder } from './component-binder.js';
import { AnimComponentLayer } from './component-layer.js';
import { AnimStateGraph } from '../../anim/state-graph/anim-state-graph.js';
import { Entity } from '../../entity.js';
import { ANIM_CONTROL_STATES, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_TRIGGER } from '../../anim/controller/constants.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';

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
class AnimComponent extends Component {
		set stateGraphAsset(value) {
				if (value === null) {
						this.removeStateGraph();
						return;
				}
				if (this._stateGraphAsset) {
						var stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
						stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
				}
				var _id;
				var _asset;
				if (value instanceof Asset) {
						_id = value.id;
						_asset = this.system.app.assets.get(_id);
						if (!_asset) {
								this.system.app.assets.add(value);
								_asset = this.system.app.assets.get(_id);
						}
				} else {
						_id = value;
						_asset = this.system.app.assets.get(_id);
				}
				if (!_asset || this._stateGraphAsset === _id) {
						return;
				}
				if (_asset.resource) {
						this._stateGraph = _asset.resource;
						this.loadStateGraph(this._stateGraph);
						_asset.on('change', this._onStateGraphAssetChangeEvent, this);
				} else {
						_asset.once('load', (asset)=>{
								this._stateGraph = asset.resource;
								this.loadStateGraph(this._stateGraph);
						});
						_asset.on('change', this._onStateGraphAssetChangeEvent, this);
						this.system.app.assets.load(_asset);
				}
				this._stateGraphAsset = _id;
		}
		get stateGraphAsset() {
				return this._stateGraphAsset;
		}
		set normalizeWeights(value) {
				this._normalizeWeights = value;
				this.unbind();
		}
		get normalizeWeights() {
				return this._normalizeWeights;
		}
		set animationAssets(value) {
				this._animationAssets = value;
				this.loadAnimationAssets();
		}
		get animationAssets() {
				return this._animationAssets;
		}
		set speed(value) {
				this._speed = value;
		}
		get speed() {
				return this._speed;
		}
		set activate(value) {
				this._activate = value;
		}
		get activate() {
				return this._activate;
		}
		set playing(value) {
				this._playing = value;
		}
		get playing() {
				return this._playing;
		}
		set rootBone(value) {
				if (typeof value === 'string') {
						var entity = this.entity.root.findByGuid(value);
						this._rootBone = entity;
				} else if (value instanceof Entity) {
						this._rootBone = value;
				} else {
						this._rootBone = null;
				}
				this.rebind();
		}
		get rootBone() {
				return this._rootBone;
		}
		set stateGraph(value) {
				this._stateGraph = value;
		}
		get stateGraph() {
				return this._stateGraph;
		}
		get layers() {
				return this._layers;
		}
		set layerIndices(value) {
				this._layerIndices = value;
		}
		get layerIndices() {
				return this._layerIndices;
		}
		set parameters(value) {
				this._parameters = value;
		}
		get parameters() {
				return this._parameters;
		}
		set targets(value) {
				this._targets = value;
		}
		get targets() {
				return this._targets;
		}
		get playable() {
				for(var i = 0; i < this._layers.length; i++){
						if (!this._layers[i].playable) {
								return false;
						}
				}
				return true;
		}
		get baseLayer() {
				if (this._layers.length > 0) {
						return this._layers[0];
				}
				return null;
		}
		_onStateGraphAssetChangeEvent(asset) {
				var prevAnimationAssets = this.animationAssets;
				var prevMasks = this.layers.map((layer)=>layer.mask);
				this.removeStateGraph();
				this._stateGraph = new AnimStateGraph(asset._data);
				this.loadStateGraph(this._stateGraph);
				this.animationAssets = prevAnimationAssets;
				this.loadAnimationAssets();
				this.layers.forEach((layer, i)=>{
						layer.mask = prevMasks[i];
				});
				this.rebind();
		}
		dirtifyTargets() {
				var targets = Object.values(this._targets);
				for(var i = 0; i < targets.length; i++){
						targets[i].dirty = true;
				}
		}
		_addLayer(param) {
				var { name, states, transitions, weight, mask, blendType } = param;
				var graph;
				if (this.rootBone) {
						graph = this.rootBone;
				} else {
						graph = this.entity;
				}
				var layerIndex = this._layers.length;
				var animBinder = new AnimComponentBinder(this, graph, name, mask, layerIndex);
				var animEvaluator = new AnimEvaluator(animBinder);
				var controller = new AnimController(animEvaluator, states, transitions, this._activate, this, this.findParameter, this.consumeTrigger);
				this._layers.push(new AnimComponentLayer(name, controller, this, weight, blendType));
				this._layerIndices[name] = layerIndex;
				return this._layers[layerIndex];
		}
		addLayer(name, weight, mask, blendType) {
				var layer = this.findAnimationLayer(name);
				if (layer) return layer;
				var states = [
						{
								'name': 'START',
								'speed': 1
						}
				];
				var transitions = [];
				return this._addLayer({
						name,
						states,
						transitions,
						weight,
						mask,
						blendType
				});
		}
		_assignParameters(stateGraph) {
				this._parameters = {};
				var paramKeys = Object.keys(stateGraph.parameters);
				for(var i = 0; i < paramKeys.length; i++){
						var paramKey = paramKeys[i];
						this._parameters[paramKey] = {
								type: stateGraph.parameters[paramKey].type,
								value: stateGraph.parameters[paramKey].value
						};
				}
		}
		loadStateGraph(stateGraph) {
				this._stateGraph = stateGraph;
				this._assignParameters(stateGraph);
				this._layers = [];
				var containsBlendTree = false;
				for(var i = 0; i < stateGraph.layers.length; i++){
						var layer = stateGraph.layers[i];
						this._addLayer(_extends({}, layer));
						if (layer.states.some((state)=>state.blendTree)) {
								containsBlendTree = true;
						}
				}
				if (!containsBlendTree) {
						this.setupAnimationAssets();
				}
		}
		setupAnimationAssets() {
				for(var i = 0; i < this._layers.length; i++){
						var layer = this._layers[i];
						var layerName = layer.name;
						for(var j = 0; j < layer.states.length; j++){
								var stateName = layer.states[j];
								if (ANIM_CONTROL_STATES.indexOf(stateName) === -1) {
										var stateKey = layerName + ":" + stateName;
										if (!this._animationAssets[stateKey]) {
												this._animationAssets[stateKey] = {
														asset: null
												};
										}
								}
						}
				}
				this.loadAnimationAssets();
		}
		loadAnimationAssets() {
				for(var i = 0; i < this._layers.length; i++){
						var layer = this._layers[i];
						for(var j = 0; j < layer.states.length; j++){
								var stateName = layer.states[j];
								if (ANIM_CONTROL_STATES.indexOf(stateName) !== -1) continue;
								var animationAsset = this._animationAssets[layer.name + ":" + stateName];
								if (!animationAsset || !animationAsset.asset) {
										this.findAnimationLayer(layer.name).assignAnimation(stateName, AnimTrack.EMPTY);
										continue;
								}
								var assetId = animationAsset.asset;
								var asset = this.system.app.assets.get(assetId);
								if (asset) {
										if (asset.resource) {
												this.onAnimationAssetLoaded(layer.name, stateName, asset);
										} else {
												asset.once('load', (function(layerName, stateName) {
														return (function(asset) {
																this.onAnimationAssetLoaded(layerName, stateName, asset);
														}).bind(this);
												}).bind(this)(layer.name, stateName));
												this.system.app.assets.load(asset);
										}
								}
						}
				}
		}
		onAnimationAssetLoaded(layerName, stateName, asset) {
				this.findAnimationLayer(layerName).assignAnimation(stateName, asset.resource);
		}
		removeStateGraph() {
				this._stateGraph = null;
				this._stateGraphAsset = null;
				this._animationAssets = {};
				this._layers = [];
				this._layerIndices = {};
				this._parameters = {};
				this._playing = false;
				this.unbind();
				this._targets = {};
		}
		reset() {
				this._assignParameters(this._stateGraph);
				for(var i = 0; i < this._layers.length; i++){
						var layerPlaying = this._layers[i].playing;
						this._layers[i].reset();
						this._layers[i].playing = layerPlaying;
				}
		}
		unbind() {
				if (!this._normalizeWeights) {
						Object.keys(this._targets).forEach((targetKey)=>{
								this._targets[targetKey].unbind();
						});
				}
		}
		rebind() {
				this._targets = {};
				for(var i = 0; i < this._layers.length; i++){
						this._layers[i].rebind();
				}
		}
		findAnimationLayer(name) {
				var layerIndex = this._layerIndices[name];
				return this._layers[layerIndex] || null;
		}
		addAnimationState(nodeName, animTrack, speed, loop, layerName) {
				if (speed === undefined) speed = 1;
				if (loop === undefined) loop = true;
				if (layerName === undefined) layerName = 'Base';
				if (!this._stateGraph) {
						this.loadStateGraph(new AnimStateGraph({
								'layers': [
										{
												'name': layerName,
												'states': [
														{
																'name': 'START',
																'speed': 1
														},
														{
																'name': nodeName,
																'speed': speed,
																'loop': loop,
																'defaultState': true
														}
												],
												'transitions': [
														{
																'from': 'START',
																'to': nodeName
														}
												]
										}
								],
								'parameters': {}
						}));
				}
				var layer = this.findAnimationLayer(layerName);
				if (layer) {
						layer.assignAnimation(nodeName, animTrack, speed, loop);
				} else {
						var _this_addLayer;
						(_this_addLayer = this.addLayer(layerName)) == null ? undefined : _this_addLayer.assignAnimation(nodeName, animTrack, speed, loop);
				}
		}
		assignAnimation(nodePath, animTrack, layerName, speed, loop) {
				if (speed === undefined) speed = 1;
				if (loop === undefined) loop = true;
				if (!this._stateGraph && nodePath.indexOf('.') === -1) {
						this.loadStateGraph(new AnimStateGraph({
								'layers': [
										{
												'name': 'Base',
												'states': [
														{
																'name': 'START',
																'speed': 1
														},
														{
																'name': nodePath,
																'speed': speed,
																'loop': loop,
																'defaultState': true
														}
												],
												'transitions': [
														{
																'from': 'START',
																'to': nodePath
														}
												]
										}
								],
								'parameters': {}
						}));
						this.baseLayer.assignAnimation(nodePath, animTrack);
						return;
				}
				var layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
				if (!layer) {
						return;
				}
				layer.assignAnimation(nodePath, animTrack, speed, loop);
		}
		removeNodeAnimations(nodeName, layerName) {
				var layer = layerName ? this.findAnimationLayer(layerName) : this.baseLayer;
				if (!layer) {
						return;
				}
				layer.removeNodeAnimations(nodeName);
		}
		getParameterValue(name, type) {
				var param = this._parameters[name];
				if (param && param.type === type) {
						return param.value;
				}
				return undefined;
		}
		setParameterValue(name, type, value) {
				var param = this._parameters[name];
				if (param && param.type === type) {
						param.value = value;
						return;
				}
		}
		getFloat(name) {
				return this.getParameterValue(name, ANIM_PARAMETER_FLOAT);
		}
		setFloat(name, value) {
				this.setParameterValue(name, ANIM_PARAMETER_FLOAT, value);
		}
		getInteger(name) {
				return this.getParameterValue(name, ANIM_PARAMETER_INTEGER);
		}
		setInteger(name, value) {
				if (typeof value === 'number' && value % 1 === 0) {
						this.setParameterValue(name, ANIM_PARAMETER_INTEGER, value);
				}
		}
		getBoolean(name) {
				return this.getParameterValue(name, ANIM_PARAMETER_BOOLEAN);
		}
		setBoolean(name, value) {
				this.setParameterValue(name, ANIM_PARAMETER_BOOLEAN, !!value);
		}
		getTrigger(name) {
				return this.getParameterValue(name, ANIM_PARAMETER_TRIGGER);
		}
		setTrigger(name, singleFrame) {
				if (singleFrame === undefined) singleFrame = false;
				this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, true);
				if (singleFrame) {
						this._consumedTriggers.add(name);
				}
		}
		resetTrigger(name) {
				this.setParameterValue(name, ANIM_PARAMETER_TRIGGER, false);
		}
		onBeforeRemove() {
				if (Number.isFinite(this._stateGraphAsset)) {
						var stateGraphAsset = this.system.app.assets.get(this._stateGraphAsset);
						stateGraphAsset.off('change', this._onStateGraphAssetChangeEvent, this);
				}
		}
		update(dt) {
				for(var i = 0; i < this.layers.length; i++){
						this.layers[i].update(dt * this.speed);
				}
				this._consumedTriggers.forEach((trigger)=>{
						this.parameters[trigger].value = false;
				});
				this._consumedTriggers.clear();
		}
		resolveDuplicatedEntityReferenceProperties(oldAnim, duplicatedIdsMap) {
				if (oldAnim.rootBone && duplicatedIdsMap[oldAnim.rootBone.getGuid()]) {
						this.rootBone = duplicatedIdsMap[oldAnim.rootBone.getGuid()];
				} else {
						this.rebind();
				}
		}
		constructor(...args){
				super(...args), this._stateGraphAsset = null, this._animationAssets = {}, this._speed = 1, this._activate = true, this._playing = false, this._rootBone = null, this._stateGraph = null, this._layers = [], this._layerIndices = {}, this._parameters = {}, this._targets = {}, this._consumedTriggers = new Set(), this._normalizeWeights = false, this.findParameter = (name)=>{
						return this._parameters[name];
				}, this.consumeTrigger = (name)=>{
						this._consumedTriggers.add(name);
				};
		}
}

export { AnimComponent };
