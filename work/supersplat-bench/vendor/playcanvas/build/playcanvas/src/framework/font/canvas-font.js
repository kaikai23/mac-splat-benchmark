import { string } from '../../core/string.js';
import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_SRGBA8, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

var MAX_TEXTURE_SIZE = 4096;
var DEFAULT_TEXTURE_SIZE = 512;
class Atlas {
		destroy() {
				this.texture.destroy();
		}
		clear(clearColor) {
				var { width, height } = this.canvas;
				this.ctx.clearRect(0, 0, width, height);
				this.ctx.fillStyle = clearColor;
				this.ctx.fillRect(0, 0, width, height);
		}
		constructor(device, width, height, name){
				this.canvas = document.createElement('canvas');
				this.canvas.width = width;
				this.canvas.height = height;
				this.texture = new Texture(device, {
						name: name,
						format: PIXELFORMAT_SRGBA8,
						width: width,
						height: height,
						mipmaps: true,
						minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
						magFilter: FILTER_LINEAR,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						levels: [
								this.canvas
						]
				});
				this.ctx = this.canvas.getContext('2d', {
						alpha: true
				});
		}
}
class CanvasFont extends EventHandler {
		createTextures(text) {
				var _chars = this._normalizeCharsSet(text);
				if (_chars.length !== this.chars.length) {
						this._renderAtlas(_chars);
						return;
				}
				for(var i = 0; i < _chars.length; i++){
						if (_chars[i] !== this.chars[i]) {
								this._renderAtlas(_chars);
								return;
						}
				}
		}
		updateTextures(text) {
				var _chars = this._normalizeCharsSet(text);
				var newCharsSet = [];
				for(var i = 0; i < _chars.length; i++){
						var char = _chars[i];
						if (!this.data.chars[char]) {
								newCharsSet.push(char);
						}
				}
				if (newCharsSet.length > 0) {
						this._renderAtlas(this.chars.concat(newCharsSet));
				}
		}
		destroy() {
				this.atlases.forEach((atlas)=>atlas.destroy());
				this.chars = null;
				this.color = null;
				this.data = null;
				this.fontName = null;
				this.fontSize = null;
				this.glyphSize = null;
				this.intensity = null;
				this.atlases = null;
				this.type = null;
				this.fontWeight = null;
		}
		_colorToRgbString(color, alpha) {
				var str;
				var r = Math.round(255 * color.r);
				var g = Math.round(255 * color.g);
				var b = Math.round(255 * color.b);
				if (alpha) {
						str = "rgba(" + r + ", " + g + ", " + b + ", " + color.a + ")";
				} else {
						str = "rgb(" + r + ", " + g + ", " + b + ")";
				}
				return str;
		}
		renderCharacter(context, char, x, y, color) {
				context.fillStyle = color;
				context.fillText(char, x, y);
		}
		_getAtlas(index) {
				if (index >= this.atlases.length) {
						this.atlases[index] = new Atlas(this.app.graphicsDevice, this.width, this.height, "font-atlas-" + this.fontName + "-" + index);
				}
				return this.atlases[index];
		}
		_renderAtlas(charsArray) {
				this.chars = charsArray;
				var w = this.width;
				var h = this.height;
				var color = this._colorToRgbString(this.color, false);
				var a = this.color.a;
				this.color.a = 1 / 255;
				var transparent = this._colorToRgbString(this.color, true);
				this.color.a = a;
				var TEXT_ALIGN = 'center';
				var TEXT_BASELINE = 'alphabetic';
				var atlasIndex = 0;
				var atlas = this._getAtlas(atlasIndex++);
				atlas.clear(transparent);
				this.data = this._createJson(this.chars, this.fontName, w, h);
				var symbols = string.getSymbols(this.chars.join(''));
				var maxHeight = 0;
				var maxDescent = 0;
				var metrics = {};
				for(var i = 0; i < symbols.length; i++){
						var ch = symbols[i];
						metrics[ch] = this._getTextMetrics(ch);
						maxHeight = Math.max(maxHeight, metrics[ch].height);
						maxDescent = Math.max(maxDescent, metrics[ch].descent);
				}
				this.glyphSize = Math.max(this.glyphSize, maxHeight);
				var sx = this.glyphSize + this.padding * 2;
				var sy = this.glyphSize + this.padding * 2;
				var _xOffset = this.glyphSize / 2 + this.padding;
				var _yOffset = sy - maxDescent - this.padding;
				var _x = 0;
				var _y = 0;
				for(var i1 = 0; i1 < symbols.length; i1++){
						var ch1 = symbols[i1];
						var code = string.getCodePoint(symbols[i1]);
						var fs = this.fontSize;
						atlas.ctx.font = this.fontWeight + " " + fs.toString() + "px " + this.fontName;
						atlas.ctx.textAlign = TEXT_ALIGN;
						atlas.ctx.textBaseline = TEXT_BASELINE;
						var width = atlas.ctx.measureText(ch1).width;
						if (width > fs) {
								fs = this.fontSize * this.fontSize / width;
								atlas.ctx.font = this.fontWeight + " " + fs.toString() + "px " + this.fontName;
								width = this.fontSize;
						}
						this.renderCharacter(atlas.ctx, ch1, _x + _xOffset, _y + _yOffset, color);
						var xoffset = this.padding + (this.glyphSize - width) / 2;
						var yoffset = -this.padding + metrics[ch1].descent - maxDescent;
						var xadvance = width;
						this._addChar(this.data, ch1, code, _x, _y, sx, sy, xoffset, yoffset, xadvance, atlasIndex - 1, w, h);
						_x += sx;
						if (_x + sx > w) {
								_x = 0;
								_y += sy;
								if (_y + sy > h) {
										atlas = this._getAtlas(atlasIndex++);
										atlas.clear(transparent);
										_y = 0;
								}
						}
				}
				this.atlases.splice(atlasIndex).forEach((atlas)=>atlas.destroy());
				this.atlases.forEach((atlas)=>atlas.texture.upload());
				this.fire('render');
		}
		_createJson(chars, fontName, width, height) {
				var base = {
						'version': 3,
						'intensity': this.intensity,
						'info': {
								'face': fontName,
								'width': width,
								'height': height,
								'maps': [
										{
												'width': width,
												'height': height
										}
								]
						},
						'chars': {}
				};
				return base;
		}
		_addChar(json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
				if (json.info.maps.length < mapNum + 1) {
						json.info.maps.push({
								'width': mapW,
								'height': mapH
						});
				}
				var scale = this.fontSize / 32;
				json.chars[char] = {
						'id': charCode,
						'letter': char,
						'x': x,
						'y': y,
						'width': w,
						'height': h,
						'xadvance': xadvance / scale,
						'xoffset': xoffset / scale,
						'yoffset': (yoffset + this.padding) / scale,
						'scale': scale,
						'range': 1,
						'map': mapNum,
						'bounds': [
								0,
								0,
								w / scale,
								h / scale
						]
				};
		}
		_normalizeCharsSet(text) {
				var unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
				if (unicodeConverterFunc) {
						text = unicodeConverterFunc(text);
				}
				var set = {};
				var symbols = string.getSymbols(text);
				for(var i = 0; i < symbols.length; i++){
						var ch = symbols[i];
						if (set[ch]) continue;
						set[ch] = ch;
				}
				var chars = Object.keys(set);
				return chars.sort();
		}
		_getTextMetrics(text) {
				var textSpan = document.createElement('span');
				textSpan.id = 'content-span';
				textSpan.innerHTML = text;
				var block = document.createElement('div');
				block.id = 'content-block';
				block.style.display = 'inline-block';
				block.style.width = '1px';
				block.style.height = '0px';
				var div = document.createElement('div');
				div.appendChild(textSpan);
				div.appendChild(block);
				div.style.font = this.fontSize + "px " + this.fontName;
				var body = document.body;
				body.appendChild(div);
				var ascent = -1;
				var descent = -1;
				var height = -1;
				try {
						block.style['vertical-align'] = 'baseline';
						ascent = block.offsetTop - textSpan.offsetTop;
						block.style['vertical-align'] = 'bottom';
						height = block.offsetTop - textSpan.offsetTop;
						descent = height - ascent;
				} finally{
						document.body.removeChild(div);
				}
				return {
						ascent: ascent,
						descent: descent,
						height: height
				};
		}
		get textures() {
				return this.atlases.map((atlas)=>atlas.texture);
		}
		constructor(app, options = {}){
				super();
				this.type = 'bitmap';
				this.app = app;
				this.intensity = 0;
				this.fontWeight = options.fontWeight || 'normal';
				this.fontSize = parseInt(options.fontSize, 10);
				this.glyphSize = this.fontSize;
				this.fontName = options.fontName || 'Arial';
				this.color = options.color || new Color(1, 1, 1);
				this.padding = options.padding || 0;
				this.width = Math.min(MAX_TEXTURE_SIZE, options.width || DEFAULT_TEXTURE_SIZE);
				this.height = Math.min(MAX_TEXTURE_SIZE, options.height || DEFAULT_TEXTURE_SIZE);
				this.atlases = [];
				this.chars = '';
				this.data = {};
		}
}

export { CanvasFont };
