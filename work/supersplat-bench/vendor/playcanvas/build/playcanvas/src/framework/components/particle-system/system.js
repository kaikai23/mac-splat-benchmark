import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { ComponentSystem } from '../system.js';
import { ParticleSystemComponent } from './component.js';
import { ParticleSystemComponentData } from './data.js';

var _schema = [
		'enabled',
		'autoPlay',
		'numParticles',
		'lifetime',
		'rate',
		'rate2',
		'startAngle',
		'startAngle2',
		'loop',
		'preWarm',
		'lighting',
		'halfLambert',
		'intensity',
		'depthWrite',
		'noFog',
		'depthSoftening',
		'sort',
		'blendType',
		'stretch',
		'alignToMotion',
		'emitterShape',
		'emitterExtents',
		'emitterExtentsInner',
		'emitterRadius',
		'emitterRadiusInner',
		'initialVelocity',
		'wrap',
		'wrapBounds',
		'localSpace',
		'screenSpace',
		'colorMapAsset',
		'normalMapAsset',
		'mesh',
		'meshAsset',
		'renderAsset',
		'orientation',
		'particleNormal',
		'localVelocityGraph',
		'localVelocityGraph2',
		'velocityGraph',
		'velocityGraph2',
		'rotationSpeedGraph',
		'rotationSpeedGraph2',
		'radialSpeedGraph',
		'radialSpeedGraph2',
		'scaleGraph',
		'scaleGraph2',
		'colorGraph',
		'colorGraph2',
		'alphaGraph',
		'alphaGraph2',
		'colorMap',
		'normalMap',
		'animTilesX',
		'animTilesY',
		'animStartFrame',
		'animNumFrames',
		'animNumAnimations',
		'animIndex',
		'randomizeAnimIndex',
		'animSpeed',
		'animLoop',
		'layers'
];
class ParticleSystemComponentSystem extends ComponentSystem {
		initializeComponentData(component, _data, properties) {
				var data = {};
				properties = [];
				var types = this.propertyTypes;
				if (_data.mesh instanceof Asset || typeof _data.mesh === 'number') {
						_data.meshAsset = _data.mesh;
						delete _data.mesh;
				}
				for(var prop in _data){
						if (_data.hasOwnProperty(prop)) {
								properties.push(prop);
								data[prop] = _data[prop];
						}
						if (types[prop] === 'vec3') {
								if (Array.isArray(data[prop])) {
										data[prop] = new Vec3(data[prop][0], data[prop][1], data[prop][2]);
								}
						} else if (types[prop] === 'curve') {
								if (!(data[prop] instanceof Curve)) {
										var t = data[prop].type;
										data[prop] = new Curve(data[prop].keys);
										data[prop].type = t;
								}
						} else if (types[prop] === 'curveset') {
								if (!(data[prop] instanceof CurveSet)) {
										var t1 = data[prop].type;
										data[prop] = new CurveSet(data[prop].keys);
										data[prop].type = t1;
								}
						}
						if (data.layers && Array.isArray(data.layers)) {
								data.layers = data.layers.slice(0);
						}
				}
				super.initializeComponentData(component, data, properties);
		}
		cloneComponent(entity, clone) {
				var source = entity.particlesystem.data;
				var schema = this.schema;
				var data = {};
				for(var i = 0, len = schema.length; i < len; i++){
						var prop = schema[i];
						var sourceProp = source[prop];
						if (sourceProp instanceof Vec3 || sourceProp instanceof Curve || sourceProp instanceof CurveSet) {
								sourceProp = sourceProp.clone();
								data[prop] = sourceProp;
						} else if (prop === 'layers') {
								data.layers = source.layers.slice(0);
						} else {
								if (sourceProp !== null && sourceProp !== undefined) {
										data[prop] = sourceProp;
								}
						}
				}
				return this.addComponent(clone, data);
		}
		onUpdate(dt) {
				var components = this.store;
				var numSteps;
				var stats = this.app.stats.particles;
				var composition = this.app.scene.layers;
				for(var i = 0; i < composition.layerList.length; i++){
						composition.layerList[i].requiresLightCube = false;
				}
				for(var id in components){
						if (components.hasOwnProperty(id)) {
								var component = components[id];
								var entity = component.entity;
								var data = component.data;
								if (data.enabled && entity.enabled) {
										var emitter = entity.particlesystem.emitter;
										if (!(emitter == null ? undefined : emitter.meshInstance.visible)) continue;
										if (emitter.lighting) {
												var layers = data.layers;
												for(var i1 = 0; i1 < layers.length; i1++){
														var layer = composition.getLayerById(layers[i1]);
														if (layer) {
																layer.requiresLightCube = true;
														}
												}
										}
										if (!data.paused) {
												emitter.simTime += dt;
												if (emitter.simTime > emitter.fixedTimeStep) {
														numSteps = Math.floor(emitter.simTime / emitter.fixedTimeStep);
														emitter.simTime -= numSteps * emitter.fixedTimeStep;
												}
												if (numSteps) {
														numSteps = Math.min(numSteps, emitter.maxSubSteps);
														for(var i2 = 0; i2 < numSteps; i2++){
																emitter.addTime(emitter.fixedTimeStep, false);
														}
														stats._updatesPerFrame += numSteps;
														stats._frameTime += emitter._addTimeTime;
														emitter._addTimeTime = 0;
												}
												emitter.finishFrame();
										}
								}
						}
				}
		}
		onBeforeRemove(entity, component) {
				component.onBeforeRemove();
		}
		destroy() {
				super.destroy();
				this.app.systems.off('update', this.onUpdate, this);
		}
		constructor(app){
				super(app);
				this.id = 'particlesystem';
				this.ComponentType = ParticleSystemComponent;
				this.DataType = ParticleSystemComponentData;
				this.schema = _schema;
				this.propertyTypes = {
						emitterExtents: 'vec3',
						emitterExtentsInner: 'vec3',
						particleNormal: 'vec3',
						wrapBounds: 'vec3',
						localVelocityGraph: 'curveset',
						localVelocityGraph2: 'curveset',
						velocityGraph: 'curveset',
						velocityGraph2: 'curveset',
						colorGraph: 'curveset',
						colorGraph2: 'curveset',
						alphaGraph: 'curve',
						alphaGraph2: 'curve',
						rotationSpeedGraph: 'curve',
						rotationSpeedGraph2: 'curve',
						radialSpeedGraph: 'curve',
						radialSpeedGraph2: 'curve',
						scaleGraph: 'curve',
						scaleGraph2: 'curve'
				};
				this.on('beforeremove', this.onBeforeRemove, this);
				this.app.systems.on('update', this.onUpdate, this);
		}
}

export { ParticleSystemComponentSystem };
