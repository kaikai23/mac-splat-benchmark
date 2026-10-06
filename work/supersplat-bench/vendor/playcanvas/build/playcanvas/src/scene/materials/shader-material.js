import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { SHADERDEF_SKIN, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED_INT } from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { shaderGeneratorShader } from '../shader-lib/programs/shader-generator-shader.js';
import { getCoreDefines } from '../shader-lib/utils.js';
import { Material } from './material.js';

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
class ShaderMaterial extends Material {
		set shaderDesc(value) {
				this._shaderDesc = value ? _extends({}, value) : undefined;
				this.clearVariants();
		}
		get shaderDesc() {
				return this._shaderDesc;
		}
		copy(source) {
				super.copy(source);
				this.shaderDesc = source.shaderDesc;
				return this;
		}
		getShaderVariant(params) {
				var { objDefs } = params;
				var _this_chunks;
				var options = {
						defines: getCoreDefines(this, params),
						skin: (objDefs & SHADERDEF_SKIN) !== 0,
						useInstancing: (objDefs & SHADERDEF_INSTANCING) !== 0,
						useMorphPosition: (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
						useMorphNormal: (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
						useMorphTextureBasedInt: (objDefs & SHADERDEF_MORPH_TEXTURE_BASED_INT) !== 0,
						pass: params.pass,
						gamma: params.cameraShaderParams.shaderOutputGamma,
						toneMapping: params.cameraShaderParams.toneMapping,
						fog: params.cameraShaderParams.fog,
						shaderDesc: this.shaderDesc,
						chunks: (_this_chunks = this.chunks) != null ? _this_chunks : {}
				};
				var processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat, params.vertexFormat);
				var library = getProgramLibrary(params.device);
				library.register('shader-material', shaderGeneratorShader);
				return library.getProgram('shader-material', options, processingOptions, this.userId);
		}
		constructor(shaderDesc){
				super();
				this.shaderDesc = shaderDesc;
		}
}

export { ShaderMaterial };
