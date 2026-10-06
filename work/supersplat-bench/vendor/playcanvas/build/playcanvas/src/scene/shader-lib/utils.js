import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import { ShaderGenerator } from './programs/shader-generator.js';
import { SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { ShaderPass } from '../shader-pass.js';

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
function createShader(device, vsName, fsName, useTransformFeedback, shaderDefinitionOptions) {
		if (useTransformFeedback === undefined) useTransformFeedback = false;
		if (shaderDefinitionOptions === undefined) shaderDefinitionOptions = {};
		if (typeof useTransformFeedback === 'boolean') {
				shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
		} else if (typeof useTransformFeedback === 'object') {
				shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
		}
		return new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
				name: vsName + "_" + fsName,
				vertexCode: shaderChunks[vsName],
				fragmentCode: shaderChunks[fsName]
		})));
}
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback, shaderDefinitionOptions) {
		if (useTransformFeedback === undefined) useTransformFeedback = false;
		if (shaderDefinitionOptions === undefined) shaderDefinitionOptions = {};
		if (typeof useTransformFeedback === 'boolean') {
				shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
		} else if (typeof useTransformFeedback === 'object') {
				shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
		}
		var programLibrary = getProgramLibrary(device);
		var shader = programLibrary.getCachedShader(uniqueName);
		if (!shader) {
				shader = new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
						name: uniqueName,
						vertexCode: vsCode,
						fragmentCode: fsCode,
						attributes: attributes
				})));
				programLibrary.setCachedShader(uniqueName, shader);
		}
		return shader;
}
class ShaderGeneratorPassThrough extends ShaderGenerator {
		generateKey(options) {
				return this.key;
		}
		createShaderDefinition(device, options) {
				return this.shaderDefinition;
		}
		constructor(key, shaderDefinition){
				super();
				this.key = key;
				this.shaderDefinition = shaderDefinition;
		}
}
function processShader(shader, processingOptions) {
		var shaderDefinition = shader.definition;
		var _shaderDefinition_name;
		var name = (_shaderDefinition_name = shaderDefinition.name) != null ? _shaderDefinition_name : 'shader';
		var key = name + "-id-" + shader.id;
		var materialGenerator = new ShaderGeneratorPassThrough(key, shaderDefinition);
		var libraryModuleName = 'shader';
		var library = getProgramLibrary(shader.device);
		library.register(libraryModuleName, materialGenerator);
		var variant = library.getProgram(libraryModuleName, {}, processingOptions);
		if (shader.definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
				variant.meshUniformBufferFormat = shaderDefinition.meshUniformBufferFormat;
				variant.meshBindGroupFormat = shaderDefinition.meshBindGroupFormat;
		}
		library.unregister(libraryModuleName);
		return variant;
}
var getCoreDefines = (material, params)=>{
		var defines = new Map(material.defines);
		params.cameraShaderParams.defines.forEach((value, key)=>defines.set(key, value));
		var shaderPassInfo = ShaderPass.get(params.device).getByIndex(params.pass);
		shaderPassInfo.defines.forEach((value, key)=>defines.set(key, value));
		return defines;
};

export { createShader, createShaderFromCode, getCoreDefines, processShader };
