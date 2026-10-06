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
class BasisParser extends TextureParser {
		load(url, callback, asset) {
				var device = this.device;
				var transcode = (data)=>{
						var _asset_file_variants_basis, _asset_file_variants, _asset_file;
						var basisModuleFound = basisTranscode(device, url.load, data, callback, {
								isGGGR: ((asset == null ? undefined : (_asset_file = asset.file) == null ? undefined : (_asset_file_variants = _asset_file.variants) == null ? undefined : (_asset_file_variants_basis = _asset_file_variants.basis) == null ? undefined : _asset_file_variants_basis.opt) & 8) !== 0
						});
						if (!basisModuleFound) {
								callback("Basis module not found. Asset [" + asset.name + "](" + asset.getFileUrl() + ") basis texture variant will not be loaded.");
						}
				};
				Asset.fetchArrayBuffer(url.load, (err, result)=>{
						if (err) {
								callback(err);
						} else {
								transcode(result);
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
		constructor(registry, device){
				super();
				this.device = device;
				this.maxRetries = 0;
		}
}

export { BasisParser };
