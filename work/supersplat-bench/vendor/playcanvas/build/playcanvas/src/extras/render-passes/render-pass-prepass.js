import { PIXELFORMAT_R32F, PIXELFORMAT_RGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { LAYERID_DEPTH, SHADER_PREPASS } from '../../scene/constants.js';
import { Color } from '../../core/math/color.js';
import { FloatPacking } from '../../core/math/float-packing.js';

var tempMeshInstances = [];
var DEPTH_UNIFORM_NAME = 'uSceneDepthMap';
class RenderPassPrepass extends RenderPass {
		destroy() {
				var _this_renderTarget, _this_linearDepthTexture;
				super.destroy();
				(_this_renderTarget = this.renderTarget) == null ? undefined : _this_renderTarget.destroy();
				this.renderTarget = null;
				(_this_linearDepthTexture = this.linearDepthTexture) == null ? undefined : _this_linearDepthTexture.destroy();
				this.linearDepthTexture = null;
				this.viewBindGroups.forEach((bg)=>{
						bg.defaultUniformBuffer.destroy();
						bg.destroy();
				});
				this.viewBindGroups.length = 0;
		}
		setupRenderTarget(options) {
				var { device } = this;
				this.linearDepthFormat = device.textureFloatRenderable ? PIXELFORMAT_R32F : PIXELFORMAT_RGBA8;
				this.linearDepthTexture = new Texture(device, {
						name: 'SceneLinearDepthTexture',
						width: 1,
						height: 1,
						format: this.linearDepthFormat,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				var renderTarget = new RenderTarget({
						name: 'PrepassRT',
						colorBuffer: this.linearDepthTexture,
						depth: true,
						samples: 1
				});
				this.camera.shaderParams.sceneDepthMapLinear = true;
				this.init(renderTarget, options);
		}
		after() {
				this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.linearDepthTexture);
		}
		execute() {
				var { renderer, scene, renderTarget } = this;
				var camera = this.camera.camera;
				var layers = scene.layers.layerList;
				var subLayerEnabled = scene.layers.subLayerEnabled;
				var isTransparent = scene.layers.subLayerList;
				for(var i = 0; i < layers.length; i++){
						var layer = layers[i];
						if (layer.id === LAYERID_DEPTH) {
								break;
						}
						if (layer.enabled && subLayerEnabled[i]) {
								if (layer.camerasSet.has(camera)) {
										var culledInstances = layer.getCulledInstances(camera);
										var meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;
										for(var j = 0; j < meshInstances.length; j++){
												var _meshInstance_material;
												var meshInstance = meshInstances[j];
												if ((_meshInstance_material = meshInstance.material) == null ? undefined : _meshInstance_material.depthWrite) {
														tempMeshInstances.push(meshInstance);
												}
										}
										renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_PREPASS, this.viewBindGroups, {
												meshInstances: tempMeshInstances
										});
										tempMeshInstances.length = 0;
								}
						}
				}
		}
		frameUpdate() {
				super.frameUpdate();
				var { camera } = this;
				this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);
				var clearValue;
				if (camera.clearDepthBuffer) {
						var farClip = camera.farClip - Number.MIN_VALUE;
						clearValue = this.linearDepthClearValue;
						if (this.linearDepthFormat === PIXELFORMAT_R32F) {
								clearValue.r = farClip;
						} else {
								FloatPacking.float2RGBA8(farClip, clearValue);
						}
				}
				this.setClearColor(clearValue);
		}
		constructor(device, scene, renderer, camera, options){
				super(device), this.viewBindGroups = [], this.linearDepthClearValue = new Color(0, 0, 0, 0);
				this.scene = scene;
				this.renderer = renderer;
				this.camera = camera;
				this.setupRenderTarget(options);
		}
}

export { RenderPassPrepass };
