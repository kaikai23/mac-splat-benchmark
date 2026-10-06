import { createShaderFromCode } from '../../scene/shader-lib/utils.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { shaderChunksLightmapper } from '../../scene/shader-lib/chunks/chunks-lightmapper.js';

var DENOISE_FILTER_SIZE = 15;
class LightmapFilters {
		setSourceTexture(texture) {
				this.constantTexSource.setValue(texture);
		}
		prepare(textureWidth, textureHeight) {
				this.pixelOffset[0] = 1 / textureWidth;
				this.pixelOffset[1] = 1 / textureHeight;
				this.constantPixelOffset.setValue(this.pixelOffset);
		}
		prepareDenoise(filterRange, filterSmoothness, bakeHDR) {
				var index = bakeHDR ? 0 : 1;
				if (!this.shaderDenoise[index]) {
						var name = "lmBilateralDeNoise-" + (bakeHDR ? 'hdr' : 'rgbm');
						var define = bakeHDR ? '#define HDR\n' : '';
						this.shaderDenoise[index] = createShaderFromCode(this.device, shaderChunks.fullscreenQuadVS, define + shaderChunksLightmapper.bilateralDeNoisePS, name);
						this.sigmas = new Float32Array(2);
						this.constantSigmas = this.device.scope.resolve('sigmas');
						this.constantKernel = this.device.scope.resolve('kernel[0]');
						this.bZnorm = this.device.scope.resolve('bZnorm');
				}
				this.sigmas[0] = filterRange;
				this.sigmas[1] = filterSmoothness;
				this.constantSigmas.setValue(this.sigmas);
				this.evaluateDenoiseUniforms(filterRange, filterSmoothness);
		}
		getDenoise(bakeHDR) {
				var index = bakeHDR ? 0 : 1;
				return this.shaderDenoise[index];
		}
		getDilate(device, bakeHDR) {
				var index = bakeHDR ? 0 : 1;
				if (!this.shaderDilate[index]) {
						var name = "lmDilate-" + (bakeHDR ? 'hdr' : 'rgbm');
						var define = bakeHDR ? '#define HDR\n' : '';
						this.shaderDilate[index] = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, define + shaderChunksLightmapper.dilatePS, name);
				}
				return this.shaderDilate[index];
		}
		evaluateDenoiseUniforms(filterRange, filterSmoothness) {
				function normpdf(x, sigma) {
						return 0.39894 * Math.exp(-0.5 * x * x / (sigma * sigma)) / sigma;
				}
				this.kernel = this.kernel || new Float32Array(DENOISE_FILTER_SIZE);
				var kernel = this.kernel;
				var kSize = Math.floor((DENOISE_FILTER_SIZE - 1) / 2);
				for(var j = 0; j <= kSize; ++j){
						var value = normpdf(j, filterRange);
						kernel[kSize + j] = value;
						kernel[kSize - j] = value;
				}
				this.constantKernel.setValue(this.kernel);
				var bZnorm = 1 / normpdf(0.0, filterSmoothness);
				this.bZnorm.setValue(bZnorm);
		}
		constructor(device){
				this.device = device;
				this.shaderDilate = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunksLightmapper.dilatePS, 'lmDilate');
				this.constantTexSource = device.scope.resolve('source');
				this.constantPixelOffset = device.scope.resolve('pixelOffset');
				this.pixelOffset = new Float32Array(2);
				this.shaderDenoise = [];
				this.sigmas = null;
				this.constantSigmas = null;
				this.kernel = null;
		}
}

export { LightmapFilters };
