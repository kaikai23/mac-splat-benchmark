import { hashCode } from '../../../core/hash.js';
import { SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, SEMANTIC_ATTR15, SHADERLANGUAGE_WGSL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ShaderGenerator } from './shader-generator.js';

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
class ShaderGeneratorShader extends ShaderGenerator {
		generateKey(options) {
				var desc = options.shaderDesc;
				var vsHash = desc.vertexCode ? hashCode(desc.vertexCode) : 0;
				var fsHash = desc.fragmentCode ? hashCode(desc.fragmentCode) : 0;
				var definesHash = ShaderGenerator.definesHash(options.defines);
				var key = desc.uniqueName + "_" + vsHash + "_" + fsHash + "_" + definesHash;
				if (options.skin) key += '_skin';
				if (options.useInstancing) key += '_inst';
				if (options.useMorphPosition) key += '_morphp';
				if (options.useMorphNormal) key += '_morphn';
				if (options.useMorphTextureBasedInt) key += '_morphi';
				return key;
		}
		createAttributesDefinition(definitionOptions, options) {
				var srcAttributes = options.shaderDesc.attributes;
				var attributes = srcAttributes ? _extends({}, srcAttributes) : undefined;
				if (options.skin) {
						attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
						attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
				}
				if (options.useMorphPosition || options.useMorphNormal) {
						attributes.morph_vertex_id = SEMANTIC_ATTR15;
				}
				definitionOptions.attributes = attributes;
		}
		createVertexDefinition(definitionOptions, options, sharedIncludes) {
				var desc = options.shaderDesc;
				if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {
						definitionOptions.vertexCode = desc.vertexCode;
				} else {
						var includes = new Map(sharedIncludes);
						var defines = new Map(options.defines);
						includes.set('transformInstancingVS', '');
						if (options.skin) defines.set('SKIN', true);
						if (options.useInstancing) defines.set('INSTANCING', true);
						if (options.useMorphPosition || options.useMorphNormal) {
								defines.set('MORPHING', true);
								if (options.useMorphTextureBasedInt) defines.set('MORPHING_INT', true);
								if (options.useMorphPosition) defines.set('MORPHING_POSITION', true);
								if (options.useMorphNormal) defines.set('MORPHING_NORMAL', true);
						}
						definitionOptions.vertexCode = desc.vertexCode;
						definitionOptions.vertexIncludes = includes;
						definitionOptions.vertexDefines = defines;
				}
		}
		createFragmentDefinition(definitionOptions, options, sharedIncludes) {
				var desc = options.shaderDesc;
				if (definitionOptions.shaderLanguage === SHADERLANGUAGE_WGSL) {
						definitionOptions.fragmentCode = desc.fragmentCode;
				} else {
						var includes = new Map(sharedIncludes);
						var defines = new Map(options.defines);
						definitionOptions.fragmentCode = desc.fragmentCode;
						definitionOptions.fragmentIncludes = includes;
						definitionOptions.fragmentDefines = defines;
				}
		}
		createShaderDefinition(device, options) {
				var desc = options.shaderDesc;
				var definitionOptions = {
						name: "ShaderMaterial-" + desc.uniqueName,
						shaderLanguage: desc.shaderLanguage,
						fragmentOutputTypes: desc.fragmentOutputTypes,
						meshUniformBufferFormat: desc.meshUniformBufferFormat,
						meshBindGroupFormat: desc.meshBindGroupFormat
				};
				var sharedIncludes = new Map(Object.entries(_extends({}, shaderChunks, options.chunks)));
				this.createAttributesDefinition(definitionOptions, options);
				this.createVertexDefinition(definitionOptions, options, sharedIncludes);
				this.createFragmentDefinition(definitionOptions, options, sharedIncludes);
				return ShaderUtils.createDefinition(device, definitionOptions);
		}
}
var shaderGeneratorShader = new ShaderGeneratorShader();

export { shaderGeneratorShader };
