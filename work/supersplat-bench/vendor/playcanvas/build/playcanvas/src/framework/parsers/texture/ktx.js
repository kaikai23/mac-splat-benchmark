import { pixelFormatLinearToGamma, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8, PIXELFORMAT_111110F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';
import { TextureParser } from './texture.js';

function _extends() {
		_extends = Object.assign || function(target) {
				for(var i = 1; i < arguments.length; i++){
						var source = arguments[i];
						for(var key in source){
								if (Object.prototype.hasOwnProperty.call(source, key)) {
										target[key] = source[key];
								}
						}
				}
				return target;
		};
		return _extends.apply(this, arguments);
}
var IDENTIFIER = [
		0x58544BAB,
		0xBB313120,
		0x0A1A0A0D
];
var KNOWN_FORMATS = {
		0x83F0: PIXELFORMAT_DXT1,
		0x83F2: PIXELFORMAT_DXT3,
		0x83F3: PIXELFORMAT_DXT5,
		0x8D64: PIXELFORMAT_ETC1,
		0x9274: PIXELFORMAT_ETC2_RGB,
		0x9278: PIXELFORMAT_ETC2_RGBA,
		0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
		0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
		0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
		0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1,
		0x8051: PIXELFORMAT_RGB8,
		0x8058: PIXELFORMAT_RGBA8,
		0x8C41: PIXELFORMAT_SRGB8,
		0x8C43: PIXELFORMAT_SRGBA8,
		0x8C3A: PIXELFORMAT_111110F,
		0x881B: PIXELFORMAT_RGB16F,
		0x881A: PIXELFORMAT_RGBA16F
};
function createContainer(pixelFormat, buffer, byteOffset, byteSize) {
		return pixelFormat === PIXELFORMAT_111110F ? new Uint32Array(buffer, byteOffset, byteSize / 4) : new Uint8Array(buffer, byteOffset, byteSize);
}
class KtxParser extends TextureParser {
		load(url, callback, asset) {
				Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
		}
		open(url, data, device, textureOptions) {
				if (textureOptions === undefined) textureOptions = {};
				var textureData = this.parse(data);
				if (!textureData) {
						return null;
				}
				var format = textureOptions.srgb ? pixelFormatLinearToGamma(textureData.format) : textureData.format;
				var texture = new Texture(device, _extends({
						name: url,
						addressU: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						addressV: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						width: textureData.width,
						height: textureData.height,
						format: format,
						cubemap: textureData.cubemap,
						levels: textureData.levels
				}, textureOptions));
				texture.upload();
				return texture;
		}
		parse(data) {
				var dataU32 = new Uint32Array(data);
				if (IDENTIFIER[0] !== dataU32[0] || IDENTIFIER[1] !== dataU32[1] || IDENTIFIER[2] !== dataU32[2]) {
						return null;
				}
				var header = {
						endianness: dataU32[3],
						glType: dataU32[4],
						glTypeSize: dataU32[5],
						glFormat: dataU32[6],
						glInternalFormat: dataU32[7],
						glBaseInternalFormat: dataU32[8],
						pixelWidth: dataU32[9],
						pixelHeight: dataU32[10],
						pixelDepth: dataU32[11],
						numberOfArrayElements: dataU32[12],
						numberOfFaces: dataU32[13],
						numberOfMipmapLevels: dataU32[14],
						bytesOfKeyValueData: dataU32[15]
				};
				if (header.pixelDepth > 1) {
						return null;
				}
				if (header.numberOfArrayElements !== 0) {
						return null;
				}
				var format = KNOWN_FORMATS[header.glInternalFormat];
				if (format === undefined) {
						return null;
				}
				var offset = 16 + header.bytesOfKeyValueData / 4;
				var isCubemap = header.numberOfFaces > 1;
				var levels = [];
				for(var mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++){
						var imageSizeInBytes = dataU32[offset++];
						if (isCubemap) {
								levels.push([]);
						}
						var target = isCubemap ? levels[mipmapLevel] : levels;
						for(var face = 0; face < (isCubemap ? 6 : 1); ++face){
								target.push(createContainer(format, data, offset * 4, imageSizeInBytes));
								offset += imageSizeInBytes + 3 >> 2;
						}
				}
				return {
						format: format,
						width: header.pixelWidth,
						height: header.pixelHeight,
						levels: levels,
						cubemap: isCubemap
				};
		}
		constructor(registry){
				super();
				this.maxRetries = 0;
		}
}

export { KtxParser };
