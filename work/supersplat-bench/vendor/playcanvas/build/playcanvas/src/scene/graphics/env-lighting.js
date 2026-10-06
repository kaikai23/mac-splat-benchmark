import { Vec4 } from '../../core/math/vec4.js';
import { Texture } from '../../platform/graphics/texture.js';
import { reprojectTexture } from './reproject-texture.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_RGBP, TEXTURETYPE_DEFAULT, ADDRESS_CLAMP_TO_EDGE, TEXTUREPROJECTION_EQUIRECT, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';

var calcLevels = (width, height)=>{
		if (height === undefined) height = 0;
		return 1 + Math.floor(Math.log2(Math.max(width, height)));
};
var supportsFloat16 = (device)=>{
		return device.textureHalfFloatRenderable;
};
var supportsFloat32 = (device)=>{
		return device.textureFloatRenderable;
};
var lightingSourcePixelFormat = (device)=>{
		return supportsFloat16(device) ? PIXELFORMAT_RGBA16F : supportsFloat32(device) ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
};
var lightingPixelFormat = (device)=>{
		return PIXELFORMAT_RGBA8;
};
var createCubemap = (device, size, format, mipmaps)=>{
		return new Texture(device, {
				name: "lighting-" + size,
				cubemap: true,
				width: size,
				height: size,
				format: format,
				type: TEXTURETYPE_RGBP ,
				addressU: ADDRESS_CLAMP_TO_EDGE,
				addressV: ADDRESS_CLAMP_TO_EDGE,
				mipmaps: false
		});
};
class EnvLighting {
		static generateSkyboxCubemap(source, size) {
				var device = source.device;
				var result = createCubemap(device, size || (source.cubemap ? source.width : source.width / 4), PIXELFORMAT_RGBA8);
				reprojectTexture(source, result, {
						numSamples: 1024
				});
				return result;
		}
		static generateLightingSource(source, options) {
				var device = source.device;
				var format = lightingSourcePixelFormat(device);
				var result = (options == null ? undefined : options.target) || new Texture(device, {
						name: 'lighting-source',
						cubemap: true,
						width: (options == null ? undefined : options.size) || 128,
						height: (options == null ? undefined : options.size) || 128,
						format: format,
						type: format === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBP : TEXTURETYPE_DEFAULT,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						mipmaps: true
				});
				reprojectTexture(source, result, {
						numSamples: source.mipmaps ? 1 : 1024
				});
				return result;
		}
		static generateAtlas(source, options) {
				var device = source.device;
				var format = lightingPixelFormat();
				var result = (options == null ? undefined : options.target) || new Texture(device, {
						name: 'envAtlas',
						width: (options == null ? undefined : options.size) || 512,
						height: (options == null ? undefined : options.size) || 512,
						format: format,
						type: TEXTURETYPE_RGBP ,
						projection: TEXTUREPROJECTION_EQUIRECT,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						mipmaps: false
				});
				var s = result.width / 512;
				var rect = new Vec4(0, 0, 512 * s, 256 * s);
				var levels = calcLevels(256) - calcLevels(4);
				for(var i = 0; i < levels; ++i){
						reprojectTexture(source, result, {
								numSamples: 1,
								rect: rect,
								seamPixels: s
						});
						rect.x += rect.w;
						rect.y += rect.w;
						rect.z = Math.max(1, Math.floor(rect.z * 0.5));
						rect.w = Math.max(1, Math.floor(rect.w * 0.5));
				}
				rect.set(0, 256 * s, 256 * s, 128 * s);
				for(var i1 = 1; i1 < 7; ++i1){
						reprojectTexture(source, result, {
								numSamples: (options == null ? undefined : options.numReflectionSamples) || 1024,
								distribution: (options == null ? undefined : options.distribution) || 'ggx',
								specularPower: Math.max(1, 2048 >> i1 * 2),
								rect: rect,
								seamPixels: s
						});
						rect.y += rect.w;
						rect.z = Math.max(1, Math.floor(rect.z * 0.5));
						rect.w = Math.max(1, Math.floor(rect.w * 0.5));
				}
				rect.set(128 * s, (256 + 128) * s, 64 * s, 32 * s);
				reprojectTexture(source, result, {
						numSamples: (options == null ? undefined : options.numAmbientSamples) || 2048,
						distribution: 'lambert',
						rect: rect,
						seamPixels: s
				});
				return result;
		}
		static generatePrefilteredAtlas(sources, options) {
				var device = sources[0].device;
				var format = sources[0].format;
				var type = sources[0].type;
				var result = (options == null ? undefined : options.target) || new Texture(device, {
						name: 'envPrefilteredAtlas',
						width: (options == null ? undefined : options.size) || 512,
						height: (options == null ? undefined : options.size) || 512,
						format: format,
						type: type,
						projection: TEXTUREPROJECTION_EQUIRECT,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						mipmaps: false
				});
				var s = result.width / 512;
				var rect = new Vec4(0, 0, 512 * s, 256 * s);
				var levels = calcLevels(512);
				for(var i = 0; i < levels; ++i){
						reprojectTexture(sources[0], result, {
								numSamples: 1,
								rect: rect,
								seamPixels: s
						});
						rect.x += rect.w;
						rect.y += rect.w;
						rect.z = Math.max(1, Math.floor(rect.z * 0.5));
						rect.w = Math.max(1, Math.floor(rect.w * 0.5));
				}
				rect.set(0, 256 * s, 256 * s, 128 * s);
				for(var i1 = 1; i1 < sources.length; ++i1){
						reprojectTexture(sources[i1], result, {
								numSamples: 1,
								rect: rect,
								seamPixels: s
						});
						rect.y += rect.w;
						rect.z = Math.max(1, Math.floor(rect.z * 0.5));
						rect.w = Math.max(1, Math.floor(rect.w * 0.5));
				}
				rect.set(128 * s, (256 + 128) * s, 64 * s, 32 * s);
				if (options == null ? undefined : options.legacyAmbient) {
						reprojectTexture(sources[5], result, {
								numSamples: 1,
								rect: rect,
								seamPixels: s
						});
				} else {
						reprojectTexture(sources[0], result, {
								numSamples: (options == null ? undefined : options.numSamples) || 2048,
								distribution: 'lambert',
								rect: rect,
								seamPixels: s
						});
				}
				return result;
		}
}

export { EnvLighting };
