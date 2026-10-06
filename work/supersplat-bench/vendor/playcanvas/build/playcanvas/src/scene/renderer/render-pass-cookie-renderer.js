import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';
import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI } from '../constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { QuadRender } from '../graphics/quad-render.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

var textureBlitVertexShader = "\n	attribute vec2 vertex_position;\n	varying vec2 uv0;\n	void main(void) {\n		gl_Position = vec4(vertex_position, 0.5, 1.0);\n		uv0 = vertex_position.xy * 0.5 + 0.5;\n		#ifndef WEBGPU\n			uv0.y = 1.0 - uv0.y;\n		#endif\n	}";
var textureBlitFragmentShader = "\n	varying vec2 uv0;\n	uniform sampler2D blitTexture;\n	void main(void) {\n		gl_FragColor = texture2D(blitTexture, uv0);\n	}";
var textureCubeBlitFragmentShader = "\n	varying vec2 uv0;\n	uniform samplerCube blitTexture;\n	uniform mat4 invViewProj;\n	void main(void) {\n		vec4 projPos = vec4(uv0 * 2.0 - 1.0, 0.5, 1.0);\n		vec4 worldPos = invViewProj * projPos;\n		gl_FragColor = textureCube(blitTexture, worldPos.xyz);\n	}";
var _viewport = new Vec4();
var _invViewProjMatrices = [];
class RenderPassCookieRenderer extends RenderPass {
		destroy() {
				var _this__quadRenderer2D, _this__quadRendererCube;
				(_this__quadRenderer2D = this._quadRenderer2D) == null ? undefined : _this__quadRenderer2D.destroy();
				this._quadRenderer2D = null;
				(_this__quadRendererCube = this._quadRendererCube) == null ? undefined : _this__quadRendererCube.destroy();
				this._quadRendererCube = null;
		}
		static create(renderTarget, cubeSlotsOffsets) {
				var renderPass = new RenderPassCookieRenderer(renderTarget.device, cubeSlotsOffsets);
				renderPass.init(renderTarget);
				renderPass.colorOps.clear = false;
				renderPass.depthStencilOps.clearDepth = false;
				return renderPass;
		}
		update(lights) {
				var filteredLights = this._filteredLights;
				this.filter(lights, filteredLights);
				this.executeEnabled = filteredLights.length > 0;
		}
		filter(lights, filteredLights) {
				for(var i = 0; i < lights.length; i++){
						var light = lights[i];
						if (light._type === LIGHTTYPE_DIRECTIONAL) {
								continue;
						}
						if (!light.atlasViewportAllocated) {
								continue;
						}
						if (!light.atlasSlotUpdated) {
								continue;
						}
						if (light.enabled && light.cookie && light.visibleThisFrame) {
								filteredLights.push(light);
						}
				}
		}
		initInvViewProjMatrices() {
				if (!_invViewProjMatrices.length) {
						for(var face = 0; face < 6; face++){
								var camera = LightCamera.create(null, LIGHTTYPE_OMNI, face);
								var projMat = camera.projectionMatrix;
								var viewMat = camera.node.getLocalTransform().clone().invert();
								_invViewProjMatrices[face] = new Mat4().mul2(projMat, viewMat).invert();
						}
				}
		}
		get quadRenderer2D() {
				if (!this._quadRenderer2D) {
						var shader = createShaderFromCode(this.device, textureBlitVertexShader, textureBlitFragmentShader, 'cookieRenderer2d');
						this._quadRenderer2D = new QuadRender(shader);
				}
				return this._quadRenderer2D;
		}
		get quadRendererCube() {
				if (!this._quadRendererCube) {
						var shader = createShaderFromCode(this.device, textureBlitVertexShader, textureCubeBlitFragmentShader, 'cookieRendererCube');
						this._quadRendererCube = new QuadRender(shader);
				}
				return this._quadRendererCube;
		}
		execute() {
				var device = this.device;
				device.setBlendState(BlendState.NOBLEND);
				device.setCullMode(CULLFACE_NONE);
				device.setDepthState(DepthState.NODEPTH);
				device.setStencilState();
				var renderTargetWidth = this.renderTarget.colorBuffer.width;
				var cubeSlotsOffsets = this._cubeSlotsOffsets;
				var filteredLights = this._filteredLights;
				for(var i = 0; i < filteredLights.length; i++){
						var light = filteredLights[i];
						var faceCount = light.numShadowFaces;
						var quad = faceCount > 1 ? this.quadRendererCube : this.quadRenderer2D;
						if (faceCount > 1) {
								this.initInvViewProjMatrices();
						}
						this.blitTextureId.setValue(light.cookie);
						for(var face = 0; face < faceCount; face++){
								_viewport.copy(light.atlasViewport);
								if (faceCount > 1) {
										var smallSize = _viewport.z / 3;
										var offset = cubeSlotsOffsets[face];
										_viewport.x += smallSize * offset.x;
										_viewport.y += smallSize * offset.y;
										_viewport.z = smallSize;
										_viewport.w = smallSize;
										this.invViewProjId.setValue(_invViewProjMatrices[face].data);
								}
								_viewport.mulScalar(renderTargetWidth);
								quad.render(_viewport);
						}
				}
				filteredLights.length = 0;
		}
		constructor(device, cubeSlotsOffsets){
				super(device), this._quadRenderer2D = null, this._quadRendererCube = null, this._filteredLights = [];
				this._cubeSlotsOffsets = cubeSlotsOffsets;
				this.requiresCubemaps = false;
				this.blitTextureId = device.scope.resolve('blitTexture');
				this.invViewProjId = device.scope.resolve('invViewProj');
		}
}

export { RenderPassCookieRenderer };
