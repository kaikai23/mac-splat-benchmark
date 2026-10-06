import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { gammaNames, tonemapNames, TONEMAP_LINEAR, GAMMA_SRGB, GAMMA_NONE } from '../../scene/constants.js';

var fragmentShader = '\n	#include "tonemappingPS"\n	#include "decodePS"\n	#include "gammaPS"\n	varying vec2 uv0;\n	uniform sampler2D sceneTexture;\n	uniform vec2 sceneTextureInvRes;\n	#ifdef BLOOM\n		uniform sampler2D bloomTexture;\n		uniform float bloomIntensity;\n	#endif\n	#ifdef DOF\n		uniform sampler2D cocTexture;\n		uniform sampler2D blurTexture;\n		vec3 dofBlur(vec2 uv, out vec2 coc) {\n			coc = texture2DLod(cocTexture, uv, 0.0).rg;\n			#if DOF_UPSCALE\n				vec2 blurTexelSize = 1.0 / vec2(textureSize(blurTexture, 0));\n				vec3 bilinearBlur = vec3(0.0);\n				float totalWeight = 0.0;\n				for (int i = -1; i <= 1; i++) {\n					for (int j = -1; j <= 1; j++) {\n						vec2 offset = vec2(i, j) * blurTexelSize;\n						vec2 cocSample = texture2DLod(cocTexture, uv + offset, 0.0).rg;\n						vec3 blurSample = texture2DLod(blurTexture, uv + offset, 0.0).rgb;\n						float cocWeight = clamp(cocSample.r + cocSample.g, 0.0, 1.0);\n						bilinearBlur += blurSample * cocWeight;\n						totalWeight += cocWeight;\n					}\n				}\n				if (totalWeight > 0.0) {\n					bilinearBlur /= totalWeight;\n				}\n				return bilinearBlur;\n			#else\n				return texture2DLod(blurTexture, uv, 0.0).rgb;\n			#endif\n		}\n	#endif\n	#ifdef SSAO\n		#define SSAO_TEXTURE\n	#endif\n	#if DEBUG_COMPOSE == ssao\n		#define SSAO_TEXTURE\n	#endif\n	#ifdef SSAO_TEXTURE\n		uniform sampler2D ssaoTexture;\n	#endif\n	#ifdef GRADING\n		uniform vec3 brightnessContrastSaturation;\n		uniform vec3 tint;\n		vec3 colorGradingHDR(vec3 color, float brt, float sat, float con)\n		{\n			color *= tint;\n			color = color * brt;\n			float grey = dot(color, vec3(0.3, 0.59, 0.11));\n			grey = grey / max(1.0, max(color.r, max(color.g, color.b)));\n			color = mix(vec3(grey), color, sat);\n			return mix(vec3(0.5), color, con);\n		}\n	\n	#endif\n	#ifdef VIGNETTE\n		uniform vec4 vignetterParams;\n		float vignette(vec2 uv) {\n			float inner = vignetterParams.x;\n			float outer = vignetterParams.y;\n			float curvature = vignetterParams.z;\n			float intensity = vignetterParams.w;\n			vec2 curve = pow(abs(uv * 2.0 -1.0), vec2(1.0 / curvature));\n			float edge = pow(length(curve), curvature);\n			return 1.0 - intensity * smoothstep(inner, outer, edge);\n		}		\n	#endif\n	#ifdef FRINGING\n		uniform float fringingIntensity;\n		vec3 fringing(vec2 uv, vec3 color) {\n			vec2 centerDistance = uv - 0.5;\n			vec2 offset = fringingIntensity * pow(centerDistance, vec2(2.0, 2.0));\n			color.r = texture2D(sceneTexture, uv - offset).r;\n			color.b = texture2D(sceneTexture, uv + offset).b;\n			return color;\n		}\n	#endif\n	#ifdef CAS\n		uniform float sharpness;\n		float maxComponent(float x, float y, float z) { return max(x, max(y, z)); }\n		vec3 toSDR(vec3 c) { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }\n		vec3 toHDR(vec3 c) { return c / (1.0 - maxComponent(c.r, c.g, c.b)); }\n		vec3 cas(vec3 color, vec2 uv, float sharpness) {\n			float x = sceneTextureInvRes.x;\n			float y = sceneTextureInvRes.y;\n			vec3 a = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, -y), 0.0).rgb);\n			vec3 b = toSDR(texture2DLod(sceneTexture, uv + vec2(-x, 0.0), 0.0).rgb);\n			vec3 c = toSDR(color.rgb);\n			vec3 d = toSDR(texture2DLod(sceneTexture, uv + vec2(x, 0.0), 0.0).rgb);\n			vec3 e = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, y), 0.0).rgb);\n			float min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));\n			float max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));\n			float sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max_g);\n			float w = sharpening_amount * sharpness;\n			vec3 res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);\n			res = max(res, 0.0);\n			return toHDR(res);\n		}\n	#endif\n	void main() {\n		vec2 uv = uv0;\n		#ifdef TAA\n		#ifdef WEBGPU\n			uv.y = 1.0 - uv.y;\n		#endif\n		#endif\n		vec4 scene = texture2DLod(sceneTexture, uv, 0.0);\n		vec3 result = scene.rgb;\n		#ifdef CAS\n			result = cas(result, uv, sharpness);\n		#endif\n		#ifdef DOF\n			vec2 coc;\n			vec3 blur = dofBlur(uv, coc);\n			result = mix(result, blur, coc.r + coc.g);\n		#endif\n		#ifdef SSAO_TEXTURE\n			mediump float ssao = texture2DLod(ssaoTexture, uv0, 0.0).r;\n		#endif\n		#ifdef SSAO\n			result *= ssao;\n		#endif\n		#ifdef FRINGING\n			result = fringing(uv, result);\n		#endif\n		#ifdef BLOOM\n			vec3 bloom = texture2DLod(bloomTexture, uv0, 0.0).rgb;\n			result += bloom * bloomIntensity;\n		#endif\n		#ifdef GRADING\n			result = colorGradingHDR(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);\n		#endif\n		result = toneMap(result);\n		#ifdef VIGNETTE\n			mediump float vig = vignette(uv);\n			result *= vig;\n		#endif\n		#ifdef DEBUG_COMPOSE\n			#ifdef BLOOM\n				#if DEBUG_COMPOSE == bloom\n					result = bloom * bloomIntensity;\n				#endif\n			#endif\n			#ifdef DOF\n				#ifdef DEBUG_COMPOSE == dofcoc\n					result = vec3(coc, 0.0);\n				#endif\n				#ifdef DEBUG_COMPOSE == dofblur\n					result = blur;\n				#endif\n			#endif\n			#if DEBUG_COMPOSE == ssao\n				result = vec3(ssao);\n			#endif\n			#if DEBUG_COMPOSE == vignette\n				result = vec3(vig);\n			#endif\n			#if DEBUG_COMPOSE == scene\n				result = scene.rgb;\n			#endif\n		#endif\n		result = gammaCorrectOutput(result);\n		gl_FragColor = vec4(result, scene.a);\n	}\n';
class RenderPassCompose extends RenderPassShaderQuad {
		set debug(value) {
				if (this._debug !== value) {
						this._debug = value;
						this._shaderDirty = true;
				}
		}
		get debug() {
				return this._debug;
		}
		set bloomTexture(value) {
				if (this._bloomTexture !== value) {
						this._bloomTexture = value;
						this._shaderDirty = true;
				}
		}
		get bloomTexture() {
				return this._bloomTexture;
		}
		set cocTexture(value) {
				if (this._cocTexture !== value) {
						this._cocTexture = value;
						this._shaderDirty = true;
				}
		}
		get cocTexture() {
				return this._cocTexture;
		}
		set ssaoTexture(value) {
				if (this._ssaoTexture !== value) {
						this._ssaoTexture = value;
						this._shaderDirty = true;
				}
		}
		get ssaoTexture() {
				return this._ssaoTexture;
		}
		set taaEnabled(value) {
				if (this._taaEnabled !== value) {
						this._taaEnabled = value;
						this._shaderDirty = true;
				}
		}
		get taaEnabled() {
				return this._taaEnabled;
		}
		set gradingEnabled(value) {
				if (this._gradingEnabled !== value) {
						this._gradingEnabled = value;
						this._shaderDirty = true;
				}
		}
		get gradingEnabled() {
				return this._gradingEnabled;
		}
		set vignetteEnabled(value) {
				if (this._vignetteEnabled !== value) {
						this._vignetteEnabled = value;
						this._shaderDirty = true;
				}
		}
		get vignetteEnabled() {
				return this._vignetteEnabled;
		}
		set fringingEnabled(value) {
				if (this._fringingEnabled !== value) {
						this._fringingEnabled = value;
						this._shaderDirty = true;
				}
		}
		get fringingEnabled() {
				return this._fringingEnabled;
		}
		set toneMapping(value) {
				if (this._toneMapping !== value) {
						this._toneMapping = value;
						this._shaderDirty = true;
				}
		}
		get toneMapping() {
				return this._toneMapping;
		}
		set sharpness(value) {
				if (this._sharpness !== value) {
						this._sharpness = value;
						this._shaderDirty = true;
				}
		}
		get sharpness() {
				return this._sharpness;
		}
		get isSharpnessEnabled() {
				return this._sharpness > 0;
		}
		postInit() {
				this.setClearColor(Color.BLACK);
				this.setClearDepth(1.0);
				this.setClearStencil(0);
		}
		frameUpdate() {
				var _this_renderTarget;
				var rt = (_this_renderTarget = this.renderTarget) != null ? _this_renderTarget : this.device.backBuffer;
				var srgb = rt.isColorBufferSrgb(0);
				var neededGammaCorrection = srgb ? GAMMA_NONE : GAMMA_SRGB;
				if (this._gammaCorrection !== neededGammaCorrection) {
						this._gammaCorrection = neededGammaCorrection;
						this._shaderDirty = true;
				}
				if (this._shaderDirty) {
						this._shaderDirty = false;
						var gammaCorrectionName = gammaNames[this._gammaCorrection];
						var _this__debug;
						var key = "" + this.toneMapping + ("-" + gammaCorrectionName) + ("-" + (this.bloomTexture ? 'bloom' : 'nobloom')) + ("-" + (this.cocTexture ? 'dof' : 'nodof')) + ("-" + (this.blurTextureUpscale ? 'dofupscale' : '')) + ("-" + (this.ssaoTexture ? 'ssao' : 'nossao')) + ("-" + (this.gradingEnabled ? 'grading' : 'nograding')) + ("-" + (this.vignetteEnabled ? 'vignette' : 'novignette')) + ("-" + (this.fringingEnabled ? 'fringing' : 'nofringing')) + ("-" + (this.taaEnabled ? 'taa' : 'notaa')) + ("-" + (this.isSharpnessEnabled ? 'cas' : 'nocas')) + ("-" + ((_this__debug = this._debug) != null ? _this__debug : ''));
						if (this._key !== key) {
								this._key = key;
								var defines = new Map();
								defines.set('TONEMAP', tonemapNames[this.toneMapping]);
								defines.set('GAMMA', gammaCorrectionName);
								if (this.bloomTexture) defines.set('BLOOM', true);
								if (this.cocTexture) defines.set('DOF', true);
								if (this.blurTextureUpscale) defines.set('DOF_UPSCALE', true);
								if (this.ssaoTexture) defines.set('SSAO', true);
								if (this.gradingEnabled) defines.set('GRADING', true);
								if (this.vignetteEnabled) defines.set('VIGNETTE', true);
								if (this.fringingEnabled) defines.set('FRINGING', true);
								if (this.taaEnabled) defines.set('TAA', true);
								if (this.isSharpnessEnabled) defines.set('CAS', true);
								if (this._debug) defines.set('DEBUG_COMPOSE', this._debug);
								var includes = new Map(Object.entries(shaderChunks));
								this.shader = this.createQuadShader("ComposeShader-" + key, fragmentShader, {
										fragmentIncludes: includes,
										fragmentDefines: defines
								});
						}
				}
		}
		execute() {
				this.sceneTextureId.setValue(this.sceneTexture);
				this.sceneTextureInvResValue[0] = 1.0 / this.sceneTexture.width;
				this.sceneTextureInvResValue[1] = 1.0 / this.sceneTexture.height;
				this.sceneTextureInvResId.setValue(this.sceneTextureInvResValue);
				if (this._bloomTexture) {
						this.bloomTextureId.setValue(this._bloomTexture);
						this.bloomIntensityId.setValue(this.bloomIntensity);
				}
				if (this._cocTexture) {
						this.cocTextureId.setValue(this._cocTexture);
						this.blurTextureId.setValue(this.blurTexture);
				}
				if (this._ssaoTexture) {
						this.ssaoTextureId.setValue(this._ssaoTexture);
				}
				if (this._gradingEnabled) {
						this.bcsId.setValue([
								this.gradingBrightness,
								this.gradingContrast,
								this.gradingSaturation
						]);
						this.tintId.setValue([
								this.gradingTint.r,
								this.gradingTint.g,
								this.gradingTint.b
						]);
				}
				if (this._vignetteEnabled) {
						this.vignetterParamsId.setValue([
								this.vignetteInner,
								this.vignetteOuter,
								this.vignetteCurvature,
								this.vignetteIntensity
						]);
				}
				if (this._fringingEnabled) {
						this.fringingIntensityId.setValue(this.fringingIntensity / 1024);
				}
				if (this.isSharpnessEnabled) {
						this.sharpnessId.setValue(math.lerp(-0.125, -0.2, this.sharpness));
				}
				super.execute();
		}
		constructor(graphicsDevice){
				super(graphicsDevice), this.sceneTexture = null, this.bloomIntensity = 0.01, this._bloomTexture = null, this._cocTexture = null, this.blurTexture = null, this.blurTextureUpscale = false, this._ssaoTexture = null, this._toneMapping = TONEMAP_LINEAR, this._gradingEnabled = false, this.gradingSaturation = 1, this.gradingContrast = 1, this.gradingBrightness = 1, this.gradingTint = new Color(1, 1, 1, 1), this._shaderDirty = true, this._vignetteEnabled = false, this.vignetteInner = 0.5, this.vignetteOuter = 1.0, this.vignetteCurvature = 0.5, this.vignetteIntensity = 0.3, this._fringingEnabled = false, this.fringingIntensity = 10, this._taaEnabled = false, this._sharpness = 0.5, this._gammaCorrection = GAMMA_SRGB, this._key = '', this._debug = null;
				var { scope } = graphicsDevice;
				this.sceneTextureId = scope.resolve('sceneTexture');
				this.bloomTextureId = scope.resolve('bloomTexture');
				this.cocTextureId = scope.resolve('cocTexture');
				this.ssaoTextureId = scope.resolve('ssaoTexture');
				this.blurTextureId = scope.resolve('blurTexture');
				this.bloomIntensityId = scope.resolve('bloomIntensity');
				this.bcsId = scope.resolve('brightnessContrastSaturation');
				this.tintId = scope.resolve('tint');
				this.vignetterParamsId = scope.resolve('vignetterParams');
				this.fringingIntensityId = scope.resolve('fringingIntensity');
				this.sceneTextureInvResId = scope.resolve('sceneTextureInvRes');
				this.sceneTextureInvResValue = new Float32Array(2);
				this.sharpnessId = scope.resolve('sharpness');
		}
}

export { RenderPassCompose };
