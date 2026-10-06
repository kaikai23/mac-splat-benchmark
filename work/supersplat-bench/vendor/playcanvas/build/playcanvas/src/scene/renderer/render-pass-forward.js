import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderAction } from '../composition/render-action.js';
import { EVENT_PRERENDER, EVENT_POSTRENDER, EVENT_PRERENDER_LAYER, SHADER_FORWARD, EVENT_POSTRENDER_LAYER } from '../constants.js';

class RenderPassForward extends RenderPass {
		get rendersAnything() {
				return this.renderActions.length > 0;
		}
		addRenderAction(renderAction) {
				this.renderActions.push(renderAction);
		}
		addLayer(cameraComponent, layer, transparent, autoClears) {
				if (autoClears === undefined) autoClears = true;
				var ra = new RenderAction();
				ra.renderTarget = this.renderTarget;
				ra.camera = cameraComponent;
				ra.layer = layer;
				ra.transparent = transparent;
				if (autoClears) {
						var firstRa = this.renderActions.length === 0;
						ra.setupClears(firstRa ? cameraComponent : undefined, layer);
				}
				this.addRenderAction(ra);
		}
		addLayers(composition, cameraComponent, startIndex, firstLayerClears, lastLayerId, lastLayerIsTransparent) {
				if (lastLayerIsTransparent === undefined) lastLayerIsTransparent = true;
				var { layerList, subLayerList } = composition;
				var clearRenderTarget = firstLayerClears;
				var index = startIndex;
				while(index < layerList.length){
						var layer = layerList[index];
						var isTransparent = subLayerList[index];
						var renderedByCamera = cameraComponent.camera.layersSet.has(layer.id);
						if (renderedByCamera) {
								this.addLayer(cameraComponent, layer, isTransparent, clearRenderTarget);
								clearRenderTarget = false;
						}
						index++;
						if (layer.id === lastLayerId && isTransparent === lastLayerIsTransparent) {
								break;
						}
				}
				return index;
		}
		updateDirectionalShadows() {
				var { renderer, renderActions } = this;
				for(var i = 0; i < renderActions.length; i++){
						var renderAction = renderActions[i];
						var cameraComp = renderAction.camera;
						var camera = cameraComp.camera;
						var shadowDirLights = this.renderer.cameraDirShadowLights.get(camera);
						if (shadowDirLights) {
								for(var l = 0; l < shadowDirLights.length; l++){
										var light = shadowDirLights[l];
										if (renderer.dirLightShadows.get(light) !== camera) {
												renderer.dirLightShadows.set(light, camera);
												var shadowPass = renderer._shadowRendererDirectional.getLightRenderPass(light, camera);
												if (shadowPass) {
														this.beforePasses.push(shadowPass);
												}
										}
								}
						}
				}
		}
		updateClears() {
				var renderAction = this.renderActions[0];
				if (renderAction) {
						var cameraComponent = renderAction.camera;
						var camera = cameraComponent.camera;
						var fullSizeClearRect = camera.fullSizeClearRect;
						this.setClearColor(fullSizeClearRect && renderAction.clearColor ? camera.clearColor : undefined);
						this.setClearDepth(fullSizeClearRect && renderAction.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
						this.setClearStencil(fullSizeClearRect && renderAction.clearStencil ? camera.clearStencil : undefined);
				}
		}
		frameUpdate() {
				super.frameUpdate();
				this.updateDirectionalShadows();
				this.updateClears();
		}
		before() {
				var { renderActions } = this;
				for(var i = 0; i < renderActions.length; i++){
						var ra = renderActions[i];
						if (ra.firstCameraUse) {
								this.scene.fire(EVENT_PRERENDER, ra.camera);
						}
				}
		}
		execute() {
				var { layerComposition, renderActions } = this;
				for(var i = 0; i < renderActions.length; i++){
						var ra = renderActions[i];
						var layer = ra.layer;
						if (layerComposition.isEnabled(layer, ra.transparent)) {
								this.renderRenderAction(ra, i === 0);
						}
				}
		}
		after() {
				for(var i = 0; i < this.renderActions.length; i++){
						var ra = this.renderActions[i];
						if (ra.lastCameraUse) {
								this.scene.fire(EVENT_POSTRENDER, ra.camera);
						}
				}
				this.beforePasses.length = 0;
		}
		renderRenderAction(renderAction, firstRenderAction) {
				var { renderer, scene } = this;
				var device = renderer.device;
				var { layer, transparent, camera } = renderAction;
				if (camera) {
						var _camera_camera_shaderPassInfo;
						var originalGammaCorrection = camera.gammaCorrection;
						var originalToneMapping = camera.toneMapping;
						if (this.gammaCorrection !== undefined) camera.gammaCorrection = this.gammaCorrection;
						if (this.toneMapping !== undefined) camera.toneMapping = this.toneMapping;
						scene.fire(EVENT_PRERENDER_LAYER, camera, layer, transparent);
						var options = {
								lightClusters: renderAction.lightClusters
						};
						var _camera_camera_shaderPassInfo_index;
						var shaderPass = (_camera_camera_shaderPassInfo_index = (_camera_camera_shaderPassInfo = camera.camera.shaderPassInfo) == null ? undefined : _camera_camera_shaderPassInfo.index) != null ? _camera_camera_shaderPassInfo_index : SHADER_FORWARD;
						if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
								options.clearColor = renderAction.clearColor;
								options.clearDepth = renderAction.clearDepth;
								options.clearStencil = renderAction.clearStencil;
						}
						var _renderAction_renderTarget;
						var renderTarget = (_renderAction_renderTarget = renderAction.renderTarget) != null ? _renderAction_renderTarget : device.backBuffer;
						renderer.renderForwardLayer(camera.camera, renderTarget, layer, transparent, shaderPass, renderAction.viewBindGroups, options);
						device.setBlendState(BlendState.NOBLEND);
						device.setStencilState(null, null);
						device.setAlphaToCoverage(false);
						scene.fire(EVENT_POSTRENDER_LAYER, camera, layer, transparent);
						if (this.gammaCorrection !== undefined) camera.gammaCorrection = originalGammaCorrection;
						if (this.toneMapping !== undefined) camera.toneMapping = originalToneMapping;
				}
		}
		constructor(device, layerComposition, scene, renderer){
				super(device), this.renderActions = [], this.noDepthClear = false;
				this.layerComposition = layerComposition;
				this.scene = scene;
				this.renderer = renderer;
		}
}

export { RenderPassForward };
