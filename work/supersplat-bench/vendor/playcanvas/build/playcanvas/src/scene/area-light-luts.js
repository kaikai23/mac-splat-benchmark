import { FloatPacking } from '../core/math/float-packing.js';
import { Texture } from '../platform/graphics/texture.js';
import { DeviceCache } from '../platform/graphics/device-cache.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RGBA16F } from '../platform/graphics/constants.js';

class AreaLightCacheEntry {
		destroy() {
				var _this_texture0, _this_texture1;
				(_this_texture0 = this.texture0) == null ? undefined : _this_texture0.destroy();
				(_this_texture1 = this.texture1) == null ? undefined : _this_texture1.destroy();
		}
		constructor(texture0, texture1){
				this.texture0 = texture0;
				this.texture1 = texture1;
		}
}
var deviceCache = new DeviceCache();
class AreaLightLuts {
		static createTexture(device, format, size, postfix) {
				if (postfix === undefined) postfix = '';
				var tex = new Texture(device, {
						name: "AreaLightLUT" + postfix,
						width: size,
						height: size,
						format: format,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						type: TEXTURETYPE_DEFAULT,
						magFilter: FILTER_LINEAR,
						minFilter: FILTER_NEAREST,
						anisotropy: 1,
						mipmaps: false
				});
				return tex;
		}
		static applyTextures(device, texture1, texture2) {
				deviceCache.remove(device);
				deviceCache.get(device, ()=>{
						return new AreaLightCacheEntry(texture1, texture1 === texture2 ? null : texture2);
				});
				device.scope.resolve('areaLightsLutTex1').setValue(texture1);
				device.scope.resolve('areaLightsLutTex2').setValue(texture2);
		}
		static createPlaceholder(device) {
				var texture = AreaLightLuts.createTexture(device, PIXELFORMAT_RGBA16F, 2, 'placeholder');
				var pixels = texture.lock();
				pixels.fill(0);
				texture.unlock();
				AreaLightLuts.applyTextures(device, texture, texture);
		}
		static set(device, ltcMat1, ltcMat2) {
				function buildTexture(device, data, format) {
						var texture = AreaLightLuts.createTexture(device, format, 64);
						texture.lock().set(data);
						texture.unlock();
						return texture;
				}
				function convertToHalfFloat(data) {
						var count = data.length;
						var ret = new Uint16Array(count);
						var float2Half = FloatPacking.float2Half;
						for(var i = 0; i < count; i++){
								ret[i] = float2Half(data[i]);
						}
						return ret;
				}
				var srcData1 = ltcMat1;
				var srcData2 = ltcMat2;
				var data1 = convertToHalfFloat(srcData1);
				var data2 = convertToHalfFloat(srcData2);
				var tex1 = buildTexture(device, data1, PIXELFORMAT_RGBA16F);
				var tex2 = buildTexture(device, data2, PIXELFORMAT_RGBA16F);
				AreaLightLuts.applyTextures(device, tex1, tex2);
		}
}

export { AreaLightLuts };
