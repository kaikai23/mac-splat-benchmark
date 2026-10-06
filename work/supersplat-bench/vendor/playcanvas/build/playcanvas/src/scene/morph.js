import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { FloatPacking } from '../core/math/float-packing.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA16F, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16U, isIntegerPixelFormat, PIXELFORMAT_RGB32F, SEMANTIC_ATTR15, TYPE_UINT32 } from '../platform/graphics/constants.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';

class Morph extends RefCountedObject {
		get aabb() {
				if (!this._aabb) {
						var min = new Vec3();
						var max = new Vec3();
						for(var i = 0; i < this._targets.length; i++){
								var targetAabb = this._targets[i].aabb;
								min.min(targetAabb.getMin());
								max.max(targetAabb.getMax());
						}
						this._aabb = new BoundingBox();
						this._aabb.setMinMax(min, max);
				}
				return this._aabb;
		}
		get morphPositions() {
				return this._morphPositions;
		}
		get morphNormals() {
				return this._morphNormals;
		}
		_init() {
				this._initTextureBased();
				for(var i = 0; i < this._targets.length; i++){
						this._targets[i]._postInit();
				}
		}
		_findSparseSet(deltaArrays, ids, usedDataIndices) {
				var freeIndex = 1;
				var dataCount = deltaArrays[0].length;
				for(var v = 0; v < dataCount; v += 3){
						var vertexUsed = false;
						for(var i = 0; i < deltaArrays.length; i++){
								var data = deltaArrays[i];
								if (data[v] !== 0 || data[v + 1] !== 0 || data[v + 2] !== 0) {
										vertexUsed = true;
										break;
								}
						}
						if (vertexUsed) {
								ids.push(freeIndex);
								usedDataIndices.push(v / 3);
								freeIndex++;
						} else {
								ids.push(0);
						}
				}
				return freeIndex;
		}
		_initTextureBased() {
				var deltaArrays = [], deltaInfos = [];
				for(var i = 0; i < this._targets.length; i++){
						var target = this._targets[i];
						if (target.options.deltaPositions) {
								deltaArrays.push(target.options.deltaPositions);
								deltaInfos.push({
										target: target,
										name: 'texturePositions'
								});
						}
						if (target.options.deltaNormals) {
								deltaArrays.push(target.options.deltaNormals);
								deltaInfos.push({
										target: target,
										name: 'textureNormals'
								});
						}
				}
				var ids = [], usedDataIndices = [];
				var freeIndex = this._findSparseSet(deltaArrays, ids, usedDataIndices);
				var maxTextureSize = this.device.maxTextureSize;
				var morphTextureWidth = Math.ceil(Math.sqrt(freeIndex));
				morphTextureWidth = Math.min(morphTextureWidth, maxTextureSize);
				var morphTextureHeight = Math.ceil(freeIndex / morphTextureWidth);
				if (morphTextureHeight > maxTextureSize) {
						return false;
				}
				this.morphTextureWidth = morphTextureWidth;
				this.morphTextureHeight = morphTextureHeight;
				var halfFloat = false;
				var numComponents = 3;
				var float2Half = FloatPacking.float2Half;
				if (this._textureFormat === PIXELFORMAT_RGBA16F) {
						halfFloat = true;
						numComponents = 4;
				}
				var textures = [];
				for(var i1 = 0; i1 < deltaArrays.length; i1++){
						textures.push(this._createTexture('MorphTarget', this._textureFormat));
				}
				for(var i2 = 0; i2 < deltaArrays.length; i2++){
						var data = deltaArrays[i2];
						var texture = textures[i2];
						var textureData = texture.lock();
						if (halfFloat) {
								for(var v = 0; v < usedDataIndices.length; v++){
										var index = usedDataIndices[v] * 3;
										var dstIndex = v * numComponents + numComponents;
										textureData[dstIndex] = float2Half(data[index]);
										textureData[dstIndex + 1] = float2Half(data[index + 1]);
										textureData[dstIndex + 2] = float2Half(data[index + 2]);
								}
						} else {
								for(var v1 = 0; v1 < usedDataIndices.length; v1++){
										var index1 = usedDataIndices[v1] * 3;
										var dstIndex1 = v1 * numComponents + numComponents;
										textureData[dstIndex1] = data[index1];
										textureData[dstIndex1 + 1] = data[index1 + 1];
										textureData[dstIndex1 + 2] = data[index1 + 2];
								}
						}
						texture.unlock();
						var target1 = deltaInfos[i2].target;
						target1._setTexture(deltaInfos[i2].name, texture);
				}
				var formatDesc = [
						{
								semantic: SEMANTIC_ATTR15,
								components: 1,
								type: TYPE_UINT32,
								asInt: true
						}
				];
				this.vertexBufferIds = new VertexBuffer(this.device, new VertexFormat(this.device, formatDesc, ids.length), ids.length, {
						data: new Uint32Array(ids)
				});
				return true;
		}
		destroy() {
				var _this_vertexBufferIds;
				(_this_vertexBufferIds = this.vertexBufferIds) == null ? undefined : _this_vertexBufferIds.destroy();
				this.vertexBufferIds = null;
				for(var i = 0; i < this._targets.length; i++){
						this._targets[i].destroy();
				}
				this._targets.length = 0;
		}
		get targets() {
				return this._targets;
		}
		_updateMorphFlags() {
				this._morphPositions = false;
				this._morphNormals = false;
				for(var i = 0; i < this._targets.length; i++){
						var target = this._targets[i];
						if (target.morphPositions) {
								this._morphPositions = true;
						}
						if (target.morphNormals) {
								this._morphNormals = true;
						}
				}
		}
		_createTexture(name, format) {
				return new Texture(this.device, {
						width: this.morphTextureWidth,
						height: this.morphTextureHeight,
						format: format,
						cubemap: false,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						name: name
				});
		}
		constructor(targets, graphicsDevice, { preferHighPrecision = false } = {}){
				super();
				this.device = graphicsDevice;
				this.preferHighPrecision = preferHighPrecision;
				this._targets = targets.slice();
				var device = this.device;
				var renderableHalf = device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : undefined;
				var renderableFloat = device.textureFloatRenderable ? PIXELFORMAT_RGBA32F : undefined;
				this._renderTextureFormat = this.preferHighPrecision ? renderableFloat != null ? renderableFloat : renderableHalf : renderableHalf != null ? renderableHalf : renderableFloat;
				var _this__renderTextureFormat;
				this._renderTextureFormat = (_this__renderTextureFormat = this._renderTextureFormat) != null ? _this__renderTextureFormat : PIXELFORMAT_RGBA16U;
				this.intRenderFormat = isIntegerPixelFormat(this._renderTextureFormat);
				this._textureFormat = this.preferHighPrecision ? PIXELFORMAT_RGB32F : PIXELFORMAT_RGBA16F;
				this._init();
				this._updateMorphFlags();
		}
}

export { Morph };
