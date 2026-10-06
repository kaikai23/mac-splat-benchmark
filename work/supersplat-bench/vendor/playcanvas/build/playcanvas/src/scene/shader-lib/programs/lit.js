import { ChunkBuilder } from '../chunk-builder.js';
import { LitShader } from './lit-shader.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SHADERLANGUAGE_GLSL, SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';

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
var dummyUvs = [
		0,
		1,
		2,
		3,
		4,
		5,
		6,
		7
];
class ShaderGeneratorLit extends ShaderGenerator {
		generateKey(options) {
				var definesHash = ShaderGenerator.definesHash(options.defines);
				var key = "lit_" + definesHash + "_" + dummyUvs.map((dummy, index)=>{
						return options.usedUvs[index] ? '1' : '0';
				}).join('') + options.shaderChunk + LitOptionsUtils.generateKey(options.litOptions);
				return key;
		}
		createShaderDefinition(device, options) {
				var litShader = new LitShader(device, options.litOptions);
				var decl = new ChunkBuilder();
				var code = new ChunkBuilder();
				var func = new ChunkBuilder();
				decl.append('uniform float textureBias;');
				decl.append(litShader.chunks.litShaderArgsPS);
				code.append(options.shaderChunk);
				func.code = 'evaluateFrontend();';
				func.code = "\n" + func.code.split('\n').map((l)=>"    " + l).join('\n') + "\n\n";
				var usedUvSets = options.usedUvs || [
						true
				];
				var mapTransforms = [];
				var definitionOptions = {
						name: 'LitShader',
						shaderLanguage: SHADERLANGUAGE_GLSL,
						tag: litShader.shaderPassInfo.isForward ? SHADERTAG_MATERIAL : undefined
				};
				litShader.generateVertexShader(usedUvSets, usedUvSets, mapTransforms);
				litShader.generateFragmentShader(decl.code, code.code, func.code, 'vUv0');
				var includes = new Map(Object.entries(_extends({}, Object.getPrototypeOf(litShader.chunks), litShader.chunks, options.litOptions.chunks)));
				var defines = new Map(options.defines);
				definitionOptions.attributes = litShader.attributes;
				definitionOptions.vertexCode = litShader.vshader;
				definitionOptions.vertexIncludes = includes;
				definitionOptions.vertexDefines = defines;
				definitionOptions.fragmentCode = litShader.fshader;
				definitionOptions.fragmentIncludes = includes;
				definitionOptions.fragmentDefines = defines;
				return ShaderUtils.createDefinition(device, definitionOptions);
		}
}
var lit = new ShaderGeneratorLit();

export { lit };
