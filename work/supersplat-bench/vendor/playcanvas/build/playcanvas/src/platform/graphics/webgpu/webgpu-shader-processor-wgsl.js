import { uniformTypeToNameMapWGSL, UNUSED_UNIFORM_NAME, UNIFORMTYPE_FLOAT, BINDGROUP_MESH_UB, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH, bindGroupNames, uniformTypeToNameWGSL, semanticToLocation, TEXTUREDIMENSION_CUBE_ARRAY, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_1D, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT } from '../constants.js';
import { UniformFormat, UniformBufferFormat } from '../uniform-buffer-format.js';
import { BindTextureFormat, BindStorageBufferFormat, BindGroupFormat } from '../bind-group-format.js';

var KEYWORD = /^[ \t]*(attribute|varying|uniform)[\t ]+/gm;
var KEYWORD_LINE = /^[ \t]*(attribute|varying|uniform)[ \t]*([^;]+)(;+)/gm;
var KEYWORD_RESOURCE = /^[ \t]*var\s*(<[^>]+>)?\s*[\w\d_]+\s*:\s*(texture_.*|storage_texture_.*|storage.*|external_texture|array<.*>|sampler|sampler_comparison).*;\s*$/gm;
var VARYING = /(?:@interpolate\([^)]*\)\s*)?([\w]+)\s*:/;
var MARKER = '@@@';
var getTextureDimension = (textureType, isArray)=>{
		if (isArray) {
				if (textureType === '2d') return TEXTUREDIMENSION_2D_ARRAY;
				else if (textureType === 'cube') return TEXTUREDIMENSION_CUBE_ARRAY;
		} else {
				switch(textureType){
						case '1d':
								return TEXTUREDIMENSION_1D;
						case '2d':
								return TEXTUREDIMENSION_2D;
						case '3d':
								return TEXTUREDIMENSION_3D;
						case 'cube':
								return TEXTUREDIMENSION_CUBE;
				}
		}
};
var getTextureTypeCode = (dimension, sampleType)=>{
		var sampleFormat = sampleType === SAMPLETYPE_FLOAT ? 'f32' : sampleType === SAMPLETYPE_INT ? 'i32' : 'u32';
		switch(dimension){
				case TEXTUREDIMENSION_1D:
						return "texture_1d<" + sampleFormat + ">";
				case TEXTUREDIMENSION_2D:
						return "texture_2d<" + sampleFormat + ">";
				case TEXTUREDIMENSION_3D:
						return "texture_3d<" + sampleFormat + ">";
				case TEXTUREDIMENSION_CUBE:
						return "texture_cube<" + sampleFormat + ">";
				case TEXTUREDIMENSION_2D_ARRAY:
						return "texture_2d_array<" + sampleFormat + ">";
				case TEXTUREDIMENSION_CUBE_ARRAY:
						return "texture_cube_array<" + sampleFormat + ">";
		}
};
var textureFormat2SampleType = {
		'f32': SAMPLETYPE_FLOAT,
		'i32': SAMPLETYPE_INT,
		'u32': SAMPLETYPE_UINT
};
var splitToWords = (line)=>{
		line = line.replace(/\s+/g, ' ').trim();
		return line.split(/[\s:]+/);
};
class UniformLine {
		constructor(line, shader){
				this.ubName = null;
				this.line = line;
				var parts = splitToWords(line);
				if (parts.length < 2) {
						shader.failed = true;
						return;
				}
				this.name = parts[0];
				this.type = parts.slice(1).join(' ');
		}
}
var ARRAY_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*array<([\w\d_<>]+),\s*(\d+)>;\s*$/;
var TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*texture_(\w+)<([a-zA-Z0-9_,<>]*)>;\s*$/;
var STORAGE_TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*(texture_storage_2d|texture_storage_2d_array)<([\w\d_]+),\s*(\w+)>\s*;\s*$/;
var STORAGE_BUFFER_REGEX = /^\s*var\s*<storage,\s*(read|write)?>\s*([\w\d_]+)\s*:\s*(.*)\s*;\s*$/;
var EXTERNAL_TEXTURE_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*texture_external;\s*$/;
var SAMPLER_REGEX = /^\s*var\s+([\w\d_]+)\s*:\s*(sampler|sampler_comparison)\s*;\s*$/;
class ResourceLine {
		constructor(line, shader){
				this.originalLine = line;
				this.line = line;
				this.isTexture = false;
				this.isSampler = false;
				this.isStorageTexture = false;
				this.isStorageBuffer = false;
				this.isExternalTexture = false;
				this.arraySize = 0;
				this.type = '';
				this.matchedElements = [];
				var arrayMatch = line.match(ARRAY_REGEX);
				if (arrayMatch) {
						this.name = arrayMatch[1];
						this.arraySize = parseInt(arrayMatch[3], 10);
						this.line = "var " + this.name + " : " + arrayMatch[2] + ";";
						this.matchedElements.push(...arrayMatch);
						if (isNaN(this.arraySize)) {
								shader.failed = true;
						}
				}
				var textureMatch = this.line.match(TEXTURE_REGEX);
				if (textureMatch) {
						this.name = textureMatch[1];
						this.type = textureMatch[2];
						this.textureFormat = textureMatch[3];
						this.isTexture = true;
						this.matchedElements.push(...textureMatch);
						this.textureDimension = getTextureDimension(this.type, this.arraySize > 0);
						this.sampleType = textureFormat2SampleType[this.textureFormat];
				}
				var storageTextureMatch = this.line.match(STORAGE_TEXTURE_REGEX);
				if (storageTextureMatch) {
						this.isStorageTexture = true;
						this.name = storageTextureMatch[1];
						this.textureType = storageTextureMatch[2];
						this.format = storageTextureMatch[3];
						this.access = storageTextureMatch[4];
						this.matchedElements.push(...storageTextureMatch);
				}
				var storageBufferMatch = this.line.match(STORAGE_BUFFER_REGEX);
				if (storageBufferMatch) {
						this.isStorageBuffer = true;
						this.accessMode = storageBufferMatch[1] || 'none';
						this.name = storageBufferMatch[2];
						this.type = storageBufferMatch[3];
						this.matchedElements.push(...storageBufferMatch);
				}
				var externalTextureMatch = this.line.match(EXTERNAL_TEXTURE_REGEX);
				if (externalTextureMatch) {
						this.name = externalTextureMatch[1];
						this.isExternalTexture = true;
						this.matchedElements.push(...storageBufferMatch);
				}
				var samplerMatch = this.line.match(SAMPLER_REGEX);
				if (samplerMatch) {
						this.name = samplerMatch[1];
						this.samplerType = samplerMatch[2];
						this.isSampler = true;
						this.matchedElements.push(...samplerMatch);
				}
				if (this.matchedElements.length === 0) {
						shader.failed = true;
				}
		}
}
class WebgpuShaderProcessorWGSL {
		static run(device, shaderDefinition, shader) {
				var varyingMap = new Map();
				var vertexExtracted = WebgpuShaderProcessorWGSL.extract(shaderDefinition.vshader);
				var fragmentExtracted = WebgpuShaderProcessorWGSL.extract(shaderDefinition.fshader);
				var attributesBlock = WebgpuShaderProcessorWGSL.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);
				var vertexVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(vertexExtracted.varyings, varyingMap, true);
				var fragmentVaryingsBlock = WebgpuShaderProcessorWGSL.processVaryings(fragmentExtracted.varyings, varyingMap, false);
				var concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
				var uniforms = Array.from(new Set(concatUniforms));
				var parsedUniforms = uniforms.map((line)=>new UniformLine(line, shader));
				var uniformsData = WebgpuShaderProcessorWGSL.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);
				vertexExtracted.src = WebgpuShaderProcessorWGSL.renameUniformAccess(vertexExtracted.src, parsedUniforms);
				fragmentExtracted.src = WebgpuShaderProcessorWGSL.renameUniformAccess(fragmentExtracted.src, parsedUniforms);
				var concatResources = vertexExtracted.resources.concat(fragmentExtracted.resources);
				var resources = Array.from(new Set(concatResources));
				var parsedResources = resources.map((line)=>new ResourceLine(line, shader));
				var resourcesData = WebgpuShaderProcessorWGSL.processResources(device, parsedResources, shaderDefinition.processingOptions, shader);
				var fOutput = WebgpuShaderProcessorWGSL.generateFragmentOutputStruct(fragmentExtracted.src, device.maxColorAttachments);
				var vBlock = attributesBlock + "\n" + vertexVaryingsBlock + "\n" + uniformsData.code + "\n" + resourcesData.code + "\n";
				var vshader = vertexExtracted.src.replace(MARKER, vBlock);
				var fBlock = fragmentVaryingsBlock + "\n" + fOutput + "\n" + uniformsData.code + "\n" + resourcesData.code + "\n";
				var fshader = fragmentExtracted.src.replace(MARKER, fBlock);
				return {
						vshader: vshader,
						fshader: fshader,
						meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
						meshBindGroupFormat: resourcesData.meshBindGroupFormat
				};
		}
		static extract(src) {
				var attributes = [];
				var varyings = [];
				var uniforms = [];
				var resources = [];
				var replacement = "" + MARKER + "\n";
				var match;
				while((match = KEYWORD.exec(src)) !== null){
						var keyword = match[1];
						KEYWORD_LINE.lastIndex = match.index;
						var lineMatch = KEYWORD_LINE.exec(src);
						if (keyword === 'attribute') {
								attributes.push(lineMatch[2]);
						} else if (keyword === 'varying') {
								varyings.push(lineMatch[2]);
						} else if (keyword === 'uniform') {
								uniforms.push(lineMatch[2]);
						}
						src = WebgpuShaderProcessorWGSL.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
						KEYWORD.lastIndex = match.index + replacement.length;
						replacement = '';
				}
				while((match = KEYWORD_RESOURCE.exec(src)) !== null){
						resources.push(match[0]);
						src = WebgpuShaderProcessorWGSL.cutOut(src, match.index, KEYWORD_RESOURCE.lastIndex, replacement);
						KEYWORD_RESOURCE.lastIndex = match.index + replacement.length;
						replacement = '';
				}
				return {
						src,
						attributes,
						varyings,
						uniforms,
						resources
				};
		}
		static processUniforms(device, uniforms, processingOptions, shader) {
				var meshUniforms = [];
				uniforms.forEach((uniform)=>{
						if (!processingOptions.hasUniform(uniform.name)) {
								uniform.ubName = 'ub_mesh_ub';
								var uniformType = uniformTypeToNameMapWGSL.get(uniform.type);
								var uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
								meshUniforms.push(uniformFormat);
						} else {
								uniform.ubName = 'ub_view';
						}
				});
				if (meshUniforms.length === 0) {
						meshUniforms.push(new UniformFormat(UNUSED_UNIFORM_NAME, UNIFORMTYPE_FLOAT));
				}
				var meshUniformBufferFormat = new UniformBufferFormat(device, meshUniforms);
				var code = '';
				processingOptions.uniformFormats.forEach((format, bindGroupIndex)=>{
						if (format) {
								code += WebgpuShaderProcessorWGSL.getUniformShaderDeclaration(format, bindGroupIndex, 0);
						}
				});
				if (meshUniformBufferFormat) {
						code += WebgpuShaderProcessorWGSL.getUniformShaderDeclaration(meshUniformBufferFormat, BINDGROUP_MESH_UB, 0);
				}
				return {
						code,
						meshUniformBufferFormat
				};
		}
		static renameUniformAccess(source, uniforms) {
				uniforms.forEach((uniform)=>{
						var srcName = "uniform." + uniform.name;
						var dstName = uniform.ubName + "." + uniform.name;
						var regex = new RegExp("\\b" + srcName + "\\b", 'g');
						source = source.replace(regex, dstName);
				});
				return source;
		}
		static processResources(device, resources, processingOptions, shader) {
				var textureFormats = [];
				for(var i = 0; i < resources.length; i++){
						var resource = resources[i];
						if (resource.isTexture) {
								var sampler = resources[i + 1];
								var hasSampler = sampler == null ? undefined : sampler.isSampler;
								var sampleType = resource.sampleType;
								var dimension = resource.textureDimension;
								textureFormats.push(new BindTextureFormat(resource.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType, hasSampler, hasSampler ? sampler.name : null));
								if (hasSampler) i++;
						}
						if (resource.isStorageBuffer) {
								var readOnly = resource.accessMode !== 'read_write';
								var bufferFormat = new BindStorageBufferFormat(resource.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, readOnly);
								bufferFormat.format = resource.type;
								textureFormats.push(bufferFormat);
						}
				}
				var meshBindGroupFormat = new BindGroupFormat(device, textureFormats);
				var code = '';
				processingOptions.bindGroupFormats.forEach((format, bindGroupIndex)=>{
						if (format) {
								code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(format, bindGroupIndex, 1);
						}
				});
				code += WebgpuShaderProcessorWGSL.getTextureShaderDeclaration(meshBindGroupFormat, BINDGROUP_MESH, 0);
				return {
						code,
						meshBindGroupFormat
				};
		}
		static getUniformShaderDeclaration(ubFormat, bindGroup, bindIndex) {
				var name = bindGroupNames[bindGroup];
				var structName = "struct_ub_" + name;
				var code = "struct " + structName + " {\n";
				ubFormat.uniforms.forEach((uniform)=>{
						var typeString = uniformTypeToNameWGSL[uniform.type][0];
						code += "    " + uniform.name + ": " + typeString + (uniform.count ? "[" + uniform.count + "]" : '') + ",\n";
				});
				code += '};\n';
				code += "@group(" + bindGroup + ") @binding(" + bindIndex + ") var<uniform> ub_" + name + " : " + structName + ";\n\n";
				return code;
		}
		static getTextureShaderDeclaration(format, bindGroup, startBindIndex) {
				var code = '';
				var bindIndex = startBindIndex;
				format.textureFormats.forEach((format)=>{
						var typeCode = getTextureTypeCode(format.textureDimension, format.sampleType);
						code += "@group(" + bindGroup + ") @binding(" + bindIndex + ") var " + format.name + ": " + typeCode + ";\n";
						bindIndex++;
						if (format.hasSampler) {
								code += "@group(" + bindGroup + ") @binding(" + bindIndex + ") var " + format.samplerName + ": sampler;\n";
								bindIndex++;
						}
				});
				format.storageBufferFormats.forEach((format)=>{
						var access = format.readOnly ? 'read' : 'read_write';
						code += "@group(" + bindGroup + ") @binding(" + bindIndex + ") var<storage, " + access + "> " + format.name + " : " + format.format + ";\n";
						bindIndex++;
				});
				return code;
		}
		static processVaryings(varyingLines, varyingMap, isVertex) {
				var block = '';
				varyingLines.forEach((line, index)=>{
						var match = line.match(VARYING);
						if (match) {
								var name = match[1];
								if (isVertex) {
										varyingMap.set(name, index);
								} else {
										index = varyingMap.get(name);
								}
								block += "    @location(" + index + ") " + line + ",\n";
						}
				});
				if (isVertex) {
						block += '    @builtin(position) position : vec4f,\n';
				} else {
						block += '    @builtin(position) position : vec4f,\n';
						block += '    @builtin(front_facing) frontFacing : bool,\n';
						block += '    @builtin(sample_index) sampleIndex : u32\n';
				}
				var structName = isVertex ? 'VertexOutput' : 'FragmentInput';
				return "struct " + structName + " {\n" + block + "};\n";
		}
		static generateFragmentOutputStruct(src, numRenderTargets) {
				var structCode = 'struct FragmentOutput {\n';
				for(var i = 0; i < numRenderTargets; i++){
						structCode += "    @location(" + i + ") color" + (i > 0 ? i : '') + " : vec4f,\n";
				}
				var needsFragDepth = src.search(/\.fragDepth\s*=/) !== -1;
				if (needsFragDepth) {
						structCode += '    @builtin(frag_depth) fragDepth : f32\n';
				}
				return "" + structCode + "};\n";
		}
		static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
				var block = '';
				attributeLines.forEach((line)=>{
						var words = splitToWords(line);
						var name = words[0];
						if (shaderDefinitionAttributes.hasOwnProperty(name)) {
								var semantic = shaderDefinitionAttributes[name];
								var location = semanticToLocation[semantic];
								block += "    @location(" + location + ") " + line + ",\n";
						}
				});
				block += '    @builtin(vertex_index) vertexIndex : u32,\n';
				block += '    @builtin(instance_index) instanceIndex : u32\n';
				return "struct VertexInput {\n" + block + "};\n";
		}
		static cutOut(src, start, end, replacement) {
				return src.substring(0, start) + replacement + src.substring(end);
		}
}

export { WebgpuShaderProcessorWGSL };
