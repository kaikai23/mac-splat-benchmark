import { PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { http } from '../../../platform/net/http.js';
import { ABSOLUTE_URL } from '../../asset/constants.js';
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
class ImgParser extends TextureParser {
		load(url, callback, asset) {
				var _asset_file;
				var hasContents = !!(asset == null ? undefined : (_asset_file = asset.file) == null ? undefined : _asset_file.contents);
				if (hasContents) {
						if (this.device.supportsImageBitmap) {
								this._loadImageBitmapFromBlob(new Blob([
										asset.file.contents
								]), callback);
								return;
						}
						url = {
								load: URL.createObjectURL(new Blob([
										asset.file.contents
								])),
								original: url.original
						};
				}
				var handler = (err, result)=>{
						if (hasContents) {
								URL.revokeObjectURL(url.load);
						}
						callback(err, result);
				};
				var crossOrigin;
				if (asset && asset.options && asset.options.hasOwnProperty('crossOrigin')) {
						crossOrigin = asset.options.crossOrigin;
				} else if (ABSOLUTE_URL.test(url.load)) {
						crossOrigin = this.crossOrigin;
				}
				if (this.device.supportsImageBitmap) {
						this._loadImageBitmap(url.load, url.original, crossOrigin, handler);
				} else {
						this._loadImage(url.load, url.original, crossOrigin, handler);
				}
		}
		open(url, data, device, textureOptions) {
				if (textureOptions === undefined) textureOptions = {};
				var texture = new Texture(device, _extends({
						name: url,
						width: data.width,
						height: data.height,
						format: textureOptions.srgb ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8
				}, textureOptions));
				texture.setSource(data);
				return texture;
		}
		_loadImage(url, originalUrl, crossOrigin, callback) {
				var image = new Image();
				if (crossOrigin) {
						image.crossOrigin = crossOrigin;
				}
				var retries = 0;
				var maxRetries = this.maxRetries;
				var retryTimeout;
				image.onload = function() {
						callback(null, image);
				};
				image.onerror = function() {
						if (retryTimeout) return;
						if (maxRetries > 0 && ++retries <= maxRetries) {
								var retryDelay = Math.pow(2, retries) * 100;
								console.log("Error loading Texture from: '" + originalUrl + "' - Retrying in " + retryDelay + "ms...");
								var idx = url.indexOf('?');
								var separator = idx >= 0 ? '&' : '?';
								retryTimeout = setTimeout(()=>{
										image.src = url + separator + "retry=" + Date.now();
										retryTimeout = null;
								}, retryDelay);
						} else {
								callback("Error loading Texture from: '" + originalUrl + "'");
						}
				};
				image.src = url;
		}
		_loadImageBitmap(url, originalUrl, crossOrigin, callback) {
				var options = {
						cache: true,
						responseType: 'blob',
						retry: this.maxRetries > 0,
						maxRetries: this.maxRetries
				};
				http.get(url, options, (err, blob)=>{
						if (err) {
								callback(err);
						} else {
								this._loadImageBitmapFromBlob(blob, callback);
						}
				});
		}
		_loadImageBitmapFromBlob(blob, callback) {
				createImageBitmap(blob, {
						premultiplyAlpha: 'none',
						colorSpaceConversion: 'none'
				}).then((imageBitmap)=>callback(null, imageBitmap)).catch((e)=>callback(e));
		}
		constructor(registry, device){
				super();
				this.crossOrigin = registry.prefix ? 'anonymous' : null;
				this.maxRetries = 0;
				this.device = device;
		}
}

export { ImgParser };
