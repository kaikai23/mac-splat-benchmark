import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { SHADER_FORWARD, GAMMA_NONE, TONEMAP_LINEAR, PARTICLEORIENTATION_SCREEN } from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { Material } from '../materials/material.js';
import { particle } from '../shader-lib/programs/particle.js';
import { getCoreDefines } from '../shader-lib/utils.js';

class ParticleMaterial extends Material {
		getShaderVariant(params) {
				var { device, scene, cameraShaderParams } = params;
				var { emitter } = this;
				var _cameraShaderParams_shaderOutputGamma, _cameraShaderParams_toneMapping;
				var options = {
						defines: getCoreDefines(this, params),
						pass: SHADER_FORWARD,
						useCpu: this.emitter.useCpu,
						normal: emitter.lighting ? emitter.normalMap !== null ? 2 : 1 : 0,
						halflambert: this.emitter.halfLambert,
						stretch: this.emitter.stretch,
						alignToMotion: this.emitter.alignToMotion,
						soft: this.emitter.depthSoftening,
						mesh: this.emitter.useMesh,
						gamma: (_cameraShaderParams_shaderOutputGamma = cameraShaderParams == null ? undefined : cameraShaderParams.shaderOutputGamma) != null ? _cameraShaderParams_shaderOutputGamma : GAMMA_NONE,
						toneMap: (_cameraShaderParams_toneMapping = cameraShaderParams == null ? undefined : cameraShaderParams.toneMapping) != null ? _cameraShaderParams_toneMapping : TONEMAP_LINEAR,
						fog: scene && !this.emitter.noFog ? scene.fog.type : 'none',
						wrap: this.emitter.wrap && this.emitter.wrapBounds,
						localSpace: this.emitter.localSpace,
						screenSpace: emitter.inTools ? false : this.emitter.screenSpace,
						blend: this.blendType,
						animTex: this.emitter._isAnimated(),
						animTexLoop: this.emitter.animLoop,
						pack8: this.emitter.pack8,
						customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
				};
				var processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat, params.vertexFormat);
				var library = getProgramLibrary(device);
				library.register('particle', particle);
				return library.getProgram('particle', options, processingOptions, this.userId);
		}
		constructor(emitter){
				super(), this.emitter = null;
				this.emitter = emitter;
		}
}

export { ParticleMaterial };
