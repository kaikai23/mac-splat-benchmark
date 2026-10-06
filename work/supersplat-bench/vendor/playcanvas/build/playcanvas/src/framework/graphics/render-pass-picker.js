import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_PICK } from '../../scene/constants.js';

var tempMeshInstances = [];
var lights = [
		[],
		[],
		[]
];
class RenderPassPicker extends RenderPass {
		destroy() {
				this.viewBindGroups.forEach((bg)=>{
						bg.defaultUniformBuffer.destroy();
						bg.destroy();
				});
				this.viewBindGroups.length = 0;
		}
		update(camera, scene, layers, mapping) {
				this.camera = camera;
				this.scene = scene;
				this.layers = layers;
				this.mapping = mapping;
		}
		execute() {
				var device = this.device;
				var { renderer, camera, scene, layers, mapping, renderTarget } = this;
				var srcLayers = scene.layers.layerList;
				var subLayerEnabled = scene.layers.subLayerEnabled;
				var isTransparent = scene.layers.subLayerList;
				for(var i = 0; i < srcLayers.length; i++){
						var srcLayer = srcLayers[i];
						if (layers && layers.indexOf(srcLayer) < 0) {
								continue;
						}
						if (srcLayer.enabled && subLayerEnabled[i]) {
								if (srcLayer.camerasSet.has(camera.camera)) {
										var transparent = isTransparent[i];
										if (srcLayer._clearDepthBuffer) {
												renderer.clear(camera.camera, false, true, false);
										}
										var meshInstances = srcLayer.meshInstances;
										for(var j = 0; j < meshInstances.length; j++){
												var meshInstance = meshInstances[j];
												if (meshInstance.pick && meshInstance.transparent === transparent) {
														tempMeshInstances.push(meshInstance);
														mapping.set(meshInstance.id, meshInstance);
												}
										}
										if (tempMeshInstances.length > 0) {
												var clusteredLightingEnabled = scene.clusteredLightingEnabled;
												if (clusteredLightingEnabled) {
														var lightClusters = renderer.worldClustersAllocator.empty;
														lightClusters.activate();
												}
												renderer.setCameraUniforms(camera.camera, renderTarget);
												if (device.supportsUniformBuffers) {
														renderer.setupViewUniformBuffers(this.viewBindGroups, renderer.viewUniformFormat, renderer.viewBindGroupFormat, 1);
												}
												renderer.renderForward(camera.camera, renderTarget, tempMeshInstances, lights, SHADER_PICK, (meshInstance)=>{
														device.setBlendState(BlendState.NOBLEND);
												});
												tempMeshInstances.length = 0;
										}
								}
						}
				}
		}
		constructor(device, renderer){
				super(device), this.viewBindGroups = [];
				this.renderer = renderer;
		}
}

export { RenderPassPicker };
