import { math } from '../../core/math/math.js';
import { isIntegerPixelFormat, TEXPROPERTY_MIN_FILTER, TEXPROPERTY_MAG_FILTER, TEXPROPERTY_ADDRESS_U, TEXPROPERTY_ADDRESS_V, TEXPROPERTY_ADDRESS_W, TEXPROPERTY_COMPARE_ON_READ, TEXPROPERTY_COMPARE_FUNC, TEXPROPERTY_ANISOTROPY, isSrgbPixelFormat, pixelFormatLinearToGamma, pixelFormatGammaToLinear, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, requiresManualGamma, TEXPROPERTY_ALL, TEXTURELOCK_WRITE, getPixelFormatArrayType, TEXTURELOCK_NONE, PIXELFORMAT_RGBA8, isCompressedPixelFormat, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE } from './constants.js';
import { TextureUtils } from './texture-utils.js';

var id = 0;
class Texture {
		destroy() {
				var device = this.device;
				if (device) {
						var idx = device.textures.indexOf(this);
						if (idx !== -1) {
								device.textures.splice(idx, 1);
						}
						device.scope.removeValue(this);
						this.impl.destroy(device);
						this.adjustVramSizeTracking(device._vram, -this._gpuSize);
						this._levels = null;
						this.device = null;
				}
		}
		recreateImpl(upload) {
				if (upload === undefined) upload = true;
				var _this_impl;
				var { device } = this;
				(_this_impl = this.impl) == null ? undefined : _this_impl.destroy(device);
				this.impl = null;
				this.impl = device.createTextureImpl(this);
				this.dirtyAll();
				if (upload) {
						this.upload();
				}
		}
		resize(width, height, depth) {
				if (depth === undefined) depth = 1;
				var device = this.device;
				this.adjustVramSizeTracking(device._vram, -this._gpuSize);
				this.impl.destroy(device);
				this._width = Math.floor(width);
				this._height = Math.floor(height);
				this._depth = Math.floor(depth);
				this._updateNumLevel();
				this.impl = device.createTextureImpl(this);
				this.dirtyAll();
		}
		loseContext() {
				this.impl.loseContext();
				this.dirtyAll();
		}
		adjustVramSizeTracking(vram, size) {
				vram.tex += size;
		}
		propertyChanged(flag) {
				this.impl.propertyChanged(flag);
				this.renderVersionDirty = this.device.renderVersion;
		}
		_updateNumLevel() {
				var maxLevels = this.mipmaps ? TextureUtils.calcMipLevelsCount(this.width, this.height) : 1;
				var requestedLevels = this._numLevelsRequested;
				this._numLevels = Math.min(requestedLevels != null ? requestedLevels : maxLevels, maxLevels);
				this._mipmaps = this._numLevels > 1;
		}
		get lockedMode() {
				return this._lockedMode;
		}
		set minFilter(v) {
				if (this._minFilter !== v) {
						if (isIntegerPixelFormat(this._format)) ; else {
								this._minFilter = v;
								this.propertyChanged(TEXPROPERTY_MIN_FILTER);
						}
				}
		}
		get minFilter() {
				return this._minFilter;
		}
		set magFilter(v) {
				if (this._magFilter !== v) {
						if (isIntegerPixelFormat(this._format)) ; else {
								this._magFilter = v;
								this.propertyChanged(TEXPROPERTY_MAG_FILTER);
						}
				}
		}
		get magFilter() {
				return this._magFilter;
		}
		set addressU(v) {
				if (this._addressU !== v) {
						this._addressU = v;
						this.propertyChanged(TEXPROPERTY_ADDRESS_U);
				}
		}
		get addressU() {
				return this._addressU;
		}
		set addressV(v) {
				if (this._addressV !== v) {
						this._addressV = v;
						this.propertyChanged(TEXPROPERTY_ADDRESS_V);
				}
		}
		get addressV() {
				return this._addressV;
		}
		set addressW(addressW) {
				if (!this._volume) {
						return;
				}
				if (addressW !== this._addressW) {
						this._addressW = addressW;
						this.propertyChanged(TEXPROPERTY_ADDRESS_W);
				}
		}
		get addressW() {
				return this._addressW;
		}
		set compareOnRead(v) {
				if (this._compareOnRead !== v) {
						this._compareOnRead = v;
						this.propertyChanged(TEXPROPERTY_COMPARE_ON_READ);
				}
		}
		get compareOnRead() {
				return this._compareOnRead;
		}
		set compareFunc(v) {
				if (this._compareFunc !== v) {
						this._compareFunc = v;
						this.propertyChanged(TEXPROPERTY_COMPARE_FUNC);
				}
		}
		get compareFunc() {
				return this._compareFunc;
		}
		set anisotropy(v) {
				if (this._anisotropy !== v) {
						this._anisotropy = v;
						this.propertyChanged(TEXPROPERTY_ANISOTROPY);
				}
		}
		get anisotropy() {
				return this._anisotropy;
		}
		set mipmaps(v) {
				if (this._mipmaps !== v) {
						if (this.device.isWebGPU) ; else if (isIntegerPixelFormat(this._format)) ; else {
								this._mipmaps = v;
						}
						if (v) this._needsMipmapsUpload = true;
				}
		}
		get mipmaps() {
				return this._mipmaps;
		}
		get numLevels() {
				return this._numLevels;
		}
		get storage() {
				return this._storage;
		}
		get width() {
				return this._width;
		}
		get height() {
				return this._height;
		}
		get depth() {
				return this._depth;
		}
		get format() {
				return this._format;
		}
		get cubemap() {
				return this._cubemap;
		}
		get gpuSize() {
				var mips = this.pot && this._mipmaps && !(this._compressed && this._levels.length === 1);
				return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
		}
		get array() {
				return this._arrayLength > 0;
		}
		get arrayLength() {
				return this._arrayLength;
		}
		get volume() {
				return this._volume;
		}
		set srgb(value) {
				var currentSrgb = isSrgbPixelFormat(this.format);
				if (value !== currentSrgb) {
						if (value) {
								var srgbFormat = pixelFormatLinearToGamma(this.format);
								if (this._format !== srgbFormat) {
										this._format = srgbFormat;
										this.recreateImpl();
										this.device._shadersDirty = true;
								}
						} else {
								var linearFormat = pixelFormatGammaToLinear(this.format);
								if (this._format !== linearFormat) {
										this._format = linearFormat;
										this.recreateImpl();
										this.device._shadersDirty = true;
								}
						}
				}
		}
		get srgb() {
				return isSrgbPixelFormat(this.format);
		}
		set flipY(flipY) {
				if (this._flipY !== flipY) {
						this._flipY = flipY;
						this._needsUpload = true;
				}
		}
		get flipY() {
				return this._flipY;
		}
		set premultiplyAlpha(premultiplyAlpha) {
				if (this._premultiplyAlpha !== premultiplyAlpha) {
						this._premultiplyAlpha = premultiplyAlpha;
						this._needsUpload = true;
				}
		}
		get premultiplyAlpha() {
				return this._premultiplyAlpha;
		}
		get pot() {
				return math.powerOfTwo(this._width) && math.powerOfTwo(this._height);
		}
		get encoding() {
				switch(this.type){
						case TEXTURETYPE_RGBM:
								return 'rgbm';
						case TEXTURETYPE_RGBE:
								return 'rgbe';
						case TEXTURETYPE_RGBP:
								return 'rgbp';
				}
				return requiresManualGamma(this.format) ? 'srgb' : 'linear';
		}
		dirtyAll() {
				this._levelsUpdated = this._cubemap ? [
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
				this._needsUpload = true;
				this._needsMipmapsUpload = this._mipmaps;
				this._mipmapsUploaded = false;
				this.propertyChanged(TEXPROPERTY_ALL);
		}
		lock(options) {
				if (options === undefined) options = {};
				var _options, _options1, _options2;
				var _level;
				(_level = (_options = options).level) != null ? _level : _options.level = 0;
				var _face;
				(_face = (_options1 = options).face) != null ? _face : _options1.face = 0;
				var _mode;
				(_mode = (_options2 = options).mode) != null ? _mode : _options2.mode = TEXTURELOCK_WRITE;
				this._lockedMode = options.mode;
				this._lockedLevel = options.level;
				var levels = this.cubemap ? this._levels[options.face] : this._levels;
				if (levels[options.level] === null) {
						var width = Math.max(1, this._width >> options.level);
						var height = Math.max(1, this._height >> options.level);
						var depth = Math.max(1, this._depth >> options.level);
						var data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, depth, this._format));
						levels[options.level] = new (getPixelFormatArrayType(this._format))(data);
				}
				return levels[options.level];
		}
		setSource(source, mipLevel) {
				if (mipLevel === undefined) mipLevel = 0;
				var invalid = false;
				var width, height;
				if (this._cubemap) {
						if (source[0]) {
								width = source[0].width || 0;
								height = source[0].height || 0;
								for(var i = 0; i < 6; i++){
										var face = source[i];
										if (!face || face.width !== width || face.height !== height || !this.device._isBrowserInterface(face)) {
												invalid = true;
												break;
										}
								}
						} else {
								invalid = true;
						}
						if (!invalid) {
								for(var i1 = 0; i1 < 6; i1++){
										if (this._levels[mipLevel][i1] !== source[i1]) {
												this._levelsUpdated[mipLevel][i1] = true;
										}
								}
						}
				} else {
						if (!this.device._isBrowserInterface(source)) {
								invalid = true;
						}
						if (!invalid) {
								if (source !== this._levels[mipLevel]) {
										this._levelsUpdated[mipLevel] = true;
								}
								if (source instanceof HTMLVideoElement) {
										width = source.videoWidth;
										height = source.videoHeight;
								} else {
										width = source.width;
										height = source.height;
								}
						}
				}
				if (invalid) {
						this._width = 4;
						this._height = 4;
						if (this._cubemap) {
								for(var i2 = 0; i2 < 6; i2++){
										this._levels[mipLevel][i2] = null;
										this._levelsUpdated[mipLevel][i2] = true;
								}
						} else {
								this._levels[mipLevel] = null;
								this._levelsUpdated[mipLevel] = true;
						}
				} else {
						if (mipLevel === 0) {
								this._width = width;
								this._height = height;
						}
						this._levels[mipLevel] = source;
				}
				if (this._invalid !== invalid || !invalid) {
						this._invalid = invalid;
						this.upload();
				}
		}
		getSource(mipLevel) {
				if (mipLevel === undefined) mipLevel = 0;
				return this._levels[mipLevel];
		}
		unlock() {
				if (this._lockedMode === TEXTURELOCK_NONE) ;
				if (this._lockedMode === TEXTURELOCK_WRITE) {
						this.upload();
				}
				this._lockedLevel = -1;
				this._lockedMode = TEXTURELOCK_NONE;
		}
		upload() {
				this._needsUpload = true;
				this._needsMipmapsUpload = this._mipmaps;
				this.impl.uploadImmediate == null ? undefined : this.impl.uploadImmediate.call(this.impl, this.device, this);
		}
		read(x, y, width, height, options) {
				if (options === undefined) options = {};
				return this.impl.read == null ? undefined : this.impl.read.call(this.impl, x, y, width, height, options);
		}
		constructor(graphicsDevice, options = {}){
				this._gpuSize = 0;
				this.id = id++;
				this._invalid = false;
				this._lockedLevel = -1;
				this._lockedMode = TEXTURELOCK_NONE;
				this.renderVersionDirty = 0;
				this._storage = false;
				this._numLevels = 0;
				this.device = graphicsDevice;
				var _options_name;
				this.name = (_options_name = options.name) != null ? _options_name : '';
				var _options_width;
				this._width = Math.floor((_options_width = options.width) != null ? _options_width : 4);
				var _options_height;
				this._height = Math.floor((_options_height = options.height) != null ? _options_height : 4);
				var _options_format;
				this._format = (_options_format = options.format) != null ? _options_format : PIXELFORMAT_RGBA8;
				this._compressed = isCompressedPixelFormat(this._format);
				this._integerFormat = isIntegerPixelFormat(this._format);
				if (this._integerFormat) {
						options.minFilter = FILTER_NEAREST;
						options.magFilter = FILTER_NEAREST;
				}
				var _options_volume;
				this._volume = (_options_volume = options.volume) != null ? _options_volume : false;
				var _options_depth;
				this._depth = Math.floor((_options_depth = options.depth) != null ? _options_depth : 1);
				var _options_arrayLength;
				this._arrayLength = Math.floor((_options_arrayLength = options.arrayLength) != null ? _options_arrayLength : 0);
				var _options_storage;
				this._storage = (_options_storage = options.storage) != null ? _options_storage : false;
				var _options_cubemap;
				this._cubemap = (_options_cubemap = options.cubemap) != null ? _options_cubemap : false;
				var _options_flipY;
				this._flipY = (_options_flipY = options.flipY) != null ? _options_flipY : false;
				var _options_premultiplyAlpha;
				this._premultiplyAlpha = (_options_premultiplyAlpha = options.premultiplyAlpha) != null ? _options_premultiplyAlpha : false;
				var _options_mipmaps;
				this._mipmaps = (_options_mipmaps = options.mipmaps) != null ? _options_mipmaps : true;
				this._numLevelsRequested = options.numLevels;
				if (options.numLevels !== undefined) {
						this._numLevels = options.numLevels;
				}
				this._updateNumLevel();
				var _options_minFilter;
				this._minFilter = (_options_minFilter = options.minFilter) != null ? _options_minFilter : FILTER_LINEAR_MIPMAP_LINEAR;
				var _options_magFilter;
				this._magFilter = (_options_magFilter = options.magFilter) != null ? _options_magFilter : FILTER_LINEAR;
				var _options_anisotropy;
				this._anisotropy = (_options_anisotropy = options.anisotropy) != null ? _options_anisotropy : 1;
				var _options_addressU;
				this._addressU = (_options_addressU = options.addressU) != null ? _options_addressU : ADDRESS_REPEAT;
				var _options_addressV;
				this._addressV = (_options_addressV = options.addressV) != null ? _options_addressV : ADDRESS_REPEAT;
				var _options_addressW;
				this._addressW = (_options_addressW = options.addressW) != null ? _options_addressW : ADDRESS_REPEAT;
				var _options_compareOnRead;
				this._compareOnRead = (_options_compareOnRead = options.compareOnRead) != null ? _options_compareOnRead : false;
				var _options_compareFunc;
				this._compareFunc = (_options_compareFunc = options.compareFunc) != null ? _options_compareFunc : FUNC_LESS;
				this.type = options.hasOwnProperty('type') ? options.type : TEXTURETYPE_DEFAULT;
				this.projection = TEXTUREPROJECTION_NONE;
				if (this._cubemap) {
						this.projection = TEXTUREPROJECTION_CUBE;
				} else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
						this.projection = options.projection;
				}
				this._levels = options.levels;
				var upload = !!options.levels;
				if (!this._levels) {
						this._levels = this._cubemap ? [
								[
										null,
										null,
										null,
										null,
										null,
										null
								]
						] : [
								null
						];
				}
				this.recreateImpl(upload);
				graphicsDevice.textures.push(this);
		}
}

export { Texture };
