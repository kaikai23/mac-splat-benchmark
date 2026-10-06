import { Color } from '../../core/math/color.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, PIXELFORMAT_SRGBA8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { QuadRender } from '../../scene/graphics/quad-render.js';
import { StandardMaterialOptions } from '../../scene/materials/standard-material-options.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { createShaderFromCode } from '../../scene/shader-lib/utils.js';

var shaderOutlineExtendPS = "\n	varying vec2 vUv0;\n	uniform vec2 uOffset;\n	uniform float uSrcMultiplier;\n	uniform sampler2D source;\n	void main(void)\n	{\n		vec4 pixel;\n		vec4 texel = texture2D(source, vUv0);\n		vec4 firstTexel = texel;\n		float diff = texel.a * uSrcMultiplier;\n		pixel = texture2D(source, vUv0 + uOffset * -2.0);\n		texel = max(texel, pixel);\n		diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n		pixel = texture2D(source, vUv0 + uOffset * -1.0);\n		texel = max(texel, pixel);\n		diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n		pixel = texture2D(source, vUv0 + uOffset * 1.0);\n		texel = max(texel, pixel);\n		diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n		pixel = texture2D(source, vUv0 + uOffset * 2.0);\n		texel = max(texel, pixel);\n		diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n	   gl_FragColor = vec4(texel.rgb, min(diff, 1.0));\n	}\n";
var _tempFloatArray = new Float32Array(2);
var _tempColor = new Color();
class OutlineRenderer {
		destroy() {
				var _this_quadRenderer;
				this.whiteTex.destroy();
				this.whiteTex = null;
				this.outlineCameraEntity.destroy();
				this.outlineCameraEntity = null;
				this.rt.destroyTextureBuffers();
				this.rt.destroy();
				this.rt = null;
				this.tempRt.destroyTextureBuffers();
				this.tempRt.destroy();
				this.tempRt = null;
				this.app.scene.off('postrender', this.postRender);
				(_this_quadRenderer = this.quadRenderer) == null ? undefined : _this_quadRenderer.destroy();
				this.quadRenderer = null;
		}
		getMeshInstances(entity, recursive) {
				var meshInstances = [];
				var renders = recursive ? entity.findComponents('render') : entity.render ? [
						entity.render
				] : [];
				renders.forEach((render)=>{
						if (render.entity.enabled && render.enabled && render.meshInstances) {
								meshInstances.push(...render.meshInstances);
						}
				});
				var models = recursive ? entity.findComponents('model') : entity.model ? [
						entity.model
				] : [];
				models.forEach((model)=>{
						if (model.entity.enabled && model.enabled && model.meshInstances) {
								meshInstances.push(...model.meshInstances);
						}
				});
				return meshInstances;
		}
		addEntity(entity, color, recursive) {
				if (recursive === undefined) recursive = true;
				var meshInstances = this.getMeshInstances(entity, recursive);
				meshInstances.forEach((meshInstance)=>{
						if (meshInstance.material instanceof StandardMaterial) {
								var outlineShaderPass = this.outlineShaderPass;
								meshInstance.material.onUpdateShader = (options)=>{
										if (options.pass === outlineShaderPass) {
												var opts = new StandardMaterialOptions();
												opts.defines = options.defines;
												opts.opacityMap = options.opacityMap;
												opts.opacityMapUv = options.opacityMapUv;
												opts.opacityMapChannel = options.opacityMapChannel;
												opts.opacityMapTransform = options.opacityMapTransform;
												opts.opacityVertexColor = options.opacityVertexColor;
												opts.opacityVertexColorChannel = options.opacityVertexColorChannel;
												opts.litOptions.vertexColors = options.litOptions.vertexColors;
												opts.litOptions.alphaTest = options.litOptions.alphaTest;
												opts.litOptions.skin = options.litOptions.skin;
												opts.litOptions.batch = options.litOptions.batch;
												opts.litOptions.useInstancing = options.litOptions.useInstancing;
												opts.litOptions.useMorphPosition = options.litOptions.useMorphPosition;
												opts.litOptions.useMorphNormal = options.litOptions.useMorphNormal;
												opts.litOptions.useMorphTextureBasedInt = options.litOptions.useMorphTextureBasedInt;
												return opts;
										}
										return options;
								};
								_tempColor.linear(color);
								var colArray = new Float32Array([
										_tempColor.r,
										_tempColor.g,
										_tempColor.b
								]);
								meshInstance.setParameter('material_emissive', colArray, 1 << this.outlineShaderPass);
								meshInstance.setParameter('texture_emissiveMap', this.whiteTex, 1 << this.outlineShaderPass);
						}
				});
				this.renderingLayer.addMeshInstances(meshInstances, true);
		}
		removeEntity(entity, recursive) {
				if (recursive === undefined) recursive = true;
				var meshInstances = this.getMeshInstances(entity, recursive);
				this.renderingLayer.removeMeshInstances(meshInstances);
				meshInstances.forEach((meshInstance)=>{
						if (meshInstance.material instanceof StandardMaterial) {
								meshInstance.material.onUpdateShader = null;
								meshInstance.deleteParameter('material_emissive');
						}
				});
		}
		removeAllEntities() {
				this.renderingLayer.clearMeshInstances();
		}
		blendOutlines() {
				var device = this.app.graphicsDevice;
				device.scope.resolve('source').setValue(this.rt.colorBuffer);
				device.setDepthState(DepthState.NODEPTH);
				device.setCullMode(CULLFACE_NONE);
				device.setBlendState(this.blendState);
				this.quadRenderer.render();
		}
		onPostRender() {
				var device = this.app.graphicsDevice;
				var uOffset = device.scope.resolve('uOffset');
				var uColorBuffer = device.scope.resolve('source');
				var uSrcMultiplier = device.scope.resolve('uSrcMultiplier');
				var { rt, tempRt, shaderExtend } = this;
				var { width, height } = rt;
				_tempFloatArray[0] = 1.0 / width / 2.0;
				_tempFloatArray[1] = 0;
				uOffset.setValue(_tempFloatArray);
				uColorBuffer.setValue(rt.colorBuffer);
				uSrcMultiplier.setValue(0.0);
				drawQuadWithShader(device, tempRt, shaderExtend);
				_tempFloatArray[0] = 0;
				_tempFloatArray[1] = 1.0 / height / 2.0;
				uOffset.setValue(_tempFloatArray);
				uColorBuffer.setValue(tempRt.colorBuffer);
				uSrcMultiplier.setValue(1.0);
				drawQuadWithShader(device, rt, shaderExtend);
		}
		createRenderTarget(name, width, height, depth) {
				var texture = new Texture(this.app.graphicsDevice, {
						name: name,
						width: width,
						height: height,
						format: PIXELFORMAT_SRGBA8,
						mipmaps: false,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
						magFilter: FILTER_LINEAR
				});
				return new RenderTarget({
						colorBuffer: texture,
						depth: depth,
						flipY: this.app.graphicsDevice.isWebGPU
				});
		}
		updateRenderTarget(sceneCamera) {
				var _sceneCamera_renderTarget, _sceneCamera_renderTarget1;
				var _sceneCamera_renderTarget_width;
				var width = (_sceneCamera_renderTarget_width = (_sceneCamera_renderTarget = sceneCamera.renderTarget) == null ? undefined : _sceneCamera_renderTarget.width) != null ? _sceneCamera_renderTarget_width : this.app.graphicsDevice.width;
				var _sceneCamera_renderTarget_height;
				var height = (_sceneCamera_renderTarget_height = (_sceneCamera_renderTarget1 = sceneCamera.renderTarget) == null ? undefined : _sceneCamera_renderTarget1.height) != null ? _sceneCamera_renderTarget_height : this.app.graphicsDevice.height;
				var outlineCamera = this.outlineCameraEntity.camera;
				if (!outlineCamera.renderTarget || outlineCamera.renderTarget.width !== width || outlineCamera.renderTarget.height !== height) {
						this.rt.resize(width, height);
						this.tempRt.resize(width, height);
				}
		}
		frameUpdate(sceneCameraEntity, blendLayer, blendLayerTransparent) {
				var sceneCamera = sceneCameraEntity.camera;
				this.updateRenderTarget(sceneCamera);
				var evt = this.app.scene.on('prerender:layer', (cameraComponent, layer, transparent)=>{
						if (sceneCamera === cameraComponent && transparent === blendLayerTransparent && layer === blendLayer) {
								this.blendOutlines();
								evt.off();
						}
				});
				this.outlineCameraEntity.setLocalPosition(sceneCameraEntity.getPosition());
				this.outlineCameraEntity.setLocalRotation(sceneCameraEntity.getRotation());
				var outlineCamera = this.outlineCameraEntity.camera;
				outlineCamera.projection = sceneCamera.projection;
				outlineCamera.horizontalFov = sceneCamera.horizontalFov;
				outlineCamera.fov = sceneCamera.fov;
				outlineCamera.orthoHeight = sceneCamera.orthoHeight;
				outlineCamera.nearClip = sceneCamera.nearClip;
				outlineCamera.farClip = sceneCamera.farClip;
		}
		constructor(app, renderingLayer, priority = -1){
				this.app = app;
				this.renderingLayer = renderingLayer != null ? renderingLayer : app.scene.layers.getLayerByName('Immediate');
				this.rt = this.createRenderTarget('OutlineTexture', 1, 1, true);
				this.outlineCameraEntity = new Entity('OutlineCamera');
				this.outlineCameraEntity.addComponent('camera', {
						layers: [
								this.renderingLayer.id
						],
						priority: priority,
						clearColor: new Color(0, 0, 0, 0),
						renderTarget: this.rt
				});
				this.outlineShaderPass = this.outlineCameraEntity.camera.setShaderPass('OutlineShaderPass');
				this.postRender = (cameraComponent)=>{
						if (this.outlineCameraEntity.camera === cameraComponent) {
								this.onPostRender();
						}
				};
				app.scene.on('postrender', this.postRender);
				this.app.root.addChild(this.outlineCameraEntity);
				this.tempRt = this.createRenderTarget('OutlineTempTexture', 1, 1, false);
				this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA);
				var device = this.app.graphicsDevice;
				this.shaderExtend = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderOutlineExtendPS, 'OutlineExtendShader');
				this.shaderBlend = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.outputTex2DPS, 'OutlineBlendShader');
				this.quadRenderer = new QuadRender(this.shaderBlend);
				this.whiteTex = new Texture(device, {
						name: 'OutlineWhiteTexture',
						width: 1,
						height: 1,
						format: PIXELFORMAT_SRGBA8,
						mipmaps: false
				});
				var pixels = this.whiteTex.lock();
				pixels.set(new Uint8Array([
						255,
						255,
						255,
						255
				]));
				this.whiteTex.unlock();
		}
}

export { OutlineRenderer };
