import { ReadStream } from '../../../core/read-stream.js';
import { ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8, TEXTURETYPE_RGBE } from '../../../platform/graphics/constants.js';
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
class HdrParser extends TextureParser {
		load(url, callback, asset) {
				Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
		}
		open(url, data, device, textureOptions) {
				if (textureOptions === undefined) textureOptions = {};
				var textureData = this.parse(data);
				if (!textureData) {
						return null;
				}
				var texture = new Texture(device, _extends({
						name: url,
						addressU: ADDRESS_REPEAT,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						width: textureData.width,
						height: textureData.height,
						levels: textureData.levels,
						format: PIXELFORMAT_RGBA8,
						type: TEXTURETYPE_RGBE,
						mipmaps: false
				}, textureOptions));
				texture.upload();
				return texture;
		}
		parse(data) {
				var readStream = new ReadStream(data);
				var magic = readStream.readLine();
				if (!magic.startsWith('#?RADIANCE')) {
						return null;
				}
				var variables = {};
				while(true){
						var line = readStream.readLine();
						if (line.length === 0) {
								break;
						} else {
								var parts = line.split('=');
								if (parts.length === 2) {
										variables[parts[0]] = parts[1];
								}
						}
				}
				if (!variables.hasOwnProperty('FORMAT')) {
						return null;
				}
				var resolution = readStream.readLine().split(' ');
				if (resolution.length !== 4) {
						return null;
				}
				var height = parseInt(resolution[1], 10);
				var width = parseInt(resolution[3], 10);
				var pixels = this._readPixels(readStream, width, height, resolution[0] === '-Y');
				if (!pixels) {
						return null;
				}
				return {
						width: width,
						height: height,
						levels: [
								pixels
						]
				};
		}
		_readPixels(readStream, width, height, flipY) {
				if (width < 8 || width > 0x7fff) {
						return this._readPixelsFlat(readStream, width, height);
				}
				var rgbe = [
						0,
						0,
						0,
						0
				];
				readStream.readArray(rgbe);
				if (rgbe[0] !== 2 || rgbe[1] !== 2 || (rgbe[2] & 0x80) !== 0) {
						readStream.skip(-4);
						return this._readPixelsFlat(readStream, width, height);
				}
				var buffer = new ArrayBuffer(width * height * 4);
				var view = new Uint8Array(buffer);
				var scanstart = flipY ? 0 : width * 4 * (height - 1);
				var x, y, i, channel, count, value;
				for(y = 0; y < height; ++y){
						if (y) {
								readStream.readArray(rgbe);
						}
						if ((rgbe[2] << 8) + rgbe[3] !== width) {
								return null;
						}
						for(channel = 0; channel < 4; ++channel){
								x = 0;
								while(x < width){
										count = readStream.readU8();
										if (count > 128) {
												count -= 128;
												if (x + count > width) {
														return null;
												}
												value = readStream.readU8();
												for(i = 0; i < count; ++i){
														view[scanstart + channel + 4 * x++] = value;
												}
										} else {
												if (count === 0 || x + count > width) {
														return null;
												}
												for(i = 0; i < count; ++i){
														view[scanstart + channel + 4 * x++] = readStream.readU8();
												}
										}
								}
						}
						scanstart += width * 4 * (flipY ? 1 : -1);
				}
				return view;
		}
		_readPixelsFlat(readStream, width, height) {
				return readStream.remainingBytes === width * height * 4 ? new Uint8Array(readStream.arraybuffer, readStream.offset) : null;
		}
		constructor(registry){
				super();
				this.maxRetries = 0;
		}
}

export { HdrParser };
