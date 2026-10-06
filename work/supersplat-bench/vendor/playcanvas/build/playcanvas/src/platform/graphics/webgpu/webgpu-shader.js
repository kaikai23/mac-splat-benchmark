import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { ShaderProcessor } from '../shader-processor.js';
import { WebgpuShaderProcessorWGSL } from './webgpu-shader-processor-wgsl.js';

class WebgpuShader {
		destroy(shader) {
				this._vertexCode = null;
				this._fragmentCode = null;
		}
		createShaderModule(code, shaderType) {
				var device = this.shader.device;
				var wgpu = device.wgpu;
				var shaderModule = wgpu.createShaderModule({
						code: code
				});
				return shaderModule;
		}
		getVertexShaderModule() {
				return this.createShaderModule(this._vertexCode, 'Vertex');
		}
		getFragmentShaderModule() {
				return this.createShaderModule(this._fragmentCode, 'Fragment');
		}
		getComputeShaderModule() {
				return this.createShaderModule(this._computeCode, 'Compute');
		}
		processGLSL() {
				var shader = this.shader;
				var processed = ShaderProcessor.run(shader.device, shader.definition, shader);
				this._vertexCode = this.transpile(processed.vshader, 'vertex', shader.definition.vshader);
				this._fragmentCode = this.transpile(processed.fshader, 'fragment', shader.definition.fshader);
				if (!(this._vertexCode && this._fragmentCode)) {
						shader.failed = true;
				} else {
						shader.ready = true;
				}
				shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
				shader.meshBindGroupFormat = processed.meshBindGroupFormat;
		}
		processWGSL() {
				var shader = this.shader;
				var processed = WebgpuShaderProcessorWGSL.run(shader.device, shader.definition, shader);
				this._vertexCode = processed.vshader;
				this._fragmentCode = processed.fshader;
				shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
				shader.meshBindGroupFormat = processed.meshBindGroupFormat;
		}
		transpile(src, shaderType, originalSrc) {
				try {
						var spirv = this.shader.device.glslang.compileGLSL(src, shaderType);
						var wgsl = this.shader.device.twgsl.convertSpirV2WGSL(spirv);
						return wgsl;
				} catch (err) {
						console.error("Failed to transpile webgl " + shaderType + " shader [" + this.shader.label + "] to WebGPU while rendering " + undefined + ", error:\n [" + err.stack + "]", {
								processed: src,
								original: originalSrc,
								shader: this.shader,
								error: err,
								stack: err.stack
						});
				}
		}
		get vertexCode() {
				return this._vertexCode;
		}
		get fragmentCode() {
				return this._fragmentCode;
		}
		loseContext() {}
		restoreContext(device, shader) {}
		constructor(shader){
				this._vertexCode = null;
				this._fragmentCode = null;
				this._computeCode = null;
				this.vertexEntryPoint = 'main';
				this.fragmentEntryPoint = 'main';
				this.computeEntryPoint = 'main';
				this.shader = shader;
				var definition = shader.definition;
				if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
						if (definition.cshader) {
								var _definition_cshader;
								this._computeCode = (_definition_cshader = definition.cshader) != null ? _definition_cshader : null;
								this.computeUniformBufferFormats = definition.computeUniformBufferFormats;
								this.computeBindGroupFormat = definition.computeBindGroupFormat;
						} else {
								this.vertexEntryPoint = 'vertexMain';
								this.fragmentEntryPoint = 'fragmentMain';
								if (definition.processingOptions) {
										this.processWGSL();
								} else {
										var _definition_vshader;
										this._vertexCode = (_definition_vshader = definition.vshader) != null ? _definition_vshader : null;
										var _definition_fshader;
										this._fragmentCode = (_definition_fshader = definition.fshader) != null ? _definition_fshader : null;
										shader.meshUniformBufferFormat = definition.meshUniformBufferFormat;
										shader.meshBindGroupFormat = definition.meshBindGroupFormat;
								}
						}
						shader.ready = true;
				} else {
						if (definition.processingOptions) {
								this.processGLSL();
						}
				}
		}
}

export { WebgpuShader };
