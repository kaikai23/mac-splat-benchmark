import { SHADER_FORWARD, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, FRESNEL_SCHLICK, BLEND_NONE, DITHER_NONE, DITHER_BAYER8 } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { LitShader } from './lit-shader.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ChunkUtils } from '../chunk-utils.js';
import { StandardMaterialOptions } from '../../materials/standard-material-options.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';

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
var _matTex2D = [];
var buildPropertiesList = (options)=>{
		return Object.keys(options).filter((key)=>key !== 'litOptions').sort();
};
class ShaderGeneratorStandard extends ShaderGenerator {
		generateKey(options) {
				var props;
				if (options === this.optionsContextMin) {
						if (!this.propsMin) this.propsMin = buildPropertiesList(options);
						props = this.propsMin;
				} else if (options === this.optionsContext) {
						if (!this.props) this.props = buildPropertiesList(options);
						props = this.props;
				} else {
						props = buildPropertiesList(options);
				}
				var definesHash = ShaderGenerator.definesHash(options.defines);
				var key = "standard:\n" + definesHash + "\n" + props.map((prop)=>prop + options[prop]).join('\n') + LitOptionsUtils.generateKey(options.litOptions);
				return key;
		}
		_getUvSourceExpression(transformPropName, uVPropName, options) {
				var transformId = options[transformPropName];
				var uvChannel = options[uVPropName];
				var isMainPass = options.litOptions.pass === SHADER_FORWARD;
				var expression;
				if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
						expression = 'nineSlicedUv';
				} else if (isMainPass && options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
						expression = 'nineSlicedUv';
				} else {
						if (transformId === 0) {
								expression = "vUv" + uvChannel;
						} else {
								expression = "vUV" + uvChannel + "_" + transformId;
						}
						if (options.heightMap && transformPropName !== 'heightMapTransform') {
								expression += ' + dUvOffset';
						}
				}
				return expression;
		}
		_addMapDef(name, enabled) {
				return enabled ? "#define " + name + "\n" : "#undef " + name + "\n";
		}
		_addMapDefs(float, color, vertex, map, invert) {
				return this._addMapDef('MAPFLOAT', float) + this._addMapDef('MAPCOLOR', color) + this._addMapDef('MAPVERTEX', vertex) + this._addMapDef('MAPTEXTURE', map) + this._addMapDef('MAPINVERT', invert);
		}
		_addMap(propName, chunkName, options, chunks, mapping, encoding) {
				if (encoding === undefined) encoding = null;
				var mapPropName = "" + propName + "Map";
				var uVPropName = "" + mapPropName + "Uv";
				var identifierPropName = "" + mapPropName + "Identifier";
				var transformPropName = "" + mapPropName + "Transform";
				var channelPropName = "" + mapPropName + "Channel";
				var vertexColorChannelPropName = "" + propName + "VertexColorChannel";
				var tintPropName = "" + propName + "Tint";
				var vertexColorPropName = "" + propName + "VertexColor";
				var detailModePropName = "" + propName + "Mode";
				var invertName = "" + propName + "Invert";
				var tintOption = options[tintPropName];
				var vertexColorOption = options[vertexColorPropName];
				var textureOption = options[mapPropName];
				var textureIdentifier = options[identifierPropName];
				var detailModeOption = options[detailModePropName];
				var subCode = chunks[chunkName];
				if (textureOption) {
						var uv = this._getUvSourceExpression(transformPropName, uVPropName, options);
						subCode = subCode.replace(/\$UV/g, uv).replace(/\$CH/g, options[channelPropName]);
						if (mapping && subCode.search(/\$SAMPLER/g) !== -1) {
								var samplerName = "texture_" + mapPropName;
								var alias = mapping[textureIdentifier];
								if (alias) {
										samplerName = alias;
								} else {
										mapping[textureIdentifier] = samplerName;
								}
								subCode = subCode.replace(/\$SAMPLER/g, samplerName);
						}
						if (encoding) {
								if (options[channelPropName] === 'aaa') {
										subCode = subCode.replace(/\$DECODE/g, 'passThrough');
								} else {
										subCode = subCode.replace(/\$DECODE/g, ChunkUtils.decodeFunc(encoding));
								}
								if (subCode.indexOf('$texture2DSAMPLE')) {
										var decodeTable = {
												linear: 'texture2D',
												srgb: 'texture2DSRGB',
												rgbm: 'texture2DRGBM',
												rgbe: 'texture2DRGBE'
										};
										subCode = subCode.replace(/\$texture2DSAMPLE/g, decodeTable[encoding] || 'texture2D');
								}
						}
				}
				if (vertexColorOption) {
						subCode = subCode.replace(/\$VC/g, options[vertexColorChannelPropName]);
				}
				if (detailModeOption) {
						subCode = subCode.replace(/\$DETAILMODE/g, detailModeOption);
				}
				var isFloatTint = !!(tintOption & 1);
				var isVecTint = !!(tintOption & 2);
				var invertOption = !!options[invertName];
				subCode = this._addMapDefs(isFloatTint, isVecTint, vertexColorOption, textureOption, invertOption) + subCode;
				return subCode.replace(/\$/g, '');
		}
		_correctChannel(p, chan, _matTex2D) {
				if (_matTex2D[p] > 0) {
						if (_matTex2D[p] < chan.length) {
								return chan.substring(0, _matTex2D[p]);
						} else if (_matTex2D[p] > chan.length) {
								var str = chan;
								var chr = str.charAt(str.length - 1);
								var addLen = _matTex2D[p] - str.length;
								for(var i = 0; i < addLen; i++)str += chr;
								return str;
						}
						return chan;
				}
		}
		createShaderDefinition(device, options) {
				var shaderPassInfo = ShaderPass.get(device).getByIndex(options.litOptions.pass);
				var isForwardPass = shaderPassInfo.isForward;
				var litShader = new LitShader(device, options.litOptions);
				var useUv = [];
				var useUnmodifiedUv = [];
				var mapTransforms = [];
				var maxUvSets = 2;
				var textureMapping = {};
				for(var p in _matTex2D){
						var mname = "" + p + "Map";
						if (options["" + p + "VertexColor"]) {
								var cname = "" + p + "VertexColorChannel";
								options[cname] = this._correctChannel(p, options[cname], _matTex2D);
						}
						if (options[mname]) {
								var cname1 = "" + mname + "Channel";
								var tname = "" + mname + "Transform";
								var uname = "" + mname + "Uv";
								options[uname] = Math.min(options[uname], maxUvSets - 1);
								options[cname1] = this._correctChannel(p, options[cname1], _matTex2D);
								var uvSet = options[uname];
								useUv[uvSet] = true;
								useUnmodifiedUv[uvSet] = useUnmodifiedUv[uvSet] || options[mname] && !options[tname];
								if (options[tname]) {
										mapTransforms.push({
												name: p,
												id: options[tname],
												uv: options[uname]
										});
								}
						}
				}
				if (options.forceUv1) {
						useUv[1] = true;
						useUnmodifiedUv[1] = useUnmodifiedUv[1] !== undefined ? useUnmodifiedUv[1] : true;
				}
				litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);
				options.litOptions.fresnelModel = options.litOptions.fresnelModel === 0 ? FRESNEL_SCHLICK : options.litOptions.fresnelModel;
				var decl = new ChunkBuilder();
				var code = new ChunkBuilder();
				var func = new ChunkBuilder();
				var args = new ChunkBuilder();
				var lightingUv = '';
				if (options.litOptions.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
						decl.append('const float textureBias = -1000.0;');
				} else {
						decl.append('uniform float textureBias;');
				}
				if (isForwardPass) {
						if (options.heightMap) {
								decl.append('vec2 dUvOffset;');
								code.append(this._addMap('height', 'parallaxPS', options, litShader.chunks, textureMapping));
								func.append('getParallax();');
						}
						if (options.litOptions.blendType !== BLEND_NONE || options.litOptions.alphaTest || options.litOptions.alphaToCoverage || options.litOptions.opacityDither !== DITHER_NONE) {
								decl.append('float dAlpha;');
								code.append(this._addMap('opacity', 'opacityPS', options, litShader.chunks, textureMapping));
								func.append('getOpacity();');
								args.append('litArgs_opacity = dAlpha;');
								if (options.litOptions.alphaTest) {
										code.append(litShader.chunks.alphaTestPS);
										func.append('alphaTest(dAlpha);');
								}
								var opacityDither = options.litOptions.opacityDither;
								if (opacityDither !== DITHER_NONE) {
										if (opacityDither === DITHER_BAYER8) {
												decl.append(litShader.chunks.bayerPS);
										}
										decl.append("#define DITHER_" + opacityDither.toUpperCase() + "\n");
										decl.append(litShader.chunks.opacityDitherPS);
										func.append('opacityDither(dAlpha, 0.0);');
								}
						} else {
								decl.append('float dAlpha = 1.0;');
						}
						if (litShader.needsNormal) {
								if (options.normalMap || options.clearCoatNormalMap) {
										code.append(options.packedNormal ? litShader.chunks.normalXYPS : litShader.chunks.normalXYZPS);
										if (!options.litOptions.hasTangents) {
												var baseName = options.normalMap ? 'normalMap' : 'clearCoatNormalMap';
												lightingUv = this._getUvSourceExpression("" + baseName + "Transform", "" + baseName + "Uv", options);
										}
								}
								decl.append('vec3 dNormalW;');
								code.append(this._addMap('normalDetail', 'normalDetailMapPS', options, litShader.chunks, textureMapping));
								code.append(this._addMap('normal', 'normalMapPS', options, litShader.chunks, textureMapping));
								func.append('getNormal();');
								args.append('litArgs_worldNormal = dNormalW;');
						}
						if (litShader.needsSceneColor) {
								decl.append('uniform sampler2D uSceneColorMap;');
						}
						if (litShader.needsScreenSize) {
								decl.append('uniform vec4 uScreenSize;');
						}
						if (litShader.needsTransforms) {
								decl.append('uniform mat4 matrix_viewProjection;');
								decl.append('uniform mat4 matrix_model;');
						}
						if (options.diffuseDetail || options.aoDetail) {
								code.append(litShader.chunks.detailModesPS);
						}
						decl.append('vec3 dAlbedo;');
						if (options.diffuseDetail) {
								code.append(this._addMap('diffuseDetail', 'diffuseDetailMapPS', options, litShader.chunks, textureMapping, options.diffuseDetailEncoding));
						}
						code.append(this._addMap('diffuse', 'diffusePS', options, litShader.chunks, textureMapping, options.diffuseEncoding));
						func.append('getAlbedo();');
						args.append('litArgs_albedo = dAlbedo;');
						if (options.litOptions.useRefraction) {
								decl.append('float dTransmission;');
								code.append(this._addMap('refraction', 'transmissionPS', options, litShader.chunks, textureMapping));
								func.append('getRefraction();');
								args.append('litArgs_transmission = dTransmission;');
								decl.append('float dThickness;');
								code.append(this._addMap('thickness', 'thicknessPS', options, litShader.chunks, textureMapping));
								func.append('getThickness();');
								args.append('litArgs_thickness = dThickness;');
								if (options.litOptions.dispersion) {
										args.append('litArgs_dispersion = material_dispersion;');
								}
						}
						if (options.litOptions.useIridescence) {
								decl.append('float dIridescence;');
								code.append(this._addMap('iridescence', 'iridescencePS', options, litShader.chunks, textureMapping));
								func.append('getIridescence();');
								args.append('litArgs_iridescence_intensity = dIridescence;');
								decl.append('float dIridescenceThickness;');
								code.append(this._addMap('iridescenceThickness', 'iridescenceThicknessPS', options, litShader.chunks, textureMapping));
								func.append('getIridescenceThickness();');
								args.append('litArgs_iridescence_thickness = dIridescenceThickness;');
						}
						if (litShader.lighting && options.litOptions.useSpecular || litShader.reflections) {
								decl.append('vec3 dSpecularity;');
								decl.append('float dGlossiness;');
								if (options.litOptions.useSheen) {
										decl.append('vec3 sSpecularity;');
										code.append(this._addMap('sheen', 'sheenPS', options, litShader.chunks, textureMapping, options.sheenEncoding));
										func.append('getSheen();');
										args.append('litArgs_sheen_specularity = sSpecularity;');
										decl.append('float sGlossiness;');
										code.append(this._addMap('sheenGloss', 'sheenGlossPS', options, litShader.chunks, textureMapping));
										func.append('getSheenGlossiness();');
										args.append('litArgs_sheen_gloss = sGlossiness;');
								}
								if (options.litOptions.useMetalness) {
										decl.append('float dMetalness;');
										code.append(this._addMap('metalness', 'metalnessPS', options, litShader.chunks, textureMapping));
										func.append('getMetalness();');
										args.append('litArgs_metalness = dMetalness;');
										decl.append('float dIor;');
										code.append(this._addMap('ior', 'iorPS', options, litShader.chunks, textureMapping));
										func.append('getIor();');
										args.append('litArgs_ior = dIor;');
								}
								if (options.litOptions.useSpecularityFactor) {
										decl.append('float dSpecularityFactor;');
										code.append(this._addMap('specularityFactor', 'specularityFactorPS', options, litShader.chunks, textureMapping));
										func.append('getSpecularityFactor();');
										args.append('litArgs_specularityFactor = dSpecularityFactor;');
								}
								if (options.useSpecularColor) {
										code.append(this._addMap('specular', 'specularPS', options, litShader.chunks, textureMapping, options.specularEncoding));
								} else {
										code.append('void getSpecularity() { dSpecularity = vec3(1); }');
								}
								code.append(this._addMap('gloss', 'glossPS', options, litShader.chunks, textureMapping));
								func.append('getGlossiness();');
								func.append('getSpecularity();');
								args.append('litArgs_specularity = dSpecularity;');
								args.append('litArgs_gloss = dGlossiness;');
						} else {
								decl.append('vec3 dSpecularity = vec3(0.0);');
								decl.append('float dGlossiness = 0.0;');
						}
						if (options.aoDetail) {
								code.append(this._addMap('aoDetail', 'aoDetailMapPS', options, litShader.chunks, textureMapping));
						}
						if (options.aoMap || options.aoVertexColor || options.useAO) {
								decl.append('float dAo;');
								code.append(this._addMap('ao', 'aoPS', options, litShader.chunks, textureMapping));
								func.append('getAO();');
								args.append('litArgs_ao = dAo;');
						}
						decl.append('vec3 dEmission;');
						code.append(this._addMap('emissive', 'emissivePS', options, litShader.chunks, textureMapping, options.emissiveEncoding));
						func.append('getEmission();');
						args.append('litArgs_emission = dEmission;');
						if (options.litOptions.useClearCoat) {
								decl.append('float ccSpecularity;');
								decl.append('float ccGlossiness;');
								decl.append('vec3 ccNormalW;');
								code.append(this._addMap('clearCoat', 'clearCoatPS', options, litShader.chunks, textureMapping));
								code.append(this._addMap('clearCoatGloss', 'clearCoatGlossPS', options, litShader.chunks, textureMapping));
								code.append(this._addMap('clearCoatNormal', 'clearCoatNormalPS', options, litShader.chunks, textureMapping));
								func.append('getClearCoat();');
								func.append('getClearCoatGlossiness();');
								func.append('getClearCoatNormal();');
								args.append('litArgs_clearcoat_specularity = ccSpecularity;');
								args.append('litArgs_clearcoat_gloss = ccGlossiness;');
								args.append('litArgs_clearcoat_worldNormal = ccNormalW;');
						}
						if (options.lightMap || options.lightVertexColor) {
								var lightmapDir = options.dirLightMap && options.litOptions.useSpecular;
								var lightmapChunkPropName = lightmapDir ? 'lightmapDirPS' : 'lightmapSinglePS';
								decl.append('vec3 dLightmap;');
								if (lightmapDir) {
										decl.append('vec3 dLightmapDir;');
								}
								code.append(this._addMap('light', lightmapChunkPropName, options, litShader.chunks, textureMapping, options.lightMapEncoding));
								func.append('getLightMap();');
								args.append('litArgs_lightmap = dLightmap;');
								if (lightmapDir) {
										args.append('litArgs_lightmapDir = dLightmapDir;');
								}
						}
				} else {
						var opacityShadowDither = options.litOptions.opacityShadowDither;
						if (options.litOptions.alphaTest || opacityShadowDither) {
								decl.append('float dAlpha;');
								code.append(this._addMap('opacity', 'opacityPS', options, litShader.chunks, textureMapping));
								func.append('getOpacity();');
								args.append('litArgs_opacity = dAlpha;');
								if (options.litOptions.alphaTest) {
										code.append(litShader.chunks.alphaTestPS);
										func.append('alphaTest(dAlpha);');
								}
								if (opacityShadowDither !== DITHER_NONE) {
										if (opacityShadowDither === DITHER_BAYER8) {
												decl.append(litShader.chunks.bayerPS);
										}
										decl.append("#define DITHER_" + opacityShadowDither.toUpperCase() + "\n");
										decl.append(litShader.chunks.opacityDitherPS);
										func.append('opacityDither(dAlpha, 0.0);');
								}
						}
				}
				decl.append(litShader.chunks.litShaderArgsPS);
				code.append("void evaluateFrontend() { \n" + func.code + "\n" + args.code + "\n }\n");
				func.code = 'evaluateFrontend();';
				for(var texture in textureMapping){
						decl.append("uniform sampler2D " + textureMapping[texture] + ";");
				}
				func.code = "\n" + func.code.split('\n').map((l)=>"    " + l).join('\n') + "\n\n";
				litShader.generateFragmentShader(decl.code, code.code, func.code, lightingUv);
				var includes = new Map(Object.entries(_extends({}, Object.getPrototypeOf(litShader.chunks), litShader.chunks, options.litOptions.chunks)));
				var defines = new Map(options.defines);
				var definition = ShaderUtils.createDefinition(device, {
						name: 'StandardShader',
						attributes: litShader.attributes,
						vertexCode: litShader.vshader,
						fragmentCode: litShader.fshader,
						vertexIncludes: includes,
						fragmentIncludes: includes,
						fragmentDefines: defines,
						vertexDefines: defines
				});
				if (litShader.shaderPassInfo.isForward) {
						definition.tag = SHADERTAG_MATERIAL;
				}
				return definition;
		}
		constructor(...args){
				super(...args), this.optionsContext = new StandardMaterialOptions(), this.optionsContextMin = new StandardMaterialOptions();
		}
}
var standard = new ShaderGeneratorStandard();

export { _matTex2D, standard };
