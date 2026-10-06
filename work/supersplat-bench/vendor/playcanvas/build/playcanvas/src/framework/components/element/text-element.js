import { string } from '../../../core/string.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, TYPE_FLOAT32 } from '../../../platform/graphics/constants.js';
import { VertexIterator } from '../../../platform/graphics/vertex-iterator.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { Mesh } from '../../../scene/mesh.js';
import { LocalizedAsset } from '../../asset/asset-localized.js';
import { FONT_MSDF, FONT_BITMAP } from '../../font/constants.js';
import { Markup } from './markup.js';

class MeshInfo {
		constructor(){
				this.count = 0;
				this.quad = 0;
				this.lines = {};
				this.positions = [];
				this.normals = [];
				this.uvs = [];
				this.colors = [];
				this.indices = [];
				this.outlines = [];
				this.shadows = [];
				this.meshInstance = null;
		}
}
function createTextMesh(device, meshInfo) {
		var mesh = new Mesh(device);
		mesh.setPositions(meshInfo.positions);
		mesh.setNormals(meshInfo.normals);
		mesh.setColors32(meshInfo.colors);
		mesh.setUvs(0, meshInfo.uvs);
		mesh.setIndices(meshInfo.indices);
		mesh.setVertexStream(SEMANTIC_ATTR8, meshInfo.outlines, 3, undefined, TYPE_FLOAT32, false);
		mesh.setVertexStream(SEMANTIC_ATTR9, meshInfo.shadows, 3, undefined, TYPE_FLOAT32, false);
		mesh.update();
		return mesh;
}
var LINE_BREAK_CHAR = /^[\r\n]$/;
var WHITESPACE_CHAR = /^[ \t]$/;
var WORD_BOUNDARY_CHAR = /^[ \t\-]|\u200b$/;
var ALPHANUMERIC_CHAR = /^[a-z0-9]$/i;
var CJK_CHAR = /^[\u1100-\u11ff]|[\u3000-\u9fff\ua960-\ua97f]|[\uac00-\ud7ff]$/;
var NO_LINE_BREAK_CJK_CHAR = /^[〕〉》」』】〙〗〟ヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻]$/;
var CONTROL_CHARS = [
		'\u200B',
		'\u061C',
		'\u200E',
		'\u200F',
		'\u202A',
		'\u202B',
		'\u202C',
		'\u202D',
		'\u202E',
		'\u2066',
		'\u2067',
		'\u2068',
		'\u2069'
];
var CONTROL_GLYPH_DATA = {
		width: 0,
		height: 0,
		xadvance: 0,
		xoffset: 0,
		yoffset: 0
};
var colorTmp = new Color();
var vec2Tmp = new Vec2();
var _tempColor = new Color();
class TextElement {
		destroy() {
				this._setMaterial(null);
				if (this._model) {
						this._element.removeModelFromLayers(this._model);
						this._model.destroy();
						this._model = null;
				}
				this._fontAsset.destroy();
				this.font = null;
				this._element.off('resize', this._onParentResize, this);
				this._element.off('set:screen', this._onScreenChange, this);
				this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
				this._element.off('set:draworder', this._onDrawOrderChange, this);
				this._element.off('set:pivot', this._onPivotChange, this);
				this._system.app.i18n.off('set:locale', this._onLocaleSet, this);
				this._system.app.i18n.off('data:add', this._onLocalizationData, this);
				this._system.app.i18n.off('data:remove', this._onLocalizationData, this);
		}
		_onParentResize(width, height) {
				if (this._noResize) return;
				if (this._font) this._updateText();
		}
		_onScreenChange(screen) {
				if (screen) {
						this._updateMaterial(screen.screen.screenSpace);
				} else {
						this._updateMaterial(false);
				}
		}
		_onScreenSpaceChange(value) {
				this._updateMaterial(value);
		}
		_onDrawOrderChange(order) {
				this._drawOrder = order;
				if (this._model) {
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								this._model.meshInstances[i].drawOrder = order;
						}
				}
		}
		_onPivotChange(pivot) {
				if (this._font) {
						this._updateText();
				}
		}
		_onLocaleSet(locale) {
				if (!this._i18nKey) return;
				if (this.fontAsset) {
						var asset = this._system.app.assets.get(this.fontAsset);
						if (!asset || !asset.resource || asset.resource !== this._font) {
								this.font = null;
						}
				}
				this._resetLocalizedText();
		}
		_onLocalizationData(locale, messages) {
				if (this._i18nKey && messages[this._i18nKey]) {
						this._resetLocalizedText();
				}
		}
		_resetLocalizedText() {
				this._setText(this._system.app.i18n.getText(this._i18nKey));
		}
		_setText(text) {
				if (this.unicodeConverter) {
						var unicodeConverterFunc = this._system.getUnicodeConverter();
						if (unicodeConverterFunc) {
								text = unicodeConverterFunc(text);
						} else {
								console.warn('Element created with unicodeConverter option but no unicodeConverter function registered');
						}
				}
				if (this._text !== text) {
						if (this._font) {
								this._updateText(text);
						}
						this._text = text;
				}
		}
		_updateText(text) {
				var tags;
				if (text === undefined) text = this._text;
				this._symbols = string.getSymbols(text.normalize ? text.normalize('NFC') : text);
				if (this._symbols.length === 0) {
						this._symbols = [
								' '
						];
				}
				if (this._enableMarkup) {
						var results = Markup.evaluate(this._symbols);
						this._symbols = results.symbols;
						tags = results.tags || [];
				}
				if (this._rtlReorder) {
						var rtlReorderFunc = this._system.app.systems.element.getRtlReorder();
						if (rtlReorderFunc) {
								var results1 = rtlReorderFunc(this._symbols);
								this._rtl = results1.rtl;
								this._symbols = results1.mapping.map(function(v) {
										return this._symbols[v];
								}, this);
								if (tags) {
										tags = results1.mapping.map((v)=>{
												return tags[v];
										});
								}
						} else {
								console.warn('Element created with rtlReorder option but no rtlReorder function registered');
						}
				} else {
						this._rtl = false;
				}
				var getColorThicknessHash = (color, thickness)=>{
						return color.toString(true).toLowerCase() + ":" + thickness.toFixed(2);
				};
				var getColorOffsetHash = (color, offset)=>{
						return color.toString(true).toLowerCase() + ":" + offset.x.toFixed(2) + ":" + offset.y.toFixed(2);
				};
				if (tags) {
						var paletteMap = {};
						var outlinePaletteMap = {};
						var shadowPaletteMap = {};
						this._colorPalette = [
								Math.round(this._color.r * 255),
								Math.round(this._color.g * 255),
								Math.round(this._color.b * 255)
						];
						this._outlinePalette = [
								Math.round(this._outlineColor.r * 255),
								Math.round(this._outlineColor.g * 255),
								Math.round(this._outlineColor.b * 255),
								Math.round(this._outlineColor.a * 255),
								Math.round(this._outlineThickness * 255)
						];
						this._shadowPalette = [
								Math.round(this._shadowColor.r * 255),
								Math.round(this._shadowColor.g * 255),
								Math.round(this._shadowColor.b * 255),
								Math.round(this._shadowColor.a * 255),
								Math.round(this._shadowOffset.x * 127),
								Math.round(this._shadowOffset.y * 127)
						];
						this._symbolColors = [];
						this._symbolOutlineParams = [];
						this._symbolShadowParams = [];
						paletteMap[this._color.toString(false).toLowerCase()] = 0;
						outlinePaletteMap[getColorThicknessHash(this._outlineColor, this._outlineThickness)] = 0;
						shadowPaletteMap[getColorOffsetHash(this._shadowColor, this._shadowOffset)] = 0;
						for(var i = 0, len = this._symbols.length; i < len; ++i){
								var tag = tags[i];
								var color = 0;
								if (tag && tag.color && tag.color.value) {
										var c = tag.color.value;
										if (c.length === 7 && c[0] === '#') {
												var hex = c.substring(1).toLowerCase();
												if (paletteMap.hasOwnProperty(hex)) {
														color = paletteMap[hex];
												} else {
														if (/^[0-9a-f]{6}$/.test(hex)) {
																color = this._colorPalette.length / 3;
																paletteMap[hex] = color;
																this._colorPalette.push(parseInt(hex.substring(0, 2), 16));
																this._colorPalette.push(parseInt(hex.substring(2, 4), 16));
																this._colorPalette.push(parseInt(hex.substring(4, 6), 16));
														}
												}
										}
								}
								this._symbolColors.push(color);
								var outline = 0;
								if (tag && tag.outline && (tag.outline.attributes.color || tag.outline.attributes.thickness)) {
										var color1 = tag.outline.attributes.color ? colorTmp.fromString(tag.outline.attributes.color) : this._outlineColor;
										var thickness = Number(tag.outline.attributes.thickness);
										if (Number.isNaN(color1.r) || Number.isNaN(color1.g) || Number.isNaN(color1.b) || Number.isNaN(color1.a)) {
												color1 = this._outlineColor;
										}
										if (Number.isNaN(thickness)) {
												thickness = this._outlineThickness;
										}
										var outlineHash = getColorThicknessHash(color1, thickness);
										if (outlinePaletteMap.hasOwnProperty(outlineHash)) {
												outline = outlinePaletteMap[outlineHash];
										} else {
												outline = this._outlinePalette.length / 5;
												outlinePaletteMap[outlineHash] = outline;
												this._outlinePalette.push(Math.round(color1.r * 255), Math.round(color1.g * 255), Math.round(color1.b * 255), Math.round(color1.a * 255), Math.round(thickness * 255));
										}
								}
								this._symbolOutlineParams.push(outline);
								var shadow = 0;
								if (tag && tag.shadow && (tag.shadow.attributes.color || tag.shadow.attributes.offset || tag.shadow.attributes.offsetX || tag.shadow.attributes.offsetY)) {
										var color2 = tag.shadow.attributes.color ? colorTmp.fromString(tag.shadow.attributes.color) : this._shadowColor;
										var off = Number(tag.shadow.attributes.offset);
										var offX = Number(tag.shadow.attributes.offsetX);
										var offY = Number(tag.shadow.attributes.offsetY);
										if (Number.isNaN(color2.r) || Number.isNaN(color2.g) || Number.isNaN(color2.b) || Number.isNaN(color2.a)) {
												color2 = this._shadowColor;
										}
										var offset = vec2Tmp.set(!Number.isNaN(offX) ? offX : !Number.isNaN(off) ? off : this._shadowOffset.x, !Number.isNaN(offY) ? offY : !Number.isNaN(off) ? off : this._shadowOffset.y);
										var shadowHash = getColorOffsetHash(color2, offset);
										if (shadowPaletteMap.hasOwnProperty(shadowHash)) {
												shadow = shadowPaletteMap[shadowHash];
										} else {
												shadow = this._shadowPalette.length / 6;
												shadowPaletteMap[shadowHash] = shadow;
												this._shadowPalette.push(Math.round(color2.r * 255), Math.round(color2.g * 255), Math.round(color2.b * 255), Math.round(color2.a * 255), Math.round(offset.x * 127), Math.round(offset.y * 127));
										}
								}
								this._symbolShadowParams.push(shadow);
						}
				} else {
						this._colorPalette = [];
						this._symbolColors = null;
						this._symbolOutlineParams = null;
						this._symbolShadowParams = null;
				}
				this._updateMaterialEmissive();
				this._updateMaterialOutline();
				this._updateMaterialShadow();
				var charactersPerTexture = this._calculateCharsPerTexture();
				var removedModel = false;
				var element = this._element;
				var screenSpace = element._isScreenSpace();
				var screenCulled = element._isScreenCulled();
				var visibleFn = function visibleFn(camera) {
						return element.isVisibleForCamera(camera);
				};
				for(var i1 = 0, len1 = this._meshInfo.length; i1 < len1; i1++){
						var l = charactersPerTexture[i1] || 0;
						var meshInfo = this._meshInfo[i1];
						if (meshInfo.count !== l) {
								if (!removedModel) {
										element.removeModelFromLayers(this._model);
										removedModel = true;
								}
								meshInfo.count = l;
								meshInfo.positions.length = meshInfo.normals.length = l * 3 * 4;
								meshInfo.indices.length = l * 3 * 2;
								meshInfo.uvs.length = l * 2 * 4;
								meshInfo.colors.length = l * 4 * 4;
								meshInfo.outlines.length = l * 4 * 3;
								meshInfo.shadows.length = l * 4 * 3;
								if (meshInfo.meshInstance) {
										this._removeMeshInstance(meshInfo.meshInstance);
								}
								if (l === 0) {
										meshInfo.meshInstance = null;
										continue;
								}
								for(var v = 0; v < l; v++){
										meshInfo.indices[v * 3 * 2 + 0] = v * 4;
										meshInfo.indices[v * 3 * 2 + 1] = v * 4 + 1;
										meshInfo.indices[v * 3 * 2 + 2] = v * 4 + 3;
										meshInfo.indices[v * 3 * 2 + 3] = v * 4 + 2;
										meshInfo.indices[v * 3 * 2 + 4] = v * 4 + 3;
										meshInfo.indices[v * 3 * 2 + 5] = v * 4 + 1;
										meshInfo.normals[v * 4 * 3 + 0] = 0;
										meshInfo.normals[v * 4 * 3 + 1] = 0;
										meshInfo.normals[v * 4 * 3 + 2] = -1;
										meshInfo.normals[v * 4 * 3 + 3] = 0;
										meshInfo.normals[v * 4 * 3 + 4] = 0;
										meshInfo.normals[v * 4 * 3 + 5] = -1;
										meshInfo.normals[v * 4 * 3 + 6] = 0;
										meshInfo.normals[v * 4 * 3 + 7] = 0;
										meshInfo.normals[v * 4 * 3 + 8] = -1;
										meshInfo.normals[v * 4 * 3 + 9] = 0;
										meshInfo.normals[v * 4 * 3 + 10] = 0;
										meshInfo.normals[v * 4 * 3 + 11] = -1;
								}
								var mesh = createTextMesh(this._system.app.graphicsDevice, meshInfo);
								var mi = new MeshInstance(mesh, this._material, this._node);
								mi.name = "Text Element: " + this._entity.name;
								mi.castShadow = false;
								mi.receiveShadow = false;
								mi.cull = !screenSpace;
								mi.screenSpace = screenSpace;
								mi.drawOrder = this._drawOrder;
								if (screenCulled) {
										mi.cull = true;
										mi.isVisibleFunc = visibleFn;
								}
								this._setTextureParams(mi, this._font.textures[i1]);
								mi.setParameter('material_emissive', this._colorUniform);
								mi.setParameter('material_opacity', this._color.a);
								mi.setParameter('font_sdfIntensity', this._font.intensity);
								mi.setParameter('font_pxrange', this._getPxRange(this._font));
								mi.setParameter('font_textureWidth', this._font.data.info.maps[i1].width);
								mi.setParameter('outline_color', this._outlineColorUniform);
								mi.setParameter('outline_thickness', this._outlineThicknessScale * this._outlineThickness);
								mi.setParameter('shadow_color', this._shadowColorUniform);
								if (this._symbolShadowParams) {
										this._shadowOffsetUniform[0] = 0;
										this._shadowOffsetUniform[1] = 0;
								} else {
										var ratio = -this._font.data.info.maps[i1].width / this._font.data.info.maps[i1].height;
										this._shadowOffsetUniform[0] = this._shadowOffsetScale * this._shadowOffset.x;
										this._shadowOffsetUniform[1] = ratio * this._shadowOffsetScale * this._shadowOffset.y;
								}
								mi.setParameter('shadow_offset', this._shadowOffsetUniform);
								meshInfo.meshInstance = mi;
								this._model.meshInstances.push(mi);
						}
				}
				if (this._element.maskedBy) {
						this._element._setMaskedBy(this._element.maskedBy);
				}
				if (removedModel && this._element.enabled && this._entity.enabled) {
						this._element.addModelToLayers(this._model);
				}
				this._updateMeshes();
				this._rangeStart = 0;
				this._rangeEnd = this._symbols.length;
				this._updateRenderRange();
		}
		_removeMeshInstance(meshInstance) {
				meshInstance.destroy();
				var idx = this._model.meshInstances.indexOf(meshInstance);
				if (idx !== -1) {
						this._model.meshInstances.splice(idx, 1);
				}
		}
		_setMaterial(material) {
				this._material = material;
				if (this._model) {
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								var mi = this._model.meshInstances[i];
								mi.material = material;
						}
				}
		}
		_updateMaterial(screenSpace) {
				var element = this._element;
				var screenCulled = element._isScreenCulled();
				var visibleFn = function visibleFn(camera) {
						return element.isVisibleForCamera(camera);
				};
				var msdf = this._font && this._font.type === FONT_MSDF;
				this._material = this._system.getTextElementMaterial(screenSpace, msdf, this._enableMarkup);
				if (this._model) {
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								var mi = this._model.meshInstances[i];
								mi.cull = !screenSpace;
								mi.material = this._material;
								mi.screenSpace = screenSpace;
								if (screenCulled) {
										mi.cull = true;
										mi.isVisibleFunc = visibleFn;
								} else {
										mi.isVisibleFunc = null;
								}
						}
				}
		}
		_updateMaterialEmissive() {
				if (this._symbolColors) {
						this._colorUniform[0] = 1;
						this._colorUniform[1] = 1;
						this._colorUniform[2] = 1;
				} else {
						_tempColor.linear(this._color);
						this._colorUniform[0] = _tempColor.r;
						this._colorUniform[1] = _tempColor.g;
						this._colorUniform[2] = _tempColor.b;
				}
		}
		_updateMaterialOutline() {
				if (this._symbolOutlineParams) {
						this._outlineColorUniform[0] = 0;
						this._outlineColorUniform[1] = 0;
						this._outlineColorUniform[2] = 0;
						this._outlineColorUniform[3] = 1;
				} else {
						_tempColor.linear(this._outlineColor);
						this._outlineColorUniform[0] = _tempColor.r;
						this._outlineColorUniform[1] = _tempColor.g;
						this._outlineColorUniform[2] = _tempColor.b;
						this._outlineColorUniform[3] = _tempColor.a;
				}
		}
		_updateMaterialShadow() {
				if (this._symbolOutlineParams) {
						this._shadowColorUniform[0] = 0;
						this._shadowColorUniform[1] = 0;
						this._shadowColorUniform[2] = 0;
						this._shadowColorUniform[3] = 0;
				} else {
						_tempColor.linear(this._shadowColor);
						this._shadowColorUniform[0] = _tempColor.r;
						this._shadowColorUniform[1] = _tempColor.g;
						this._shadowColorUniform[2] = _tempColor.b;
						this._shadowColorUniform[3] = _tempColor.a;
				}
		}
		_isWordBoundary(char) {
				return WORD_BOUNDARY_CHAR.test(char);
		}
		_isValidNextChar(nextchar) {
				return nextchar !== null && !NO_LINE_BREAK_CJK_CHAR.test(nextchar);
		}
		_isNextCJKBoundary(char, nextchar) {
				return CJK_CHAR.test(char) && (WORD_BOUNDARY_CHAR.test(nextchar) || ALPHANUMERIC_CHAR.test(nextchar));
		}
		_isNextCJKWholeWord(nextchar) {
				return CJK_CHAR.test(nextchar);
		}
		_updateMeshes() {
				var json = this._font.data;
				var self = this;
				var minFont = Math.min(this._minFontSize, this._maxFontSize);
				var maxFont = this._maxFontSize;
				var autoFit = this._shouldAutoFit();
				if (autoFit) {
						this._fontSize = this._maxFontSize;
				}
				var MAGIC = 32;
				var l = this._symbols.length;
				var _x = 0;
				var _y = 0;
				var _z = 0;
				var _xMinusTrailingWhitespace = 0;
				var lines = 1;
				var wordStartX = 0;
				var wordStartIndex = 0;
				var lineStartIndex = 0;
				var numWordsThisLine = 0;
				var numCharsThisLine = 0;
				var numBreaksThisLine = 0;
				var splitHorizontalAnchors = Math.abs(this._element.anchor.x - this._element.anchor.z) >= 0.0001;
				var maxLineWidth = this._element.calculatedWidth;
				if (this.autoWidth && !splitHorizontalAnchors || !this._wrapLines) {
						maxLineWidth = Number.POSITIVE_INFINITY;
				}
				var fontMinY = 0;
				var fontMaxY = 0;
				var char, data, quad, nextchar;
				function breakLine(symbols, lineBreakIndex, lineBreakX) {
						self._lineWidths.push(Math.abs(lineBreakX));
						var sliceStart = lineStartIndex > lineBreakIndex ? lineBreakIndex + 1 : lineStartIndex;
						var sliceEnd = lineStartIndex > lineBreakIndex ? lineStartIndex + 1 : lineBreakIndex;
						var chars = symbols.slice(sliceStart, sliceEnd);
						if (numBreaksThisLine) {
								var i = chars.length;
								while(i-- && numBreaksThisLine > 0){
										if (LINE_BREAK_CHAR.test(chars[i])) {
												chars.splice(i, 1);
												numBreaksThisLine--;
										}
								}
						}
						self._lineContents.push(chars.join(''));
						_x = 0;
						_y -= self._scaledLineHeight;
						lines++;
						numWordsThisLine = 0;
						numCharsThisLine = 0;
						numBreaksThisLine = 0;
						wordStartX = 0;
						lineStartIndex = lineBreakIndex;
				}
				var retryUpdateMeshes = true;
				while(retryUpdateMeshes){
						retryUpdateMeshes = false;
						if (autoFit) {
								this._scaledLineHeight = this._lineHeight * this._fontSize / (this._maxFontSize || 0.0001);
						} else {
								this._scaledLineHeight = this._lineHeight;
						}
						this.width = 0;
						this.height = 0;
						this._lineWidths = [];
						this._lineContents = [];
						_x = 0;
						_y = 0;
						_z = 0;
						_xMinusTrailingWhitespace = 0;
						lines = 1;
						wordStartX = 0;
						wordStartIndex = 0;
						lineStartIndex = 0;
						numWordsThisLine = 0;
						numCharsThisLine = 0;
						numBreaksThisLine = 0;
						var scale = this._fontSize / MAGIC;
						fontMinY = this._fontMinY * scale;
						fontMaxY = this._fontMaxY * scale;
						for(var i = 0; i < this._meshInfo.length; i++){
								this._meshInfo[i].quad = 0;
								this._meshInfo[i].lines = {};
						}
						var color_r = 255;
						var color_g = 255;
						var color_b = 255;
						var outline_color_rg = 255 + 255 * 256;
						var outline_color_ba = 255 + 255 * 256;
						var outline_thickness = 0;
						var shadow_color_rg = 255 + 255 * 256;
						var shadow_color_ba = 255 + 255 * 256;
						var shadow_offset_xy = 127 + 127 * 256;
						for(var i1 = 0; i1 < l; i1++){
								char = this._symbols[i1];
								nextchar = i1 + 1 >= l ? null : this._symbols[i1 + 1];
								var isLineBreak = LINE_BREAK_CHAR.test(char);
								if (isLineBreak) {
										numBreaksThisLine++;
										if (!this._wrapLines || this._maxLines < 0 || lines < this._maxLines) {
												breakLine(this._symbols, i1, _xMinusTrailingWhitespace);
												wordStartIndex = i1 + 1;
												lineStartIndex = i1 + 1;
										}
										continue;
								}
								var x = 0;
								var y = 0;
								var advance = 0;
								var quadsize = 1;
								var dataScale = undefined, size = undefined;
								data = json.chars[char];
								if (!data) {
										if (CONTROL_CHARS.indexOf(char) !== -1) {
												data = CONTROL_GLYPH_DATA;
										} else {
												if (json.chars[' ']) {
														data = json.chars[' '];
												} else {
														for(var key in json.chars){
																data = json.chars[key];
																break;
														}
												}
										}
								}
								if (data) {
										var kerning = 0;
										if (numCharsThisLine > 0) {
												var kernTable = this._font.data.kerning;
												if (kernTable) {
														var kernLeft = kernTable[string.getCodePoint(this._symbols[i1 - 1]) || 0];
														if (kernLeft) {
																kerning = kernLeft[string.getCodePoint(this._symbols[i1]) || 0] || 0;
														}
												}
										}
										dataScale = data.scale || 1;
										size = (data.width + data.height) / 2;
										quadsize = scale * size / dataScale;
										advance = (data.xadvance + kerning) * scale;
										x = (data.xoffset - kerning) * scale;
										y = data.yoffset * scale;
								} else {
										console.error("Couldn't substitute missing character: '" + char + "'");
								}
								var isWhitespace = WHITESPACE_CHAR.test(char);
								var meshInfoId = data && data.map || 0;
								var ratio = -this._font.data.info.maps[meshInfoId].width / this._font.data.info.maps[meshInfoId].height;
								var meshInfo = this._meshInfo[meshInfoId];
								var candidateLineWidth = _x + this._spacing * advance;
								if (candidateLineWidth > maxLineWidth && numCharsThisLine > 0 && !isWhitespace) {
										if (this._maxLines < 0 || lines < this._maxLines) {
												if (numWordsThisLine === 0) {
														wordStartIndex = i1;
														breakLine(this._symbols, i1, _xMinusTrailingWhitespace);
												} else {
														var backtrack = Math.max(i1 - wordStartIndex, 0);
														if (this._meshInfo.length <= 1) {
																meshInfo.lines[lines - 1] -= backtrack;
																meshInfo.quad -= backtrack;
														} else {
																var backtrackStart = wordStartIndex;
																var backtrackEnd = i1;
																for(var j = backtrackStart; j < backtrackEnd; j++){
																		var backChar = this._symbols[j];
																		var backCharData = json.chars[backChar];
																		var backMeshInfo = this._meshInfo[backCharData && backCharData.map || 0];
																		backMeshInfo.lines[lines - 1] -= 1;
																		backMeshInfo.quad -= 1;
																}
														}
														i1 -= backtrack + 1;
														breakLine(this._symbols, wordStartIndex, wordStartX);
														continue;
												}
										}
								}
								quad = meshInfo.quad;
								meshInfo.lines[lines - 1] = quad;
								var left = _x - x;
								var right = left + quadsize;
								var bottom = _y - y;
								var top = bottom + quadsize;
								if (this._rtl) {
										var shift = quadsize - x - this._spacing * advance - x;
										left -= shift;
										right -= shift;
								}
								meshInfo.positions[quad * 4 * 3 + 0] = left;
								meshInfo.positions[quad * 4 * 3 + 1] = bottom;
								meshInfo.positions[quad * 4 * 3 + 2] = _z;
								meshInfo.positions[quad * 4 * 3 + 3] = right;
								meshInfo.positions[quad * 4 * 3 + 4] = bottom;
								meshInfo.positions[quad * 4 * 3 + 5] = _z;
								meshInfo.positions[quad * 4 * 3 + 6] = right;
								meshInfo.positions[quad * 4 * 3 + 7] = top;
								meshInfo.positions[quad * 4 * 3 + 8] = _z;
								meshInfo.positions[quad * 4 * 3 + 9] = left;
								meshInfo.positions[quad * 4 * 3 + 10] = top;
								meshInfo.positions[quad * 4 * 3 + 11] = _z;
								this.width = Math.max(this.width, candidateLineWidth);
								var fontSize = undefined;
								if (this._shouldAutoFitWidth() && this.width > this._element.calculatedWidth) {
										fontSize = Math.floor(this._element.fontSize * this._element.calculatedWidth / (this.width || 0.0001));
										fontSize = math.clamp(fontSize, minFont, maxFont);
										if (fontSize !== this._element.fontSize) {
												this._fontSize = fontSize;
												retryUpdateMeshes = true;
												break;
										}
								}
								this.height = Math.max(this.height, fontMaxY - (_y + fontMinY));
								if (this._shouldAutoFitHeight() && this.height > this._element.calculatedHeight) {
										fontSize = math.clamp(this._fontSize - 1, minFont, maxFont);
										if (fontSize !== this._element.fontSize) {
												this._fontSize = fontSize;
												retryUpdateMeshes = true;
												break;
										}
								}
								_x += this._spacing * advance;
								if (!isWhitespace) {
										_xMinusTrailingWhitespace = _x;
								}
								if (this._isWordBoundary(char) || this._isValidNextChar(nextchar) && (this._isNextCJKBoundary(char, nextchar) || this._isNextCJKWholeWord(nextchar))) {
										numWordsThisLine++;
										wordStartX = _xMinusTrailingWhitespace;
										wordStartIndex = i1 + 1;
								}
								numCharsThisLine++;
								var uv = this._getUv(char);
								meshInfo.uvs[quad * 4 * 2 + 0] = uv[0];
								meshInfo.uvs[quad * 4 * 2 + 1] = 1.0 - uv[1];
								meshInfo.uvs[quad * 4 * 2 + 2] = uv[2];
								meshInfo.uvs[quad * 4 * 2 + 3] = 1.0 - uv[1];
								meshInfo.uvs[quad * 4 * 2 + 4] = uv[2];
								meshInfo.uvs[quad * 4 * 2 + 5] = 1.0 - uv[3];
								meshInfo.uvs[quad * 4 * 2 + 6] = uv[0];
								meshInfo.uvs[quad * 4 * 2 + 7] = 1.0 - uv[3];
								if (this._symbolColors) {
										var colorIdx = this._symbolColors[i1] * 3;
										color_r = this._colorPalette[colorIdx];
										color_g = this._colorPalette[colorIdx + 1];
										color_b = this._colorPalette[colorIdx + 2];
								}
								meshInfo.colors[quad * 4 * 4 + 0] = color_r;
								meshInfo.colors[quad * 4 * 4 + 1] = color_g;
								meshInfo.colors[quad * 4 * 4 + 2] = color_b;
								meshInfo.colors[quad * 4 * 4 + 3] = 255;
								meshInfo.colors[quad * 4 * 4 + 4] = color_r;
								meshInfo.colors[quad * 4 * 4 + 5] = color_g;
								meshInfo.colors[quad * 4 * 4 + 6] = color_b;
								meshInfo.colors[quad * 4 * 4 + 7] = 255;
								meshInfo.colors[quad * 4 * 4 + 8] = color_r;
								meshInfo.colors[quad * 4 * 4 + 9] = color_g;
								meshInfo.colors[quad * 4 * 4 + 10] = color_b;
								meshInfo.colors[quad * 4 * 4 + 11] = 255;
								meshInfo.colors[quad * 4 * 4 + 12] = color_r;
								meshInfo.colors[quad * 4 * 4 + 13] = color_g;
								meshInfo.colors[quad * 4 * 4 + 14] = color_b;
								meshInfo.colors[quad * 4 * 4 + 15] = 255;
								if (this._symbolOutlineParams) {
										var outlineIdx = this._symbolOutlineParams[i1] * 5;
										outline_color_rg = this._outlinePalette[outlineIdx] + this._outlinePalette[outlineIdx + 1] * 256;
										outline_color_ba = this._outlinePalette[outlineIdx + 2] + this._outlinePalette[outlineIdx + 3] * 256;
										outline_thickness = this._outlinePalette[outlineIdx + 4];
								}
								meshInfo.outlines[quad * 4 * 3 + 0] = outline_color_rg;
								meshInfo.outlines[quad * 4 * 3 + 1] = outline_color_ba;
								meshInfo.outlines[quad * 4 * 3 + 2] = outline_thickness;
								meshInfo.outlines[quad * 4 * 3 + 3] = outline_color_rg;
								meshInfo.outlines[quad * 4 * 3 + 4] = outline_color_ba;
								meshInfo.outlines[quad * 4 * 3 + 5] = outline_thickness;
								meshInfo.outlines[quad * 4 * 3 + 6] = outline_color_rg;
								meshInfo.outlines[quad * 4 * 3 + 7] = outline_color_ba;
								meshInfo.outlines[quad * 4 * 3 + 8] = outline_thickness;
								meshInfo.outlines[quad * 4 * 3 + 9] = outline_color_rg;
								meshInfo.outlines[quad * 4 * 3 + 10] = outline_color_ba;
								meshInfo.outlines[quad * 4 * 3 + 11] = outline_thickness;
								if (this._symbolShadowParams) {
										var shadowIdx = this._symbolShadowParams[i1] * 6;
										shadow_color_rg = this._shadowPalette[shadowIdx] + this._shadowPalette[shadowIdx + 1] * 256;
										shadow_color_ba = this._shadowPalette[shadowIdx + 2] + this._shadowPalette[shadowIdx + 3] * 256;
										shadow_offset_xy = this._shadowPalette[shadowIdx + 4] + 127 + Math.round(ratio * this._shadowPalette[shadowIdx + 5] + 127) * 256;
								}
								meshInfo.shadows[quad * 4 * 3 + 0] = shadow_color_rg;
								meshInfo.shadows[quad * 4 * 3 + 1] = shadow_color_ba;
								meshInfo.shadows[quad * 4 * 3 + 2] = shadow_offset_xy;
								meshInfo.shadows[quad * 4 * 3 + 3] = shadow_color_rg;
								meshInfo.shadows[quad * 4 * 3 + 4] = shadow_color_ba;
								meshInfo.shadows[quad * 4 * 3 + 5] = shadow_offset_xy;
								meshInfo.shadows[quad * 4 * 3 + 6] = shadow_color_rg;
								meshInfo.shadows[quad * 4 * 3 + 7] = shadow_color_ba;
								meshInfo.shadows[quad * 4 * 3 + 8] = shadow_offset_xy;
								meshInfo.shadows[quad * 4 * 3 + 9] = shadow_color_rg;
								meshInfo.shadows[quad * 4 * 3 + 10] = shadow_color_ba;
								meshInfo.shadows[quad * 4 * 3 + 11] = shadow_offset_xy;
								meshInfo.quad++;
						}
						if (retryUpdateMeshes) {
								continue;
						}
						if (lineStartIndex < l) {
								breakLine(this._symbols, l, _x);
						}
				}
				this._noResize = true;
				this.autoWidth = this._autoWidth;
				this.autoHeight = this._autoHeight;
				this._noResize = false;
				var hp = this._element.pivot.x;
				var vp = this._element.pivot.y;
				var ha = this._alignment.x;
				var va = this._alignment.y;
				for(var i2 = 0; i2 < this._meshInfo.length; i2++){
						if (this._meshInfo[i2].count === 0) continue;
						var prevQuad = 0;
						for(var line in this._meshInfo[i2].lines){
								var index = this._meshInfo[i2].lines[line];
								var lw = this._lineWidths[parseInt(line, 10)];
								var hoffset = -hp * this._element.calculatedWidth + ha * (this._element.calculatedWidth - lw) * (this._rtl ? -1 : 1);
								var voffset = (1 - vp) * this._element.calculatedHeight - fontMaxY - (1 - va) * (this._element.calculatedHeight - this.height);
								for(var quad1 = prevQuad; quad1 <= index; quad1++){
										this._meshInfo[i2].positions[quad1 * 4 * 3] += hoffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 3] += hoffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 6] += hoffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 9] += hoffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 1] += voffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 4] += voffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 7] += voffset;
										this._meshInfo[i2].positions[quad1 * 4 * 3 + 10] += voffset;
								}
								if (this._rtl) {
										for(var quad2 = prevQuad; quad2 <= index; quad2++){
												var idx = quad2 * 4 * 3;
												for(var vert = 0; vert < 4; ++vert){
														this._meshInfo[i2].positions[idx + vert * 3] = this._element.calculatedWidth - this._meshInfo[i2].positions[idx + vert * 3] + hoffset * 2;
												}
												var tmp0 = this._meshInfo[i2].positions[idx + 3];
												var tmp1 = this._meshInfo[i2].positions[idx + 6];
												this._meshInfo[i2].positions[idx + 3] = this._meshInfo[i2].positions[idx + 0];
												this._meshInfo[i2].positions[idx + 6] = this._meshInfo[i2].positions[idx + 9];
												this._meshInfo[i2].positions[idx + 0] = tmp0;
												this._meshInfo[i2].positions[idx + 9] = tmp1;
										}
								}
								prevQuad = index + 1;
						}
						var numVertices = this._meshInfo[i2].count * 4;
						var vertMax = this._meshInfo[i2].quad * 4;
						var it = new VertexIterator(this._meshInfo[i2].meshInstance.mesh.vertexBuffer);
						for(var v = 0; v < numVertices; v++){
								if (v >= vertMax) {
										it.element[SEMANTIC_POSITION].set(0, 0, 0);
										it.element[SEMANTIC_TEXCOORD0].set(0, 0);
										it.element[SEMANTIC_COLOR].set(0, 0, 0, 0);
										it.element[SEMANTIC_ATTR8].set(0, 0, 0, 0);
										it.element[SEMANTIC_ATTR9].set(0, 0, 0, 0);
								} else {
										it.element[SEMANTIC_POSITION].set(this._meshInfo[i2].positions[v * 3 + 0], this._meshInfo[i2].positions[v * 3 + 1], this._meshInfo[i2].positions[v * 3 + 2]);
										it.element[SEMANTIC_TEXCOORD0].set(this._meshInfo[i2].uvs[v * 2 + 0], this._meshInfo[i2].uvs[v * 2 + 1]);
										it.element[SEMANTIC_COLOR].set(this._meshInfo[i2].colors[v * 4 + 0], this._meshInfo[i2].colors[v * 4 + 1], this._meshInfo[i2].colors[v * 4 + 2], this._meshInfo[i2].colors[v * 4 + 3]);
										it.element[SEMANTIC_ATTR8].set(this._meshInfo[i2].outlines[v * 3 + 0], this._meshInfo[i2].outlines[v * 3 + 1], this._meshInfo[i2].outlines[v * 3 + 2]);
										it.element[SEMANTIC_ATTR9].set(this._meshInfo[i2].shadows[v * 3 + 0], this._meshInfo[i2].shadows[v * 3 + 1], this._meshInfo[i2].shadows[v * 3 + 2]);
								}
								it.next();
						}
						it.end();
						this._meshInfo[i2].meshInstance.mesh.aabb.compute(this._meshInfo[i2].positions);
						this._meshInfo[i2].meshInstance._aabbVer = -1;
				}
				this._aabbDirty = true;
		}
		_onFontRender() {
				this.font = this._font;
		}
		_onFontLoad(asset) {
				if (this.font !== asset.resource) {
						this.font = asset.resource;
				}
		}
		_onFontChange(asset, name, _new, _old) {
				if (name === 'data') {
						this._font.data = _new;
						var maps = this._font.data.info.maps.length;
						for(var i = 0; i < maps; i++){
								if (!this._meshInfo[i]) continue;
								var mi = this._meshInfo[i].meshInstance;
								if (mi) {
										mi.setParameter('font_sdfIntensity', this._font.intensity);
										mi.setParameter('font_pxrange', this._getPxRange(this._font));
										mi.setParameter('font_textureWidth', this._font.data.info.maps[i].width);
								}
						}
				}
		}
		_onFontRemove(asset) {}
		_setTextureParams(mi, texture) {
				if (this._font) {
						if (this._font.type === FONT_MSDF) {
								mi.deleteParameter('texture_emissiveMap');
								mi.deleteParameter('texture_opacityMap');
								mi.setParameter('texture_msdfMap', texture);
						} else if (this._font.type === FONT_BITMAP) {
								mi.deleteParameter('texture_msdfMap');
								mi.setParameter('texture_emissiveMap', texture);
								mi.setParameter('texture_opacityMap', texture);
						}
				}
		}
		_getPxRange(font) {
				var keys = Object.keys(this._font.data.chars);
				for(var i = 0; i < keys.length; i++){
						var char = this._font.data.chars[keys[i]];
						if (char.range) {
								return (char.scale || 1) * char.range;
						}
				}
				return 2;
		}
		_getUv(char) {
				var data = this._font.data;
				if (!data.chars[char]) {
						var space = ' ';
						if (data.chars[space]) {
								return this._getUv(space);
						}
						return [
								0,
								0,
								0,
								0
						];
				}
				var map = data.chars[char].map;
				var width = data.info.maps[map].width;
				var height = data.info.maps[map].height;
				var x = data.chars[char].x;
				var y = data.chars[char].y;
				var x1 = x;
				var y1 = y;
				var x2 = x + data.chars[char].width;
				var y2 = y - data.chars[char].height;
				var edge = 1 - data.chars[char].height / height;
				return [
						x1 / width,
						edge - y1 / height,
						x2 / width,
						edge - y2 / height
				];
		}
		onEnable() {
				this._fontAsset.autoLoad = true;
				if (this._model) {
						this._element.addModelToLayers(this._model);
				}
		}
		onDisable() {
				this._fontAsset.autoLoad = false;
				if (this._model) {
						this._element.removeModelFromLayers(this._model);
				}
		}
		_setStencil(stencilParams) {
				if (this._model) {
						var instances = this._model.meshInstances;
						for(var i = 0; i < instances.length; i++){
								instances[i].stencilFront = stencilParams;
								instances[i].stencilBack = stencilParams;
						}
				}
		}
		_shouldAutoFitWidth() {
				return this._autoFitWidth && !this._autoWidth;
		}
		_shouldAutoFitHeight() {
				return this._autoFitHeight && !this._autoHeight;
		}
		_shouldAutoFit() {
				return this._autoFitWidth && !this._autoWidth || this._autoFitHeight && !this._autoHeight;
		}
		_calculateCharsPerTexture(symbolIndex) {
				var charactersPerTexture = {};
				if (symbolIndex === undefined) {
						symbolIndex = this._symbols.length;
				}
				for(var i = 0, len = symbolIndex; i < len; i++){
						var char = this._symbols[i];
						var info = this._font.data.chars[char];
						if (!info) {
								info = this._font.data.chars[' '];
								if (!info) {
										info = this._font.data.chars[Object.keys(this._font.data.chars)[0]];
								}
						}
						var map = info.map;
						if (!charactersPerTexture[map]) {
								charactersPerTexture[map] = 1;
						} else {
								charactersPerTexture[map]++;
						}
				}
				return charactersPerTexture;
		}
		_updateRenderRange() {
				var startChars = this._rangeStart === 0 ? 0 : this._calculateCharsPerTexture(this._rangeStart);
				var endChars = this._rangeEnd === 0 ? 0 : this._calculateCharsPerTexture(this._rangeEnd);
				for(var i = 0, len = this._meshInfo.length; i < len; i++){
						var start = startChars[i] || 0;
						var end = endChars[i] || 0;
						var instance = this._meshInfo[i].meshInstance;
						if (instance) {
								var mesh = instance.mesh;
								if (mesh) {
										mesh.primitive[0].base = start * 3 * 2;
										mesh.primitive[0].count = (end - start) * 3 * 2;
								}
						}
				}
		}
		set text(value) {
				this._i18nKey = null;
				var str = value != null && value.toString() || '';
				this._setText(str);
		}
		get text() {
				return this._text;
		}
		set key(value) {
				var str = value !== null ? value.toString() : null;
				if (this._i18nKey === str) {
						return;
				}
				this._i18nKey = str;
				if (str) {
						this._fontAsset.disableLocalization = false;
						this._resetLocalizedText();
				} else {
						this._fontAsset.disableLocalization = true;
				}
		}
		get key() {
				return this._i18nKey;
		}
		set color(value) {
				var r = value.r;
				var g = value.g;
				var b = value.b;
				if (this._color.r === r && this._color.g === g && this._color.b === b) {
						return;
				}
				this._color.r = r;
				this._color.g = g;
				this._color.b = b;
				if (!this._model) {
						return;
				}
				if (this._symbolColors) {
						if (this._font) {
								this._updateText();
						}
				} else {
						_tempColor.linear(this._color);
						this._colorUniform[0] = _tempColor.r;
						this._colorUniform[1] = _tempColor.g;
						this._colorUniform[2] = _tempColor.b;
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								var mi = this._model.meshInstances[i];
								mi.setParameter('material_emissive', this._colorUniform);
						}
				}
				if (this._element) {
						this._element.fire('set:color', this._color);
				}
		}
		get color() {
				return this._color;
		}
		set opacity(value) {
				if (this._color.a !== value) {
						this._color.a = value;
						if (this._model) {
								for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
										var mi = this._model.meshInstances[i];
										mi.setParameter('material_opacity', value);
								}
						}
				}
				if (this._element) {
						this._element.fire('set:opacity', value);
				}
		}
		get opacity() {
				return this._color.a;
		}
		set lineHeight(value) {
				var _prev = this._lineHeight;
				this._lineHeight = value;
				this._scaledLineHeight = value;
				if (_prev !== value && this._font) {
						this._updateText();
				}
		}
		get lineHeight() {
				return this._lineHeight;
		}
		set wrapLines(value) {
				var _prev = this._wrapLines;
				this._wrapLines = value;
				if (_prev !== value && this._font) {
						this._updateText();
				}
		}
		get wrapLines() {
				return this._wrapLines;
		}
		get lines() {
				return this._lineContents;
		}
		set spacing(value) {
				var _prev = this._spacing;
				this._spacing = value;
				if (_prev !== value && this._font) {
						this._updateText();
				}
		}
		get spacing() {
				return this._spacing;
		}
		set fontSize(value) {
				var _prev = this._fontSize;
				this._fontSize = value;
				this._originalFontSize = value;
				if (_prev !== value && this._font) {
						this._updateText();
				}
		}
		get fontSize() {
				return this._fontSize;
		}
		set fontAsset(value) {
				this._fontAsset.defaultAsset = value;
		}
		get fontAsset() {
				return this._fontAsset.localizedAsset;
		}
		set font(value) {
				var previousFontType;
				if (this._font) {
						previousFontType = this._font.type;
						if (this._font.off) this._font.off('render', this._onFontRender, this);
				}
				this._font = value;
				this._fontMinY = 0;
				this._fontMaxY = 0;
				if (!value) return;
				var json = this._font.data;
				for(var charId in json.chars){
						var data = json.chars[charId];
						if (data.bounds) {
								this._fontMinY = Math.min(this._fontMinY, data.bounds[1]);
								this._fontMaxY = Math.max(this._fontMaxY, data.bounds[3]);
						}
				}
				if (this._font.on) this._font.on('render', this._onFontRender, this);
				if (this._fontAsset.localizedAsset) {
						var asset = this._system.app.assets.get(this._fontAsset.localizedAsset);
						if (asset.resource !== this._font) {
								this._fontAsset.defaultAsset = null;
						}
				}
				if (value.type !== previousFontType) {
						var screenSpace = this._element._isScreenSpace();
						this._updateMaterial(screenSpace);
				}
				for(var i = 0, len = this._font.textures.length; i < len; i++){
						if (!this._meshInfo[i]) {
								this._meshInfo[i] = new MeshInfo();
						} else {
								var mi = this._meshInfo[i].meshInstance;
								if (mi) {
										mi.setParameter('font_sdfIntensity', this._font.intensity);
										mi.setParameter('font_pxrange', this._getPxRange(this._font));
										mi.setParameter('font_textureWidth', this._font.data.info.maps[i].width);
										this._setTextureParams(mi, this._font.textures[i]);
								}
						}
				}
				var removedModel = false;
				for(var i1 = this._font.textures.length; i1 < this._meshInfo.length; i1++){
						if (this._meshInfo[i1].meshInstance) {
								if (!removedModel) {
										this._element.removeModelFromLayers(this._model);
										removedModel = true;
								}
								this._removeMeshInstance(this._meshInfo[i1].meshInstance);
						}
				}
				if (this._meshInfo.length > this._font.textures.length) {
						this._meshInfo.length = this._font.textures.length;
				}
				this._updateText();
		}
		get font() {
				return this._font;
		}
		set alignment(value) {
				if (value instanceof Vec2) {
						this._alignment.set(value.x, value.y);
				} else {
						this._alignment.set(value[0], value[1]);
				}
				if (this._font) {
						this._updateText();
				}
		}
		get alignment() {
				return this._alignment;
		}
		set autoWidth(value) {
				var old = this._autoWidth;
				this._autoWidth = value;
				if (value && Math.abs(this._element.anchor.x - this._element.anchor.z) < 0.0001) {
						this._element.width = this.width;
				}
				if (old !== value) {
						var newFontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
						if (newFontSize !== this._fontSize) {
								this._fontSize = newFontSize;
								if (this._font) {
										this._updateText();
								}
						}
				}
		}
		get autoWidth() {
				return this._autoWidth;
		}
		set autoHeight(value) {
				var old = this._autoHeight;
				this._autoHeight = value;
				if (value && Math.abs(this._element.anchor.y - this._element.anchor.w) < 0.0001) {
						this._element.height = this.height;
				}
				if (old !== value) {
						var newFontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
						if (newFontSize !== this._fontSize) {
								this._fontSize = newFontSize;
								if (this._font) {
										this._updateText();
								}
						}
				}
		}
		get autoHeight() {
				return this._autoHeight;
		}
		set rtlReorder(value) {
				if (this._rtlReorder !== value) {
						this._rtlReorder = value;
						if (this._font) {
								this._updateText();
						}
				}
		}
		get rtlReorder() {
				return this._rtlReorder;
		}
		set unicodeConverter(value) {
				if (this._unicodeConverter !== value) {
						this._unicodeConverter = value;
						this._setText(this._text);
				}
		}
		get unicodeConverter() {
				return this._unicodeConverter;
		}
		get aabb() {
				if (this._aabbDirty) {
						var initialized = false;
						for(var i = 0; i < this._meshInfo.length; i++){
								if (!this._meshInfo[i].meshInstance) continue;
								if (!initialized) {
										this._aabb.copy(this._meshInfo[i].meshInstance.aabb);
										initialized = true;
								} else {
										this._aabb.add(this._meshInfo[i].meshInstance.aabb);
								}
						}
						this._aabbDirty = false;
				}
				return this._aabb;
		}
		set outlineColor(value) {
				var r = value instanceof Color ? value.r : value[0];
				var g = value instanceof Color ? value.g : value[1];
				var b = value instanceof Color ? value.b : value[2];
				var a = value instanceof Color ? value.a : value[3];
				if (this._outlineColor.r === r && this._outlineColor.g === g && this._outlineColor.b === b && this._outlineColor.a === a) {
						return;
				}
				this._outlineColor.r = r;
				this._outlineColor.g = g;
				this._outlineColor.b = b;
				this._outlineColor.a = a;
				if (!this._model) {
						return;
				}
				if (this._symbolOutlineParams) {
						if (this._font) {
								this._updateText();
						}
				} else {
						_tempColor.linear(this._outlineColor);
						this._outlineColorUniform[0] = _tempColor.r;
						this._outlineColorUniform[1] = _tempColor.g;
						this._outlineColorUniform[2] = _tempColor.b;
						this._outlineColorUniform[3] = _tempColor.a;
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								var mi = this._model.meshInstances[i];
								mi.setParameter('outline_color', this._outlineColorUniform);
						}
				}
				if (this._element) {
						this._element.fire('set:outline', this._color);
				}
		}
		get outlineColor() {
				return this._outlineColor;
		}
		set outlineThickness(value) {
				var _prev = this._outlineThickness;
				this._outlineThickness = value;
				if (_prev !== value && this._font) {
						if (!this._model) {
								return;
						}
						if (this._symbolOutlineParams) {
								if (this._font) {
										this._updateText();
								}
						} else {
								for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
										var mi = this._model.meshInstances[i];
										mi.setParameter('outline_thickness', this._outlineThicknessScale * this._outlineThickness);
								}
						}
				}
		}
		get outlineThickness() {
				return this._outlineThickness;
		}
		set shadowColor(value) {
				var r = value instanceof Color ? value.r : value[0];
				var g = value instanceof Color ? value.g : value[1];
				var b = value instanceof Color ? value.b : value[2];
				var a = value instanceof Color ? value.a : value[3];
				if (this._shadowColor.r === r && this._shadowColor.g === g && this._shadowColor.b === b && this._shadowColor.a === a) {
						return;
				}
				this._shadowColor.r = r;
				this._shadowColor.g = g;
				this._shadowColor.b = b;
				this._shadowColor.a = a;
				if (!this._model) {
						return;
				}
				if (this._symbolShadowParams) {
						if (this._font) {
								this._updateText();
						}
				} else {
						_tempColor.linear(this._shadowColor);
						this._shadowColorUniform[0] = _tempColor.r;
						this._shadowColorUniform[1] = _tempColor.g;
						this._shadowColorUniform[2] = _tempColor.b;
						this._shadowColorUniform[3] = _tempColor.a;
						for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
								var mi = this._model.meshInstances[i];
								mi.setParameter('shadow_color', this._shadowColorUniform);
						}
				}
		}
		get shadowColor() {
				return this._shadowColor;
		}
		set shadowOffset(value) {
				var x = value instanceof Vec2 ? value.x : value[0], y = value instanceof Vec2 ? value.y : value[1];
				if (this._shadowOffset.x === x && this._shadowOffset.y === y) {
						return;
				}
				this._shadowOffset.set(x, y);
				if (this._font && this._model) {
						if (this._symbolShadowParams) {
								this._updateText();
						} else {
								for(var i = 0, len = this._model.meshInstances.length; i < len; i++){
										var ratio = -this._font.data.info.maps[i].width / this._font.data.info.maps[i].height;
										this._shadowOffsetUniform[0] = this._shadowOffsetScale * this._shadowOffset.x;
										this._shadowOffsetUniform[1] = ratio * this._shadowOffsetScale * this._shadowOffset.y;
										var mi = this._model.meshInstances[i];
										mi.setParameter('shadow_offset', this._shadowOffsetUniform);
								}
						}
				}
		}
		get shadowOffset() {
				return this._shadowOffset;
		}
		set minFontSize(value) {
				if (this._minFontSize === value) return;
				this._minFontSize = value;
				if (this.font && this._shouldAutoFit()) {
						this._updateText();
				}
		}
		get minFontSize() {
				return this._minFontSize;
		}
		set maxFontSize(value) {
				if (this._maxFontSize === value) return;
				this._maxFontSize = value;
				if (this.font && this._shouldAutoFit()) {
						this._updateText();
				}
		}
		get maxFontSize() {
				return this._maxFontSize;
		}
		set autoFitWidth(value) {
				if (this._autoFitWidth === value) return;
				this._autoFitWidth = value;
				this._fontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
				if (this.font) {
						this._updateText();
				}
		}
		get autoFitWidth() {
				return this._autoFitWidth;
		}
		set autoFitHeight(value) {
				if (this._autoFitHeight === value) return;
				this._autoFitHeight = value;
				this._fontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
				if (this.font) {
						this._updateText();
				}
		}
		get autoFitHeight() {
				return this._autoFitHeight;
		}
		set maxLines(value) {
				if (this._maxLines === value) return;
				if (value === null && this._maxLines === -1) return;
				this._maxLines = value === null ? -1 : value;
				if (this.font && this._wrapLines) {
						this._updateText();
				}
		}
		get maxLines() {
				return this._maxLines;
		}
		set enableMarkup(value) {
				value = !!value;
				if (this._enableMarkup === value) return;
				this._enableMarkup = value;
				if (this.font) {
						this._updateText();
				}
				var screenSpace = this._element._isScreenSpace();
				this._updateMaterial(screenSpace);
		}
		get enableMarkup() {
				return this._enableMarkup;
		}
		get symbols() {
				return this._symbols;
		}
		get symbolColors() {
				if (this._symbolColors === null) {
						return null;
				}
				return this._symbolColors.map(function(c) {
						return this._colorPalette.slice(c * 3, c * 3 + 3);
				}, this);
		}
		get symbolOutlineParams() {
				if (this._symbolOutlineParams === null) {
						return null;
				}
				return this._symbolOutlineParams.map(function(paramId) {
						return this._outlinePalette.slice(paramId * 5, paramId * 5 + 5);
				}, this);
		}
		get symbolShadowParams() {
				if (this._symbolShadowParams === null) {
						return null;
				}
				return this._symbolShadowParams.map(function(paramId) {
						return this._shadowPalette.slice(paramId * 6, paramId * 6 + 6);
				}, this);
		}
		get rtl() {
				return this._rtl;
		}
		set rangeStart(rangeStart) {
				rangeStart = Math.max(0, Math.min(rangeStart, this._symbols.length));
				if (rangeStart !== this._rangeStart) {
						this._rangeStart = rangeStart;
						this._updateRenderRange();
				}
		}
		get rangeStart() {
				return this._rangeStart;
		}
		set rangeEnd(rangeEnd) {
				rangeEnd = Math.max(this._rangeStart, Math.min(rangeEnd, this._symbols.length));
				if (rangeEnd !== this._rangeEnd) {
						this._rangeEnd = rangeEnd;
						this._updateRenderRange();
				}
		}
		get rangeEnd() {
				return this._rangeEnd;
		}
		constructor(element){
				this._element = element;
				this._system = element.system;
				this._entity = element.entity;
				this._text = '';
				this._symbols = [];
				this._colorPalette = [];
				this._outlinePalette = [];
				this._shadowPalette = [];
				this._symbolColors = null;
				this._symbolOutlineParams = null;
				this._symbolShadowParams = null;
				this._i18nKey = null;
				this._fontAsset = new LocalizedAsset(this._system.app);
				this._fontAsset.disableLocalization = true;
				this._fontAsset.on('load', this._onFontLoad, this);
				this._fontAsset.on('change', this._onFontChange, this);
				this._fontAsset.on('remove', this._onFontRemove, this);
				this._font = null;
				this._color = new Color(1, 1, 1, 1);
				this._colorUniform = new Float32Array(3);
				this._spacing = 1;
				this._fontSize = 32;
				this._fontMinY = 0;
				this._fontMaxY = 0;
				this._originalFontSize = 32;
				this._maxFontSize = 32;
				this._minFontSize = 8;
				this._autoFitWidth = false;
				this._autoFitHeight = false;
				this._maxLines = -1;
				this._lineHeight = 32;
				this._scaledLineHeight = 32;
				this._wrapLines = false;
				this._drawOrder = 0;
				this._alignment = new Vec2(0.5, 0.5);
				this._autoWidth = true;
				this._autoHeight = true;
				this.width = 0;
				this.height = 0;
				this._node = new GraphNode();
				this._model = new Model();
				this._model.graph = this._node;
				this._entity.addChild(this._node);
				this._meshInfo = [];
				this._material = null;
				this._aabbDirty = true;
				this._aabb = new BoundingBox();
				this._noResize = false;
				this._currentMaterialType = null;
				this._maskedMaterialSrc = null;
				this._rtlReorder = false;
				this._unicodeConverter = false;
				this._rtl = false;
				this._outlineColor = new Color(0, 0, 0, 1);
				this._outlineColorUniform = new Float32Array(4);
				this._outlineThicknessScale = 0.2;
				this._outlineThickness = 0.0;
				this._shadowColor = new Color(0, 0, 0, 1);
				this._shadowColorUniform = new Float32Array(4);
				this._shadowOffsetScale = 0.005;
				this._shadowOffset = new Vec2(0, 0);
				this._shadowOffsetUniform = new Float32Array(2);
				this._enableMarkup = false;
				this._onScreenChange(this._element.screen);
				element.on('resize', this._onParentResize, this);
				element.on('set:screen', this._onScreenChange, this);
				element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
				element.on('set:draworder', this._onDrawOrderChange, this);
				element.on('set:pivot', this._onPivotChange, this);
				this._system.app.i18n.on('set:locale', this._onLocaleSet, this);
				this._system.app.i18n.on('data:add', this._onLocalizationData, this);
				this._system.app.i18n.on('data:remove', this._onLocalizationData, this);
				this._rangeStart = 0;
				this._rangeEnd = 0;
		}
}

export { TextElement };
