import { pixelFormatInfo, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1 } from './constants.js';

class TextureUtils {
		static calcLevelDimension(dimension, mipLevel) {
				return Math.max(dimension >> mipLevel, 1);
		}
		static calcMipLevelsCount(width, height, depth) {
				if (depth === undefined) depth = 1;
				return 1 + Math.floor(Math.log2(Math.max(width, height, depth)));
		}
		static calcLevelGpuSize(width, height, depth, format) {
				var _pixelFormatInfo_get;
				var formatInfo = pixelFormatInfo.get(format);
				var _pixelFormatInfo_get_size;
				var pixelSize = (_pixelFormatInfo_get_size = (_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.size) != null ? _pixelFormatInfo_get_size : 0;
				if (pixelSize > 0) {
						return width * height * depth * pixelSize;
				}
				var _formatInfo_blockSize;
				var blockSize = (_formatInfo_blockSize = formatInfo.blockSize) != null ? _formatInfo_blockSize : 0;
				var blockWidth = Math.floor((width + 3) / 4);
				var blockHeight = Math.floor((height + 3) / 4);
				var blockDepth = Math.floor((depth + 3) / 4);
				if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 || format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
						blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
				}
				return blockWidth * blockHeight * blockDepth * blockSize;
		}
		static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
				var result = 0;
				while(1){
						result += TextureUtils.calcLevelGpuSize(width, height, depth, format);
						if (!mipmaps || width === 1 && height === 1 && depth === 1) {
								break;
						}
						width = Math.max(width >> 1, 1);
						height = Math.max(height >> 1, 1);
						depth = Math.max(depth >> 1, 1);
				}
				return result * (cubemap ? 6 : 1);
		}
}

export { TextureUtils };
