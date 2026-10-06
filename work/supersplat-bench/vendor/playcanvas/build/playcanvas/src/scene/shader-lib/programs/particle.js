import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { BLEND_NORMAL, BLEND_ADDITIVE, BLEND_MULTIPLICATIVE } from '../../constants.js';
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
class ShaderGeneratorParticle extends ShaderGenerator {
		generateKey(options) {
				var definesHash = ShaderGenerator.definesHash(options.defines);
				var key = "particle_" + definesHash + "_";
				for(var prop in options){
						if (options.hasOwnProperty(prop)) {
								key += options[prop];
						}
				}
				return key;
		}
		_animTex(options) {
				var vshader = '';
				vshader += options.animTexLoop ? shaderChunks.particleAnimFrameLoopVS : shaderChunks.particleAnimFrameClampVS;
				vshader += shaderChunks.particleAnimTexVS;
				return vshader;
		}
		createShaderDefinition(device, options) {
				var executionDefine = "#define PARTICLE_" + (options.useCpu ? 'CPU' : 'GPU') + "\n";
				var fshader = "#define PARTICLE\n" + executionDefine;
				var vshader = "#define VERTEXSHADER\n" + executionDefine;
				if (options.mesh) vshader += '#define USE_MESH\n';
				if (options.localSpace) vshader += '#define LOCAL_SPACE\n';
				if (options.screenSpace) vshader += '#define SCREEN_SPACE\n';
				if (options.animTex) vshader += '\nuniform vec2 animTexTilesParams;\n';
				if (options.animTex) vshader += '\nuniform vec4 animTexParams;\n';
				if (options.animTex) vshader += '\nuniform vec2 animTexIndexParams;\n';
				if (options.normal === 2) vshader += '\nvarying mat3 ParticleMat;\n';
				if (options.normal === 1) vshader += '\nvarying vec3 Normal;\n';
				if (options.soft) vshader += '\nvarying float vDepth;\n';
				var faceVS = options.customFace ? shaderChunks.particle_customFaceVS : shaderChunks.particle_billboardVS;
				if (!options.useCpu) {
						vshader += shaderChunks.particle_initVS;
						vshader += options.pack8 ? shaderChunks.particleInputRgba8PS : shaderChunks.particleInputFloatPS;
						if (options.soft > 0) vshader += shaderChunks.screenDepthPS;
						vshader += shaderChunks.particleVS;
						if (options.localSpace) vshader += shaderChunks.particle_localShiftVS;
						if (options.animTex) vshader += this._animTex(options);
						if (options.wrap) vshader += shaderChunks.particle_wrapVS;
						if (options.alignToMotion) vshader += shaderChunks.particle_pointAlongVS;
						vshader += options.mesh ? shaderChunks.particle_meshVS : faceVS;
						if (options.normal === 1) vshader += shaderChunks.particle_normalVS;
						if (options.normal === 2) vshader += shaderChunks.particle_TBNVS;
						if (options.stretch > 0.0) vshader += shaderChunks.particle_stretchVS;
						vshader += shaderChunks.particle_endVS;
						if (options.soft > 0) vshader += shaderChunks.particle_softVS;
				} else {
						if (options.soft > 0) vshader += shaderChunks.screenDepthPS;
						vshader += shaderChunks.particle_cpuVS;
						if (options.localSpace) vshader += shaderChunks.particle_localShiftVS;
						if (options.animTex) vshader += this._animTex(options);
						if (options.alignToMotion) vshader += shaderChunks.particle_pointAlongVS;
						vshader += options.mesh ? shaderChunks.particle_meshVS : faceVS;
						if (options.normal === 1) vshader += shaderChunks.particle_normalVS;
						if (options.normal === 2) vshader += shaderChunks.particle_TBNVS;
						if (options.stretch > 0.0) vshader += shaderChunks.particle_stretchVS;
						vshader += shaderChunks.particle_cpu_endVS;
						if (options.soft > 0) vshader += shaderChunks.particle_softVS;
				}
				vshader += '}\n';
				if (options.normal > 0) {
						if (options.normal === 1) {
								fshader += '\nvarying vec3 Normal;\n';
						} else if (options.normal === 2) {
								fshader += '\nvarying mat3 ParticleMat;\n';
						}
						fshader += '\nuniform vec3 lightCube[6];\n';
				}
				if (options.soft) fshader += '\nvarying float vDepth;\n';
				fshader += shaderChunks.decodePS;
				fshader += '#include "gammaPS"\n';
				fshader += '#include "tonemappingPS"\n';
				fshader += '#include "fogPS"\n';
				if (options.normal === 2) fshader += '\nuniform sampler2D normalMap;\n';
				if (options.soft > 0) fshader += shaderChunks.screenDepthPS;
				fshader += shaderChunks.particlePS;
				if (options.soft > 0) fshader += shaderChunks.particle_softPS;
				if (options.normal === 1) fshader += '\nvec3 normal = Normal;\n';
				if (options.normal === 2) fshader += shaderChunks.particle_normalMapPS;
				if (options.normal > 0) fshader += options.halflambert ? shaderChunks.particle_halflambertPS : shaderChunks.particle_lambertPS;
				if (options.normal > 0) fshader += shaderChunks.particle_lightingPS;
				if (options.blend === BLEND_NORMAL) {
						fshader += shaderChunks.particle_blendNormalPS;
				} else if (options.blend === BLEND_ADDITIVE) {
						fshader += shaderChunks.particle_blendAddPS;
				} else if (options.blend === BLEND_MULTIPLICATIVE) {
						fshader += shaderChunks.particle_blendMultiplyPS;
				}
				fshader += shaderChunks.particle_endPS;
				var includes = new Map(Object.entries(_extends({}, shaderChunks, options.chunks)));
				return ShaderUtils.createDefinition(device, {
						name: 'ParticleShader',
						vertexCode: vshader,
						fragmentCode: fshader,
						fragmentDefines: options.defines,
						fragmentIncludes: includes,
						vertexDefines: options.defines
				});
		}
}
var particle = new ShaderGeneratorParticle();

export { particle };
