import { hasAudioContext } from '../../../platform/audio/capabilities.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { SoundComponent } from './component.js';
import { SoundComponentData } from './data.js';

var _schema = [
		'enabled'
];
class SoundComponentSystem extends ComponentSystem {
		set volume(volume) {
				this.manager.volume = volume;
		}
		get volume() {
				return this.manager.volume;
		}
		get context() {
				if (!hasAudioContext()) {
						return null;
				}
				return this.manager.context;
		}
		initializeComponentData(component, data, properties) {
				properties = [
						'volume',
						'pitch',
						'positional',
						'refDistance',
						'maxDistance',
						'rollOffFactor',
						'distanceModel',
						'slots'
				];
				for(var i = 0; i < properties.length; i++){
						if (data.hasOwnProperty(properties[i])) {
								component[properties[i]] = data[properties[i]];
						}
				}
				super.initializeComponentData(component, data, [
						'enabled'
				]);
		}
		cloneComponent(entity, clone) {
				var srcComponent = entity.sound;
				var srcSlots = srcComponent.slots;
				var slots = {};
				for(var key in srcSlots){
						var srcSlot = srcSlots[key];
						slots[key] = {
								name: srcSlot.name,
								volume: srcSlot.volume,
								pitch: srcSlot.pitch,
								loop: srcSlot.loop,
								duration: srcSlot.duration,
								startTime: srcSlot.startTime,
								overlap: srcSlot.overlap,
								autoPlay: srcSlot.autoPlay,
								asset: srcSlot.asset
						};
				}
				var cloneData = {
						distanceModel: srcComponent.distanceModel,
						enabled: srcComponent.enabled,
						maxDistance: srcComponent.maxDistance,
						pitch: srcComponent.pitch,
						positional: srcComponent.positional,
						refDistance: srcComponent.refDistance,
						rollOffFactor: srcComponent.rollOffFactor,
						slots: slots,
						volume: srcComponent.volume
				};
				return this.addComponent(clone, cloneData);
		}
		onUpdate(dt) {
				var store = this.store;
				for(var id in store){
						if (store.hasOwnProperty(id)) {
								var item = store[id];
								var entity = item.entity;
								if (entity.enabled) {
										var component = entity.sound;
										if (component.enabled && component.positional) {
												var position = entity.getPosition();
												var slots = component.slots;
												for(var key in slots){
														slots[key].updatePosition(position);
												}
										}
								}
						}
				}
		}
		onBeforeRemove(entity, component) {
				var slots = component.slots;
				for(var key in slots){
						if (!slots[key].overlap) {
								slots[key].stop();
						}
				}
				component.onRemove();
		}
		destroy() {
				super.destroy();
				this.app.systems.off('update', this.onUpdate, this);
		}
		constructor(app){
				super(app);
				this.id = 'sound';
				this.ComponentType = SoundComponent;
				this.DataType = SoundComponentData;
				this.schema = _schema;
				this.manager = app.soundManager;
				this.app.systems.on('update', this.onUpdate, this);
				this.on('beforeremove', this.onBeforeRemove, this);
		}
}
Component._buildAccessors(SoundComponent.prototype, _schema);

export { SoundComponentSystem };
