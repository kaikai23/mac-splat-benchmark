import { uniformTypeToName, UNUSED_UNIFORM_NAME, UNIFORMTYPE_FLOAT, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH_UB, BINDGROUP_MESH, semanticToLocation, TYPE_FLOAT32, TYPE_FLOAT16, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_2D_ARRAY, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, TYPE_INT8, TYPE_INT16, TYPE_INT32 } from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { BindTextureFormat, BindGroupFormat } from './bind-group-format.js';

var KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\buniform\b)/g;
var KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)(;+)/g;
var MARKER = '@@@';
var ARRAY_IDENTIFIER = /([\w-]+)\[(.*?)\]/;
var precisionQualifiers = new Set([
		'highp',
		'mediump',
		'lowp'
]);
var shadowSamplers = new Set([
		'sampler2DShadow',
		'samplerCubeShadow',
		'sampler2DArrayShadow'
]);
var textureDimensions = {
		sampler2D: TEXTUREDIMENSION_2D,
		sampler3D: TEXTUREDIMENSION_3D,
		samplerCube: TEXTUREDIMENSION_CUBE,
		samplerCubeShadow: TEXTUREDIMENSION_CUBE,
		sampler2DShadow: TEXTUREDIMENSION_2D,
		sampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
		sampler2DArrayShadow: TEXTUREDIMENSION_2D_ARRAY,
		isampler2D: TEXTUREDIMENSION_2D,
		usampler2D: TEXTUREDIMENSION_2D,
		isampler3D: TEXTUREDIMENSION_3D,
		usampler3D: TEXTUREDIMENSION_3D,
		isamplerCube: TEXTUREDIMENSION_CUBE,
		usamplerCube: TEXTUREDIMENSION_CUBE,
		isampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
		usampler2DArray: TEXTUREDIMENSION_2D_ARRAY
};
class UniformLine {
		constructor(line, shader){
				this.line = line;
				var words = line.trim().split(/\s+/);
				if (precisionQualifiers.has(words[0])) {
						this.precision = words.shift();
				}
				this.type = words.shift();
				if (line.includes(',')) ;
				if (line.includes('[')) {
						var rest = words.join(' ');
						var match = ARRAY_IDENTIFIER.exec(rest);
						this.name = match[1];
						this.arraySize = Number(match[2]);
						if (isNaN(this.arraySize)) {
								shader.failed = true;
						}
				} else {
						this.name = words.shift();
						this.arraySize = 0;
				}
				this.isSampler = this.type.indexOf('sampler') !== -1;
				this.isSignedInt = this.type.indexOf('isampler') !== -1;
				this.isUnsignedInt = this.type.indexOf('usampler') !== -1;
		}
}
class ShaderProcessor {
		static run(device, shaderDefinition, shader) {
				var varyingMap = new Map();
				var vertexExtracted = ShaderProcessor.extract(shaderDefinition.vshader);
				var fragmentExtracted = ShaderProcessor.extract(shaderDefinition.fshader);
				var attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);
				var vertexVaryingsBlock = ShaderProcessor.processVaryings(vertexExtracted.varyings, varyingMap, true);
				var fragmentVaryingsBlock = ShaderProcessor.processVaryings(fragmentExtracted.varyings, varyingMap, false);
				var outBlock = ShaderProcessor.processOuts(fragmentExtracted.outs);
				var concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
				var uniforms = Array.from(new Set(concatUniforms));
				var parsedUniforms = uniforms.map((line)=>new UniformLine(line, shader));
				var uniformsData = ShaderProcessor.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);
				var vBlock = attributesBlock + "\n" + vertexVaryingsBlock + "\n" + uniformsData.code;
				var vshader = vertexExtracted.src.replace(MARKER, vBlock);
				var fBlock = fragmentVaryingsBlock + "\n" + outBlock + "\n" + uniformsData.code;
				var fshader = fragmentExtracted.src.replace(MARKER, fBlock);
				return {
						vshader: vshader,
						fshader: fshader,
						meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
						meshBindGroupFormat: uniformsData.meshBindGroupFormat
				};
		}
		static extract(src) {
				var attributes = [];
				var varyings = [];
				var outs = [];
				var uniforms = [];
				var replacement = "" + MARKER + "\n";
				var match;
				while((match = KEYWORD.exec(src)) !== null){
						var keyword = match[1];
						switch(keyword){
								case 'attribute':
								case 'varying':
								case 'uniform':
								case 'out':
										{
												KEYWORD_LINE.lastIndex = match.index;
												var lineMatch = KEYWORD_LINE.exec(src);
												if (keyword === 'attribute') {
														attributes.push(lineMatch[2]);
												} else if (keyword === 'varying') {
														varyings.push(lineMatch[2]);
												} else if (keyword === 'out') {
														outs.push(lineMatch[2]);
												} else if (keyword === 'uniform') {
														uniforms.push(lineMatch[2]);
												}
												src = ShaderProcessor.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
												KEYWORD.lastIndex = match.index + replacement.length;
												replacement = '';
												break;
										}
						}
				}
				return {
						src,
						attributes,
						varyings,
						outs,
						uniforms
				};
		}
		static processUniforms(device, uniforms, processingOptions, shader) {
				var uniformLinesSamplers = [];
				var uniformLinesNonSamplers = [];
				uniforms.forEach((uniform)=>{
						if (uniform.isSampler) {
								uniformLinesSamplers.push(uniform);
						} else {
								uniformLinesNonSamplers.push(uniform);
						}
				});
				var meshUniforms = [];
				uniformLinesNonSamplers.forEach((uniform)=>{
						if (!processingOptions.hasUniform(uniform.name)) {
								var uniformType = uniformTypeToName.indexOf(uniform.type);
								var uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
								meshUniforms.push(uniformFormat);
						}
				});
				if (meshUniforms.length === 0) {
						meshUniforms.push(new UniformFormat(UNUSED_UNIFORM_NAME, UNIFORMTYPE_FLOAT));
				}
				var meshUniformBufferFormat = meshUniforms.length ? new UniformBufferFormat(device, meshUniforms) : null;
				var textureFormats = [];
				uniformLinesSamplers.forEach((uniform)=>{
						if (!processingOptions.hasTexture(uniform.name)) {
								var sampleType = SAMPLETYPE_FLOAT;
								if (uniform.isSignedInt) {
										sampleType = SAMPLETYPE_INT;
								} else if (uniform.isUnsignedInt) {
										sampleType = SAMPLETYPE_UINT;
								} else {
										if (uniform.precision === 'highp') {
												sampleType = SAMPLETYPE_UNFILTERABLE_FLOAT;
										}
										if (shadowSamplers.has(uniform.type)) {
												sampleType = SAMPLETYPE_DEPTH;
										}
								}
								var dimension = textureDimensions[uniform.type];
								textureFormats.push(new BindTextureFormat(uniform.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType));
						}
				});
				var meshBindGroupFormat = new BindGroupFormat(device, textureFormats);
				var code = '';
				processingOptions.uniformFormats.forEach((format, bindGroupIndex)=>{
						if (format) {
								code += format.getShaderDeclaration(bindGroupIndex, 0);
						}
				});
				if (meshUniformBufferFormat) {
						code += meshUniformBufferFormat.getShaderDeclaration(BINDGROUP_MESH_UB, 0);
				}
				processingOptions.bindGroupFormats.forEach((format, bindGroupIndex)=>{
						if (format) {
								code += format.getShaderDeclarationTextures(bindGroupIndex);
						}
				});
				code += meshBindGroupFormat.getShaderDeclarationTextures(BINDGROUP_MESH);
				return {
						code,
						meshUniformBufferFormat,
						meshBindGroupFormat
				};
		}
		static processVaryings(varyingLines, varyingMap, isVertex) {
				var block = '';
				var op = isVertex ? 'out' : 'in';
				varyingLines.forEach((line, index)=>{
						var words = ShaderProcessor.splitToWords(line);
						var type = words.slice(0, -1).join(' ');
						var name = words[words.length - 1];
						if (isVertex) {
								varyingMap.set(name, index);
						} else {
								index = varyingMap.get(name);
						}
						block += "layout(location = " + index + ") " + op + " " + type + " " + name + ";\n";
				});
				return block;
		}
		static processOuts(outsLines) {
				var block = '';
				outsLines.forEach((line, index)=>{
						block += "layout(location = " + index + ") out " + line + ";\n";
				});
				return block;
		}
		static getTypeCount(type) {
				var lastChar = type.substring(type.length - 1);
				var num = parseInt(lastChar, 10);
				return isNaN(num) ? 1 : num;
		}
		static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
				var block = '';
				attributeLines.forEach((line)=>{
						var words = ShaderProcessor.splitToWords(line);
						var type = words[0];
						var name = words[1];
						if (shaderDefinitionAttributes.hasOwnProperty(name)) {
								var semantic = shaderDefinitionAttributes[name];
								var location = semanticToLocation[semantic];
								var copyCode;
								var element = processingOptions.getVertexElement(semantic);
								if (element) {
										var dataType = element.dataType;
										if (dataType !== TYPE_FLOAT32 && dataType !== TYPE_FLOAT16 && !element.normalize && !element.asInt) {
												var attribNumElements = ShaderProcessor.getTypeCount(type);
												var newName = "_private_" + name;
												copyCode = "vec" + attribNumElements + " " + name + " = vec" + attribNumElements + "(" + newName + ");\n";
												name = newName;
												var isSignedType = dataType === TYPE_INT8 || dataType === TYPE_INT16 || dataType === TYPE_INT32;
												if (attribNumElements === 1) {
														type = isSignedType ? 'int' : 'uint';
												} else {
														type = isSignedType ? "ivec" + attribNumElements : "uvec" + attribNumElements;
												}
										}
								}
								block += "layout(location = " + location + ") in " + type + " " + name + ";\n";
								if (copyCode) {
										block += copyCode;
								}
						}
				});
				return block;
		}
		static splitToWords(line) {
				line = line.replace(/\s+/g, ' ').trim();
				return line.split(' ');
		}
		static cutOut(src, start, end, replacement) {
				return src.substring(0, start) + replacement + src.substring(end);
		}
}

export { ShaderProcessor };
