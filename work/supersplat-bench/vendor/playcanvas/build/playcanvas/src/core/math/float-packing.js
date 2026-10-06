import { math } from './math.js';

var oneDiv255 = 1 / 255;
var floatView = new Float32Array(1);
var int32View = new Int32Array(floatView.buffer);
class FloatPacking {
		static float2Half(value) {
				floatView[0] = value;
				var x = int32View[0];
				var bits = x >> 16 & 0x8000;
				var m = x >> 12 & 0x07ff;
				var e = x >> 23 & 0xff;
				if (e < 103) {
						return bits;
				}
				if (e > 142) {
						bits |= 0x7c00;
						bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
						return bits;
				}
				if (e < 113) {
						m |= 0x0800;
						bits |= (m >> 114 - e) + (m >> 113 - e & 1);
						return bits;
				}
				bits |= e - 112 << 10 | m >> 1;
				bits += m & 1;
				return bits;
		}
		static float2Bytes(value, array, offset, numBytes) {
				var enc1 = 255.0 * value % 1;
				array[offset + 0] = Math.round((value % 1 - oneDiv255 * enc1) * 255);
				if (numBytes > 1) {
						var enc2 = 65025.0 * value % 1;
						array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
						if (numBytes > 2) {
								var enc3 = 16581375.0 * value % 1;
								array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);
								if (numBytes > 3) {
										array[offset + 3] = Math.round(enc3 * 255);
								}
						}
				}
		}
		static float2BytesRange(value, array, offset, min, max, numBytes) {
				value = math.clamp((value - min) / (max - min), 0, 1);
				FloatPacking.float2Bytes(value, array, offset, numBytes);
		}
		static float2RGBA8(value, data) {
				floatView[0] = value;
				var intBits = int32View[0];
				data.r = (intBits >> 24 & 0xFF) / 255.0;
				data.g = (intBits >> 16 & 0xFF) / 255.0;
				data.b = (intBits >> 8 & 0xFF) / 255.0;
				data.a = (intBits & 0xFF) / 255.0;
		}
}

export { FloatPacking };
