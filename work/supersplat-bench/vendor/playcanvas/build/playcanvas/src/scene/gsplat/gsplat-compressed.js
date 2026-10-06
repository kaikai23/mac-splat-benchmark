import { Vec2 } from '../../core/math/vec2.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { createGSplatMaterial } from './gsplat-material.js';

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
var strideCopy = (target, targetStride, src, srcStride, numEntries)=>{
		for(var i = 0; i < numEntries; ++i){
				for(var j = 0; j < srcStride; ++j){
						target[i * targetStride + j] = src[i * srcStride + j];
				}
		}
};
class GSplatCompressed {
		destroy() {
				var _this_packedTexture, _this_chunkTexture, _this_shTexture0, _this_shTexture1, _this_shTexture2;
				(_this_packedTexture = this.packedTexture) == null ? undefined : _this_packedTexture.destroy();
				(_this_chunkTexture = this.chunkTexture) == null ? undefined : _this_chunkTexture.destroy();
				(_this_shTexture0 = this.shTexture0) == null ? undefined : _this_shTexture0.destroy();
				(_this_shTexture1 = this.shTexture1) == null ? undefined : _this_shTexture1.destroy();
				(_this_shTexture2 = this.shTexture2) == null ? undefined : _this_shTexture2.destroy();
		}
		createMaterial(options) {
				var result = createGSplatMaterial(options);
				result.setDefine('GSPLAT_COMPRESSED_DATA', true);
				result.setParameter('packedTexture', this.packedTexture);
				result.setParameter('chunkTexture', this.chunkTexture);
				result.setParameter('numSplats', this.numSplatsVisible);
				if (this.shTexture0) {
						result.setDefine('SH_BANDS', 3);
						result.setParameter('shTexture0', this.shTexture0);
						result.setParameter('shTexture1', this.shTexture1);
						result.setParameter('shTexture2', this.shTexture2);
				} else {
						result.setDefine('SH_BANDS', 0);
				}
				return result;
		}
		evalTextureSize(count) {
				var width = Math.ceil(Math.sqrt(count));
				var height = Math.ceil(count / width);
				return new Vec2(width, height);
		}
		createTexture(name, format, size, data) {
				return new Texture(this.device, _extends({
						name: name,
						width: size.x,
						height: size.y,
						format: format,
						cubemap: false,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				}, data ? {
						levels: [
								data
						]
				} : {}));
		}
		constructor(device, gsplatData){
				var { chunkData, chunkSize, numChunks, numSplats, vertexData, shBands } = gsplatData;
				this.device = device;
				this.numSplats = numSplats;
				this.numVisibleSplats = numSplats;
				this.aabb = new BoundingBox();
				gsplatData.calcAabb(this.aabb);
				this.centers = new Float32Array(numSplats * 3);
				gsplatData.getCenters(this.centers);
				this.packedTexture = this.createTexture('packedData', PIXELFORMAT_RGBA32U, this.evalTextureSize(numSplats), vertexData);
				var chunkTextureSize = this.evalTextureSize(numChunks);
				chunkTextureSize.x *= 5;
				this.chunkTexture = this.createTexture('chunkData', PIXELFORMAT_RGBA32F, chunkTextureSize);
				var chunkTextureData = this.chunkTexture.lock();
				strideCopy(chunkTextureData, 20, chunkData, chunkSize, numChunks);
				if (chunkSize === 12) {
						for(var i = 0; i < numChunks; ++i){
								chunkTextureData[i * 20 + 15] = 1;
								chunkTextureData[i * 20 + 16] = 1;
								chunkTextureData[i * 20 + 17] = 1;
						}
				}
				this.chunkTexture.unlock();
				if (shBands > 0) {
						var { shData } = gsplatData;
						var size = this.evalTextureSize(numSplats);
						var texture0 = this.createTexture('shTexture0', PIXELFORMAT_RGBA32U, size);
						var texture1 = this.createTexture('shTexture1', PIXELFORMAT_RGBA32U, size);
						var texture2 = this.createTexture('shTexture2', PIXELFORMAT_RGBA32U, size);
						var data0 = texture0.lock();
						var data1 = texture1.lock();
						var data2 = texture2.lock();
						var target0 = new Uint8Array(data0.buffer);
						var target1 = new Uint8Array(data1.buffer);
						var target2 = new Uint8Array(data2.buffer);
						var srcCoeffs = [
								3,
								8,
								15
						][shBands - 1];
						for(var i1 = 0; i1 < numSplats; ++i1){
								for(var j = 0; j < 15; ++j){
										target0[i1 * 16 + j] = j < srcCoeffs ? shData[(i1 * 3 + 0) * srcCoeffs + j] : 127;
										target1[i1 * 16 + j] = j < srcCoeffs ? shData[(i1 * 3 + 1) * srcCoeffs + j] : 127;
										target2[i1 * 16 + j] = j < srcCoeffs ? shData[(i1 * 3 + 2) * srcCoeffs + j] : 127;
								}
						}
						texture0.unlock();
						texture1.unlock();
						texture2.unlock();
						this.shTexture0 = texture0;
						this.shTexture1 = texture1;
						this.shTexture2 = texture2;
				} else {
						this.shTexture0 = null;
						this.shTexture1 = null;
						this.shTexture2 = null;
				}
		}
}

export { GSplatCompressed };
