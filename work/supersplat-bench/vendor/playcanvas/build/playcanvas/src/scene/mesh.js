import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT, SEMANTIC_POSITION, TYPE_UINT16, TYPE_INT16, TYPE_INT8, BUFFER_STATIC, BUFFER_DYNAMIC, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD, SEMANTIC_COLOR, PRIMITIVE_POINTS, typedArrayIndexFormats, PRIMITIVE_LINES, PRIMITIVE_TRIANGLES, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16 } from '../platform/graphics/constants.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID } from './constants.js';

var id = 0;
class GeometryData {
		initDefaults() {
				this.recreate = false;
				this.verticesUsage = BUFFER_STATIC;
				this.indicesUsage = BUFFER_STATIC;
				this.maxVertices = 0;
				this.maxIndices = 0;
				this.vertexCount = 0;
				this.indexCount = 0;
				this.vertexStreamsUpdated = false;
				this.indexStreamUpdated = false;
				this.vertexStreamDictionary = {};
				this.indices = null;
		}
		_changeVertexCount(count, semantic) {
				if (!this.vertexCount) {
						this.vertexCount = count;
				}
		}
		constructor(){
				this.initDefaults();
		}
}
GeometryData.DEFAULT_COMPONENTS_POSITION = 3;
GeometryData.DEFAULT_COMPONENTS_NORMAL = 3;
GeometryData.DEFAULT_COMPONENTS_UV = 2;
GeometryData.DEFAULT_COMPONENTS_COLORS = 4;
class GeometryVertexStream {
		constructor(data, componentCount, dataType, dataTypeNormalize, asInt){
				this.data = data;
				this.componentCount = componentCount;
				this.dataType = dataType;
				this.dataTypeNormalize = dataTypeNormalize;
				this.asInt = asInt;
		}
}
class Mesh extends RefCountedObject {
		static fromGeometry(graphicsDevice, geometry, options) {
				if (options === undefined) options = {};
				var mesh = new Mesh(graphicsDevice, options);
				var { positions, normals, tangents, colors, uvs, uvs1, blendIndices, blendWeights, indices } = geometry;
				if (positions) {
						mesh.setPositions(positions);
				}
				if (normals) {
						mesh.setNormals(normals);
				}
				if (tangents) {
						mesh.setVertexStream(SEMANTIC_TANGENT, tangents, 4);
				}
				if (colors) {
						mesh.setColors32(colors);
				}
				if (uvs) {
						mesh.setUvs(0, uvs);
				}
				if (uvs1) {
						mesh.setUvs(1, uvs1);
				}
				if (blendIndices) {
						mesh.setVertexStream(SEMANTIC_BLENDINDICES, blendIndices, 4, blendIndices.length / 4, TYPE_UINT8);
				}
				if (blendWeights) {
						mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, blendWeights, 4);
				}
				if (indices) {
						mesh.setIndices(indices);
				}
				mesh.update();
				return mesh;
		}
		set morph(morph) {
				if (morph !== this._morph) {
						if (this._morph) {
								this._morph.decRefCount();
						}
						this._morph = morph;
						if (morph) {
								morph.incRefCount();
						}
				}
		}
		get morph() {
				return this._morph;
		}
		set aabb(aabb) {
				this._aabb = aabb;
				this._aabbVer++;
		}
		get aabb() {
				return this._aabb;
		}
		destroy() {
				var morph = this.morph;
				if (morph) {
						this.morph = null;
						if (morph.refCount < 1) {
								morph.destroy();
						}
				}
				if (this.vertexBuffer) {
						this.vertexBuffer.destroy();
						this.vertexBuffer = null;
				}
				for(var j = 0; j < this.indexBuffer.length; j++){
						this._destroyIndexBuffer(j);
				}
				this.indexBuffer.length = 0;
				this._geometryData = null;
		}
		_destroyIndexBuffer(index) {
				if (this.indexBuffer[index]) {
						this.indexBuffer[index].destroy();
						this.indexBuffer[index] = null;
				}
		}
		_initBoneAabbs(morphTargets) {
				this.boneAabb = [];
				this.boneUsed = [];
				var x, y, z;
				var bMax, bMin;
				var boneMin = [];
				var boneMax = [];
				var boneUsed = this.boneUsed;
				var numBones = this.skin.boneNames.length;
				var maxMorphX, maxMorphY, maxMorphZ;
				for(var i = 0; i < numBones; i++){
						boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
						boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
				}
				var iterator = new VertexIterator(this.vertexBuffer);
				var posElement = iterator.element[SEMANTIC_POSITION];
				var weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
				var indicesElement = iterator.element[SEMANTIC_BLENDINDICES];
				var numVerts = this.vertexBuffer.numVertices;
				for(var j = 0; j < numVerts; j++){
						for(var k = 0; k < 4; k++){
								var boneWeight = weightsElement.array[weightsElement.index + k];
								if (boneWeight > 0) {
										var boneIndex = indicesElement.array[indicesElement.index + k];
										boneUsed[boneIndex] = true;
										x = posElement.array[posElement.index];
										y = posElement.array[posElement.index + 1];
										z = posElement.array[posElement.index + 2];
										bMax = boneMax[boneIndex];
										bMin = boneMin[boneIndex];
										if (bMin.x > x) bMin.x = x;
										if (bMin.y > y) bMin.y = y;
										if (bMin.z > z) bMin.z = z;
										if (bMax.x < x) bMax.x = x;
										if (bMax.y < y) bMax.y = y;
										if (bMax.z < z) bMax.z = z;
										if (morphTargets) {
												var minMorphX = maxMorphX = x;
												var minMorphY = maxMorphY = y;
												var minMorphZ = maxMorphZ = z;
												for(var l = 0; l < morphTargets.length; l++){
														var target = morphTargets[l];
														var dx = target.deltaPositions[j * 3];
														var dy = target.deltaPositions[j * 3 + 1];
														var dz = target.deltaPositions[j * 3 + 2];
														if (dx < 0) {
																minMorphX += dx;
														} else {
																maxMorphX += dx;
														}
														if (dy < 0) {
																minMorphY += dy;
														} else {
																maxMorphY += dy;
														}
														if (dz < 0) {
																minMorphZ += dz;
														} else {
																maxMorphZ += dz;
														}
												}
												if (bMin.x > minMorphX) bMin.x = minMorphX;
												if (bMin.y > minMorphY) bMin.y = minMorphY;
												if (bMin.z > minMorphZ) bMin.z = minMorphZ;
												if (bMax.x < maxMorphX) bMax.x = maxMorphX;
												if (bMax.y < maxMorphY) bMax.y = maxMorphY;
												if (bMax.z < maxMorphZ) bMax.z = maxMorphZ;
										}
								}
						}
						iterator.next();
				}
				var positionElement = this.vertexBuffer.getFormat().elements.find((e)=>e.name === SEMANTIC_POSITION);
				if (positionElement && positionElement.normalize) {
						var func = (()=>{
								switch(positionElement.dataType){
										case TYPE_INT8:
												return (x)=>Math.max(x / 127.0, -1);
										case TYPE_UINT8:
												return (x)=>x / 255.0;
										case TYPE_INT16:
												return (x)=>Math.max(x / 32767.0, -1);
										case TYPE_UINT16:
												return (x)=>x / 65535.0;
										default:
												return (x)=>x;
								}
						})();
						for(var i1 = 0; i1 < numBones; i1++){
								if (boneUsed[i1]) {
										var min = boneMin[i1];
										var max = boneMax[i1];
										min.set(func(min.x), func(min.y), func(min.z));
										max.set(func(max.x), func(max.y), func(max.z));
								}
						}
				}
				for(var i2 = 0; i2 < numBones; i2++){
						var aabb = new BoundingBox();
						aabb.setMinMax(boneMin[i2], boneMax[i2]);
						this.boneAabb.push(aabb);
				}
		}
		_initGeometryData() {
				if (!this._geometryData) {
						this._geometryData = new GeometryData();
						if (this.vertexBuffer) {
								this._geometryData.vertexCount = this.vertexBuffer.numVertices;
								this._geometryData.maxVertices = this.vertexBuffer.numVertices;
						}
						if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
								this._geometryData.indexCount = this.indexBuffer[0].numIndices;
								this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
						}
				}
		}
		clear(verticesDynamic, indicesDynamic, maxVertices, maxIndices) {
				if (maxVertices === undefined) maxVertices = 0;
				if (maxIndices === undefined) maxIndices = 0;
				this._initGeometryData();
				this._geometryData.initDefaults();
				this._geometryData.recreate = true;
				this._geometryData.maxVertices = maxVertices;
				this._geometryData.maxIndices = maxIndices;
				this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
				this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
		}
		setVertexStream(semantic, data, componentCount, numVertices, dataType, dataTypeNormalize, asInt) {
				if (dataType === undefined) dataType = TYPE_FLOAT32;
				if (dataTypeNormalize === undefined) dataTypeNormalize = false;
				if (asInt === undefined) asInt = false;
				this._initGeometryData();
				var vertexCount = numVertices || data.length / componentCount;
				this._geometryData._changeVertexCount(vertexCount, semantic);
				this._geometryData.vertexStreamsUpdated = true;
				this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(data, componentCount, dataType, dataTypeNormalize, asInt);
		}
		getVertexStream(semantic, data) {
				var count = 0;
				var done = false;
				if (this._geometryData) {
						var stream = this._geometryData.vertexStreamDictionary[semantic];
						if (stream) {
								done = true;
								count = this._geometryData.vertexCount;
								if (ArrayBuffer.isView(data)) {
										data.set(stream.data);
								} else {
										data.length = 0;
										data.push(stream.data);
								}
						}
				}
				if (!done) {
						if (this.vertexBuffer) {
								var iterator = new VertexIterator(this.vertexBuffer);
								count = iterator.readData(semantic, data);
						}
				}
				return count;
		}
		setPositions(positions, componentCount, numVertices) {
				if (componentCount === undefined) componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION;
				this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
		}
		setNormals(normals, componentCount, numVertices) {
				if (componentCount === undefined) componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL;
				this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
		}
		setUvs(channel, uvs, componentCount, numVertices) {
				if (componentCount === undefined) componentCount = GeometryData.DEFAULT_COMPONENTS_UV;
				this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
		}
		setColors(colors, componentCount, numVertices) {
				if (componentCount === undefined) componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS;
				this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
		}
		setColors32(colors, numVertices) {
				this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
		}
		setIndices(indices, numIndices) {
				this._initGeometryData();
				this._geometryData.indexStreamUpdated = true;
				this._geometryData.indices = indices;
				this._geometryData.indexCount = numIndices || indices.length;
		}
		getPositions(positions) {
				return this.getVertexStream(SEMANTIC_POSITION, positions);
		}
		getNormals(normals) {
				return this.getVertexStream(SEMANTIC_NORMAL, normals);
		}
		getUvs(channel, uvs) {
				return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
		}
		getColors(colors) {
				return this.getVertexStream(SEMANTIC_COLOR, colors);
		}
		getIndices(indices) {
				var count = 0;
				if (this._geometryData && this._geometryData.indices) {
						var streamIndices = this._geometryData.indices;
						count = this._geometryData.indexCount;
						if (ArrayBuffer.isView(indices)) {
								indices.set(streamIndices);
						} else {
								indices.length = 0;
								for(var i = 0, il = streamIndices.length; i < il; i++){
										indices.push(streamIndices[i]);
								}
						}
				} else {
						if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
								var indexBuffer = this.indexBuffer[0];
								count = indexBuffer.readData(indices);
						}
				}
				return count;
		}
		update(primitiveType, updateBoundingBox) {
				if (primitiveType === undefined) primitiveType = PRIMITIVE_TRIANGLES;
				if (updateBoundingBox === undefined) updateBoundingBox = true;
				if (this._geometryData) {
						if (updateBoundingBox) {
								var stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
								if (stream) {
										if (stream.componentCount === 3) {
												this._aabb.compute(stream.data, this._geometryData.vertexCount);
												this._aabbVer++;
										}
								}
						}
						var destroyVB = this._geometryData.recreate;
						if (this._geometryData.vertexCount > this._geometryData.maxVertices) {
								destroyVB = true;
								this._geometryData.maxVertices = this._geometryData.vertexCount;
						}
						if (destroyVB) {
								if (this.vertexBuffer) {
										this.vertexBuffer.destroy();
										this.vertexBuffer = null;
								}
						}
						var destroyIB = this._geometryData.recreate;
						if (this._geometryData.indexCount > this._geometryData.maxIndices) {
								destroyIB = true;
								this._geometryData.maxIndices = this._geometryData.indexCount;
						}
						if (destroyIB) {
								if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
										this.indexBuffer[0].destroy();
										this.indexBuffer[0] = null;
								}
						}
						if (this._geometryData.vertexStreamsUpdated) {
								this._updateVertexBuffer();
						}
						if (this._geometryData.indexStreamUpdated) {
								this._updateIndexBuffer();
						}
						this.primitive[0].type = primitiveType;
						if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
								if (this._geometryData.indexStreamUpdated) {
										this.primitive[0].count = this._geometryData.indexCount;
										this.primitive[0].indexed = true;
								}
						} else {
								if (this._geometryData.vertexStreamsUpdated) {
										this.primitive[0].count = this._geometryData.vertexCount;
										this.primitive[0].indexed = false;
								}
						}
						this._geometryData.vertexCount = 0;
						this._geometryData.indexCount = 0;
						this._geometryData.vertexStreamsUpdated = false;
						this._geometryData.indexStreamUpdated = false;
						this._geometryData.recreate = false;
						this.updateRenderStates();
				}
		}
		_buildVertexFormat(vertexCount) {
				var vertexDesc = [];
				for(var semantic in this._geometryData.vertexStreamDictionary){
						var stream = this._geometryData.vertexStreamDictionary[semantic];
						vertexDesc.push({
								semantic: semantic,
								components: stream.componentCount,
								type: stream.dataType,
								normalize: stream.dataTypeNormalize,
								asInt: stream.asInt
						});
				}
				return new VertexFormat(this.device, vertexDesc, vertexCount);
		}
		_updateVertexBuffer() {
				if (!this.vertexBuffer) {
						var allocateVertexCount = this._geometryData.maxVertices;
						var format = this._buildVertexFormat(allocateVertexCount);
						this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, {
								usage: this._geometryData.verticesUsage,
								storage: this._storageVertex
						});
				}
				var iterator = new VertexIterator(this.vertexBuffer);
				var numVertices = this._geometryData.vertexCount;
				for(var semantic in this._geometryData.vertexStreamDictionary){
						var stream = this._geometryData.vertexStreamDictionary[semantic];
						iterator.writeData(semantic, stream.data, numVertices);
						delete this._geometryData.vertexStreamDictionary[semantic];
				}
				iterator.end();
		}
		_updateIndexBuffer() {
				if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
						var maxVertices = this._geometryData.maxVertices;
						var createFormat = maxVertices > 0xffff || maxVertices === 0 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
						var options = this._storageIndex ? {
								storage: true
						} : undefined;
						this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage, undefined, options);
				}
				var srcIndices = this._geometryData.indices;
				if (srcIndices) {
						var indexBuffer = this.indexBuffer[0];
						indexBuffer.writeData(srcIndices, this._geometryData.indexCount);
						this._geometryData.indices = null;
				}
		}
		prepareRenderState(renderStyle) {
				if (renderStyle === RENDERSTYLE_WIREFRAME) {
						this.generateWireframe();
				} else if (renderStyle === RENDERSTYLE_POINTS) {
						this.primitive[RENDERSTYLE_POINTS] = {
								type: PRIMITIVE_POINTS,
								base: 0,
								count: this.vertexBuffer ? this.vertexBuffer.numVertices : 0,
								indexed: false
						};
				}
		}
		updateRenderStates() {
				if (this.primitive[RENDERSTYLE_POINTS]) {
						this.prepareRenderState(RENDERSTYLE_POINTS);
				}
				if (this.primitive[RENDERSTYLE_WIREFRAME]) {
						this.prepareRenderState(RENDERSTYLE_WIREFRAME);
				}
		}
		generateWireframe() {
				this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);
				var numVertices = this.vertexBuffer.numVertices;
				var lines = [];
				var format;
				if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
						var offsets = [
								[
										0,
										1
								],
								[
										1,
										2
								],
								[
										2,
										0
								]
						];
						var base = this.primitive[RENDERSTYLE_SOLID].base;
						var count = this.primitive[RENDERSTYLE_SOLID].count;
						var indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
						var srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);
						var seen = new Set();
						for(var j = base; j < base + count; j += 3){
								for(var k = 0; k < 3; k++){
										var i1 = srcIndices[j + offsets[k][0]];
										var i2 = srcIndices[j + offsets[k][1]];
										var hash = i1 > i2 ? i2 * numVertices + i1 : i1 * numVertices + i2;
										if (!seen.has(hash)) {
												seen.add(hash);
												lines.push(i1, i2);
										}
								}
						}
						format = indexBuffer.format;
				} else {
						for(var i = 0; i < numVertices; i += 3){
								lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
						}
						format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
				}
				var wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
				var dstIndices = new typedArrayIndexFormats[wireBuffer.format](wireBuffer.storage);
				dstIndices.set(lines);
				wireBuffer.unlock();
				this.primitive[RENDERSTYLE_WIREFRAME] = {
						type: PRIMITIVE_LINES,
						base: 0,
						count: lines.length,
						indexed: true
				};
				this.indexBuffer[RENDERSTYLE_WIREFRAME] = wireBuffer;
		}
		constructor(graphicsDevice, options){
				super(), this.indexBuffer = [
						null
				], this.vertexBuffer = null, this.primitive = [
						{
								type: 0,
								base: 0,
								count: 0
						}
				], this.skin = null, this.boneAabb = null, this._aabbVer = 0, this._aabb = new BoundingBox(), this._geometryData = null, this._morph = null, this._storageIndex = false, this._storageVertex = false;
				this.id = id++;
				this.device = graphicsDevice;
				this._storageIndex = (options == null ? undefined : options.storageIndex) || false;
				this._storageVertex = (options == null ? undefined : options.storageVertex) || false;
		}
}

export { Mesh };
