import { SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../../platform/graphics/constants.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LIGHTSHAPE_SPHERE, LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, LIGHTTYPE_DIRECTIONAL, shadowTypeInfo, SHADOW_PCSS_32F, LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI, FRESNEL_SCHLICK, SPECOCC_GLOSSDEPENDENT, SPECOCC_AO, SHADOW_PCF3_32F, SHADOW_PCF5_32F, SHADOW_PCF1_32F, SHADOW_PCF1_16F, SHADOW_PCF3_16F, SHADOW_PCF5_16F, SHADOW_VSM_16F, SHADOW_VSM_32F, LIGHTFALLOFF_LINEAR, BLEND_NORMAL, BLEND_PREMULTIPLIED, BLEND_ADDITIVEALPHA, SHADER_PICK, SHADER_DEPTH, SHADER_PREPASS } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';
import { LightsBuffer } from '../../lighting/lights-buffer.js';
import { ShaderPass } from '../../shader-pass.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { ShaderGenerator } from './shader-generator.js';

var builtinAttributes = {
		vertex_normal: SEMANTIC_NORMAL,
		vertex_tangent: SEMANTIC_TANGENT,
		vertex_texCoord0: SEMANTIC_TEXCOORD0,
		vertex_texCoord1: SEMANTIC_TEXCOORD1,
		vertex_color: SEMANTIC_COLOR,
		vertex_boneWeights: SEMANTIC_BLENDWEIGHT,
		vertex_boneIndices: SEMANTIC_BLENDINDICES
};
var builtinVaryings = {
		vVertexColor: 'vec4',
		vPositionW: 'vec3',
		vNormalV: 'vec3',
		vNormalW: 'vec3',
		vTangentW: 'vec3',
		vBinormalW: 'vec3',
		vObjectSpaceUpW: 'vec3',
		vUv0: 'vec2',
		vUv1: 'vec2',
		vLinearDepth: 'float'
};
class LitShader {
		_vsAddBaseCode(code, chunks, options) {
				code += chunks.baseVS;
				if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED || options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
						code += chunks.baseNineSlicedVS;
				}
				return code;
		}
		_setMapTransform(codes, name, id, uv) {
				var checkId = id + uv * 100;
				if (!codes[3][checkId]) {
						var varName = "texture_" + name + "MapTransform";
						codes[0] += "uniform vec3 " + varName + "0;\n";
						codes[0] += "uniform vec3 " + varName + "1;\n";
						codes[1] += "varying vec2 vUV" + uv + "_" + id + ";\n";
						codes[2] += "   vUV" + uv + "_" + id + " = vec2(dot(vec3(uv" + uv + ", 1), " + varName + "0), dot(vec3(uv" + uv + ", 1), " + varName + "1));\n";
						codes[3][checkId] = true;
				}
				return codes;
		}
		_fsGetBaseCode() {
				var options = this.options;
				var chunks = this.chunks;
				var result = this.chunks.basePS;
				if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
						result += chunks.baseNineSlicedPS;
				} else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
						result += chunks.baseNineSlicedTiledPS;
				}
				return result;
		}
		_fsGetStartCode(code, device, chunks, options) {
				var result = chunks.startPS;
				if (options.nineSlicedMode === SPRITE_RENDERMODE_SLICED) {
						result += chunks.startNineSlicedPS;
				} else if (options.nineSlicedMode === SPRITE_RENDERMODE_TILED) {
						result += chunks.startNineSlicedTiledPS;
				}
				return result;
		}
		_getLightSourceShapeString(shape) {
				switch(shape){
						case LIGHTSHAPE_RECT:
								return 'Rect';
						case LIGHTSHAPE_DISK:
								return 'Disk';
						case LIGHTSHAPE_SPHERE:
								return 'Sphere';
						default:
								return '';
				}
		}
		generateVertexShader(useUv, useUnmodifiedUv, mapTransforms) {
				var device = this.device;
				var options = this.options;
				var chunks = this.chunks;
				var code = '';
				var codeBody = '';
				var codeDefines = '';
				code = this._vsAddBaseCode(code, chunks, options);
				codeBody += '   vPositionW = getWorldPosition();\n';
				if (this.options.linearDepth) {
						codeDefines += "\n                #ifndef VIEWMATRIX\n                #define VIEWMATRIX\n                    uniform mat4 matrix_view;\n                #endif\n            ";
						codeBody += "\n                // linear depth from the worldPosition, see getLinearDepth\n                vLinearDepth = -(matrix_view * vec4(vPositionW, 1.0)).z;\n            ";
				}
				if (this.options.useInstancing) {
						if (this.chunks.transformInstancingVS === shaderChunks.transformInstancingVS) {
								this.attributes.instance_line1 = SEMANTIC_ATTR12;
								this.attributes.instance_line2 = SEMANTIC_ATTR13;
								this.attributes.instance_line3 = SEMANTIC_ATTR14;
								this.attributes.instance_line4 = SEMANTIC_ATTR15;
						}
				}
				code += chunks.transformVS;
				if (this.needsNormal) {
						code += chunks.normalCoreVS;
						code += chunks.normalVS;
				}
				if (this.needsNormal) {
						this.attributes.vertex_normal = SEMANTIC_NORMAL;
						codeBody += '   vNormalW = getNormal();\n';
						if (options.reflectionSource === 'sphereMap' && device.fragmentUniformsCount <= 16) {
								code += chunks.viewNormalVS;
								codeBody += '   vNormalV    = getViewNormal();\n';
						}
						if (options.hasTangents && (options.useHeights || options.useNormals || options.enableGGXSpecular)) {
								this.attributes.vertex_tangent = SEMANTIC_TANGENT;
								code += chunks.tangentBinormalVS;
								codeBody += '   vTangentW   = getTangent();\n';
								codeBody += '   vBinormalW  = getBinormal();\n';
						} else if (options.enableGGXSpecular) {
								codeBody += '   vObjectSpaceUpW = normalize(dNormalMatrix * vec3(0, 1, 0));\n';
						}
				}
				var maxUvSets = 2;
				for(var i = 0; i < maxUvSets; i++){
						if (useUv[i]) {
								this.attributes["vertex_texCoord" + i] = "TEXCOORD" + i;
								code += chunks["uv" + i + "VS"];
								codeBody += "   vec2 uv" + i + " = getUv" + i + "();\n";
						}
						if (useUnmodifiedUv[i]) {
								codeBody += "   vUv" + i + " = uv" + i + ";\n";
						}
				}
				var codes = [
						code,
						this.varyings,
						codeBody,
						[]
				];
				mapTransforms.forEach((mapTransform)=>{
						this._setMapTransform(codes, mapTransform.name, mapTransform.id, mapTransform.uv);
				});
				code = codes[0];
				this.varyings = codes[1];
				codeBody = codes[2];
				if (options.vertexColors) {
						this.attributes.vertex_color = SEMANTIC_COLOR;
						codeBody += '   vVertexColor = vertex_color;\n';
				}
				if (options.useMsdf && options.msdfTextAttribute) {
						this.attributes.vertex_outlineParameters = SEMANTIC_ATTR8;
						this.attributes.vertex_shadowParameters = SEMANTIC_ATTR9;
						codeBody += '    unpackMsdfParams();\n';
						code += chunks.msdfVS;
				}
				if (options.useMorphPosition || options.useMorphNormal) {
						codeDefines += '#define MORPHING\n';
						if (options.useMorphTextureBasedInt) {
								codeDefines += '#define MORPHING_INT\n';
						}
						if (options.useMorphPosition) {
								codeDefines += '#define MORPHING_POSITION\n';
						}
						if (options.useMorphNormal) {
								codeDefines += '#define MORPHING_NORMAL\n';
						}
						this.attributes.morph_vertex_id = SEMANTIC_ATTR15;
				}
				if (options.skin) {
						this.attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
						if (options.batch) {
								codeDefines += '#define BATCH\n';
						} else {
								this.attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
								codeDefines += '#define SKIN\n';
						}
				} else if (options.useInstancing) {
						codeDefines += '#define INSTANCING\n';
				}
				if (options.screenSpace) {
						codeDefines += '#define SCREENSPACE\n';
				}
				if (options.pixelSnap) {
						codeDefines += '#define PIXELSNAP\n';
				}
				code += '\n';
				code += chunks.startVS;
				code += codeBody;
				code += chunks.endVS;
				code += '}';
				Object.keys(builtinVaryings).forEach((v)=>{
						if (code.indexOf(v) >= 0) {
								this.varyings += "varying " + builtinVaryings[v] + " " + v + ";\n";
								this.varyingDefines += "#define VARYING_" + v.toUpperCase() + "\n";
						}
				});
				this.vshader = codeDefines + this.varyings + code;
		}
		_fsGetBeginCode() {
				var code = '';
				for(var i = 0; i < this.defines.length; i++){
						code += "#define " + this.defines[i] + "\n";
				}
				return code;
		}
		_fsGetPickPassCode() {
				return "\n            " + this._fsGetBeginCode() + "\n            " + this.varyings + "\n            " + this.varyingDefines + "\n            " + this.frontendDecl + "\n            " + this.frontendCode + "\n            " + this.chunks.pickPS + "\n\n            void main(void) {\n                " + this.frontendFunc + "\n                gl_FragColor = getPickOutput();\n            }\n        ";
		}
		_fsGetDepthPassCode() {
				var code = this._fsGetBeginCode();
				code += this.varyings;
				code += this.varyingDefines;
				code += this.frontendDecl;
				code += this.frontendCode;
				code += ShaderGenerator.begin();
				code += this.frontendFunc;
				code += '    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);\n';
				code += ShaderGenerator.end();
				return code;
		}
		_fsGetPrePassCode() {
				var code = this._fsGetBeginCode();
				code += this.varyings;
				code += this.varyingDefines;
				code += this.chunks.floatAsUintPS;
				code += this.frontendDecl;
				code += this.frontendCode;
				code += ShaderGenerator.begin();
				code += this.frontendFunc;
				code += this.device.textureFloatRenderable ? "\n            gl_FragColor = vec4(vLinearDepth, 1.0, 1.0, 1.0);\n        " : "\n            gl_FragColor = float2uint(vLinearDepth);\n        ";
				code += ShaderGenerator.end();
				return code;
		}
		_fsGetShadowPassCode() {
				var options = this.options;
				var chunks = this.chunks;
				var varyings = this.varyings;
				var lightType = this.shaderPassInfo.lightType;
				var shadowType = this.shaderPassInfo.shadowType;
				if (lightType !== LIGHTTYPE_DIRECTIONAL && options.clusteredLightingEnabled) {
						if (shadowType === SHADOW_VSM_16F || shadowType === SHADOW_VSM_32F || shadowType === SHADOW_PCSS_32F) {
								shadowType = SHADOW_PCF3_32F;
						}
				}
				var shadowInfo = shadowTypeInfo.get(shadowType);
				var _shadowInfo_vsm;
				var isVsm = (_shadowInfo_vsm = shadowInfo == null ? undefined : shadowInfo.vsm) != null ? _shadowInfo_vsm : false;
				var _shadowInfo_pcss;
				var isPcss = (_shadowInfo_pcss = shadowInfo == null ? undefined : shadowInfo.pcss) != null ? _shadowInfo_pcss : false;
				var code = this._fsGetBeginCode();
				if (shadowType === SHADOW_VSM_32F) {
						code += '#define VSM_EXPONENT 15.0\n\n';
				} else if (shadowType === SHADOW_VSM_16F) {
						code += '#define VSM_EXPONENT 5.54\n\n';
				}
				if (lightType !== LIGHTTYPE_DIRECTIONAL) {
						code += 'uniform vec3 view_position;\n';
						code += 'uniform float light_radius;\n';
				}
				code += varyings;
				code += this.varyingDefines;
				code += this.frontendDecl;
				code += this.frontendCode;
				if (shadowType === SHADOW_PCSS_32F) {
						code += shaderChunks.linearizeDepthPS;
				}
				code += ShaderGenerator.begin();
				code += this.frontendFunc;
				var usePerspectiveDepth = lightType === LIGHTTYPE_DIRECTIONAL || !isVsm && lightType === LIGHTTYPE_SPOT;
				var hasModifiedDepth = false;
				if (usePerspectiveDepth) {
						code += '    float depth = gl_FragCoord.z;\n';
						if (isPcss) {
								if (lightType !== LIGHTTYPE_DIRECTIONAL) {
										code += '    depth = linearizeDepth(depth, camera_params);\n';
								}
						}
				} else {
						code += '    float depth = min(distance(view_position, vPositionW) / light_radius, 0.99999);\n';
						hasModifiedDepth = true;
				}
				if (!isVsm) {
						var exportR32 = isPcss;
						if (exportR32) {
								code += '    gl_FragColor.r = depth;\n';
						} else {
								if (hasModifiedDepth) {
										code += '    gl_FragDepth = depth;\n';
								}
								code += '    gl_FragColor = vec4(1.0);\n';
						}
				} else {
						code += chunks.storeEVSMPS;
				}
				code += ShaderGenerator.end();
				return code;
		}
		_fsGetLitPassCode() {
				var device = this.device;
				var options = this.options;
				var chunks = this.chunks;
				var decl = new ChunkBuilder();
				var func = new ChunkBuilder();
				var backend = new ChunkBuilder();
				var code = new ChunkBuilder();
				if (options.opacityFadesSpecular === false) {
						decl.append('uniform float material_alphaFade;');
				}
				if (options.useSpecular) {
						this.defines.push('LIT_SPECULAR');
						if (this.reflections) {
								this.defines.push('LIT_REFLECTIONS');
						}
						if (options.useClearCoat) {
								this.defines.push('LIT_CLEARCOAT');
						}
						if (options.fresnelModel > 0) {
								this.defines.push('LIT_SPECULAR_FRESNEL');
						}
						if (options.useSheen) {
								this.defines.push('LIT_SHEEN');
						}
						if (options.useIridescence) {
								this.defines.push('LIT_IRIDESCENCE');
						}
				}
				var shadowTypeUsed = [];
				var numShadowLights = 0;
				var shadowedDirectionalLightUsed = false;
				var useVsm = false;
				var usePcss = false;
				var hasAreaLights = options.lights.some((light)=>{
						return light._shape && light._shape !== LIGHTSHAPE_PUNCTUAL;
				});
				if (options.clusteredLightingEnabled && options.clusteredLightingAreaLightsEnabled) {
						hasAreaLights = true;
				}
				if (hasAreaLights || options.clusteredLightingEnabled) {
						decl.append('#define AREA_LIGHTS');
						decl.append('uniform highp sampler2D areaLightsLutTex1;');
						decl.append('uniform highp sampler2D areaLightsLutTex2;');
				}
				for(var i = 0; i < options.lights.length; i++){
						var light = options.lights[i];
						var lightType = light._type;
						if (options.clusteredLightingEnabled && lightType !== LIGHTTYPE_DIRECTIONAL) {
								continue;
						}
						var lightShape = hasAreaLights && light._shape ? light._shape : LIGHTSHAPE_PUNCTUAL;
						decl.append("uniform vec3 light" + i + "_color;");
						if (light._shadowType === SHADOW_PCSS_32F && light.castShadows && !options.noShadow) {
								decl.append("uniform float light" + i + "_shadowSearchArea;");
								decl.append("uniform vec4 light" + i + "_cameraParams;");
								if (lightType === LIGHTTYPE_DIRECTIONAL) {
										decl.append("uniform vec4 light" + i + "_softShadowParams;");
								}
						}
						if (lightType === LIGHTTYPE_DIRECTIONAL) {
								decl.append("uniform vec3 light" + i + "_direction;");
						} else {
								decl.append("uniform vec3 light" + i + "_position;");
								decl.append("uniform float light" + i + "_radius;");
								if (lightType === LIGHTTYPE_SPOT) {
										decl.append("uniform vec3 light" + i + "_direction;");
										decl.append("uniform float light" + i + "_innerConeAngle;");
										decl.append("uniform float light" + i + "_outerConeAngle;");
								}
						}
						if (lightShape !== LIGHTSHAPE_PUNCTUAL) {
								if (lightType === LIGHTTYPE_DIRECTIONAL) {
										decl.append("uniform vec3 light" + i + "_position;");
								}
								decl.append("uniform vec3 light" + i + "_halfWidth;");
								decl.append("uniform vec3 light" + i + "_halfHeight;");
						}
						if (light.castShadows && !options.noShadow) {
								decl.append("uniform mat4 light" + i + "_shadowMatrix;");
								decl.append("uniform float light" + i + "_shadowIntensity;");
								if (lightType === LIGHTTYPE_DIRECTIONAL) {
										decl.append("uniform mat4 light" + i + "_shadowMatrixPalette[4];");
										decl.append("uniform vec4 light" + i + "_shadowCascadeDistances;");
										decl.append("uniform int light" + i + "_shadowCascadeCount;");
										decl.append("uniform float light" + i + "_shadowCascadeBlend;");
								}
								decl.append("uniform vec4 light" + i + "_shadowParams;");
								if (lightType === LIGHTTYPE_DIRECTIONAL) {
										shadowedDirectionalLightUsed = true;
								}
								if (lightType === LIGHTTYPE_OMNI) {
										decl.append("uniform " + (light._isPcf ? 'samplerCubeShadow' : 'samplerCube') + " light" + i + "_shadowMap;");
								} else {
										decl.append("uniform " + (light._isPcf ? 'sampler2DShadow' : 'sampler2D') + " light" + i + "_shadowMap;");
								}
								numShadowLights++;
								shadowTypeUsed[light._shadowType] = true;
								if (light._isVsm) useVsm = true;
								if (light._shadowType === SHADOW_PCSS_32F) usePcss = true;
						}
						if (light._cookie) {
								if (light._cookie._cubemap) {
										if (lightType === LIGHTTYPE_OMNI) {
												decl.append("uniform samplerCube light" + i + "_cookie;");
												decl.append("uniform float light" + i + "_cookieIntensity;");
												if (!light.castShadows || options.noShadow) {
														decl.append("uniform mat4 light" + i + "_shadowMatrix;");
												}
										}
								} else {
										if (lightType === LIGHTTYPE_SPOT) {
												decl.append("uniform sampler2D light" + i + "_cookie;");
												decl.append("uniform float light" + i + "_cookieIntensity;");
												if (!light.castShadows || options.noShadow) {
														decl.append("uniform mat4 light" + i + "_shadowMatrix;");
												}
												if (light._cookieTransform) {
														decl.append("uniform vec4 light" + i + "_cookieMatrix;");
														decl.append("uniform vec2 light" + i + "_cookieOffset;");
												}
										}
								}
						}
				}
				var hasTBN = this.needsNormal && (options.useNormals || options.useClearCoatNormals || options.enableGGXSpecular && !options.useHeights);
				if (hasTBN) {
						if (options.hasTangents) {
								func.append(chunks.TBNPS);
						} else {
								if (options.useNormals || options.useClearCoatNormals) {
										func.append(chunks.TBNderivativePS.replace(/\$UV/g, this.lightingUv));
								} else {
										func.append(chunks.TBNObjectSpacePS);
								}
						}
						if (options.twoSidedLighting) {
								func.append(chunks.twoSidedLightingPS);
						}
				}
				func.append(chunks.sphericalPS);
				func.append(chunks.decodePS);
				func.append(chunks.gammaPS);
				func.append(chunks.tonemappingPS);
				func.append(chunks.fogPS);
				func.append(this.frontendCode);
				if (options.useCubeMapRotation) {
						decl.append('#define CUBEMAP_ROTATION');
				}
				if (this.needsNormal) {
						func.append(chunks.cubeMapRotatePS);
						func.append(options.cubeMapProjection > 0 ? chunks.cubeMapProjectBoxPS : chunks.cubeMapProjectNonePS);
						func.append(options.skyboxIntensity ? chunks.envMultiplyPS : chunks.envConstPS);
				}
				if (this.lighting && options.useSpecular || this.reflections) {
						if (options.useMetalness) {
								func.append(chunks.metalnessModulatePS);
						}
						if (options.fresnelModel === FRESNEL_SCHLICK) {
								func.append(chunks.fresnelSchlickPS);
						}
						if (options.useIridescence) {
								func.append(chunks.iridescenceDiffractionPS);
						}
				}
				if (options.useAo) {
						func.append(chunks.aoDiffuseOccPS);
						switch(options.occludeSpecular){
								case SPECOCC_AO:
										func.append(options.occludeSpecularFloat ? chunks.aoSpecOccSimplePS : chunks.aoSpecOccConstSimplePS);
										break;
								case SPECOCC_GLOSSDEPENDENT:
										func.append(options.occludeSpecularFloat ? chunks.aoSpecOccPS : chunks.aoSpecOccConstPS);
										break;
						}
				}
				if (options.reflectionSource === 'envAtlasHQ') {
						func.append(chunks.envAtlasPS);
						func.append(chunks.reflectionEnvHQPS.replace(/\$DECODE_CUBEMAP/g, ChunkUtils.decodeFunc(options.reflectionCubemapEncoding)).replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
				} else if (options.reflectionSource === 'envAtlas') {
						func.append(chunks.envAtlasPS);
						func.append(chunks.reflectionEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
				} else if (options.reflectionSource === 'cubeMap') {
						func.append(chunks.reflectionCubePS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
				} else if (options.reflectionSource === 'sphereMap') {
						func.append(chunks.reflectionSpherePS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.reflectionEncoding)));
				}
				if (this.reflections) {
						if (options.useClearCoat) {
								func.append(chunks.reflectionCCPS);
						}
						if (options.useSheen) {
								func.append(chunks.reflectionSheenPS);
						}
				}
				if (options.useRefraction) {
						if (options.useDynamicRefraction) {
								if (options.dispersion) {
										decl.append('uniform float material_dispersion;');
										decl.append('#define DISPERSION\n');
								}
								func.append(chunks.refractionDynamicPS);
						} else if (this.reflections) {
								func.append(chunks.refractionCubePS);
						}
				}
				if (options.useSheen) {
						func.append(chunks.lightSheenPS);
				}
				if (options.clusteredLightingEnabled) {
						func.append(chunks.clusteredLightUtilsPS);
						if (options.clusteredLightingCookiesEnabled) {
								func.append(chunks.clusteredLightCookiesPS);
						}
						if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
								shadowTypeUsed[SHADOW_PCF3_32F] = true;
								shadowTypeUsed[SHADOW_PCF5_32F] = true;
								shadowTypeUsed[SHADOW_PCSS_32F] = true;
						}
				}
				if (numShadowLights > 0 || options.clusteredLightingEnabled) {
						if (shadowedDirectionalLightUsed) {
								func.append(chunks.shadowCascadesPS);
						}
						if (shadowTypeUsed[SHADOW_PCF1_32F] || shadowTypeUsed[SHADOW_PCF3_32F] || shadowTypeUsed[SHADOW_PCF1_16F] || shadowTypeUsed[SHADOW_PCF3_16F]) {
								func.append(chunks.shadowStandardPS);
						}
						if (shadowTypeUsed[SHADOW_PCF5_32F] || shadowTypeUsed[SHADOW_PCF5_16F]) {
								func.append(chunks.shadowStandardGL2PS);
						}
						if (useVsm) {
								func.append(chunks.shadowVSM_commonPS);
								if (shadowTypeUsed[SHADOW_VSM_16F]) {
										func.append(chunks.shadowEVSMPS.replace(/\$/g, '16'));
								}
								if (shadowTypeUsed[SHADOW_VSM_32F]) {
										func.append(device.extTextureFloatLinear ? chunks.shadowEVSMPS.replace(/\$/g, '32') : chunks.shadowEVSMnPS.replace(/\$/g, '32'));
								}
						}
						if (usePcss) {
								func.append(chunks.linearizeDepthPS);
								func.append(chunks.shadowPCSSPS);
								func.append(chunks.shadowSoftPS);
						}
				}
				if (options.enableGGXSpecular) func.append('uniform float material_anisotropy;');
				if (this.lighting) {
						func.append(chunks.lightDiffuseLambertPS);
						if (hasAreaLights || options.clusteredLightingAreaLightsEnabled) {
								func.append(chunks.ltcPS);
						}
				}
				var useOldAmbient = false;
				if (options.useSpecular) {
						if (this.lighting) {
								func.append(options.enableGGXSpecular ? chunks.lightSpecularAnisoGGXPS : chunks.lightSpecularBlinnPS);
						}
						if (!options.fresnelModel && !this.reflections && !options.diffuseMapEnabled) {
								decl.append('uniform vec3 material_ambient;');
								decl.append('#define LIT_OLD_AMBIENT');
								useOldAmbient = true;
						}
				}
				func.append(chunks.combinePS);
				if (options.lightMapEnabled) {
						func.append(options.useSpecular && options.dirLightMapEnabled ? chunks.lightmapDirAddPS : chunks.lightmapAddPS);
				}
				var addAmbient = !options.lightMapEnabled || options.lightMapWithoutAmbient;
				if (addAmbient) {
						if (options.ambientSource === 'ambientSH') {
								func.append(chunks.ambientSHPS);
						} else if (options.ambientSource === 'envAtlas') {
								if (options.reflectionSource !== 'envAtlas' && options.reflectionSource !== 'envAtlasHQ') {
										func.append(chunks.envAtlasPS);
								}
								func.append(chunks.ambientEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.ambientEncoding)));
						} else {
								func.append(chunks.ambientConstantPS);
						}
				}
				if (!useOldAmbient) {
						decl.append('uniform vec3 material_ambient;');
				}
				if (options.useMsdf) {
						if (!options.msdfTextAttribute) {
								decl.append('#define UNIFORM_TEXT_PARAMETERS');
						}
						func.append(chunks.msdfPS);
				}
				if (this.needsNormal) {
						func.append(chunks.viewDirPS);
						if (options.useSpecular) {
								func.append(options.enableGGXSpecular ? chunks.reflDirAnisoPS : chunks.reflDirPS);
						}
				}
				var hasPointLights = false;
				var usesLinearFalloff = false;
				var usesInvSquaredFalloff = false;
				var usesSpot = false;
				var usesCookie = false;
				var usesCookieNow;
				if (options.clusteredLightingEnabled && this.lighting) {
						usesSpot = true;
						hasPointLights = true;
						usesLinearFalloff = true;
						usesCookie = true;
						func.append(chunks.floatUnpackingPS);
						if (options.lightMaskDynamic) {
								decl.append('#define CLUSTER_MESH_DYNAMIC_LIGHTS');
						}
						if (options.clusteredLightingCookiesEnabled) {
								decl.append('#define CLUSTER_COOKIES');
						}
						if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
								var _shadowTypeInfo_get;
								var shadowTypeName = (_shadowTypeInfo_get = shadowTypeInfo.get(options.clusteredLightingShadowType)) == null ? undefined : _shadowTypeInfo_get.name;
								var clusteredSampleType = shadowTypeName.substring(0, 4);
								decl.append('#define CLUSTER_SHADOWS');
								decl.append("#define CLUSTER_SHADOW_TYPE_" + clusteredSampleType);
						}
						if (options.clusteredLightingAreaLightsEnabled) {
								decl.append('#define CLUSTER_AREALIGHTS');
						}
						decl.append(LightsBuffer.getShaderDefines());
						if (options.clusteredLightingShadowsEnabled && !options.noShadow) {
								func.append(chunks.clusteredLightShadowsPS);
						}
						func.append(chunks.clusteredLightPS);
				}
				code.append(this._fsGetStartCode(code, device, chunks, options));
				if (this.needsNormal) {
						code.append('    dVertexNormalW = normalize(vNormalW);');
						if ((options.useHeights || options.useNormals) && options.hasTangents) {
								code.append('    dTangentW = vTangentW;');
								code.append('    dBinormalW = vBinormalW;');
						}
						code.append('    getViewDir();');
						if (hasTBN) {
								code.append('    getTBN(dTangentW, dBinormalW, dVertexNormalW);');
								if (options.twoSidedLighting) {
										code.append('    handleTwoSidedLighting();');
								}
						}
				}
				code.append(this.frontendFunc);
				if (options.ssao) {
						func.append("\n                    uniform sampler2D ssaoTexture;\n                    uniform vec2 ssaoTextureSizeInv;\n                ");
						backend.append('litArgs_ao *= texture2DLod(ssaoTexture, gl_FragCoord.xy * ssaoTextureSizeInv, 0.0).r;');
				}
				if (this.needsNormal) {
						if (options.useSpecular) {
								backend.append('    getReflDir(litArgs_worldNormal, dViewDirW, litArgs_gloss, dTBN);');
						}
						if (options.useClearCoat) {
								backend.append('    ccReflDirW = normalize(-reflect(dViewDirW, litArgs_clearcoat_worldNormal));');
						}
				}
				if (this.lighting && options.useSpecular || this.reflections) {
						if (options.useMetalness) {
								backend.append('    float f0 = 1.0 / litArgs_ior; f0 = (f0 - 1.0) / (f0 + 1.0); f0 *= f0;');
								backend.append('    litArgs_specularity = getSpecularModulate(litArgs_specularity, litArgs_albedo, litArgs_metalness, f0);');
								backend.append('    litArgs_albedo = getAlbedoModulate(litArgs_albedo, litArgs_metalness);');
						}
						if (options.useIridescence) {
								backend.append('    vec3 iridescenceFresnel = getIridescence(saturate(dot(dViewDirW, litArgs_worldNormal)), litArgs_specularity, litArgs_iridescence_thickness);');
						}
				}
				if (addAmbient) {
						backend.append('    addAmbient(litArgs_worldNormal);');
						if (options.useSpecular) {
								backend.append('   dDiffuseLight = dDiffuseLight * (1.0 - litArgs_specularity);');
						}
						if (options.separateAmbient) {
								backend.append("\n                    vec3 dAmbientLight = dDiffuseLight;\n                    dDiffuseLight = vec3(0);\n                ");
						}
				}
				if (!useOldAmbient) {
						backend.append('    dDiffuseLight *= material_ambient;');
				}
				if (options.useAo && !options.occludeDirect) {
						backend.append('    occludeDiffuse(litArgs_ao);');
				}
				if (options.lightMapEnabled) {
						backend.append("    addLightMap(\n                litArgs_lightmap, \n                litArgs_lightmapDir, \n                litArgs_worldNormal, \n                dViewDirW, \n                dReflDirW, \n                litArgs_gloss, \n                litArgs_specularity, \n                dVertexNormalW,\n                dTBN\n            #if defined(LIT_IRIDESCENCE)\n                , iridescenceFresnel,\n                litArgs_iridescence_intensity\n            #endif\n                );");
				}
				if (this.lighting || this.reflections) {
						if (this.reflections) {
								if (options.useClearCoat) {
										backend.append('    addReflectionCC(ccReflDirW, litArgs_clearcoat_gloss);');
										if (options.fresnelModel > 0) {
												backend.append('    ccFresnel = getFresnelCC(dot(dViewDirW, litArgs_clearcoat_worldNormal));');
												backend.append('    ccReflection.rgb *= ccFresnel;');
										} else {
												backend.append('    ccFresnel = 0.0;');
										}
								}
								if (options.useSpecularityFactor) {
										backend.append('    ccReflection.rgb *= litArgs_specularityFactor;');
								}
								if (options.useSheen) {
										backend.append('    addReflectionSheen(litArgs_worldNormal, dViewDirW, litArgs_sheen_gloss);');
								}
								backend.append('    addReflection(dReflDirW, litArgs_gloss);');
								if (options.fresnelModel > 0) {
										backend.append("    dReflection.rgb *= \n                        getFresnel(\n                            dot(dViewDirW, litArgs_worldNormal), \n                            litArgs_gloss, \n                            litArgs_specularity\n                        #if defined(LIT_IRIDESCENCE)\n                            , iridescenceFresnel,\n                            litArgs_iridescence_intensity\n                        #endif\n                            );");
								} else {
										backend.append('    dReflection.rgb *= litArgs_specularity;');
								}
								if (options.useSpecularityFactor) {
										backend.append('    dReflection.rgb *= litArgs_specularityFactor;');
								}
						}
						if (hasAreaLights) {
								backend.append('    dSpecularLight *= litArgs_specularity;');
								if (options.useSpecular) {
										backend.append('    calcLTCLightValues(litArgs_gloss, litArgs_worldNormal, dViewDirW, litArgs_specularity, litArgs_clearcoat_gloss, litArgs_clearcoat_worldNormal, litArgs_clearcoat_specularity);');
								}
						}
						for(var i1 = 0; i1 < options.lights.length; i1++){
								var light1 = options.lights[i1];
								var lightType1 = light1._type;
								if (options.clusteredLightingEnabled && lightType1 !== LIGHTTYPE_DIRECTIONAL) {
										continue;
								}
								usesCookieNow = false;
								var lightShape1 = hasAreaLights && light1._shape ? light1.shape : LIGHTSHAPE_PUNCTUAL;
								var shapeString = hasAreaLights && light1._shape ? this._getLightSourceShapeString(lightShape1) : '';
								if (lightShape1 !== LIGHTSHAPE_PUNCTUAL) {
										backend.append("    calc" + shapeString + "LightValues(light" + i1 + "_position, light" + i1 + "_halfWidth, light" + i1 + "_halfHeight);");
								}
								if (lightType1 === LIGHTTYPE_DIRECTIONAL) {
										backend.append("    dLightDirNormW = light" + i1 + "_direction;");
										backend.append('    dAtten = 1.0;');
								} else {
										if (light1._cookie) {
												if (lightType1 === LIGHTTYPE_SPOT && !light1._cookie._cubemap) {
														usesCookie = true;
														usesCookieNow = true;
												} else if (lightType1 === LIGHTTYPE_OMNI && light1._cookie._cubemap) {
														usesCookie = true;
														usesCookieNow = true;
												}
										}
										backend.append("    getLightDirPoint(light" + i1 + "_position);");
										hasPointLights = true;
										if (usesCookieNow) {
												if (lightType1 === LIGHTTYPE_SPOT) {
														backend.append("    dAtten3 = getCookie2D" + (light1._cookieFalloff ? '' : 'Clip') + (light1._cookieTransform ? 'Xform' : '') + "(light" + i1 + "_cookie, light" + i1 + "_shadowMatrix, light" + i1 + "_cookieIntensity" + (light1._cookieTransform ? ", light" + i1 + "_cookieMatrix, light" + i1 + "_cookieOffset" : '') + ")." + light1._cookieChannel + ";");
												} else {
														backend.append("    dAtten3 = getCookieCube(light" + i1 + "_cookie, light" + i1 + "_shadowMatrix, light" + i1 + "_cookieIntensity)." + light1._cookieChannel + ";");
												}
										}
										if (lightShape1 === LIGHTSHAPE_PUNCTUAL) {
												if (light1._falloffMode === LIGHTFALLOFF_LINEAR) {
														backend.append("    dAtten = getFalloffLinear(light" + i1 + "_radius, dLightDirW);");
														usesLinearFalloff = true;
												} else {
														backend.append("    dAtten = getFalloffInvSquared(light" + i1 + "_radius, dLightDirW);");
														usesInvSquaredFalloff = true;
												}
										} else {
												backend.append("    dAtten = getFalloffWindow(light" + i1 + "_radius, dLightDirW);");
												usesInvSquaredFalloff = true;
										}
										backend.append('    if (dAtten > 0.00001) {');
										if (lightType1 === LIGHTTYPE_SPOT) {
												if (!(usesCookieNow && !light1._cookieFalloff)) {
														backend.append("    dAtten *= getSpotEffect(light" + i1 + "_direction, light" + i1 + "_innerConeAngle, light" + i1 + "_outerConeAngle, dLightDirNormW);");
														usesSpot = true;
												}
										}
								}
								if (lightShape1 !== LIGHTSHAPE_PUNCTUAL) {
										if (lightType1 === LIGHTTYPE_DIRECTIONAL) {
												backend.append('    dAttenD = getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW);');
										} else {
												backend.append("    dAttenD = get" + shapeString + "LightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW) * 16.0;");
										}
								} else {
										backend.append('    dAtten *= getLightDiffuse(litArgs_worldNormal, dViewDirW, dLightDirW, dLightDirNormW);');
								}
								if (light1.castShadows && !options.noShadow) {
										var shadowInfo = shadowTypeInfo.get(light1._shadowType);
										var pcssShadows = light1._shadowType === SHADOW_PCSS_32F;
										var vsmShadows = shadowInfo == null ? undefined : shadowInfo.vsm;
										var pcfShadows = shadowInfo == null ? undefined : shadowInfo.pcf;
										var shadowReadMode = null;
										var evsmExp = undefined;
										switch(light1._shadowType){
												case SHADOW_VSM_16F:
														shadowReadMode = 'VSM16';
														evsmExp = '5.54';
														break;
												case SHADOW_VSM_32F:
														shadowReadMode = 'VSM32';
														evsmExp = '15.0';
														break;
												case SHADOW_PCF1_32F:
												case SHADOW_PCF1_16F:
														shadowReadMode = 'PCF1x1';
														break;
												case SHADOW_PCF5_32F:
												case SHADOW_PCF5_16F:
														shadowReadMode = 'PCF5x5';
														break;
												case SHADOW_PCSS_32F:
														shadowReadMode = 'PCSS';
														break;
												case SHADOW_PCF3_32F:
												case SHADOW_PCF3_16F:
												default:
														shadowReadMode = 'PCF3x3';
														break;
										}
										if (shadowReadMode !== null) {
												if (light1._normalOffsetBias && !light1._isVsm) {
														func.append('#define SHADOW_SAMPLE_NORMAL_OFFSET');
												}
												if (lightType1 === LIGHTTYPE_DIRECTIONAL) {
														func.append('#define SHADOW_SAMPLE_ORTHO');
												}
												if (pcfShadows || pcssShadows || device.isWebGPU) {
														func.append('#define SHADOW_SAMPLE_SOURCE_ZBUFFER');
												}
												if (lightType1 === LIGHTTYPE_OMNI) {
														func.append('#define SHADOW_SAMPLE_POINT');
												}
												var coordCode = chunks.shadowSampleCoordPS;
												func.append(coordCode.replace('$LIGHT', i1));
												func.append('#undef SHADOW_SAMPLE_NORMAL_OFFSET');
												func.append('#undef SHADOW_SAMPLE_ORTHO');
												func.append('#undef SHADOW_SAMPLE_SOURCE_ZBUFFER');
												func.append('#undef SHADOW_SAMPLE_POINT');
												var shadowMatrix = "light" + i1 + "_shadowMatrix";
												if (lightType1 === LIGHTTYPE_DIRECTIONAL && light1.numCascades > 1) {
														backend.append("int cascadeIndex" + i1 + " = getShadowCascadeIndex(light" + i1 + "_shadowCascadeDistances, light" + i1 + "_shadowCascadeCount);");
														if (light1.cascadeBlend > 0) {
																backend.append("cascadeIndex" + i1 + " = ditherShadowCascadeIndex(cascadeIndex" + i1 + ", light" + i1 + "_shadowCascadeDistances, light" + i1 + "_shadowCascadeCount, light" + i1 + "_shadowCascadeBlend);");
														}
														backend.append("mat4 cascadeShadowMat" + i1 + " = light" + i1 + "_shadowMatrixPalette[cascadeIndex" + i1 + "];");
														shadowMatrix = "cascadeShadowMat" + i1;
												}
												backend.append("    dShadowCoord = getShadowSampleCoord" + i1 + "(" + shadowMatrix + ", light" + i1 + "_shadowParams, vPositionW, dLightPosW, dLightDirW, dLightDirNormW, dVertexNormalW);");
												if (lightType1 === LIGHTTYPE_DIRECTIONAL) {
														backend.append("    fadeShadow(light" + i1 + "_shadowCascadeDistances);");
												}
												var shadowCoordArgs = "SHADOWMAP_PASS(light" + i1 + "_shadowMap), dShadowCoord, light" + i1 + "_shadowParams";
												if (vsmShadows) {
														shadowCoordArgs = shadowCoordArgs + ", " + evsmExp + ", dLightDirW";
												} else if (pcssShadows) {
														var penumbraSizeArg = lightType1 === LIGHTTYPE_DIRECTIONAL ? "light" + i1 + "_softShadowParams" : "vec2(light" + i1 + "_shadowSearchArea)";
														if (lightShape1 !== LIGHTSHAPE_PUNCTUAL) {
																penumbraSizeArg = "vec2(length(light" + i1 + "_halfWidth), length(light" + i1 + "_halfHeight)) * light" + i1 + "_shadowSearchArea";
														}
														shadowCoordArgs = shadowCoordArgs + ", light" + i1 + "_cameraParams, " + penumbraSizeArg + ", dLightDirW";
												}
												if (lightType1 === LIGHTTYPE_OMNI) {
														shadowReadMode = "Point" + shadowReadMode;
														if (!pcssShadows) {
																shadowCoordArgs = "" + shadowCoordArgs + ", dLightDirW";
														}
												} else if (lightType1 === LIGHTTYPE_SPOT) {
														shadowReadMode = "Spot" + shadowReadMode;
												}
												backend.append("    float shadow" + i1 + " = getShadow" + shadowReadMode + "(" + shadowCoordArgs + ");");
												backend.append("    dAtten *= mix(1.0, shadow" + i1 + ", light" + i1 + "_shadowIntensity);");
										}
								}
								if (lightShape1 !== LIGHTSHAPE_PUNCTUAL) {
										if (options.useSpecular) {
												backend.append("    dDiffuseLight += ((dAttenD * dAtten) * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ") * (1.0 - dLTCSpecFres);");
										} else {
												backend.append("    dDiffuseLight += (dAttenD * dAtten) * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ";");
										}
								} else {
										if (hasAreaLights && options.useSpecular) {
												backend.append("    dDiffuseLight += (dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ") * (1.0 - litArgs_specularity);");
										} else {
												backend.append("    dDiffuseLight += dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ";");
										}
								}
								if (options.useSpecular) {
										backend.append('    dHalfDirW = normalize(-dLightDirNormW + dViewDirW);');
								}
								if (light1.affectSpecularity) {
										if (lightShape1 !== LIGHTSHAPE_PUNCTUAL) {
												if (options.useClearCoat) {
														backend.append("    ccSpecularLight += ccLTCSpecFres * get" + shapeString + "LightSpecular(litArgs_clearcoat_worldNormal, dViewDirW) * dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ";");
												}
												if (options.useSpecular) {
														backend.append("    dSpecularLight += dLTCSpecFres * get" + shapeString + "LightSpecular(litArgs_worldNormal, dViewDirW) * dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + ";");
												}
										} else {
												var calcFresnel = false;
												if (lightType1 === LIGHTTYPE_DIRECTIONAL && options.fresnelModel > 0) {
														calcFresnel = true;
												}
												if (options.useClearCoat) {
														backend.append("    ccSpecularLight += getLightSpecular(dHalfDirW, ccReflDirW, litArgs_clearcoat_worldNormal, dViewDirW, dLightDirNormW, litArgs_clearcoat_gloss, dTBN) * dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + (calcFresnel ? ' * getFresnelCC(dot(dViewDirW, dHalfDirW));' : ';'));
												}
												if (options.useSheen) {
														backend.append("    sSpecularLight += getLightSpecularSheen(dHalfDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_sheen_gloss) * dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3;' : ';'));
												}
												if (options.useSpecular) {
														backend.append("    dSpecularLight += getLightSpecular(dHalfDirW, dReflDirW, litArgs_worldNormal, dViewDirW, dLightDirNormW, litArgs_gloss, dTBN) * dAtten * light" + i1 + "_color" + (usesCookieNow ? ' * dAtten3' : '') + (calcFresnel ? " \n                                    * getFresnel(\n                                        dot(dViewDirW, dHalfDirW), \n                                        litArgs_gloss, \n                                        litArgs_specularity\n                                    #if defined(LIT_IRIDESCENCE)\n                                        , iridescenceFresnel, \n                                        litArgs_iridescence_intensity\n                                    #endif\n                                    );" : '* litArgs_specularity;'));
												}
										}
								}
								if (lightType1 !== LIGHTTYPE_DIRECTIONAL) {
										backend.append('    }');
								}
						}
						if (options.clusteredLightingEnabled && this.lighting) {
								usesLinearFalloff = true;
								usesInvSquaredFalloff = true;
								hasPointLights = true;
								backend.append("    addClusteredLights(\n                                        litArgs_worldNormal, \n                                        dViewDirW, \n                                        dReflDirW,\n                                #if defined(LIT_CLEARCOAT)\n                                        ccReflDirW,\n                                #endif\n                                        litArgs_gloss, \n                                        litArgs_specularity, \n                                        dVertexNormalW, \n                                        dTBN, \n                                #if defined(LIT_IRIDESCENCE)\n                                        iridescenceFresnel,\n                                #endif\n                                        litArgs_clearcoat_worldNormal, \n                                        litArgs_clearcoat_gloss,\n                                        litArgs_sheen_gloss,\n                                        litArgs_iridescence_intensity\n                                    );");
						}
						if (hasAreaLights) {
								if (options.useClearCoat) {
										backend.append('    litArgs_clearcoat_specularity = 1.0;');
								}
								if (options.useSpecular) {
										backend.append('    litArgs_specularity = vec3(1);');
								}
						}
						if (options.useRefraction) {
								backend.append("    addRefraction(\n                        litArgs_worldNormal, \n                        dViewDirW, \n                        litArgs_thickness, \n                        litArgs_gloss, \n                        litArgs_specularity, \n                        litArgs_albedo, \n                        litArgs_transmission,\n                        litArgs_ior,\n                        litArgs_dispersion\n                    #if defined(LIT_IRIDESCENCE)\n                        , iridescenceFresnel, \n                        litArgs_iridescence_intensity\n                    #endif\n                    );");
						}
				}
				if (options.useAo) {
						if (options.occludeDirect) {
								backend.append('    occludeDiffuse(litArgs_ao);');
						}
						if (options.occludeSpecular === SPECOCC_AO || options.occludeSpecular === SPECOCC_GLOSSDEPENDENT) {
								backend.append('    occludeSpecular(litArgs_gloss, litArgs_ao, litArgs_worldNormal, dViewDirW);');
						}
				}
				if (options.useSpecularityFactor) {
						backend.append('    dSpecularLight *= litArgs_specularityFactor;');
				}
				if (options.opacityFadesSpecular === false) {
						if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_PREMULTIPLIED) {
								backend.append('float specLum = dot((dSpecularLight + dReflection.rgb * dReflection.a), vec3( 0.2126, 0.7152, 0.0722 ));');
								backend.append('#ifdef LIT_CLEARCOAT\n specLum += dot(ccSpecularLight * litArgs_clearcoat_specularity + ccReflection.rgb * litArgs_clearcoat_specularity, vec3( 0.2126, 0.7152, 0.0722 ));\n#endif');
								backend.append('litArgs_opacity = clamp(litArgs_opacity + gammaCorrectInput(specLum), 0.0, 1.0);');
						}
						backend.append('litArgs_opacity *= material_alphaFade;');
				}
				backend.append(chunks.endPS);
				if (options.blendType === BLEND_NORMAL || options.blendType === BLEND_ADDITIVEALPHA || options.alphaToCoverage) {
						backend.append(chunks.outputAlphaPS);
				} else if (options.blendType === BLEND_PREMULTIPLIED) {
						backend.append(chunks.outputAlphaPremulPS);
				} else {
						backend.append(chunks.outputAlphaOpaquePS);
				}
				if (options.useMsdf) {
						backend.append('    gl_FragColor = applyMsdf(gl_FragColor);');
				}
				backend.append(chunks.outputPS);
				backend.append(chunks.debugOutputPS);
				if (hasPointLights) {
						func.prepend(chunks.lightDirPointPS);
				}
				if (usesLinearFalloff) {
						func.prepend(chunks.falloffLinearPS);
				}
				if (usesInvSquaredFalloff) {
						func.prepend(chunks.falloffInvSquaredPS);
				}
				if (usesSpot) {
						func.prepend(chunks.spotPS);
				}
				if (usesCookie && !options.clusteredLightingEnabled) {
						func.prepend(chunks.cookiePS);
				}
				var structCode = '';
				var backendCode = "void evaluateBackend() {\n" + backend.code + "\n}";
				func.append(backendCode);
				code.append(chunks.debugProcessFrontendPS);
				code.append('    evaluateBackend();');
				code.append(ShaderGenerator.end());
				var mergedCode = decl.code + func.code + code.code;
				if (mergedCode.includes('dTBN')) structCode += 'mat3 dTBN;\n';
				if (mergedCode.includes('dVertexNormalW')) structCode += 'vec3 dVertexNormalW;\n';
				if (mergedCode.includes('dTangentW')) structCode += 'vec3 dTangentW;\n';
				if (mergedCode.includes('dBinormalW')) structCode += 'vec3 dBinormalW;\n';
				if (mergedCode.includes('dViewDirW')) structCode += 'vec3 dViewDirW;\n';
				if (mergedCode.includes('dReflDirW')) structCode += 'vec3 dReflDirW;\n';
				if (mergedCode.includes('dHalfDirW')) structCode += 'vec3 dHalfDirW;\n';
				if (mergedCode.includes('ccReflDirW')) structCode += 'vec3 ccReflDirW;\n';
				if (mergedCode.includes('dLightDirNormW')) structCode += 'vec3 dLightDirNormW;\n';
				if (mergedCode.includes('dLightDirW')) structCode += 'vec3 dLightDirW;\n';
				if (mergedCode.includes('dLightPosW')) structCode += 'vec3 dLightPosW;\n';
				if (mergedCode.includes('dShadowCoord')) structCode += 'vec3 dShadowCoord;\n';
				if (mergedCode.includes('dReflection')) structCode += 'vec4 dReflection;\n';
				if (mergedCode.includes('dDiffuseLight')) structCode += 'vec3 dDiffuseLight;\n';
				if (mergedCode.includes('dSpecularLight')) structCode += 'vec3 dSpecularLight;\n';
				if (mergedCode.includes('dAtten')) structCode += 'float dAtten;\n';
				if (mergedCode.includes('dAttenD')) structCode += 'float dAttenD;\n';
				if (mergedCode.includes('dAtten3')) structCode += 'vec3 dAtten3;\n';
				if (mergedCode.includes('dMsdf')) structCode += 'vec4 dMsdf;\n';
				if (mergedCode.includes('ccFresnel')) structCode += 'float ccFresnel;\n';
				if (mergedCode.includes('ccReflection')) structCode += 'vec3 ccReflection;\n';
				if (mergedCode.includes('ccSpecularLight')) structCode += 'vec3 ccSpecularLight;\n';
				if (mergedCode.includes('ccSpecularityNoFres')) structCode += 'float ccSpecularityNoFres;\n';
				if (mergedCode.includes('sSpecularLight')) structCode += 'vec3 sSpecularLight;\n';
				if (mergedCode.includes('sReflection')) structCode += 'vec3 sReflection;\n';
				var result = this._fsGetBeginCode() + this.varyings + this.varyingDefines + this._fsGetBaseCode() + structCode + this.frontendDecl + mergedCode;
				return result;
		}
		generateFragmentShader(frontendDecl, frontendCode, frontendFunc, lightingUv) {
				var options = this.options;
				this.frontendDecl = frontendDecl;
				this.frontendCode = frontendCode;
				this.frontendFunc = frontendFunc;
				this.lightingUv = lightingUv;
				if (options.pass === SHADER_PICK) {
						this.fshader = this._fsGetPickPassCode();
				} else if (options.pass === SHADER_DEPTH) {
						this.fshader = this._fsGetDepthPassCode();
				} else if (options.pass === SHADER_PREPASS) {
						this.fshader = this._fsGetPrePassCode();
				} else if (this.shadowPass) {
						this.fshader = this._fsGetShadowPassCode();
				} else if (options.customFragmentShader) {
						this.fshader = this._fsGetBeginCode() + options.customFragmentShader;
				} else {
						this.fshader = this._fsGetLitPassCode();
				}
		}
		constructor(device, options){
				this.device = device;
				this.options = options;
				this.attributes = {
						vertex_position: SEMANTIC_POSITION
				};
				if (options.userAttributes) {
						for (var [semantic, name] of Object.entries(options.userAttributes)){
								this.attributes[name] = semantic;
						}
				}
				if (options.chunks) {
						var userChunks = options.chunks;
						this.chunks = Object.create(shaderChunks);
						for(var chunkName in shaderChunks){
								if (userChunks.hasOwnProperty(chunkName)) {
										var chunk = userChunks[chunkName];
										for(var a in builtinAttributes){
												if (builtinAttributes.hasOwnProperty(a) && chunk.indexOf(a) >= 0) {
														this.attributes[a] = builtinAttributes[a];
												}
										}
										this.chunks[chunkName] = chunk;
								}
						}
				} else {
						this.chunks = shaderChunks;
				}
				this.shaderPassInfo = ShaderPass.get(this.device).getByIndex(options.pass);
				this.shadowPass = this.shaderPassInfo.isShadow;
				this.lighting = options.lights.length > 0 || options.dirLightMapEnabled || options.clusteredLightingEnabled;
				this.reflections = !!options.reflectionSource;
				this.needsNormal = this.lighting || this.reflections || options.useSpecular || options.ambientSH || options.useHeights || options.enableGGXSpecular || options.clusteredLightingEnabled && !this.shadowPass || options.useClearCoatNormals;
				this.needsNormal = this.needsNormal && !this.shadowPass;
				this.needsSceneColor = options.useDynamicRefraction;
				this.needsScreenSize = options.useDynamicRefraction;
				this.needsTransforms = options.useDynamicRefraction;
				this.varyings = '';
				this.varyingDefines = '';
				this.vshader = null;
				this.frontendDecl = null;
				this.frontendCode = null;
				this.frontendFunc = null;
				this.lightingUv = null;
				this.defines = [];
				this.fshader = null;
		}
}

export { LitShader };
