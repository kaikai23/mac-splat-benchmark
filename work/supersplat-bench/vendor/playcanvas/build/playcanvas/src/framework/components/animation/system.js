import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { AnimationComponent } from './component.js';
import { AnimationComponentData } from './data.js';

var _schema = [
		'enabled'
];
class AnimationComponentSystem extends ComponentSystem {
		initializeComponentData(component, data, properties) {
				properties = [
						'activate',
						'enabled',
						'loop',
						'speed',
						'assets'
				];
				for (var property of properties){
						if (data.hasOwnProperty(property)) {
								component[property] = data[property];
						}
				}
				super.initializeComponentData(component, data, _schema);
		}
		cloneComponent(entity, clone) {
				this.addComponent(clone, {});
				clone.animation.assets = entity.animation.assets.slice();
				clone.animation.speed = entity.animation.speed;
				clone.animation.loop = entity.animation.loop;
				clone.animation.activate = entity.animation.activate;
				clone.animation.enabled = entity.animation.enabled;
				var clonedAnimations = {};
				var animations = entity.animation.animations;
				for(var key in animations){
						if (animations.hasOwnProperty(key)) {
								clonedAnimations[key] = animations[key];
						}
				}
				clone.animation.animations = clonedAnimations;
				var clonedAnimationsIndex = {};
				var animationsIndex = entity.animation.animationsIndex;
				for(var key1 in animationsIndex){
						if (animationsIndex.hasOwnProperty(key1)) {
								clonedAnimationsIndex[key1] = animationsIndex[key1];
						}
				}
				clone.animation.animationsIndex = clonedAnimationsIndex;
				return clone.animation;
		}
		onBeforeRemove(entity, component) {
				component.onBeforeRemove();
		}
		onUpdate(dt) {
				var components = this.store;
				for(var id in components){
						if (components.hasOwnProperty(id)) {
								var component = components[id];
								if (component.data.enabled && component.entity.enabled) {
										component.entity.animation.update(dt);
								}
						}
				}
		}
		destroy() {
				super.destroy();
				this.app.systems.off('update', this.onUpdate, this);
		}
		constructor(app){
				super(app);
				this.id = 'animation';
				this.ComponentType = AnimationComponent;
				this.DataType = AnimationComponentData;
				this.schema = _schema;
				this.on('beforeremove', this.onBeforeRemove, this);
				this.app.systems.on('update', this.onUpdate, this);
		}
}
Component._buildAccessors(AnimationComponent.prototype, _schema);

export { AnimationComponentSystem };
