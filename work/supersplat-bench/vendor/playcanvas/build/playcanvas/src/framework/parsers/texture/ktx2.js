import { ReadStream } from '../../../core/read-stream.js';
import { pixelFormatLinearToGamma, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';
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
var KHRConstants = {
		KHR_DF_MODEL_ETC1S: 163,
		KHR_DF_MODEL_UASTC: 166
};
class Ktx2Parser extends TextureParser {
		load(url, callback, asset) {
				Asset.fetchArrayBuffer(url.load, (err, result)=>{
						if (err) {
								callback(err, result);
						} else {
								this.parse(result, url, callback, asset);
						}
				}, asset, this.maxRetries);
		}
		open(url, data, device, textureOptions) {
				if (textureOptions === undefined) textureOptions = {};
				var format = textureOptions.srgb ? pixelFormatLinearToGamma(data.format) : data.format;
				var texture = new Texture(device, _extends({
						name: url,
						addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
						width: data.width,
						height: data.height,
						format: format,
						cubemap: data.cubemap,
						levels: data.levels
				}, textureOptions));
				texture.upload();
				return texture;
		}
		parse(arraybuffer, url, callback, asset) {
				var rs = new ReadStream(arraybuffer);
				var magic = [
						rs.readU32be(),
						rs.readU32be(),
						rs.readU32be()
				];
				if (magic[0] !== 0xAB4B5458 || magic[1] !== 0x203230BB || magic[2] !== 0x0D0A1A0A) {
						return null;
				}
				var header = {
						vkFormat: rs.readU32(),
						typeSize: rs.readU32(),
						pixelWidth: rs.readU32(),
						pixelHeight: rs.readU32(),
						pixelDepth: rs.readU32(),
						layerCount: rs.readU32(),
						faceCount: rs.readU32(),
						levelCount: rs.readU32(),
						supercompressionScheme: rs.readU32()
				};
				var index = {
						dfdByteOffset: rs.readU32(),
						dfdByteLength: rs.readU32(),
						kvdByteOffset: rs.readU32(),
						kvdByteLength: rs.readU32(),
						sgdByteOffset: rs.readU64(),
						sgdByteLength: rs.readU64()
				};
				var levels = [];
				for(var i = 0; i < Math.max(1, header.levelCount); ++i){
						levels.push({
								byteOffset: rs.readU64(),
								byteLength: rs.readU64(),
								uncompressedByteLength: rs.readU64()
						});
				}
				var dfdTotalSize = rs.readU32();
				if (dfdTotalSize !== index.kvdByteOffset - index.dfdByteOffset) {
						return null;
				}
				rs.skip(8);
				var colorModel = rs.readU8();
				rs.skip(index.dfdByteLength - 9);
				rs.skip(index.kvdByteLength);
				if (header.supercompressionScheme === 1 || colorModel === KHRConstants.KHR_DF_MODEL_UASTC) {
						var _asset_file_variants_basis, _asset_file_variants, _asset_file;
						var basisModuleFound = basisTranscode(this.device, url.load, arraybuffer, callback, {
								isGGGR: ((asset == null ? undefined : (_asset_file = asset.file) == null ? undefined : (_asset_file_variants = _asset_file.variants) == null ? undefined : (_asset_file_variants_basis = _asset_file_variants.basis) == null ? undefined : _asset_file_variants_basis.opt) & 8) !== 0,
								isKTX2: true
						});
						if (!basisModuleFound) {
								callback("Basis module not found. Asset [" + asset.name + "](" + asset.getFileUrl() + ") basis texture variant will not be loaded.");
						}
				} else {
						callback('unsupported KTX2 pixel format');
				}
		}
		constructor(registry, device){
				super();
				this.maxRetries = 0;
				this.device = device;
		}
}

export { Ktx2Parser };
