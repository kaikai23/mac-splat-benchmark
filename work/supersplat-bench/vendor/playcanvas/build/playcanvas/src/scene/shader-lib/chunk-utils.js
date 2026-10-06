import { shaderChunks } from './chunks/chunks.js';

var decodeTable = {
		'linear': 'decodeLinear',
		'srgb': 'decodeGamma',
		'rgbm': 'decodeRGBM',
		'rgbe': 'decodeRGBE',
		'rgbp': 'decodeRGBP'
};
var encodeTable = {
		'linear': 'encodeLinear',
		'srgb': 'encodeGamma',
		'rgbm': 'encodeRGBM',
		'rgbe': 'encodeRGBE',
		'rgbp': 'encodeRGBP'
};
class ChunkUtils {
		static decodeFunc(encoding) {
				return decodeTable[encoding] || 'decodeGamma';
		}
		static encodeFunc(encoding) {
				return encodeTable[encoding] || 'encodeGamma';
		}
		static getScreenDepthChunk(device, cameraShaderParams) {
				return "\n            " + (cameraShaderParams.sceneDepthMapLinear ? '#define SCENE_DEPTHMAP_LINEAR' : '') + "\n            " + (device.textureFloatRenderable ? '#define SCENE_DEPTHMAP_FLOAT' : '') + "\n            " + shaderChunks.screenDepthPS + "\n        ";
		}
}

export { ChunkUtils };
