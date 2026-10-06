import { BlueNoise } from '../../core/math/blue-noise.js';
import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_R8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';
import { RenderPassDepthAwareBlur } from './render-pass-depth-aware-blur.js';

var fs = "\n	varying vec2 uv0;\n	uniform vec2 uInvResolution;\n	uniform float uAspect;\n	#define saturate(x) clamp(x,0.0,1.0)\n	highp float getWFromProjectionMatrix(const mat4 p, const vec3 v) {\n		return -v.z;\n	}\n	highp float getViewSpaceZFromW(const mat4 p, const float w) {\n		return -w;\n	}\n	const float kLog2LodRate = 3.0;\n	float random(const highp vec2 w) {\n		const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);\n		return fract(m.z * fract(dot(w, m.xy)));\n	}\n	highp vec2 getFragCoord() {\n		return gl_FragCoord.xy;\n	}\n	highp vec3 computeViewSpacePositionFromDepth(highp vec2 uv, highp float linearDepth) {\n		return vec3((0.5 - uv) * vec2(uAspect, 1.0) * linearDepth, linearDepth);\n	}\n	highp vec3 faceNormal(highp vec3 dpdx, highp vec3 dpdy) {\n		return normalize(cross(dpdx, dpdy));\n	}\n	highp vec3 computeViewSpaceNormal(const highp vec3 position) {\n		return faceNormal(dFdx(position), dFdy(position));\n	}\n	highp vec3 computeViewSpaceNormal(const highp vec3 position, const highp vec2 uv) {\n		highp vec2 uvdx = uv + vec2(uInvResolution.x, 0.0);\n		highp vec2 uvdy = uv + vec2(0.0, uInvResolution.y);\n		highp vec3 px = computeViewSpacePositionFromDepth(uvdx, -getLinearScreenDepth(uvdx));\n		highp vec3 py = computeViewSpacePositionFromDepth(uvdy, -getLinearScreenDepth(uvdy));\n		highp vec3 dpdx = px - position;\n		highp vec3 dpdy = py - position;\n		return faceNormal(dpdx, dpdy);\n	}\n	uniform vec2 uSampleCount;\n	uniform float uSpiralTurns;\n	#define PI (3.14159)\n	mediump vec3 tapLocation(mediump float i, const mediump float noise) {\n		mediump float offset = ((2.0 * PI) * 2.4) * noise;\n		mediump float angle = ((i * uSampleCount.y) * uSpiralTurns) * (2.0 * PI) + offset;\n		mediump float radius = (i + noise + 0.5) * uSampleCount.y;\n		return vec3(cos(angle), sin(angle), radius * radius);\n	}\n	highp vec2 startPosition(const float noise) {\n		float angle = ((2.0 * PI) * 2.4) * noise;\n		return vec2(cos(angle), sin(angle));\n	}\n	uniform vec2 uAngleIncCosSin;\n	highp mat2 tapAngleStep() {\n		highp vec2 t = uAngleIncCosSin;\n		return mat2(t.x, t.y, -t.y, t.x);\n	}\n	mediump vec3 tapLocationFast(mediump float i, mediump vec2 p, const mediump float noise) {\n		mediump float radius = (i + noise + 0.5) * uSampleCount.y;\n		return vec3(p, radius * radius);\n	}\n	uniform float uMaxLevel;\n	uniform float uInvRadiusSquared;\n	uniform float uMinHorizonAngleSineSquared;\n	uniform float uBias;\n	uniform float uPeak2;\n	void computeAmbientOcclusionSAO(inout mediump float occlusion, mediump float i, mediump float ssDiskRadius,\n			const highp vec2 uv, const highp vec3 origin, const mediump vec3 normal,\n			const mediump vec2 tapPosition, const float noise) {\n		mediump vec3 tap = tapLocationFast(i, tapPosition, noise);\n		mediump float ssRadius = max(1.0, tap.z * ssDiskRadius);\n		mediump vec2 uvSamplePos = uv + vec2(ssRadius * tap.xy) * uInvResolution;\n		mediump float level = clamp(floor(log2(ssRadius)) - kLog2LodRate, 0.0, float(uMaxLevel));\n		highp float occlusionDepth = -getLinearScreenDepth(uvSamplePos);\n		highp vec3 p = computeViewSpacePositionFromDepth(uvSamplePos, occlusionDepth);\n		vec3 v = p - origin;\n		float vv = dot(v, v);\n		float vn = dot(v, normal);\n		mediump float w = max(0.0, 1.0 - vv * uInvRadiusSquared);\n		w = w * w;\n		w *= step(vv * uMinHorizonAngleSineSquared, vn * vn);\n		occlusion += w * max(0.0, vn + origin.z * uBias) / (vv + uPeak2);\n	}\n	uniform float uProjectionScaleRadius;\n	uniform float uIntensity;\n	uniform float uRandomize;\n	float scalableAmbientObscurance(highp vec2 uv, highp vec3 origin, vec3 normal) {\n		float noise = random(getFragCoord()) + uRandomize;\n		highp vec2 tapPosition = startPosition(noise);\n		highp mat2 angleStep = tapAngleStep();\n		float ssDiskRadius = -(uProjectionScaleRadius / origin.z);\n		float occlusion = 0.0;\n		for (float i = 0.0; i < uSampleCount.x; i += 1.0) {\n			computeAmbientOcclusionSAO(occlusion, i, ssDiskRadius, uv, origin, normal, tapPosition, noise);\n			tapPosition = angleStep * tapPosition;\n		}\n		return occlusion;\n	}\n	uniform float uPower;\n	void main() {\n		highp vec2 uv = uv0;\n		highp float depth = -getLinearScreenDepth(uv0);\n		highp vec3 origin = computeViewSpacePositionFromDepth(uv, depth);\n		vec3 normal = computeViewSpaceNormal(origin, uv);\n		float occlusion = 0.0;\n		if (uIntensity > 0.0) {\n			occlusion = scalableAmbientObscurance(uv, origin, normal);\n		}\n		float ao = max(0.0, 1.0 - occlusion * uIntensity);\n		ao = pow(ao, uPower);\n		gl_FragColor = vec4(ao, ao, ao, 1.0);\n	}\n";
class RenderPassSsao extends RenderPassShaderQuad {
		destroy() {
				var _this_renderTarget, _this_renderTarget1;
				(_this_renderTarget = this.renderTarget) == null ? undefined : _this_renderTarget.destroyTextureBuffers();
				(_this_renderTarget1 = this.renderTarget) == null ? undefined : _this_renderTarget1.destroy();
				this.renderTarget = null;
				if (this.afterPasses.length > 0) {
						var blurRt = this.afterPasses[0].renderTarget;
						blurRt == null ? undefined : blurRt.destroyTextureBuffers();
						blurRt == null ? undefined : blurRt.destroy();
				}
				this.afterPasses.forEach((pass)=>pass.destroy());
				this.afterPasses.length = 0;
				super.destroy();
		}
		set scale(value) {
				this._scale = value;
				this.scaleX = value;
				this.scaleY = value;
		}
		get scale() {
				return this._scale;
		}
		createRenderTarget(name) {
				return new RenderTarget({
						depth: false,
						colorBuffer: new Texture(this.device, {
								name: name,
								width: 1,
								height: 1,
								format: PIXELFORMAT_R8,
								mipmaps: false,
								minFilter: FILTER_NEAREST,
								magFilter: FILTER_NEAREST,
								addressU: ADDRESS_CLAMP_TO_EDGE,
								addressV: ADDRESS_CLAMP_TO_EDGE
						})
				});
		}
		execute() {
				var { device, sourceTexture, sampleCount, minAngle, scale } = this;
				var { width, height } = this.renderTarget.colorBuffer;
				var scope = device.scope;
				scope.resolve('uAspect').setValue(width / height);
				scope.resolve('uInvResolution').setValue([
						1.0 / width,
						1.0 / height
				]);
				scope.resolve('uSampleCount').setValue([
						sampleCount,
						1.0 / sampleCount
				]);
				var minAngleSin = Math.sin(minAngle * Math.PI / 180.0);
				scope.resolve('uMinHorizonAngleSineSquared').setValue(minAngleSin * minAngleSin);
				var spiralTurns = 10.0;
				var step = 1.0 / (sampleCount - 0.5) * spiralTurns * 2.0 * 3.141;
				var radius = this.radius / scale;
				var bias = 0.001;
				var peak = 0.1 * radius;
				var intensity = 2 * (peak * 2.0 * 3.141) * this.intensity / sampleCount;
				var projectionScale = 0.5 * sourceTexture.height;
				scope.resolve('uSpiralTurns').setValue(spiralTurns);
				scope.resolve('uAngleIncCosSin').setValue([
						Math.cos(step),
						Math.sin(step)
				]);
				scope.resolve('uMaxLevel').setValue(0.0);
				scope.resolve('uInvRadiusSquared').setValue(1.0 / (radius * radius));
				scope.resolve('uBias').setValue(bias);
				scope.resolve('uPeak2').setValue(peak * peak);
				scope.resolve('uIntensity').setValue(intensity);
				scope.resolve('uPower').setValue(this.power);
				scope.resolve('uProjectionScaleRadius').setValue(projectionScale * radius);
				scope.resolve('uRandomize').setValue(this.randomize ? this._blueNoise.value() : 0);
				super.execute();
		}
		after() {
				this.ssaoTextureId.setValue(this.ssaoTexture);
				var srcTexture = this.sourceTexture;
				this.ssaoTextureSizeInvId.setValue([
						1.0 / srcTexture.width,
						1.0 / srcTexture.height
				]);
		}
		constructor(device, sourceTexture, cameraComponent, blurEnabled){
				super(device), this.radius = 5, this.intensity = 1, this.power = 1, this.sampleCount = 10, this.minAngle = 5, this.randomize = false, this._scale = 1, this._blueNoise = new BlueNoise(19);
				this.sourceTexture = sourceTexture;
				this.cameraComponent = cameraComponent;
				var screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
				this.shader = this.createQuadShader('SsaoShader', screenDepth + fs);
				var rt = this.createRenderTarget('SsaoFinalTexture');
				this.ssaoTexture = rt.colorBuffer;
				this.init(rt, {
						resizeSource: this.sourceTexture
				});
				var clearColor = new Color(0, 0, 0, 0);
				this.setClearColor(clearColor);
				if (blurEnabled) {
						var blurRT = this.createRenderTarget('SsaoTempTexture');
						var blurPassHorizontal = new RenderPassDepthAwareBlur(device, rt.colorBuffer, cameraComponent, true);
						blurPassHorizontal.init(blurRT, {
								resizeSource: rt.colorBuffer
						});
						blurPassHorizontal.setClearColor(clearColor);
						var blurPassVertical = new RenderPassDepthAwareBlur(device, blurRT.colorBuffer, cameraComponent, false);
						blurPassVertical.init(rt, {
								resizeSource: rt.colorBuffer
						});
						blurPassVertical.setClearColor(clearColor);
						this.afterPasses.push(blurPassHorizontal);
						this.afterPasses.push(blurPassVertical);
				}
				this.ssaoTextureId = device.scope.resolve('ssaoTexture');
				this.ssaoTextureSizeInvId = device.scope.resolve('ssaoTextureSizeInv');
		}
}

export { RenderPassSsao };
