import { SHADERLANGUAGE_WGSL, SHADERLANGUAGE_GLSL, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT } from './constants.js';
import gles3PS from './shader-chunks/frag/gles3.js';
import gles3VS from './shader-chunks/vert/gles3.js';
import webgpuPS from './shader-chunks/frag/webgpu.js';
import webgpuVS from './shader-chunks/vert/webgpu.js';
import sharedFS from './shader-chunks/frag/shared.js';

var _attrib2Semantic = {
		vertex_position: SEMANTIC_POSITION,
		vertex_normal: SEMANTIC_NORMAL,
		vertex_tangent: SEMANTIC_TANGENT,
		vertex_texCoord0: SEMANTIC_TEXCOORD0,
		vertex_texCoord1: SEMANTIC_TEXCOORD1,
		vertex_texCoord2: SEMANTIC_TEXCOORD2,
		vertex_texCoord3: SEMANTIC_TEXCOORD3,
		vertex_texCoord4: SEMANTIC_TEXCOORD4,
		vertex_texCoord5: SEMANTIC_TEXCOORD5,
		vertex_texCoord6: SEMANTIC_TEXCOORD6,
		vertex_texCoord7: SEMANTIC_TEXCOORD7,
		vertex_color: SEMANTIC_COLOR,
		vertex_boneIndices: SEMANTIC_BLENDINDICES,
		vertex_boneWeights: SEMANTIC_BLENDWEIGHT
};
class ShaderUtils {
		static createDefinition(device, options) {
				var getDefines = (gpu, gl2, isVertex, options)=>{
						var deviceIntro = device.isWebGPU ? gpu : gl2;
						var attachmentsDefine = '';
						if (!isVertex) {
								var _options_fragmentOutputTypes;
								var fragmentOutputTypes = (_options_fragmentOutputTypes = options.fragmentOutputTypes) != null ? _options_fragmentOutputTypes : 'vec4';
								if (!Array.isArray(fragmentOutputTypes)) {
										fragmentOutputTypes = [
												fragmentOutputTypes
										];
								}
								for(var i = 0; i < device.maxColorAttachments; i++){
										attachmentsDefine += "#define COLOR_ATTACHMENT_" + i + "\n";
										var _fragmentOutputTypes_i;
										var outType = (_fragmentOutputTypes_i = fragmentOutputTypes[i]) != null ? _fragmentOutputTypes_i : 'vec4';
										attachmentsDefine += "#define outType_" + i + " " + outType + "\n";
								}
						}
						return attachmentsDefine + deviceIntro;
				};
				var _options_name;
				var name = (_options_name = options.name) != null ? _options_name : 'Untitled';
				var vertCode;
				var fragCode;
				if (options.shaderLanguage === SHADERLANGUAGE_WGSL) {
						vertCode = options.vertexCode;
						fragCode = options.fragmentCode;
				} else {
						vertCode = ShaderUtils.versionCode(device) + getDefines(webgpuVS, gles3VS, true, options) + ShaderUtils.getDefinesCode(options.vertexDefines) + ShaderUtils.precisionCode(device) + "\n" + sharedFS + ShaderUtils.getShaderNameCode(name) + options.vertexCode;
						fragCode = (options.fragmentPreamble || '') + ShaderUtils.versionCode(device) + getDefines(webgpuPS, gles3PS, false, options) + ShaderUtils.getDefinesCode(options.fragmentDefines) + ShaderUtils.precisionCode(device) + "\n" + sharedFS + ShaderUtils.getShaderNameCode(name) + (options.fragmentCode || ShaderUtils.dummyFragmentCode());
				}
				var _options_shaderLanguage;
				return {
						name: name,
						shaderLanguage: (_options_shaderLanguage = options.shaderLanguage) != null ? _options_shaderLanguage : SHADERLANGUAGE_GLSL,
						attributes: options.attributes,
						vshader: vertCode,
						vincludes: options.vertexIncludes,
						fincludes: options.fragmentIncludes,
						fshader: fragCode,
						useTransformFeedback: options.useTransformFeedback,
						meshUniformBufferFormat: options.meshUniformBufferFormat,
						meshBindGroupFormat: options.meshBindGroupFormat
				};
		}
		static getDefinesCode(defines) {
				var code = '';
				defines == null ? undefined : defines.forEach((value, key)=>{
						code += "#define " + key + " " + value + "\n";
				});
				return code;
		}
		static getShaderNameCode(name) {
				return "#define SHADER_NAME " + name + "\n";
		}
		static dummyFragmentCode() {
				return 'void main(void) {gl_FragColor = vec4(0.0);}';
		}
		static versionCode(device) {
				return device.isWebGPU ? '#version 450\n' : '#version 300 es\n';
		}
		static precisionCode(device, forcePrecision) {
				if (forcePrecision && forcePrecision !== 'highp' && forcePrecision !== 'mediump' && forcePrecision !== 'lowp') {
						forcePrecision = null;
				}
				if (forcePrecision) {
						if (forcePrecision === 'highp' && device.maxPrecision !== 'highp') {
								forcePrecision = 'mediump';
						}
						if (forcePrecision === 'mediump' && device.maxPrecision === 'lowp') {
								forcePrecision = 'lowp';
						}
				}
				var precision = forcePrecision ? forcePrecision : device.precision;
				var code = "\n            precision " + precision + " float;\n            precision " + precision + " int;\n            precision " + precision + " usampler2D;\n            precision " + precision + " isampler2D;\n            precision " + precision + " sampler2DShadow;\n            precision " + precision + " samplerCubeShadow;\n            precision " + precision + " sampler2DArray;\n        ";
				return code;
		}
		static collectAttributes(vsCode) {
				var attribs = {};
				var attrs = 0;
				var found = vsCode.indexOf('attribute');
				while(found >= 0){
						if (found > 0 && vsCode[found - 1] === '/') break;
						var ignore = false;
						if (found > 0) {
								var startOfLine = vsCode.lastIndexOf('\n', found);
								startOfLine = startOfLine !== -1 ? startOfLine + 1 : 0;
								var lineStartString = vsCode.substring(startOfLine, found);
								if (lineStartString.includes('#')) {
										ignore = true;
								}
						}
						if (!ignore) {
								var endOfLine = vsCode.indexOf(';', found);
								var startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
								var attribName = vsCode.substring(startOfAttribName + 1, endOfLine);
								if (attribs[attribName]) ; else {
										var semantic = _attrib2Semantic[attribName];
										if (semantic !== undefined) {
												attribs[attribName] = semantic;
										} else {
												attribs[attribName] = "ATTR" + attrs;
												attrs++;
										}
								}
						}
						found = vsCode.indexOf('attribute', found + 1);
				}
				return attribs;
		}
}

export { ShaderUtils };
