import { LAYERID_DEPTH, ASPECT_AUTO, LAYERID_UI } from '../../../scene/constants.js';
import { Camera } from '../../../scene/camera.js';
import { ShaderPass } from '../../../scene/shader-pass.js';
import { Component } from '../component.js';
import { PostEffectQueue } from './post-effect-queue.js';

class CameraComponent extends Component {
		setShaderPass(name) {
				var shaderPass = ShaderPass.get(this.system.app.graphicsDevice);
				var shaderPassInfo = name ? shaderPass.allocate(name, {
						isForward: true
				}) : null;
				this._camera.shaderPassInfo = shaderPassInfo;
				return shaderPassInfo.index;
		}
		getShaderPass() {
				var _this__camera_shaderPassInfo;
				return (_this__camera_shaderPassInfo = this._camera.shaderPassInfo) == null ? undefined : _this__camera_shaderPassInfo.name;
		}
		set renderPasses(passes) {
				this._camera.renderPasses = passes || [];
				this.dirtyLayerCompositionCameras();
				this.system.app.scene.updateShaders = true;
		}
		get renderPasses() {
				return this._camera.renderPasses;
		}
		get shaderParams() {
				return this._camera.shaderParams;
		}
		set gammaCorrection(value) {
				this.camera.shaderParams.gammaCorrection = value;
		}
		get gammaCorrection() {
				return this.camera.shaderParams.gammaCorrection;
		}
		set toneMapping(value) {
				this.camera.shaderParams.toneMapping = value;
		}
		get toneMapping() {
				return this.camera.shaderParams.toneMapping;
		}
		set fog(value) {
				this._camera.fogParams = value;
		}
		get fog() {
				return this._camera.fogParams;
		}
		set aperture(value) {
				this._camera.aperture = value;
		}
		get aperture() {
				return this._camera.aperture;
		}
		set aspectRatio(value) {
				this._camera.aspectRatio = value;
		}
		get aspectRatio() {
				return this._camera.aspectRatio;
		}
		set aspectRatioMode(value) {
				this._camera.aspectRatioMode = value;
		}
		get aspectRatioMode() {
				return this._camera.aspectRatioMode;
		}
		set calculateProjection(value) {
				this._camera.calculateProjection = value;
		}
		get calculateProjection() {
				return this._camera.calculateProjection;
		}
		set calculateTransform(value) {
				this._camera.calculateTransform = value;
		}
		get calculateTransform() {
				return this._camera.calculateTransform;
		}
		get camera() {
				return this._camera;
		}
		set clearColor(value) {
				this._camera.clearColor = value;
		}
		get clearColor() {
				return this._camera.clearColor;
		}
		set clearColorBuffer(value) {
				this._camera.clearColorBuffer = value;
				this.dirtyLayerCompositionCameras();
		}
		get clearColorBuffer() {
				return this._camera.clearColorBuffer;
		}
		set clearDepthBuffer(value) {
				this._camera.clearDepthBuffer = value;
				this.dirtyLayerCompositionCameras();
		}
		get clearDepthBuffer() {
				return this._camera.clearDepthBuffer;
		}
		set clearStencilBuffer(value) {
				this._camera.clearStencilBuffer = value;
				this.dirtyLayerCompositionCameras();
		}
		get clearStencilBuffer() {
				return this._camera.clearStencilBuffer;
		}
		set cullFaces(value) {
				this._camera.cullFaces = value;
		}
		get cullFaces() {
				return this._camera.cullFaces;
		}
		set disablePostEffectsLayer(layer) {
				this._disablePostEffectsLayer = layer;
				this.dirtyLayerCompositionCameras();
		}
		get disablePostEffectsLayer() {
				return this._disablePostEffectsLayer;
		}
		set farClip(value) {
				this._camera.farClip = value;
		}
		get farClip() {
				return this._camera.farClip;
		}
		set flipFaces(value) {
				this._camera.flipFaces = value;
		}
		get flipFaces() {
				return this._camera.flipFaces;
		}
		set fov(value) {
				this._camera.fov = value;
		}
		get fov() {
				return this._camera.fov;
		}
		get frustum() {
				return this._camera.frustum;
		}
		set frustumCulling(value) {
				this._camera.frustumCulling = value;
		}
		get frustumCulling() {
				return this._camera.frustumCulling;
		}
		set horizontalFov(value) {
				this._camera.horizontalFov = value;
		}
		get horizontalFov() {
				return this._camera.horizontalFov;
		}
		set layers(newValue) {
				var oldLayers = this._camera.layers;
				var scene = this.system.app.scene;
				oldLayers.forEach((layerId)=>{
						var layer = scene.layers.getLayerById(layerId);
						layer == null ? undefined : layer.removeCamera(this);
				});
				this._camera.layers = newValue;
				if (this.enabled && this.entity.enabled) {
						newValue.forEach((layerId)=>{
								var layer = scene.layers.getLayerById(layerId);
								layer == null ? undefined : layer.addCamera(this);
						});
				}
		}
		get layers() {
				return this._camera.layers;
		}
		get layersSet() {
				return this._camera.layersSet;
		}
		set jitter(value) {
				this._camera.jitter = value;
		}
		get jitter() {
				return this._camera.jitter;
		}
		set nearClip(value) {
				this._camera.nearClip = value;
		}
		get nearClip() {
				return this._camera.nearClip;
		}
		set orthoHeight(value) {
				this._camera.orthoHeight = value;
		}
		get orthoHeight() {
				return this._camera.orthoHeight;
		}
		get postEffects() {
				return this._postEffects;
		}
		get postEffectsEnabled() {
				return this._postEffects.enabled;
		}
		set priority(newValue) {
				this._priority = newValue;
				this.dirtyLayerCompositionCameras();
		}
		get priority() {
				return this._priority;
		}
		set projection(value) {
				this._camera.projection = value;
		}
		get projection() {
				return this._camera.projection;
		}
		get projectionMatrix() {
				return this._camera.projectionMatrix;
		}
		set rect(value) {
				this._camera.rect = value;
				this.fire('set:rect', this._camera.rect);
		}
		get rect() {
				return this._camera.rect;
		}
		set renderSceneColorMap(value) {
				if (value && !this._sceneColorMapRequested) {
						this.requestSceneColorMap(true);
						this._sceneColorMapRequested = true;
				} else if (this._sceneColorMapRequested) {
						this.requestSceneColorMap(false);
						this._sceneColorMapRequested = false;
				}
		}
		get renderSceneColorMap() {
				return this._renderSceneColorMap > 0;
		}
		set renderSceneDepthMap(value) {
				if (value && !this._sceneDepthMapRequested) {
						this.requestSceneDepthMap(true);
						this._sceneDepthMapRequested = true;
				} else if (this._sceneDepthMapRequested) {
						this.requestSceneDepthMap(false);
						this._sceneDepthMapRequested = false;
				}
		}
		get renderSceneDepthMap() {
				return this._renderSceneDepthMap > 0;
		}
		set renderTarget(value) {
				this._camera.renderTarget = value;
				this.dirtyLayerCompositionCameras();
		}
		get renderTarget() {
				return this._camera.renderTarget;
		}
		set scissorRect(value) {
				this._camera.scissorRect = value;
		}
		get scissorRect() {
				return this._camera.scissorRect;
		}
		set sensitivity(value) {
				this._camera.sensitivity = value;
		}
		get sensitivity() {
				return this._camera.sensitivity;
		}
		set shutter(value) {
				this._camera.shutter = value;
		}
		get shutter() {
				return this._camera.shutter;
		}
		get viewMatrix() {
				return this._camera.viewMatrix;
		}
		_enableDepthLayer(value) {
				var hasDepthLayer = this.layers.find((layerId)=>layerId === LAYERID_DEPTH);
				if (hasDepthLayer) {
						var depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
						if (value) {
								depthLayer == null ? undefined : depthLayer.incrementCounter();
						} else {
								depthLayer == null ? undefined : depthLayer.decrementCounter();
						}
				} else if (value) {
						return false;
				}
				return true;
		}
		requestSceneColorMap(enabled) {
				this._renderSceneColorMap += enabled ? 1 : -1;
				this._enableDepthLayer(enabled);
				this.camera._enableRenderPassColorGrab(this.system.app.graphicsDevice, this.renderSceneColorMap);
		}
		requestSceneDepthMap(enabled) {
				this._renderSceneDepthMap += enabled ? 1 : -1;
				this._enableDepthLayer(enabled);
				this.camera._enableRenderPassDepthGrab(this.system.app.graphicsDevice, this.system.app.renderer, this.renderSceneDepthMap);
		}
		dirtyLayerCompositionCameras() {
				var layerComp = this.system.app.scene.layers;
				layerComp._dirty = true;
		}
		screenToWorld(screenx, screeny, cameraz, worldCoord) {
				var device = this.system.app.graphicsDevice;
				var { width, height } = device.clientRect;
				return this._camera.screenToWorld(screenx, screeny, cameraz, width, height, worldCoord);
		}
		worldToScreen(worldCoord, screenCoord) {
				var device = this.system.app.graphicsDevice;
				var { width, height } = device.clientRect;
				return this._camera.worldToScreen(worldCoord, width, height, screenCoord);
		}
		onAppPrerender() {
				this._camera._viewMatDirty = true;
				this._camera._viewProjMatDirty = true;
		}
		addCameraToLayers() {
				var layers = this.layers;
				for(var i = 0; i < layers.length; i++){
						var layer = this.system.app.scene.layers.getLayerById(layers[i]);
						if (layer) {
								layer.addCamera(this);
						}
				}
		}
		removeCameraFromLayers() {
				var layers = this.layers;
				for(var i = 0; i < layers.length; i++){
						var layer = this.system.app.scene.layers.getLayerById(layers[i]);
						if (layer) {
								layer.removeCamera(this);
						}
				}
		}
		onLayersChanged(oldComp, newComp) {
				this.addCameraToLayers();
				oldComp.off('add', this.onLayerAdded, this);
				oldComp.off('remove', this.onLayerRemoved, this);
				newComp.on('add', this.onLayerAdded, this);
				newComp.on('remove', this.onLayerRemoved, this);
		}
		onLayerAdded(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				layer.addCamera(this);
		}
		onLayerRemoved(layer) {
				var index = this.layers.indexOf(layer.id);
				if (index < 0) return;
				layer.removeCamera(this);
		}
		onEnable() {
				var _this__evtLayersChanged;
				var scene = this.system.app.scene;
				var layers = scene.layers;
				this.system.addCamera(this);
				(_this__evtLayersChanged = this._evtLayersChanged) == null ? undefined : _this__evtLayersChanged.off();
				this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);
				if (layers) {
						var _this__evtLayerAdded, _this__evtLayerRemoved;
						(_this__evtLayerAdded = this._evtLayerAdded) == null ? undefined : _this__evtLayerAdded.off();
						this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
						(_this__evtLayerRemoved = this._evtLayerRemoved) == null ? undefined : _this__evtLayerRemoved.off();
						this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
				}
				if (this.enabled && this.entity.enabled) {
						this.addCameraToLayers();
				}
				this.postEffects.enable();
		}
		onDisable() {
				var _this__evtLayersChanged;
				var scene = this.system.app.scene;
				var layers = scene.layers;
				this.postEffects.disable();
				this.removeCameraFromLayers();
				(_this__evtLayersChanged = this._evtLayersChanged) == null ? undefined : _this__evtLayersChanged.off();
				this._evtLayersChanged = null;
				if (layers) {
						var _this__evtLayerAdded, _this__evtLayerRemoved;
						(_this__evtLayerAdded = this._evtLayerAdded) == null ? undefined : _this__evtLayerAdded.off();
						this._evtLayerAdded = null;
						(_this__evtLayerRemoved = this._evtLayerRemoved) == null ? undefined : _this__evtLayerRemoved.off();
						this._evtLayerRemoved = null;
				}
				this.system.removeCamera(this);
		}
		onRemove() {
				this.onDisable();
				this.off();
				this.camera.destroy();
		}
		calculateAspectRatio(rt) {
				var device = this.system.app.graphicsDevice;
				var width = rt ? rt.width : device.width;
				var height = rt ? rt.height : device.height;
				return width * this.rect.z / (height * this.rect.w);
		}
		frameUpdate(rt) {
				if (this.aspectRatioMode === ASPECT_AUTO) {
						this.aspectRatio = this.calculateAspectRatio(rt);
				}
		}
		startXr(type, spaceType, options) {
				this.system.app.xr.start(this, type, spaceType, options);
		}
		endXr(callback) {
				if (!this._camera.xr) {
						if (callback) callback(new Error('Camera is not in XR'));
						return;
				}
				this._camera.xr.end(callback);
		}
		copy(source) {
				this.aperture = source.aperture;
				this.aspectRatio = source.aspectRatio;
				this.aspectRatioMode = source.aspectRatioMode;
				this.calculateProjection = source.calculateProjection;
				this.calculateTransform = source.calculateTransform;
				this.clearColor = source.clearColor;
				this.clearColorBuffer = source.clearColorBuffer;
				this.clearDepthBuffer = source.clearDepthBuffer;
				this.clearStencilBuffer = source.clearStencilBuffer;
				this.cullFaces = source.cullFaces;
				this.disablePostEffectsLayer = source.disablePostEffectsLayer;
				this.farClip = source.farClip;
				this.flipFaces = source.flipFaces;
				this.fov = source.fov;
				this.frustumCulling = source.frustumCulling;
				this.horizontalFov = source.horizontalFov;
				this.layers = source.layers;
				this.nearClip = source.nearClip;
				this.orthoHeight = source.orthoHeight;
				this.priority = source.priority;
				this.projection = source.projection;
				this.rect = source.rect;
				this.renderTarget = source.renderTarget;
				this.scissorRect = source.scissorRect;
				this.sensitivity = source.sensitivity;
				this.shutter = source.shutter;
		}
		constructor(system, entity){
				super(system, entity), this.onPostprocessing = null, this._renderSceneDepthMap = 0, this._renderSceneColorMap = 0, this._sceneDepthMapRequested = false, this._sceneColorMapRequested = false, this._priority = 0, this._disablePostEffectsLayer = LAYERID_UI, this._camera = new Camera(), this._evtLayersChanged = null, this._evtLayerAdded = null, this._evtLayerRemoved = null;
				this._camera.node = entity;
				this._postEffects = new PostEffectQueue(system.app, this);
		}
}

export { CameraComponent };
