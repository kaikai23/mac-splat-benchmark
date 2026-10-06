import { random } from '../../core/math/random.js';
import { Vec3 } from '../../core/math/vec3.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from './quad-render-utils.js';

var getProjectionName = (projection)=>{
		switch(projection){
				case TEXTUREPROJECTION_CUBE:
						return 'Cubemap';
				case TEXTUREPROJECTION_OCTAHEDRAL:
						return 'Octahedral';
				default:
						return 'Equirect';
		}
};
var packFloat32ToRGBA8 = (value, array, offset)=>{
		if (value <= 0) {
				array[offset + 0] = 0;
				array[offset + 1] = 0;
				array[offset + 2] = 0;
				array[offset + 3] = 0;
		} else if (value >= 1.0) {
				array[offset + 0] = 255;
				array[offset + 1] = 0;
				array[offset + 2] = 0;
				array[offset + 3] = 0;
		} else {
				var encX = 1 * value % 1;
				var encY = 255 * value % 1;
				var encZ = 65025 * value % 1;
				var encW = 16581375.0 * value % 1;
				encX -= encY / 255;
				encY -= encZ / 255;
				encZ -= encW / 255;
				array[offset + 0] = Math.min(255, Math.floor(encX * 256));
				array[offset + 1] = Math.min(255, Math.floor(encY * 256));
				array[offset + 2] = Math.min(255, Math.floor(encZ * 256));
				array[offset + 3] = Math.min(255, Math.floor(encW * 256));
		}
};
var packSamples = (samples)=>{
		var numSamples = samples.length;
		var w = Math.min(numSamples, 512);
		var h = Math.ceil(numSamples / w);
		var data = new Uint8Array(w * h * 4);
		var off = 0;
		for(var i = 0; i < numSamples; i += 4){
				packFloat32ToRGBA8(samples[i + 0] * 0.5 + 0.5, data, off + 0);
				packFloat32ToRGBA8(samples[i + 1] * 0.5 + 0.5, data, off + 4);
				packFloat32ToRGBA8(samples[i + 2] * 0.5 + 0.5, data, off + 8);
				packFloat32ToRGBA8(samples[i + 3] / 8, data, off + 12);
				off += 16;
		}
		return {
				width: w,
				height: h,
				data: data
		};
};
var hemisphereSamplePhong = (dstVec, x, y, specularPower)=>{
		var phi = y * 2 * Math.PI;
		var cosTheta = Math.pow(1 - x, 1 / (specularPower + 1));
		var sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
		dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};
var hemisphereSampleLambert = (dstVec, x, y)=>{
		var phi = y * 2 * Math.PI;
		var cosTheta = Math.sqrt(1 - x);
		var sinTheta = Math.sqrt(x);
		dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};
var hemisphereSampleGGX = (dstVec, x, y, a)=>{
		var phi = y * 2 * Math.PI;
		var cosTheta = Math.sqrt((1 - x) / (1 + (a * a - 1) * x));
		var sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
		dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};
var D_GGX = (NoH, linearRoughness)=>{
		var a = NoH * linearRoughness;
		var k = linearRoughness / (1.0 - NoH * NoH + a * a);
		return k * k * (1 / Math.PI);
};
var generatePhongSamples = (numSamples, specularPower)=>{
		var H = new Vec3();
		var result = [];
		for(var i = 0; i < numSamples; ++i){
				hemisphereSamplePhong(H, i / numSamples, random.radicalInverse(i), specularPower);
				result.push(H.x, H.y, H.z, 0);
		}
		return result;
};
var generateLambertSamples = (numSamples, sourceTotalPixels)=>{
		var pixelsPerSample = sourceTotalPixels / numSamples;
		var H = new Vec3();
		var result = [];
		for(var i = 0; i < numSamples; ++i){
				hemisphereSampleLambert(H, i / numSamples, random.radicalInverse(i));
				var pdf = H.z / Math.PI;
				var mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
				result.push(H.x, H.y, H.z, mipLevel);
		}
		return result;
};
var requiredSamplesGGX = {
		'16': {
				'2': 26,
				'8': 20,
				'32': 17,
				'128': 16,
				'512': 16
		},
		'32': {
				'2': 53,
				'8': 40,
				'32': 34,
				'128': 32,
				'512': 32
		},
		'128': {
				'2': 214,
				'8': 163,
				'32': 139,
				'128': 130,
				'512': 128
		},
		'1024': {
				'2': 1722,
				'8': 1310,
				'32': 1114,
				'128': 1041,
				'512': 1025
		}
};
var getRequiredSamplesGGX = (numSamples, specularPower)=>{
		var table = requiredSamplesGGX[numSamples];
		return table && table[specularPower] || numSamples;
};
var generateGGXSamples = (numSamples, specularPower, sourceTotalPixels)=>{
		var pixelsPerSample = sourceTotalPixels / numSamples;
		var roughness = 1 - Math.log2(specularPower) / 11.0;
		var a = roughness * roughness;
		var H = new Vec3();
		var L = new Vec3();
		var N = new Vec3(0, 0, 1);
		var result = [];
		var requiredSamples = getRequiredSamplesGGX(numSamples, specularPower);
		for(var i = 0; i < requiredSamples; ++i){
				hemisphereSampleGGX(H, i / requiredSamples, random.radicalInverse(i), a);
				var NoH = H.z;
				L.set(H.x, H.y, H.z).mulScalar(2 * NoH).sub(N);
				if (L.z > 0) {
						var pdf = D_GGX(Math.min(1, NoH), a) / 4 + 0.001;
						var mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
						result.push(L.x, L.y, L.z, mipLevel);
				}
		}
		while(result.length < numSamples * 4){
				result.push(0, 0, 0, 0);
		}
		return result;
};
var createSamplesTex = (device, name, samples)=>{
		var packedSamples = packSamples(samples);
		return new Texture(device, {
				name: name,
				width: packedSamples.width,
				height: packedSamples.height,
				mipmaps: false,
				minFilter: FILTER_NEAREST,
				magFilter: FILTER_NEAREST,
				levels: [
						packedSamples.data
				]
		});
};
class SimpleCache {
		destroy() {
				if (this.destroyContent) {
						this.map.forEach((value, key)=>{
								value.destroy();
						});
				}
		}
		get(key, missFunc) {
				if (!this.map.has(key)) {
						var result = missFunc();
						this.map.set(key, result);
						return result;
				}
				return this.map.get(key);
		}
		constructor(destroyContent = true){
				this.map = new Map();
				this.destroyContent = destroyContent;
		}
}
var samplesCache = new SimpleCache(false);
var deviceCache = new DeviceCache();
var getCachedTexture = (device, key, getSamplesFnc)=>{
		var cache = deviceCache.get(device, ()=>{
				return new SimpleCache();
		});
		return cache.get(key, ()=>{
				return createSamplesTex(device, key, samplesCache.get(key, getSamplesFnc));
		});
};
var generateLambertSamplesTex = (device, numSamples, sourceTotalPixels)=>{
		var key = "lambert-samples-" + numSamples + "-" + sourceTotalPixels;
		return getCachedTexture(device, key, ()=>{
				return generateLambertSamples(numSamples, sourceTotalPixels);
		});
};
var generatePhongSamplesTex = (device, numSamples, specularPower)=>{
		var key = "phong-samples-" + numSamples + "-" + specularPower;
		return getCachedTexture(device, key, ()=>{
				return generatePhongSamples(numSamples, specularPower);
		});
};
var generateGGXSamplesTex = (device, numSamples, specularPower, sourceTotalPixels)=>{
		var key = "ggx-samples-" + numSamples + "-" + specularPower + "-" + sourceTotalPixels;
		return getCachedTexture(device, key, ()=>{
				return generateGGXSamples(numSamples, specularPower, sourceTotalPixels);
		});
};
var vsCode = "\nattribute vec2 vertex_position;\n\nuniform vec4 uvMod;\n\nvarying vec2 vUv0;\n\nvoid main(void) {\n    gl_Position = vec4(vertex_position, 0.5, 1.0);\n    vUv0 = getImageEffectUV((vertex_position.xy * 0.5 + 0.5) * uvMod.xy + uvMod.zw);\n}\n";
function reprojectTexture(source, target, options) {
		if (options === undefined) options = {};
		var _options_rect, _options_rect1;
		var _options_seamPixels;
		var seamPixels = (_options_seamPixels = options.seamPixels) != null ? _options_seamPixels : 0;
		var _options_rect_z;
		var innerWidth = ((_options_rect_z = (_options_rect = options.rect) == null ? undefined : _options_rect.z) != null ? _options_rect_z : target.width) - seamPixels * 2;
		var _options_rect_w;
		var innerHeight = ((_options_rect_w = (_options_rect1 = options.rect) == null ? undefined : _options_rect1.w) != null ? _options_rect_w : target.height) - seamPixels * 2;
		if (innerWidth < 1 || innerHeight < 1) {
				return false;
		}
		var funcNames = {
				'none': 'reproject',
				'lambert': 'prefilterSamplesUnweighted',
				'phong': 'prefilterSamplesUnweighted',
				'ggx': 'prefilterSamples'
		};
		var specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
		var face = options.hasOwnProperty('face') ? options.face : null;
		var distribution = options.hasOwnProperty('distribution') ? options.distribution : specularPower === 1 ? 'none' : 'phong';
		var processFunc = funcNames[distribution] || 'reproject';
		var prefilterSamples = processFunc.startsWith('prefilterSamples');
		var decodeFunc = ChunkUtils.decodeFunc(source.encoding);
		var encodeFunc = ChunkUtils.encodeFunc(target.encoding);
		var sourceFunc = "sample" + getProjectionName(source.projection);
		var targetFunc = "getDirection" + getProjectionName(target.projection);
		var numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;
		var shaderKey = processFunc + "_" + decodeFunc + "_" + encodeFunc + "_" + sourceFunc + "_" + targetFunc + "_" + numSamples;
		var device = source.device;
		var shader = getProgramLibrary(device).getCachedShader(shaderKey);
		if (!shader) {
				var defines = "#define PROCESS_FUNC " + processFunc + "\n" + (prefilterSamples ? '#define USE_SAMPLES_TEX\n' : '') + (source.cubemap ? '#define CUBEMAP_SOURCE\n' : '') + "#define DECODE_FUNC " + decodeFunc + "\n" + ("#define ENCODE_FUNC " + encodeFunc + "\n") + ("#define SOURCE_FUNC " + sourceFunc + "\n") + ("#define TARGET_FUNC " + targetFunc + "\n") + ("#define NUM_SAMPLES " + numSamples + "\n") + ("#define NUM_SAMPLES_SQRT " + Math.round(Math.sqrt(numSamples)).toFixed(1) + "\n");
				shader = createShaderFromCode(device, vsCode, defines + "\n" + shaderChunks.reprojectPS, shaderKey);
		}
		device.setBlendState(BlendState.NOBLEND);
		var constantSource = device.scope.resolve(source.cubemap ? 'sourceCube' : 'sourceTex');
		constantSource.setValue(source);
		var constantParams = device.scope.resolve('params');
		var uvModParam = device.scope.resolve('uvMod');
		if (seamPixels > 0) {
				uvModParam.setValue([
						(innerWidth + seamPixels * 2) / innerWidth,
						(innerHeight + seamPixels * 2) / innerHeight,
						-seamPixels / innerWidth,
						-seamPixels / innerHeight
				]);
		} else {
				uvModParam.setValue([
						1,
						1,
						0,
						0
				]);
		}
		var params = [
				0,
				target.width * target.height * (target.cubemap ? 6 : 1),
				source.width * source.height * (source.cubemap ? 6 : 1)
		];
		if (prefilterSamples) {
				var sourceTotalPixels = source.width * source.height * (source.cubemap ? 6 : 1);
				var samplesTex = distribution === 'ggx' ? generateGGXSamplesTex(device, numSamples, specularPower, sourceTotalPixels) : distribution === 'lambert' ? generateLambertSamplesTex(device, numSamples, sourceTotalPixels) : generatePhongSamplesTex(device, numSamples, specularPower);
				device.scope.resolve('samplesTex').setValue(samplesTex);
				device.scope.resolve('samplesTexInverseSize').setValue([
						1.0 / samplesTex.width,
						1.0 / samplesTex.height
				]);
		}
		for(var f = 0; f < (target.cubemap ? 6 : 1); f++){
				if (face === null || f === face) {
						var renderTarget = new RenderTarget({
								colorBuffer: target,
								face: f,
								depth: false,
								flipY: device.isWebGPU
						});
						params[0] = f;
						constantParams.setValue(params);
						drawQuadWithShader(device, renderTarget, shader, options == null ? undefined : options.rect);
						renderTarget.destroy();
				}
		}
		return true;
}

export { reprojectTexture };
