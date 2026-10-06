import { FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

var fs = "\n	uniform sampler2D sourceTexture;\n	uniform sampler2D historyTexture;\n	uniform mat4 matrix_viewProjectionPrevious;\n	uniform mat4 matrix_viewProjectionInverse;\n	uniform vec4 jitters;\n	uniform vec2 textureSize;\n	varying vec2 uv0;\n	vec2 reproject(vec2 uv, float depth) {\n		#ifndef WEBGPU\n			depth = depth * 2.0 - 1.0;\n		#endif\n		vec4 ndc = vec4(uv * 2.0 - 1.0, depth, 1.0);\n		ndc.xy -= jitters.xy;\n		vec4 worldPosition = matrix_viewProjectionInverse * ndc;\n		worldPosition /= worldPosition.w;\n	\n		vec4 screenPrevious = matrix_viewProjectionPrevious * worldPosition;\n		return (screenPrevious.xy / screenPrevious.w) * 0.5 + 0.5;\n	}\n	vec4 colorClamp(vec2 uv, vec4 historyColor) {\n		vec3 minColor = vec3(9999.0);\n		vec3 maxColor = vec3(-9999.0);\n \n		for(float x = -1.0; x <= 1.0; ++x)\n		{\n			for(float y = -1.0; y <= 1.0; ++y)\n			{\n				vec3 color = texture2D(sourceTexture, uv + vec2(x, y) / textureSize).rgb;\n				minColor = min(minColor, color);\n				maxColor = max(maxColor, color);\n			}\n		}\n \n		vec3 clamped = clamp(historyColor.rgb, minColor, maxColor);\n		return vec4(clamped, historyColor.a);\n	}\n	void main()\n	{\n		vec2 uv = uv0;\n		#ifdef WEBGPU\n			uv.y = 1.0 - uv.y;\n		#endif\n		vec4 srcColor = texture2D(sourceTexture, uv);\n		float linearDepth = getLinearScreenDepth(uv0);\n		float depth = delinearizeDepth(linearDepth);\n		vec2 historyUv = reproject(uv0, depth);\n		#ifdef QUALITY_HIGH\n			vec4 historyColor = SampleTextureCatmullRom(TEXTURE_PASS(historyTexture), historyUv, textureSize);\n		#else\n			vec4 historyColor = texture2D(historyTexture, historyUv);\n		#endif\n		vec4 historyColorClamped = colorClamp(uv, historyColor);\n		float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?\n			1.0 : 0.05;\n		gl_FragColor = mix(historyColorClamped, srcColor, mixFactor);\n	}\n";
class RenderPassTAA extends RenderPassShaderQuad {
		destroy() {
				if (this.renderTarget) {
						this.renderTarget.destroyTextureBuffers();
						this.renderTarget.destroy();
						this.renderTarget = null;
				}
		}
		setup() {
				for(var i = 0; i < 2; ++i){
						this.historyTextures[i] = new Texture(this.device, {
								name: "TAA-History-" + i,
								width: 4,
								height: 4,
								format: this.sourceTexture.format,
								mipmaps: false,
								minFilter: FILTER_LINEAR,
								magFilter: FILTER_LINEAR,
								addressU: ADDRESS_CLAMP_TO_EDGE,
								addressV: ADDRESS_CLAMP_TO_EDGE
						});
						this.historyRenderTargets[i] = new RenderTarget({
								colorBuffer: this.historyTextures[i],
								depth: false
						});
				}
				this.historyTexture = this.historyTextures[0];
				this.init(this.historyRenderTargets[0], {
						resizeSource: this.sourceTexture
				});
		}
		before() {
				this.sourceTextureId.setValue(this.sourceTexture);
				this.historyTextureId.setValue(this.historyTextures[1 - this.historyIndex]);
				this.textureSize[0] = this.sourceTexture.width;
				this.textureSize[1] = this.sourceTexture.height;
				this.textureSizeId.setValue(this.textureSize);
				var camera = this.cameraComponent.camera;
				this.viewProjPrevId.setValue(camera._viewProjPrevious.data);
				this.viewProjInvId.setValue(camera._viewProjInverse.data);
				this.jittersId.setValue(camera._jitters);
				var f = camera._farClip;
				this.cameraParams[0] = 1 / f;
				this.cameraParams[1] = f;
				this.cameraParams[2] = camera._nearClip;
				this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
				this.cameraParamsId.setValue(this.cameraParams);
		}
		update() {
				this.historyIndex = 1 - this.historyIndex;
				this.historyTexture = this.historyTextures[this.historyIndex];
				this.renderTarget = this.historyRenderTargets[this.historyIndex];
				return this.historyTexture;
		}
		constructor(device, sourceTexture, cameraComponent){
				super(device), this.historyIndex = 0, this.historyTexture = null, this.historyTextures = [], this.historyRenderTargets = [];
				this.sourceTexture = sourceTexture;
				this.cameraComponent = cameraComponent;
				var defines = "\n			#define QUALITY_HIGH\n		";
				var screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
				var fsChunks = shaderChunks.sampleCatmullRomPS + screenDepth;
				this.shader = this.createQuadShader('TaaResolveShader', defines + fsChunks + fs);
				var { scope } = device;
				this.sourceTextureId = scope.resolve('sourceTexture');
				this.textureSizeId = scope.resolve('textureSize');
				this.textureSize = new Float32Array(2);
				this.historyTextureId = scope.resolve('historyTexture');
				this.viewProjPrevId = scope.resolve('matrix_viewProjectionPrevious');
				this.viewProjInvId = scope.resolve('matrix_viewProjectionInverse');
				this.jittersId = scope.resolve('jitters');
				this.cameraParams = new Float32Array(4);
				this.cameraParamsId = scope.resolve('camera_params');
				this.setup();
		}
}

export { RenderPassTAA };
