import { path } from '../../core/path.js';
import { TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, PIXELFORMAT_RGB8, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';
import { BasisParser } from '../parsers/texture/basis.js';
import { ImgParser } from '../parsers/texture/img.js';
import { KtxParser } from '../parsers/texture/ktx.js';
import { Ktx2Parser } from '../parsers/texture/ktx2.js';
import { DdsParser } from '../parsers/texture/dds.js';
import { HdrParser } from '../parsers/texture/hdr.js';
import { ResourceHandler } from './handler.js';

var JSON_ADDRESS_MODE = {
		'repeat': ADDRESS_REPEAT,
		'clamp': ADDRESS_CLAMP_TO_EDGE,
		'mirror': ADDRESS_MIRRORED_REPEAT
};
var JSON_FILTER_MODE = {
		'nearest': FILTER_NEAREST,
		'linear': FILTER_LINEAR,
		'nearest_mip_nearest': FILTER_NEAREST_MIPMAP_NEAREST,
		'linear_mip_nearest': FILTER_LINEAR_MIPMAP_NEAREST,
		'nearest_mip_linear': FILTER_NEAREST_MIPMAP_LINEAR,
		'linear_mip_linear': FILTER_LINEAR_MIPMAP_LINEAR
};
var JSON_TEXTURE_TYPE = {
		'default': TEXTURETYPE_DEFAULT,
		'rgbm': TEXTURETYPE_RGBM,
		'rgbe': TEXTURETYPE_RGBE,
		'rgbp': TEXTURETYPE_RGBP,
		'swizzleGGGR': TEXTURETYPE_SWIZZLEGGGR
};
var _completePartialMipmapChain = function _completePartialMipmapChain(texture) {
		var requiredMipLevels = TextureUtils.calcMipLevelsCount(texture._width, texture._height);
		var isHtmlElement = function isHtmlElement(object) {
				return object instanceof HTMLCanvasElement || object instanceof HTMLImageElement || object instanceof HTMLVideoElement;
		};
		if (!(texture._format === PIXELFORMAT_RGBA8 || texture._format === PIXELFORMAT_RGBA32F) || texture._volume || texture._compressed || texture._levels.length === 1 || texture._levels.length === requiredMipLevels || isHtmlElement(texture._cubemap ? texture._levels[0][0] : texture._levels[0])) {
				return;
		}
		var downsample = function downsample(width, height, data) {
				var sampledWidth = Math.max(1, width >> 1);
				var sampledHeight = Math.max(1, height >> 1);
				var sampledData = new data.constructor(sampledWidth * sampledHeight * 4);
				var xs = Math.floor(width / sampledWidth);
				var ys = Math.floor(height / sampledHeight);
				var xsys = xs * ys;
				for(var y = 0; y < sampledHeight; ++y){
						for(var x = 0; x < sampledWidth; ++x){
								for(var e = 0; e < 4; ++e){
										var sum = 0;
										for(var sy = 0; sy < ys; ++sy){
												for(var sx = 0; sx < xs; ++sx){
														sum += data[(x * xs + sx + (y * ys + sy) * width) * 4 + e];
												}
										}
										sampledData[(x + y * sampledWidth) * 4 + e] = sum / xsys;
								}
						}
				}
				return sampledData;
		};
		for(var level = texture._levels.length; level < requiredMipLevels; ++level){
				var width = Math.max(1, texture._width >> level - 1);
				var height = Math.max(1, texture._height >> level - 1);
				if (texture._cubemap) {
						var mips = [];
						for(var face = 0; face < 6; ++face){
								mips.push(downsample(width, height, texture._levels[level - 1][face]));
						}
						texture._levels.push(mips);
				} else {
						texture._levels.push(downsample(width, height, texture._levels[level - 1]));
				}
		}
		texture._levelsUpdated = texture._cubemap ? [
				[
						true,
						true,
						true,
						true,
						true,
						true
				]
		] : [
				true
		];
};
class TextureHandler extends ResourceHandler {
		set crossOrigin(value) {
				this.imgParser.crossOrigin = value;
		}
		get crossOrigin() {
				return this.imgParser.crossOrigin;
		}
		set maxRetries(value) {
				this.imgParser.maxRetries = value;
				for(var parser in this.parsers){
						if (this.parsers.hasOwnProperty(parser)) {
								this.parsers[parser].maxRetries = value;
						}
				}
		}
		get maxRetries() {
				return this.imgParser.maxRetries;
		}
		_getUrlWithoutParams(url) {
				return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
		}
		_getParser(url) {
				var ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
				return this.parsers[ext] || this.imgParser;
		}
		_getTextureOptions(asset) {
				var options = {};
				if (asset) {
						var _asset_name;
						if (((_asset_name = asset.name) == null ? undefined : _asset_name.length) > 0) {
								options.name = asset.name;
						}
						var assetData = asset.data;
						if (assetData.hasOwnProperty('minfilter')) {
								options.minFilter = JSON_FILTER_MODE[assetData.minfilter];
						}
						if (assetData.hasOwnProperty('magfilter')) {
								options.magFilter = JSON_FILTER_MODE[assetData.magfilter];
						}
						if (assetData.hasOwnProperty('addressu')) {
								options.addressU = JSON_ADDRESS_MODE[assetData.addressu];
						}
						if (assetData.hasOwnProperty('addressv')) {
								options.addressV = JSON_ADDRESS_MODE[assetData.addressv];
						}
						if (assetData.hasOwnProperty('mipmaps')) {
								options.mipmaps = assetData.mipmaps;
						}
						if (assetData.hasOwnProperty('anisotropy')) {
								options.anisotropy = assetData.anisotropy;
						}
						if (assetData.hasOwnProperty('flipY')) {
								options.flipY = !!assetData.flipY;
						}
						if (assetData.hasOwnProperty('srgb')) {
								options.srgb = !!assetData.srgb;
						}
						if (assetData.hasOwnProperty('type')) {
								options.type = JSON_TEXTURE_TYPE[assetData.type];
						} else if (assetData.hasOwnProperty('rgbm') && assetData.rgbm) {
								options.type = TEXTURETYPE_RGBM;
						} else if (asset.file && (asset.file.opt & 8) !== 0) {
								options.type = TEXTURETYPE_SWIZZLEGGGR;
						}
				}
				return options;
		}
		load(url, callback, asset) {
				if (typeof url === 'string') {
						url = {
								load: url,
								original: url
						};
				}
				this._getParser(url.original).load(url, callback, asset);
		}
		open(url, data, asset) {
				if (!url) {
						return undefined;
				}
				var textureOptions = this._getTextureOptions(asset);
				var texture = this._getParser(url).open(url, data, this._device, textureOptions);
				if (texture === null) {
						texture = new Texture(this._device, {
								width: 4,
								height: 4,
								format: PIXELFORMAT_RGB8
						});
				} else {
						_completePartialMipmapChain(texture);
						if (data.unswizzledGGGR) {
								asset.file.variants.basis.opt &= -9;
						}
				}
				return texture;
		}
		patch(asset, assets) {
				var texture = asset.resource;
				if (!texture) {
						return;
				}
				var options = this._getTextureOptions(asset);
				for (var key of Object.keys(options)){
						texture[key] = options[key];
				}
		}
		constructor(app){
				super(app, 'texture');
				var assets = app.assets;
				var device = app.graphicsDevice;
				this._device = device;
				this._assets = assets;
				this.imgParser = new ImgParser(assets, device);
				this.parsers = {
						dds: new DdsParser(assets),
						ktx: new KtxParser(assets),
						ktx2: new Ktx2Parser(assets, device),
						basis: new BasisParser(assets, device),
						hdr: new HdrParser(assets)
				};
		}
}

export { TextureHandler };
