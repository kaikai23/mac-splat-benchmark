import { DISTANCE_LINEAR } from '../../../platform/audio/constants.js';
import { Component } from '../component.js';
import { SoundSlot } from './slot.js';

class SoundComponent extends Component {
		_updateSoundInstances(property, value, isFactor) {
				var slots = this._slots;
				for(var key in slots){
						var slot = slots[key];
						if (!slot.overlap) {
								var instances = slot.instances;
								for(var i = 0, len = instances.length; i < len; i++){
										instances[i][property] = isFactor ? slot[property] * value : value;
								}
						}
				}
		}
		set distanceModel(value) {
				this._distanceModel = value;
				this._updateSoundInstances('distanceModel', value, false);
		}
		get distanceModel() {
				return this._distanceModel;
		}
		set maxDistance(value) {
				this._maxDistance = value;
				this._updateSoundInstances('maxDistance', value, false);
		}
		get maxDistance() {
				return this._maxDistance;
		}
		set refDistance(value) {
				this._refDistance = value;
				this._updateSoundInstances('refDistance', value, false);
		}
		get refDistance() {
				return this._refDistance;
		}
		set rollOffFactor(value) {
				this._rollOffFactor = value;
				this._updateSoundInstances('rollOffFactor', value, false);
		}
		get rollOffFactor() {
				return this._rollOffFactor;
		}
		set pitch(value) {
				this._pitch = value;
				this._updateSoundInstances('pitch', value, true);
		}
		get pitch() {
				return this._pitch;
		}
		set volume(value) {
				this._volume = value;
				this._updateSoundInstances('volume', value, true);
		}
		get volume() {
				return this._volume;
		}
		set positional(newValue) {
				this._positional = newValue;
				var slots = this._slots;
				for(var key in slots){
						var slot = slots[key];
						if (!slot.overlap) {
								var instances = slot.instances;
								var oldLength = instances.length;
								for(var i = oldLength - 1; i >= 0; i--){
										var isPlaying = instances[i].isPlaying || instances[i].isSuspended;
										var currentTime = instances[i].currentTime;
										if (isPlaying) {
												instances[i].stop();
										}
										var instance = slot._createInstance();
										if (isPlaying) {
												instance.play();
												instance.currentTime = currentTime;
										}
										instances.push(instance);
								}
						}
				}
		}
		get positional() {
				return this._positional;
		}
		set slots(newValue) {
				var oldValue = this._slots;
				if (oldValue) {
						for(var key in oldValue){
								oldValue[key].stop();
						}
				}
				var slots = {};
				for(var key1 in newValue){
						if (!(newValue[key1] instanceof SoundSlot)) {
								if (newValue[key1].name) {
										slots[newValue[key1].name] = new SoundSlot(this, newValue[key1].name, newValue[key1]);
								}
						} else {
								slots[newValue[key1].name] = newValue[key1];
						}
				}
				this._slots = slots;
				if (this.enabled && this.entity.enabled) {
						this.onEnable();
				}
		}
		get slots() {
				return this._slots;
		}
		onEnable() {
				if (this.system._inTools) {
						return;
				}
				var slots = this._slots;
				var playingBeforeDisable = this._playingBeforeDisable;
				for(var key in slots){
						var slot = slots[key];
						if (slot.autoPlay && slot.isStopped) {
								slot.play();
						} else if (playingBeforeDisable[key]) {
								slot.resume();
						} else if (!slot.isLoaded) {
								slot.load();
						}
				}
		}
		onDisable() {
				var slots = this._slots;
				var playingBeforeDisable = {};
				for(var key in slots){
						if (!slots[key].overlap) {
								if (slots[key].isPlaying) {
										slots[key].pause();
										playingBeforeDisable[key] = true;
								}
						}
				}
				this._playingBeforeDisable = playingBeforeDisable;
		}
		onRemove() {
				this.off();
		}
		addSlot(name, options) {
				var slots = this._slots;
				if (slots[name]) {
						return null;
				}
				var slot = new SoundSlot(this, name, options);
				slots[name] = slot;
				if (slot.autoPlay && this.enabled && this.entity.enabled) {
						slot.play();
				}
				return slot;
		}
		removeSlot(name) {
				var slots = this._slots;
				if (slots[name]) {
						slots[name].stop();
						delete slots[name];
				}
		}
		slot(name) {
				return this._slots[name];
		}
		_getSlotProperty(name, property) {
				if (!this.enabled || !this.entity.enabled) {
						return undefined;
				}
				var slot = this._slots[name];
				if (!slot) {
						return undefined;
				}
				return slot[property];
		}
		isPlaying(name) {
				return this._getSlotProperty(name, 'isPlaying') || false;
		}
		isLoaded(name) {
				return this._getSlotProperty(name, 'isLoaded') || false;
		}
		isPaused(name) {
				return this._getSlotProperty(name, 'isPaused') || false;
		}
		isStopped(name) {
				return this._getSlotProperty(name, 'isStopped') || false;
		}
		play(name) {
				if (!this.enabled || !this.entity.enabled) {
						return null;
				}
				var slot = this._slots[name];
				if (!slot) {
						return null;
				}
				return slot.play();
		}
		pause(name) {
				var slots = this._slots;
				if (name) {
						var slot = slots[name];
						if (!slot) {
								return;
						}
						slot.pause();
				} else {
						for(var key in slots){
								slots[key].pause();
						}
				}
		}
		resume(name) {
				var slots = this._slots;
				if (name) {
						var slot = slots[name];
						if (!slot) {
								return;
						}
						if (slot.isPaused) {
								slot.resume();
						}
				} else {
						for(var key in slots){
								slots[key].resume();
						}
				}
		}
		stop(name) {
				var slots = this._slots;
				if (name) {
						var slot = slots[name];
						if (!slot) {
								return;
						}
						slot.stop();
				} else {
						for(var key in slots){
								slots[key].stop();
						}
				}
		}
		constructor(...args){
				super(...args), this._volume = 1, this._pitch = 1, this._positional = true, this._refDistance = 1, this._maxDistance = 10000, this._rollOffFactor = 1, this._distanceModel = DISTANCE_LINEAR, this._slots = {}, this._playingBeforeDisable = {};
		}
}
SoundComponent.EVENT_PLAY = 'play';
SoundComponent.EVENT_PAUSE = 'pause';
SoundComponent.EVENT_RESUME = 'resume';
SoundComponent.EVENT_STOP = 'stop';
SoundComponent.EVENT_END = 'end';

export { SoundComponent };
