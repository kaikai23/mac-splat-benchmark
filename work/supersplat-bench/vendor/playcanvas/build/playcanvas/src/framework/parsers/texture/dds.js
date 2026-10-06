import { PIXELFORMAT_RGB8, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT5, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_ETC1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
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
class DdsParser extends TextureParser {
		load(url, callback, asset) {
				Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
		}
		open(url, data, device, textureOptions) {
				if (textureOptions === undefined) textureOptions = {};
				var header = new Uint32Array(data, 0, 128 / 4);
				var width = header[4];
				var height = header[3];
				var mips = Math.max(header[7], 1);
				var isFourCc = header[20] === 4;
				var fcc = header[21];
				var bpp = header[22];
				var isCubemap = header[28] === 65024;
				var FCC_DXT1 = 827611204;
				var FCC_DXT5 = 894720068;
				var FCC_FP16 = 113;
				var FCC_FP32 = 116;
				var FCC_ETC1 = 826496069;
				var FCC_PVRTC_2BPP_RGB_1 = 825438800;
				var FCC_PVRTC_2BPP_RGBA_1 = 825504336;
				var FCC_PVRTC_4BPP_RGB_1 = 825439312;
				var FCC_PVRTC_4BPP_RGBA_1 = 825504848;
				var compressed = false;
				var etc1 = false;
				var pvrtc2 = false;
				var pvrtc4 = false;
				var format = null;
				var componentSize = 1;
				var texture;
				if (isFourCc) {
						if (fcc === FCC_DXT1) {
								format = PIXELFORMAT_DXT1;
								compressed = true;
						} else if (fcc === FCC_DXT5) {
								format = PIXELFORMAT_DXT5;
								compressed = true;
						} else if (fcc === FCC_FP16) {
								format = PIXELFORMAT_RGBA16F;
								componentSize = 2;
						} else if (fcc === FCC_FP32) {
								format = PIXELFORMAT_RGBA32F;
								componentSize = 4;
						} else if (fcc === FCC_ETC1) {
								format = PIXELFORMAT_ETC1;
								compressed = true;
								etc1 = true;
						} else if (fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1) {
								format = fcc === FCC_PVRTC_2BPP_RGB_1 ? PIXELFORMAT_PVRTC_2BPP_RGB_1 : PIXELFORMAT_PVRTC_2BPP_RGBA_1;
								compressed = true;
								pvrtc2 = true;
						} else if (fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1) {
								format = fcc === FCC_PVRTC_4BPP_RGB_1 ? PIXELFORMAT_PVRTC_4BPP_RGB_1 : PIXELFORMAT_PVRTC_4BPP_RGBA_1;
								compressed = true;
								pvrtc4 = true;
						}
				} else {
						if (bpp === 32) {
								format = PIXELFORMAT_RGBA8;
						}
				}
				if (!format) {
						texture = new Texture(device, {
								width: 4,
								height: 4,
								format: PIXELFORMAT_RGB8,
								name: 'dds-legacy-empty'
						});
						return texture;
				}
				texture = new Texture(device, _extends({
						name: url,
						addressU: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						addressV: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						width: width,
						height: height,
						format: format,
						cubemap: isCubemap,
						mipmaps: mips > 1
				}, textureOptions));
				var offset = 128;
				var faces = isCubemap ? 6 : 1;
				var mipSize;
				var DXT_BLOCK_WIDTH = 4;
				var DXT_BLOCK_HEIGHT = 4;
				var blockSize = fcc === FCC_DXT1 ? 8 : 16;
				var numBlocksAcross, numBlocksDown, numBlocks;
				for(var face = 0; face < faces; face++){
						var mipWidth = width;
						var mipHeight = height;
						for(var i = 0; i < mips; i++){
								if (compressed) {
										if (etc1) {
												mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8;
										} else if (pvrtc2) {
												mipSize = Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4;
										} else if (pvrtc4) {
												mipSize = Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2;
										} else {
												numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
												numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
												numBlocks = numBlocksAcross * numBlocksDown;
												mipSize = numBlocks * blockSize;
										}
								} else {
										mipSize = mipWidth * mipHeight * 4;
								}
								var mipBuff = format === PIXELFORMAT_RGBA32F ? new Float32Array(data, offset, mipSize) : format === PIXELFORMAT_RGBA16F ? new Uint16Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
								if (!isCubemap) {
										texture._levels[i] = mipBuff;
								} else {
										if (!texture._levels[i]) texture._levels[i] = [];
										texture._levels[i][face] = mipBuff;
								}
								offset += mipSize * componentSize;
								mipWidth = Math.max(mipWidth * 0.5, 1);
								mipHeight = Math.max(mipHeight * 0.5, 1);
						}
				}
				texture.upload();
				return texture;
		}
		constructor(registry){
				super();
				this.maxRetries = 0;
		}
}

export { DdsParser };
