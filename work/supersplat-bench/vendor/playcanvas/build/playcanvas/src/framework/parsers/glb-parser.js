import { path } from '../../core/path.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CULLFACE_NONE, CULLFACE_BACK, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, BUFFER_STATIC, TYPE_FLOAT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, SEMANTIC_COLOR, INDEXFORMAT_UINT32, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { http } from '../../platform/net/http.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Light, lightTypes } from '../../scene/light.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { calculateNormals } from '../../scene/geometry/geometry-utils.js';
import { Render } from '../../scene/render.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Entity } from '../entity.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../anim/constants.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { Asset } from '../asset/asset.js';
import { ABSOLUTE_URL } from '../asset/constants.js';
import { dracoDecode } from './draco-decoder.js';
import { Quat } from '../../core/math/quat.js';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
		try {
				var info = gen[key](arg);
				var value = info.value;
		} catch (error) {
				reject(error);
				return;
		}
		if (info.done) {
				resolve(value);
		} else {
				Promise.resolve(value).then(_next, _throw);
		}
}
function _async_to_generator(fn) {
		return function() {
				var self = this, args = arguments;
				return new Promise(function(resolve, reject) {
						var gen = fn.apply(self, args);
						function _next(value) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
						}
						function _throw(err) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
						}
						_next(undefined);
				});
		};
}
class GlbResources {
		destroy() {
				if (this.renders) {
						this.renders.forEach((render)=>{
								render.meshes = null;
						});
				}
		}
}
var isDataURI = (uri)=>{
		return /^data:[^\n\r,\u2028\u2029]*,.*$/i.test(uri);
};
var getDataURIMimeType = (uri)=>{
		return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'));
};
var getNumComponents = (accessorType)=>{
		switch(accessorType){
				case 'SCALAR':
						return 1;
				case 'VEC2':
						return 2;
				case 'VEC3':
						return 3;
				case 'VEC4':
						return 4;
				case 'MAT2':
						return 4;
				case 'MAT3':
						return 9;
				case 'MAT4':
						return 16;
				default:
						return 3;
		}
};
var getComponentType = (componentType)=>{
		switch(componentType){
				case 5120:
						return TYPE_INT8;
				case 5121:
						return TYPE_UINT8;
				case 5122:
						return TYPE_INT16;
				case 5123:
						return TYPE_UINT16;
				case 5124:
						return TYPE_INT32;
				case 5125:
						return TYPE_UINT32;
				case 5126:
						return TYPE_FLOAT32;
				default:
						return 0;
		}
};
var getComponentSizeInBytes = (componentType)=>{
		switch(componentType){
				case 5120:
						return 1;
				case 5121:
						return 1;
				case 5122:
						return 2;
				case 5123:
						return 2;
				case 5124:
						return 4;
				case 5125:
						return 4;
				case 5126:
						return 4;
				default:
						return 0;
		}
};
var getComponentDataType = (componentType)=>{
		switch(componentType){
				case 5120:
						return Int8Array;
				case 5121:
						return Uint8Array;
				case 5122:
						return Int16Array;
				case 5123:
						return Uint16Array;
				case 5124:
						return Int32Array;
				case 5125:
						return Uint32Array;
				case 5126:
						return Float32Array;
				default:
						return null;
		}
};
var gltfToEngineSemanticMap = {
		'POSITION': SEMANTIC_POSITION,
		'NORMAL': SEMANTIC_NORMAL,
		'TANGENT': SEMANTIC_TANGENT,
		'COLOR_0': SEMANTIC_COLOR,
		'JOINTS_0': SEMANTIC_BLENDINDICES,
		'WEIGHTS_0': SEMANTIC_BLENDWEIGHT,
		'TEXCOORD_0': SEMANTIC_TEXCOORD0,
		'TEXCOORD_1': SEMANTIC_TEXCOORD1,
		'TEXCOORD_2': SEMANTIC_TEXCOORD2,
		'TEXCOORD_3': SEMANTIC_TEXCOORD3,
		'TEXCOORD_4': SEMANTIC_TEXCOORD4,
		'TEXCOORD_5': SEMANTIC_TEXCOORD5,
		'TEXCOORD_6': SEMANTIC_TEXCOORD6,
		'TEXCOORD_7': SEMANTIC_TEXCOORD7
};
var attributeOrder = {
		[SEMANTIC_POSITION]: 0,
		[SEMANTIC_NORMAL]: 1,
		[SEMANTIC_TANGENT]: 2,
		[SEMANTIC_COLOR]: 3,
		[SEMANTIC_BLENDINDICES]: 4,
		[SEMANTIC_BLENDWEIGHT]: 5,
		[SEMANTIC_TEXCOORD0]: 6,
		[SEMANTIC_TEXCOORD1]: 7,
		[SEMANTIC_TEXCOORD2]: 8,
		[SEMANTIC_TEXCOORD3]: 9,
		[SEMANTIC_TEXCOORD4]: 10,
		[SEMANTIC_TEXCOORD5]: 11,
		[SEMANTIC_TEXCOORD6]: 12,
		[SEMANTIC_TEXCOORD7]: 13
};
var getDequantizeFunc = (srcType)=>{
		switch(srcType){
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
};
var dequantizeArray = (dstArray, srcArray, srcType)=>{
		var convFunc = getDequantizeFunc(srcType);
		var len = srcArray.length;
		for(var i = 0; i < len; ++i){
				dstArray[i] = convFunc(srcArray[i]);
		}
		return dstArray;
};
var getAccessorData = (gltfAccessor, bufferViews, flatten)=>{
		if (flatten === undefined) flatten = false;
		var numComponents = getNumComponents(gltfAccessor.type);
		var dataType = getComponentDataType(gltfAccessor.componentType);
		if (!dataType) {
				return null;
		}
		var result;
		if (gltfAccessor.sparse) {
				var sparse = gltfAccessor.sparse;
				var indicesAccessor = {
						count: sparse.count,
						type: 'SCALAR'
				};
				var indices = getAccessorData(Object.assign(indicesAccessor, sparse.indices), bufferViews, true);
				var valuesAccessor = {
						count: sparse.count,
						type: gltfAccessor.type,
						componentType: gltfAccessor.componentType
				};
				var values = getAccessorData(Object.assign(valuesAccessor, sparse.values), bufferViews, true);
				if (gltfAccessor.hasOwnProperty('bufferView')) {
						var baseAccessor = {
								bufferView: gltfAccessor.bufferView,
								byteOffset: gltfAccessor.byteOffset,
								componentType: gltfAccessor.componentType,
								count: gltfAccessor.count,
								type: gltfAccessor.type
						};
						result = getAccessorData(baseAccessor, bufferViews, true).slice();
				} else {
						result = new dataType(gltfAccessor.count * numComponents);
				}
				for(var i = 0; i < sparse.count; ++i){
						var targetIndex = indices[i];
						for(var j = 0; j < numComponents; ++j){
								result[targetIndex * numComponents + j] = values[i * numComponents + j];
						}
				}
		} else {
				if (gltfAccessor.hasOwnProperty('bufferView')) {
						var bufferView = bufferViews[gltfAccessor.bufferView];
						if (flatten && bufferView.hasOwnProperty('byteStride')) {
								var bytesPerElement = numComponents * dataType.BYTES_PER_ELEMENT;
								var storage = new ArrayBuffer(gltfAccessor.count * bytesPerElement);
								var tmpArray = new Uint8Array(storage);
								var dstOffset = 0;
								for(var i1 = 0; i1 < gltfAccessor.count; ++i1){
										var srcOffset = (gltfAccessor.byteOffset || 0) + i1 * bufferView.byteStride;
										for(var b = 0; b < bytesPerElement; ++b){
												tmpArray[dstOffset++] = bufferView[srcOffset++];
										}
								}
								result = new dataType(storage);
						} else {
								result = new dataType(bufferView.buffer, bufferView.byteOffset + (gltfAccessor.byteOffset || 0), gltfAccessor.count * numComponents);
						}
				} else {
						result = new dataType(gltfAccessor.count * numComponents);
				}
		}
		return result;
};
var getAccessorDataFloat32 = (gltfAccessor, bufferViews)=>{
		var data = getAccessorData(gltfAccessor, bufferViews, true);
		if (data instanceof Float32Array || !gltfAccessor.normalized) {
				return data;
		}
		var float32Data = new Float32Array(data.length);
		dequantizeArray(float32Data, data, getComponentType(gltfAccessor.componentType));
		return float32Data;
};
var getAccessorBoundingBox = (gltfAccessor)=>{
		var min = gltfAccessor.min;
		var max = gltfAccessor.max;
		if (!min || !max) {
				return null;
		}
		if (gltfAccessor.normalized) {
				var ctype = getComponentType(gltfAccessor.componentType);
				min = dequantizeArray([], min, ctype);
				max = dequantizeArray([], max, ctype);
		}
		return new BoundingBox(new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
};
var getPrimitiveType = (primitive)=>{
		if (!primitive.hasOwnProperty('mode')) {
				return PRIMITIVE_TRIANGLES;
		}
		switch(primitive.mode){
				case 0:
						return PRIMITIVE_POINTS;
				case 1:
						return PRIMITIVE_LINES;
				case 2:
						return PRIMITIVE_LINELOOP;
				case 3:
						return PRIMITIVE_LINESTRIP;
				case 4:
						return PRIMITIVE_TRIANGLES;
				case 5:
						return PRIMITIVE_TRISTRIP;
				case 6:
						return PRIMITIVE_TRIFAN;
				default:
						return PRIMITIVE_TRIANGLES;
		}
};
var generateIndices = (numVertices)=>{
		var dummyIndices = new Uint16Array(numVertices);
		for(var i = 0; i < numVertices; i++){
				dummyIndices[i] = i;
		}
		return dummyIndices;
};
var generateNormals = (sourceDesc, indices)=>{
		var p = sourceDesc[SEMANTIC_POSITION];
		if (!p || p.components !== 3) {
				return;
		}
		var positions;
		if (p.size !== p.stride) {
				var srcStride = p.stride / typedArrayTypesByteSize[p.type];
				var src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
				positions = new typedArrayTypes[p.type](p.count * 3);
				for(var i = 0; i < p.count; ++i){
						positions[i * 3 + 0] = src[i * srcStride + 0];
						positions[i * 3 + 1] = src[i * srcStride + 1];
						positions[i * 3 + 2] = src[i * srcStride + 2];
				}
		} else {
				positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
		}
		var numVertices = p.count;
		if (!indices) {
				indices = generateIndices(numVertices);
		}
		var normalsTemp = calculateNormals(positions, indices);
		var normals = new Float32Array(normalsTemp.length);
		normals.set(normalsTemp);
		sourceDesc[SEMANTIC_NORMAL] = {
				buffer: normals.buffer,
				size: 12,
				offset: 0,
				stride: 12,
				count: numVertices,
				components: 3,
				type: TYPE_FLOAT32
		};
};
var cloneTexture = (texture)=>{
		var shallowCopyLevels = (texture)=>{
				var result = [];
				for(var mip = 0; mip < texture._levels.length; ++mip){
						var level = [];
						if (texture.cubemap) {
								for(var face = 0; face < 6; ++face){
										level.push(texture._levels[mip][face]);
								}
						} else {
								level = texture._levels[mip];
						}
						result.push(level);
				}
				return result;
		};
		var result = new Texture(texture.device, texture);
		result._levels = shallowCopyLevels(texture);
		return result;
};
var cloneTextureAsset = (src)=>{
		var result = new Asset("" + src.name + "_clone", src.type, src.file, src.data, src.options);
		result.loaded = true;
		result.resource = cloneTexture(src.resource);
		src.registry.add(result);
		return result;
};
var createVertexBufferInternal = (device, sourceDesc)=>{
		var positionDesc = sourceDesc[SEMANTIC_POSITION];
		if (!positionDesc) {
				return null;
		}
		var numVertices = positionDesc.count;
		var vertexDesc = [];
		for(var semantic in sourceDesc){
				if (sourceDesc.hasOwnProperty(semantic)) {
						var element = {
								semantic: semantic,
								components: sourceDesc[semantic].components,
								type: sourceDesc[semantic].type,
								normalize: !!sourceDesc[semantic].normalize
						};
						if (!VertexFormat.isElementValid(device, element)) {
								element.components++;
						}
						vertexDesc.push(element);
				}
		}
		vertexDesc.sort((lhs, rhs)=>{
				return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
		});
		var i, j, k;
		var source, target, sourceOffset;
		var vertexFormat = new VertexFormat(device, vertexDesc);
		var isCorrectlyInterleaved = true;
		for(i = 0; i < vertexFormat.elements.length; ++i){
				target = vertexFormat.elements[i];
				source = sourceDesc[target.name];
				sourceOffset = source.offset - positionDesc.offset;
				if (source.buffer !== positionDesc.buffer || source.stride !== target.stride || source.size !== target.size || sourceOffset !== target.offset) {
						isCorrectlyInterleaved = false;
						break;
				}
		}
		var vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices);
		var vertexData = vertexBuffer.lock();
		var targetArray = new Uint32Array(vertexData);
		var sourceArray;
		if (isCorrectlyInterleaved) {
				sourceArray = new Uint32Array(positionDesc.buffer, positionDesc.offset, numVertices * vertexBuffer.format.size / 4);
				targetArray.set(sourceArray);
		} else {
				var targetStride, sourceStride;
				for(i = 0; i < vertexBuffer.format.elements.length; ++i){
						target = vertexBuffer.format.elements[i];
						targetStride = target.stride / 4;
						source = sourceDesc[target.name];
						sourceStride = source.stride / 4;
						sourceArray = new Uint32Array(source.buffer, source.offset, (source.count - 1) * sourceStride + (source.size + 3) / 4);
						var src = 0;
						var dst = target.offset / 4;
						var kend = Math.floor((source.size + 3) / 4);
						for(j = 0; j < numVertices; ++j){
								for(k = 0; k < kend; ++k){
										targetArray[dst + k] = sourceArray[src + k];
								}
								src += sourceStride;
								dst += targetStride;
						}
				}
		}
		vertexBuffer.unlock();
		return vertexBuffer;
};
var createVertexBuffer = (device, attributes, indices, accessors, bufferViews, vertexBufferDict)=>{
		var useAttributes = {};
		var attribIds = [];
		for(var attrib in attributes){
				if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
						useAttributes[attrib] = attributes[attrib];
						attribIds.push(attrib + ":" + attributes[attrib]);
				}
		}
		attribIds.sort();
		var vbKey = attribIds.join();
		var vb = vertexBufferDict[vbKey];
		if (!vb) {
				var sourceDesc = {};
				for(var attrib1 in useAttributes){
						var accessor = accessors[attributes[attrib1]];
						var accessorData = getAccessorData(accessor, bufferViews);
						var bufferView = bufferViews[accessor.bufferView];
						var semantic = gltfToEngineSemanticMap[attrib1];
						var size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
						var stride = bufferView && bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
						sourceDesc[semantic] = {
								buffer: accessorData.buffer,
								size: size,
								offset: accessorData.byteOffset,
								stride: stride,
								count: accessor.count,
								components: getNumComponents(accessor.type),
								type: getComponentType(accessor.componentType),
								normalize: accessor.normalized
						};
				}
				if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
						generateNormals(sourceDesc, indices);
				}
				vb = createVertexBufferInternal(device, sourceDesc);
				vertexBufferDict[vbKey] = vb;
		}
		return vb;
};
var createSkin = (device, gltfSkin, accessors, bufferViews, nodes, glbSkins)=>{
		var i, j, bindMatrix;
		var joints = gltfSkin.joints;
		var numJoints = joints.length;
		var ibp = [];
		if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
				var inverseBindMatrices = gltfSkin.inverseBindMatrices;
				var ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews, true);
				var ibmValues = [];
				for(i = 0; i < numJoints; i++){
						for(j = 0; j < 16; j++){
								ibmValues[j] = ibmData[i * 16 + j];
						}
						bindMatrix = new Mat4();
						bindMatrix.set(ibmValues);
						ibp.push(bindMatrix);
				}
		} else {
				for(i = 0; i < numJoints; i++){
						bindMatrix = new Mat4();
						ibp.push(bindMatrix);
				}
		}
		var boneNames = [];
		for(i = 0; i < numJoints; i++){
				boneNames[i] = nodes[joints[i]].name;
		}
		var key = boneNames.join('#');
		var skin = glbSkins.get(key);
		if (!skin) {
				skin = new Skin(device, ibp, boneNames);
				glbSkins.set(key, skin);
		}
		return skin;
};
var createDracoMesh = (device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises)=>{
		var _primitive_extensions;
		var result = new Mesh(device);
		result.aabb = getAccessorBoundingBox(accessors[primitive.attributes.POSITION]);
		var vertexDesc = [];
		for (var [name, index] of Object.entries(primitive.attributes)){
				var accessor = accessors[index];
				var semantic = gltfToEngineSemanticMap[name];
				var componentType = getComponentType(accessor.componentType);
				var _accessor_normalized;
				vertexDesc.push({
						semantic: semantic,
						components: getNumComponents(accessor.type),
						type: componentType,
						normalize: (_accessor_normalized = accessor.normalized) != null ? _accessor_normalized : semantic === SEMANTIC_COLOR && (componentType === TYPE_UINT8 || componentType === TYPE_UINT16)
				});
		}
		promises.push(new Promise((resolve, reject)=>{
				var dracoExt = primitive.extensions.KHR_draco_mesh_compression;
				dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData)=>{
						if (err) {
								console.log(err);
								reject(err);
						} else {
								var _primitive_attributes;
								var order = {};
								for (var [name, index] of Object.entries(dracoExt.attributes)){
										order[gltfToEngineSemanticMap[name]] = decompressedData.attributes.indexOf(index);
								}
								vertexDesc.sort((a, b)=>{
										return order[a.semantic] - order[b.semantic];
								});
								if (!((_primitive_attributes = primitive.attributes) == null ? undefined : _primitive_attributes.NORMAL)) {
										vertexDesc.splice(1, 0, {
												semantic: 'NORMAL',
												components: 3,
												type: TYPE_FLOAT32
										});
								}
								var vertexFormat = new VertexFormat(device, vertexDesc);
								var numVertices = decompressedData.vertices.byteLength / vertexFormat.size;
								var indexFormat = numVertices <= 65535 ? INDEXFORMAT_UINT16 : INDEXFORMAT_UINT32;
								var numIndices = decompressedData.indices.byteLength / (numVertices <= 65535 ? 2 : 4);
								var vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, {
										data: decompressedData.vertices
								});
								var indexBuffer = new IndexBuffer(device, indexFormat, numIndices, BUFFER_STATIC, decompressedData.indices);
								result.vertexBuffer = vertexBuffer;
								result.indexBuffer[0] = indexBuffer;
								result.primitive[0].type = getPrimitiveType(primitive);
								result.primitive[0].base = 0;
								result.primitive[0].count = indexBuffer ? numIndices : numVertices;
								result.primitive[0].indexed = !!indexBuffer;
								resolve();
						}
				});
		}));
		if (primitive == null ? undefined : (_primitive_extensions = primitive.extensions) == null ? undefined : _primitive_extensions.KHR_materials_variants) {
				var variants = primitive.extensions.KHR_materials_variants;
				var tempMapping = {};
				variants.mappings.forEach((mapping)=>{
						mapping.variants.forEach((variant)=>{
								tempMapping[variant] = mapping.material;
						});
				});
				meshVariants[result.id] = tempMapping;
		}
		meshDefaultMaterials[result.id] = primitive.material;
		return result;
};
var createMesh = (device, gltfMesh, accessors, bufferViews, vertexBufferDict, meshVariants, meshDefaultMaterials, assetOptions, promises)=>{
		var meshes = [];
		gltfMesh.primitives.forEach((primitive)=>{
				var _primitive_extensions;
				if ((_primitive_extensions = primitive.extensions) == null ? undefined : _primitive_extensions.KHR_draco_mesh_compression) {
						meshes.push(createDracoMesh(device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises));
				} else {
						var indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
						var vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, vertexBufferDict);
						var primitiveType = getPrimitiveType(primitive);
						var mesh = new Mesh(device);
						mesh.vertexBuffer = vertexBuffer;
						mesh.primitive[0].type = primitiveType;
						mesh.primitive[0].base = 0;
						mesh.primitive[0].indexed = indices !== null;
						if (indices !== null) {
								var indexFormat;
								if (indices instanceof Uint8Array) {
										indexFormat = INDEXFORMAT_UINT8;
								} else if (indices instanceof Uint16Array) {
										indexFormat = INDEXFORMAT_UINT16;
								} else {
										indexFormat = INDEXFORMAT_UINT32;
								}
								if (indexFormat === INDEXFORMAT_UINT8 && device.isWebGPU) {
										indexFormat = INDEXFORMAT_UINT16;
										indices = new Uint16Array(indices);
								}
								var indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
								mesh.indexBuffer[0] = indexBuffer;
								mesh.primitive[0].count = indices.length;
						} else {
								mesh.primitive[0].count = vertexBuffer.numVertices;
						}
						if (primitive.hasOwnProperty('extensions') && primitive.extensions.hasOwnProperty('KHR_materials_variants')) {
								var variants = primitive.extensions.KHR_materials_variants;
								var tempMapping = {};
								variants.mappings.forEach((mapping)=>{
										mapping.variants.forEach((variant)=>{
												tempMapping[variant] = mapping.material;
										});
								});
								meshVariants[mesh.id] = tempMapping;
						}
						meshDefaultMaterials[mesh.id] = primitive.material;
						var accessor = accessors[primitive.attributes.POSITION];
						mesh.aabb = getAccessorBoundingBox(accessor);
						if (primitive.hasOwnProperty('targets')) {
								var targets = [];
								primitive.targets.forEach((target, index)=>{
										var options = {};
										if (target.hasOwnProperty('POSITION')) {
												accessor = accessors[target.POSITION];
												options.deltaPositions = getAccessorDataFloat32(accessor, bufferViews);
												options.aabb = getAccessorBoundingBox(accessor);
										}
										if (target.hasOwnProperty('NORMAL')) {
												accessor = accessors[target.NORMAL];
												options.deltaNormals = getAccessorDataFloat32(accessor, bufferViews);
										}
										if (gltfMesh.hasOwnProperty('extras') && gltfMesh.extras.hasOwnProperty('targetNames')) {
												options.name = gltfMesh.extras.targetNames[index];
										} else {
												options.name = index.toString(10);
										}
										if (gltfMesh.hasOwnProperty('weights')) {
												options.defaultWeight = gltfMesh.weights[index];
										}
										options.preserveData = assetOptions.morphPreserveData;
										targets.push(new MorphTarget(options));
								});
								mesh.morph = new Morph(targets, device, {
										preferHighPrecision: assetOptions.morphPreferHighPrecision
								});
						}
						meshes.push(mesh);
				}
		});
		return meshes;
};
var extractTextureTransform = (source, material, maps)=>{
		var _source_extensions;
		var map;
		var texCoord = source.texCoord;
		if (texCoord) {
				for(map = 0; map < maps.length; ++map){
						material["" + maps[map] + "MapUv"] = texCoord;
				}
		}
		var zeros = [
				0,
				0
		];
		var ones = [
				1,
				1
		];
		var textureTransform = (_source_extensions = source.extensions) == null ? undefined : _source_extensions.KHR_texture_transform;
		if (textureTransform) {
				var offset = textureTransform.offset || zeros;
				var scale = textureTransform.scale || ones;
				var rotation = textureTransform.rotation ? -textureTransform.rotation * math.RAD_TO_DEG : 0;
				var tilingVec = new Vec2(scale[0], scale[1]);
				var offsetVec = new Vec2(offset[0], 1.0 - scale[1] - offset[1]);
				for(map = 0; map < maps.length; ++map){
						material["" + maps[map] + "MapTiling"] = tilingVec;
						material["" + maps[map] + "MapOffset"] = offsetVec;
						material["" + maps[map] + "MapRotation"] = rotation;
				}
		}
};
var extensionPbrSpecGlossiness = (data, material, textures)=>{
		var color, texture;
		if (data.hasOwnProperty('diffuseFactor')) {
				color = data.diffuseFactor;
				material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
				material.opacity = color[3];
		} else {
				material.diffuse.set(1, 1, 1);
				material.opacity = 1;
		}
		if (data.hasOwnProperty('diffuseTexture')) {
				var diffuseTexture = data.diffuseTexture;
				texture = textures[diffuseTexture.index];
				material.diffuseMap = texture;
				material.diffuseMapChannel = 'rgb';
				material.opacityMap = texture;
				material.opacityMapChannel = 'a';
				extractTextureTransform(diffuseTexture, material, [
						'diffuse',
						'opacity'
				]);
		}
		material.useMetalness = false;
		if (data.hasOwnProperty('specularFactor')) {
				color = data.specularFactor;
				material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
		} else {
				material.specular.set(1, 1, 1);
		}
		if (data.hasOwnProperty('glossinessFactor')) {
				material.gloss = data.glossinessFactor;
		} else {
				material.gloss = 1.0;
		}
		if (data.hasOwnProperty('specularGlossinessTexture')) {
				var specularGlossinessTexture = data.specularGlossinessTexture;
				material.specularEncoding = 'srgb';
				material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
				material.specularMapChannel = 'rgb';
				material.glossMapChannel = 'a';
				extractTextureTransform(specularGlossinessTexture, material, [
						'gloss',
						'metalness'
				]);
		}
};
var extensionClearCoat = (data, material, textures)=>{
		if (data.hasOwnProperty('clearcoatFactor')) {
				material.clearCoat = data.clearcoatFactor * 0.25;
		} else {
				material.clearCoat = 0;
		}
		if (data.hasOwnProperty('clearcoatTexture')) {
				var clearcoatTexture = data.clearcoatTexture;
				material.clearCoatMap = textures[clearcoatTexture.index];
				material.clearCoatMapChannel = 'r';
				extractTextureTransform(clearcoatTexture, material, [
						'clearCoat'
				]);
		}
		if (data.hasOwnProperty('clearcoatRoughnessFactor')) {
				material.clearCoatGloss = data.clearcoatRoughnessFactor;
		} else {
				material.clearCoatGloss = 0;
		}
		if (data.hasOwnProperty('clearcoatRoughnessTexture')) {
				var clearcoatRoughnessTexture = data.clearcoatRoughnessTexture;
				material.clearCoatGlossMap = textures[clearcoatRoughnessTexture.index];
				material.clearCoatGlossMapChannel = 'g';
				extractTextureTransform(clearcoatRoughnessTexture, material, [
						'clearCoatGloss'
				]);
		}
		if (data.hasOwnProperty('clearcoatNormalTexture')) {
				var clearcoatNormalTexture = data.clearcoatNormalTexture;
				material.clearCoatNormalMap = textures[clearcoatNormalTexture.index];
				extractTextureTransform(clearcoatNormalTexture, material, [
						'clearCoatNormal'
				]);
				if (clearcoatNormalTexture.hasOwnProperty('scale')) {
						material.clearCoatBumpiness = clearcoatNormalTexture.scale;
				}
		}
		material.clearCoatGlossInvert = true;
};
var extensionUnlit = (data, material, textures)=>{
		material.useLighting = false;
		material.emissive.copy(material.diffuse);
		material.emissiveMap = material.diffuseMap;
		material.emissiveMapUv = material.diffuseMapUv;
		material.emissiveMapTiling.copy(material.diffuseMapTiling);
		material.emissiveMapOffset.copy(material.diffuseMapOffset);
		material.emissiveMapRotation = material.diffuseMapRotation;
		material.emissiveMapChannel = material.diffuseMapChannel;
		material.emissiveVertexColor = material.diffuseVertexColor;
		material.emissiveVertexColorChannel = material.diffuseVertexColorChannel;
		material.useLighting = false;
		material.useSkybox = false;
		material.diffuse.set(1, 1, 1);
		material.diffuseMap = null;
		material.diffuseVertexColor = false;
};
var extensionSpecular = (data, material, textures)=>{
		material.useMetalnessSpecularColor = true;
		if (data.hasOwnProperty('specularColorTexture')) {
				material.specularEncoding = 'srgb';
				material.specularMap = textures[data.specularColorTexture.index];
				material.specularMapChannel = 'rgb';
				extractTextureTransform(data.specularColorTexture, material, [
						'specular'
				]);
		}
		if (data.hasOwnProperty('specularColorFactor')) {
				var color = data.specularColorFactor;
				material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
		} else {
				material.specular.set(1, 1, 1);
		}
		if (data.hasOwnProperty('specularFactor')) {
				material.specularityFactor = data.specularFactor;
		} else {
				material.specularityFactor = 1;
		}
		if (data.hasOwnProperty('specularTexture')) {
				material.specularityFactorMapChannel = 'a';
				material.specularityFactorMap = textures[data.specularTexture.index];
				extractTextureTransform(data.specularTexture, material, [
						'specularityFactor'
				]);
		}
};
var extensionIor = (data, material, textures)=>{
		if (data.hasOwnProperty('ior')) {
				material.refractionIndex = 1.0 / data.ior;
		}
};
var extensionDispersion = (data, material, textures)=>{
		if (data.hasOwnProperty('dispersion')) {
				material.dispersion = data.dispersion;
		}
};
var extensionTransmission = (data, material, textures)=>{
		material.blendType = BLEND_NORMAL;
		material.useDynamicRefraction = true;
		if (data.hasOwnProperty('transmissionFactor')) {
				material.refraction = data.transmissionFactor;
		}
		if (data.hasOwnProperty('transmissionTexture')) {
				material.refractionMapChannel = 'r';
				material.refractionMap = textures[data.transmissionTexture.index];
				extractTextureTransform(data.transmissionTexture, material, [
						'refraction'
				]);
		}
};
var extensionSheen = (data, material, textures)=>{
		material.useSheen = true;
		if (data.hasOwnProperty('sheenColorFactor')) {
				var color = data.sheenColorFactor;
				material.sheen.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
		} else {
				material.sheen.set(1, 1, 1);
		}
		if (data.hasOwnProperty('sheenColorTexture')) {
				material.sheenMap = textures[data.sheenColorTexture.index];
				material.sheenEncoding = 'srgb';
				extractTextureTransform(data.sheenColorTexture, material, [
						'sheen'
				]);
		}
		material.sheenGloss = data.hasOwnProperty('sheenRoughnessFactor') ? data.sheenRoughnessFactor : 0.0;
		if (data.hasOwnProperty('sheenRoughnessTexture')) {
				material.sheenGlossMap = textures[data.sheenRoughnessTexture.index];
				material.sheenGlossMapChannel = 'a';
				extractTextureTransform(data.sheenRoughnessTexture, material, [
						'sheenGloss'
				]);
		}
		material.sheenGlossInvert = true;
};
var extensionVolume = (data, material, textures)=>{
		material.blendType = BLEND_NORMAL;
		material.useDynamicRefraction = true;
		if (data.hasOwnProperty('thicknessFactor')) {
				material.thickness = data.thicknessFactor;
		}
		if (data.hasOwnProperty('thicknessTexture')) {
				material.thicknessMap = textures[data.thicknessTexture.index];
				material.thicknessMapChannel = 'g';
				extractTextureTransform(data.thicknessTexture, material, [
						'thickness'
				]);
		}
		if (data.hasOwnProperty('attenuationDistance')) {
				material.attenuationDistance = data.attenuationDistance;
		}
		if (data.hasOwnProperty('attenuationColor')) {
				var color = data.attenuationColor;
				material.attenuation.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
		}
};
var extensionEmissiveStrength = (data, material, textures)=>{
		if (data.hasOwnProperty('emissiveStrength')) {
				material.emissiveIntensity = data.emissiveStrength;
		}
};
var extensionIridescence = (data, material, textures)=>{
		material.useIridescence = true;
		if (data.hasOwnProperty('iridescenceFactor')) {
				material.iridescence = data.iridescenceFactor;
		}
		if (data.hasOwnProperty('iridescenceTexture')) {
				material.iridescenceMapChannel = 'r';
				material.iridescenceMap = textures[data.iridescenceTexture.index];
				extractTextureTransform(data.iridescenceTexture, material, [
						'iridescence'
				]);
		}
		if (data.hasOwnProperty('iridescenceIor')) {
				material.iridescenceRefractionIndex = data.iridescenceIor;
		}
		if (data.hasOwnProperty('iridescenceThicknessMinimum')) {
				material.iridescenceThicknessMin = data.iridescenceThicknessMinimum;
		}
		if (data.hasOwnProperty('iridescenceThicknessMaximum')) {
				material.iridescenceThicknessMax = data.iridescenceThicknessMaximum;
		}
		if (data.hasOwnProperty('iridescenceThicknessTexture')) {
				material.iridescenceThicknessMapChannel = 'g';
				material.iridescenceThicknessMap = textures[data.iridescenceThicknessTexture.index];
				extractTextureTransform(data.iridescenceThicknessTexture, material, [
						'iridescenceThickness'
				]);
		}
};
var createMaterial = (gltfMaterial, textures)=>{
		var material = new StandardMaterial();
		if (gltfMaterial.hasOwnProperty('name')) {
				material.name = gltfMaterial.name;
		}
		material.occludeSpecular = SPECOCC_AO;
		material.diffuseVertexColor = true;
		material.specularTint = true;
		material.specularVertexColor = true;
		material.specular.set(1, 1, 1);
		material.gloss = 1;
		material.glossInvert = true;
		material.useMetalness = true;
		var color, texture;
		if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
				var pbrData = gltfMaterial.pbrMetallicRoughness;
				if (pbrData.hasOwnProperty('baseColorFactor')) {
						color = pbrData.baseColorFactor;
						material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
						material.opacity = color[3];
				}
				if (pbrData.hasOwnProperty('baseColorTexture')) {
						var baseColorTexture = pbrData.baseColorTexture;
						texture = textures[baseColorTexture.index];
						material.diffuseMap = texture;
						material.diffuseMapChannel = 'rgb';
						material.opacityMap = texture;
						material.opacityMapChannel = 'a';
						extractTextureTransform(baseColorTexture, material, [
								'diffuse',
								'opacity'
						]);
				}
				if (pbrData.hasOwnProperty('metallicFactor')) {
						material.metalness = pbrData.metallicFactor;
				}
				if (pbrData.hasOwnProperty('roughnessFactor')) {
						material.gloss = pbrData.roughnessFactor;
				}
				if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
						var metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
						material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
						material.metalnessMapChannel = 'b';
						material.glossMapChannel = 'g';
						extractTextureTransform(metallicRoughnessTexture, material, [
								'gloss',
								'metalness'
						]);
				}
		}
		if (gltfMaterial.hasOwnProperty('normalTexture')) {
				var normalTexture = gltfMaterial.normalTexture;
				material.normalMap = textures[normalTexture.index];
				extractTextureTransform(normalTexture, material, [
						'normal'
				]);
				if (normalTexture.hasOwnProperty('scale')) {
						material.bumpiness = normalTexture.scale;
				}
		}
		if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
				var occlusionTexture = gltfMaterial.occlusionTexture;
				material.aoMap = textures[occlusionTexture.index];
				material.aoMapChannel = 'r';
				extractTextureTransform(occlusionTexture, material, [
						'ao'
				]);
		}
		if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
				color = gltfMaterial.emissiveFactor;
				material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
		}
		if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
				var emissiveTexture = gltfMaterial.emissiveTexture;
				material.emissiveMap = textures[emissiveTexture.index];
				extractTextureTransform(emissiveTexture, material, [
						'emissive'
				]);
		}
		if (gltfMaterial.hasOwnProperty('alphaMode')) {
				switch(gltfMaterial.alphaMode){
						case 'MASK':
								material.blendType = BLEND_NONE;
								if (gltfMaterial.hasOwnProperty('alphaCutoff')) {
										material.alphaTest = gltfMaterial.alphaCutoff;
								} else {
										material.alphaTest = 0.5;
								}
								break;
						case 'BLEND':
								material.blendType = BLEND_NORMAL;
								material.depthWrite = false;
								break;
						default:
						case 'OPAQUE':
								material.blendType = BLEND_NONE;
								break;
				}
		} else {
				material.blendType = BLEND_NONE;
		}
		if (gltfMaterial.hasOwnProperty('doubleSided')) {
				material.twoSidedLighting = gltfMaterial.doubleSided;
				material.cull = gltfMaterial.doubleSided ? CULLFACE_NONE : CULLFACE_BACK;
		} else {
				material.twoSidedLighting = false;
				material.cull = CULLFACE_BACK;
		}
		var extensions = {
				'KHR_materials_clearcoat': extensionClearCoat,
				'KHR_materials_emissive_strength': extensionEmissiveStrength,
				'KHR_materials_ior': extensionIor,
				'KHR_materials_dispersion': extensionDispersion,
				'KHR_materials_iridescence': extensionIridescence,
				'KHR_materials_pbrSpecularGlossiness': extensionPbrSpecGlossiness,
				'KHR_materials_sheen': extensionSheen,
				'KHR_materials_specular': extensionSpecular,
				'KHR_materials_transmission': extensionTransmission,
				'KHR_materials_unlit': extensionUnlit,
				'KHR_materials_volume': extensionVolume
		};
		if (gltfMaterial.hasOwnProperty('extensions')) {
				for(var key in gltfMaterial.extensions){
						var extensionFunc = extensions[key];
						if (extensionFunc !== undefined) {
								extensionFunc(gltfMaterial.extensions[key], material, textures);
						}
				}
		}
		material.update();
		return material;
};
var createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes)=>{
		var createAnimData = (gltfAccessor)=>{
				return new AnimData(getNumComponents(gltfAccessor.type), getAccessorDataFloat32(gltfAccessor, bufferViews));
		};
		var interpMap = {
				'STEP': INTERPOLATION_STEP,
				'LINEAR': INTERPOLATION_LINEAR,
				'CUBICSPLINE': INTERPOLATION_CUBIC
		};
		var inputMap = {};
		var outputMap = {};
		var curveMap = {};
		var outputCounter = 1;
		var i;
		for(i = 0; i < gltfAnimation.samplers.length; ++i){
				var sampler = gltfAnimation.samplers[i];
				if (!inputMap.hasOwnProperty(sampler.input)) {
						inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
				}
				if (!outputMap.hasOwnProperty(sampler.output)) {
						outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
				}
				var interpolation = sampler.hasOwnProperty('interpolation') && interpMap.hasOwnProperty(sampler.interpolation) ? interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;
				var curve = {
						paths: [],
						input: sampler.input,
						output: sampler.output,
						interpolation: interpolation
				};
				curveMap[i] = curve;
		}
		var quatArrays = [];
		var transformSchema = {
				'translation': 'localPosition',
				'rotation': 'localRotation',
				'scale': 'localScale'
		};
		var constructNodePath = (node)=>{
				var path = [];
				while(node){
						path.unshift(node.name);
						node = node.parent;
				}
				return path;
		};
		var createMorphTargetCurves = (curve, gltfNode, entityPath)=>{
				var out = outputMap[curve.output];
				if (!out) {
						return;
				}
				var targetNames;
				if (meshes && meshes[gltfNode.mesh]) {
						var mesh = meshes[gltfNode.mesh];
						if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames')) {
								targetNames = mesh.extras.targetNames;
						}
				}
				var outData = out.data;
				var morphTargetCount = outData.length / inputMap[curve.input].data.length;
				var keyframeCount = outData.length / morphTargetCount;
				var singleBufferSize = keyframeCount * 4;
				var buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);
				for(var j = 0; j < morphTargetCount; j++){
						var morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);
						for(var k = 0; k < keyframeCount; k++){
								morphTargetOutput[k] = outData[k * morphTargetCount + j];
						}
						var output = new AnimData(1, morphTargetOutput);
						var weightName = (targetNames == null ? undefined : targetNames[j]) ? "name." + targetNames[j] : j;
						outputMap[-outputCounter] = output;
						var morphCurve = {
								paths: [
										{
												entityPath: entityPath,
												component: 'graph',
												propertyPath: [
														"weight." + weightName
												]
										}
								],
								input: curve.input,
								output: -outputCounter,
								interpolation: curve.interpolation
						};
						outputCounter++;
						curveMap["morphCurve-" + i + "-" + j] = morphCurve;
				}
		};
		for(i = 0; i < gltfAnimation.channels.length; ++i){
				var channel = gltfAnimation.channels[i];
				var target = channel.target;
				var curve1 = curveMap[channel.sampler];
				var node = nodes[target.node];
				var gltfNode = gltfNodes[target.node];
				var entityPath = constructNodePath(node);
				if (target.path.startsWith('weights')) {
						createMorphTargetCurves(curve1, gltfNode, entityPath);
						curveMap[channel.sampler].morphCurve = true;
				} else {
						curve1.paths.push({
								entityPath: entityPath,
								component: 'graph',
								propertyPath: [
										transformSchema[target.path]
								]
						});
				}
		}
		var inputs = [];
		var outputs = [];
		var curves = [];
		for(var inputKey in inputMap){
				inputs.push(inputMap[inputKey]);
				inputMap[inputKey] = inputs.length - 1;
		}
		for(var outputKey in outputMap){
				outputs.push(outputMap[outputKey]);
				outputMap[outputKey] = outputs.length - 1;
		}
		for(var curveKey in curveMap){
				var curveData = curveMap[curveKey];
				if (curveData.morphCurve) {
						continue;
				}
				curves.push(new AnimCurve(curveData.paths, inputMap[curveData.input], outputMap[curveData.output], curveData.interpolation));
				if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
						quatArrays.push(curves[curves.length - 1].output);
				}
		}
		quatArrays.sort();
		var prevIndex = null;
		var data;
		for(i = 0; i < quatArrays.length; ++i){
				var index = quatArrays[i];
				if (i === 0 || index !== prevIndex) {
						data = outputs[index];
						if (data.components === 4) {
								var d = data.data;
								var len = d.length - 4;
								for(var j = 0; j < len; j += 4){
										var dp = d[j + 0] * d[j + 4] + d[j + 1] * d[j + 5] + d[j + 2] * d[j + 6] + d[j + 3] * d[j + 7];
										if (dp < 0) {
												d[j + 4] *= -1;
												d[j + 5] *= -1;
												d[j + 6] *= -1;
												d[j + 7] *= -1;
										}
								}
						}
						prevIndex = index;
				}
		}
		var duration = 0;
		for(i = 0; i < inputs.length; i++){
				data = inputs[i]._data;
				duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
		}
		return new AnimTrack(gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : "animation_" + animationIndex, duration, inputs, outputs, curves);
};
var tempMat = new Mat4();
var tempVec = new Vec3();
var createNode = (gltfNode, nodeIndex, nodeInstancingMap)=>{
		var entity = new GraphNode();
		if (gltfNode.hasOwnProperty('name') && gltfNode.name.length > 0) {
				entity.name = gltfNode.name;
		} else {
				entity.name = "node_" + nodeIndex;
		}
		if (gltfNode.hasOwnProperty('matrix')) {
				tempMat.data.set(gltfNode.matrix);
				tempMat.getTranslation(tempVec);
				entity.setLocalPosition(tempVec);
				tempMat.getEulerAngles(tempVec);
				entity.setLocalEulerAngles(tempVec);
				tempMat.getScale(tempVec);
				entity.setLocalScale(tempVec);
		}
		if (gltfNode.hasOwnProperty('rotation')) {
				var r = gltfNode.rotation;
				entity.setLocalRotation(r[0], r[1], r[2], r[3]);
		}
		if (gltfNode.hasOwnProperty('translation')) {
				var t = gltfNode.translation;
				entity.setLocalPosition(t[0], t[1], t[2]);
		}
		if (gltfNode.hasOwnProperty('scale')) {
				var s = gltfNode.scale;
				entity.setLocalScale(s[0], s[1], s[2]);
		}
		if (gltfNode.hasOwnProperty('extensions') && gltfNode.extensions.EXT_mesh_gpu_instancing) {
				nodeInstancingMap.set(gltfNode, {
						ext: gltfNode.extensions.EXT_mesh_gpu_instancing
				});
		}
		return entity;
};
var createCamera = (gltfCamera, node)=>{
		var projection = gltfCamera.type === 'orthographic' ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE;
		var gltfProperties = projection === PROJECTION_ORTHOGRAPHIC ? gltfCamera.orthographic : gltfCamera.perspective;
		var componentData = {
				enabled: false,
				projection: projection,
				nearClip: gltfProperties.znear,
				aspectRatioMode: ASPECT_AUTO
		};
		if (gltfProperties.zfar) {
				componentData.farClip = gltfProperties.zfar;
		}
		if (projection === PROJECTION_ORTHOGRAPHIC) {
				componentData.orthoHeight = 0.5 * gltfProperties.ymag;
				if (gltfProperties.ymag) {
						componentData.aspectRatioMode = ASPECT_MANUAL;
						componentData.aspectRatio = gltfProperties.xmag / gltfProperties.ymag;
				}
		} else {
				componentData.fov = gltfProperties.yfov * math.RAD_TO_DEG;
				if (gltfProperties.aspectRatio) {
						componentData.aspectRatioMode = ASPECT_MANUAL;
						componentData.aspectRatio = gltfProperties.aspectRatio;
				}
		}
		var cameraEntity = new Entity(gltfCamera.name);
		cameraEntity.addComponent('camera', componentData);
		return cameraEntity;
};
var createLight = (gltfLight, node)=>{
		var lightProps = {
				enabled: false,
				type: gltfLight.type === 'point' ? 'omni' : gltfLight.type,
				color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
				range: gltfLight.hasOwnProperty('range') ? gltfLight.range : 9999,
				falloffMode: LIGHTFALLOFF_INVERSESQUARED,
				intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
		};
		if (gltfLight.hasOwnProperty('spot')) {
				lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
				lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : Math.PI / 4;
		}
		if (gltfLight.hasOwnProperty('intensity')) {
				lightProps.luminance = gltfLight.intensity * Light.getLightUnitConversion(lightTypes[lightProps.type], lightProps.outerConeAngle, lightProps.innerConeAngle);
		}
		var lightEntity = new Entity(node.name);
		lightEntity.rotateLocal(90, 0, 0);
		lightEntity.addComponent('light', lightProps);
		return lightEntity;
};
var createSkins = (device, gltf, nodes, bufferViews)=>{
		if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
				return [];
		}
		var glbSkins = new Map();
		return gltf.skins.map((gltfSkin)=>{
				return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
		});
};
var createMeshes = (device, gltf, bufferViews, options)=>{
		var _gltf_meshes, _gltf_accessors, _gltf_bufferViews;
		var vertexBufferDict = {};
		var meshVariants = {};
		var meshDefaultMaterials = {};
		var promises = [];
		var valid = !options.skipMeshes && (gltf == null ? undefined : (_gltf_meshes = gltf.meshes) == null ? undefined : _gltf_meshes.length) && (gltf == null ? undefined : (_gltf_accessors = gltf.accessors) == null ? undefined : _gltf_accessors.length) && (gltf == null ? undefined : (_gltf_bufferViews = gltf.bufferViews) == null ? undefined : _gltf_bufferViews.length);
		var meshes = valid ? gltf.meshes.map((gltfMesh)=>{
				return createMesh(device, gltfMesh, gltf.accessors, bufferViews, vertexBufferDict, meshVariants, meshDefaultMaterials, options, promises);
		}) : [];
		return {
				meshes,
				meshVariants,
				meshDefaultMaterials,
				promises
		};
};
var createMaterials = (gltf, textures, options)=>{
		var _options_material, _options_material1, _options_material2;
		if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_material = options.material) == null ? undefined : _options_material.preprocess;
		var _options_material_process;
		var process = (_options_material_process = options == null ? undefined : (_options_material1 = options.material) == null ? undefined : _options_material1.process) != null ? _options_material_process : createMaterial;
		var postprocess = options == null ? undefined : (_options_material2 = options.material) == null ? undefined : _options_material2.postprocess;
		return gltf.materials.map((gltfMaterial)=>{
				if (preprocess) {
						preprocess(gltfMaterial);
				}
				var material = process(gltfMaterial, textures);
				if (postprocess) {
						postprocess(gltfMaterial, material);
				}
				return material;
		});
};
var createVariants = (gltf)=>{
		if (!gltf.hasOwnProperty('extensions') || !gltf.extensions.hasOwnProperty('KHR_materials_variants')) {
				return null;
		}
		var data = gltf.extensions.KHR_materials_variants.variants;
		var variants = {};
		for(var i = 0; i < data.length; i++){
				variants[data[i].name] = i;
		}
		return variants;
};
var createAnimations = (gltf, nodes, bufferViews, options)=>{
		var _options_animation, _options_animation1;
		if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_animation = options.animation) == null ? undefined : _options_animation.preprocess;
		var postprocess = options == null ? undefined : (_options_animation1 = options.animation) == null ? undefined : _options_animation1.postprocess;
		return gltf.animations.map((gltfAnimation, index)=>{
				if (preprocess) {
						preprocess(gltfAnimation);
				}
				var animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes, gltf.nodes);
				if (postprocess) {
						postprocess(gltfAnimation, animation);
				}
				return animation;
		});
};
var createInstancing = (device, gltf, nodeInstancingMap, bufferViews)=>{
		var accessors = gltf.accessors;
		nodeInstancingMap.forEach((data, entity)=>{
				var attributes = data.ext.attributes;
				var translations;
				if (attributes.hasOwnProperty('TRANSLATION')) {
						var accessor = accessors[attributes.TRANSLATION];
						translations = getAccessorDataFloat32(accessor, bufferViews);
				}
				var rotations;
				if (attributes.hasOwnProperty('ROTATION')) {
						var accessor1 = accessors[attributes.ROTATION];
						rotations = getAccessorDataFloat32(accessor1, bufferViews);
				}
				var scales;
				if (attributes.hasOwnProperty('SCALE')) {
						var accessor2 = accessors[attributes.SCALE];
						scales = getAccessorDataFloat32(accessor2, bufferViews);
				}
				var instanceCount = (translations ? translations.length / 3 : 0) || (rotations ? rotations.length / 4 : 0) || (scales ? scales.length / 3 : 0);
				if (instanceCount) {
						var matrices = new Float32Array(instanceCount * 16);
						var pos = new Vec3();
						var rot = new Quat();
						var scl = new Vec3(1, 1, 1);
						var matrix = new Mat4();
						var matrixIndex = 0;
						for(var i = 0; i < instanceCount; i++){
								var i3 = i * 3;
								if (translations) {
										pos.set(translations[i3], translations[i3 + 1], translations[i3 + 2]);
								}
								if (rotations) {
										var i4 = i * 4;
										rot.set(rotations[i4], rotations[i4 + 1], rotations[i4 + 2], rotations[i4 + 3]);
								}
								if (scales) {
										scl.set(scales[i3], scales[i3 + 1], scales[i3 + 2]);
								}
								matrix.setTRS(pos, rot, scl);
								for(var m = 0; m < 16; m++){
										matrices[matrixIndex++] = matrix.data[m];
								}
						}
						data.matrices = matrices;
				}
		});
};
var createNodes = (gltf, options, nodeInstancingMap)=>{
		var _options_node, _options_node1, _options_node2;
		if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_node = options.node) == null ? undefined : _options_node.preprocess;
		var _options_node_process;
		var process = (_options_node_process = options == null ? undefined : (_options_node1 = options.node) == null ? undefined : _options_node1.process) != null ? _options_node_process : createNode;
		var postprocess = options == null ? undefined : (_options_node2 = options.node) == null ? undefined : _options_node2.postprocess;
		var nodes = gltf.nodes.map((gltfNode, index)=>{
				if (preprocess) {
						preprocess(gltfNode);
				}
				var node = process(gltfNode, index, nodeInstancingMap);
				if (postprocess) {
						postprocess(gltfNode, node);
				}
				return node;
		});
		for(var i = 0; i < gltf.nodes.length; ++i){
				var gltfNode = gltf.nodes[i];
				if (gltfNode.hasOwnProperty('children')) {
						var parent = nodes[i];
						var uniqueNames = {};
						for(var j = 0; j < gltfNode.children.length; ++j){
								var child = nodes[gltfNode.children[j]];
								if (!child.parent) {
										if (uniqueNames.hasOwnProperty(child.name)) {
												child.name += uniqueNames[child.name]++;
										} else {
												uniqueNames[child.name] = 1;
										}
										parent.addChild(child);
								}
						}
				}
		}
		return nodes;
};
var createScenes = (gltf, nodes)=>{
		var _gltf_scenes__nodes;
		var scenes = [];
		var count = gltf.scenes.length;
		if (count === 1 && ((_gltf_scenes__nodes = gltf.scenes[0].nodes) == null ? undefined : _gltf_scenes__nodes.length) === 1) {
				var nodeIndex = gltf.scenes[0].nodes[0];
				scenes.push(nodes[nodeIndex]);
		} else {
				for(var i = 0; i < count; i++){
						var scene = gltf.scenes[i];
						if (scene.nodes) {
								var sceneRoot = new GraphNode(scene.name);
								for(var n = 0; n < scene.nodes.length; n++){
										var childNode = nodes[scene.nodes[n]];
										sceneRoot.addChild(childNode);
								}
								scenes.push(sceneRoot);
						}
				}
		}
		return scenes;
};
var createCameras = (gltf, nodes, options)=>{
		var cameras = null;
		if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('cameras') && gltf.cameras.length > 0) {
				var _options_camera, _options_camera1, _options_camera2;
				var preprocess = options == null ? undefined : (_options_camera = options.camera) == null ? undefined : _options_camera.preprocess;
				var _options_camera_process;
				var process = (_options_camera_process = options == null ? undefined : (_options_camera1 = options.camera) == null ? undefined : _options_camera1.process) != null ? _options_camera_process : createCamera;
				var postprocess = options == null ? undefined : (_options_camera2 = options.camera) == null ? undefined : _options_camera2.postprocess;
				gltf.nodes.forEach((gltfNode, nodeIndex)=>{
						if (gltfNode.hasOwnProperty('camera')) {
								var gltfCamera = gltf.cameras[gltfNode.camera];
								if (gltfCamera) {
										if (preprocess) {
												preprocess(gltfCamera);
										}
										var camera = process(gltfCamera, nodes[nodeIndex]);
										if (postprocess) {
												postprocess(gltfCamera, camera);
										}
										if (camera) {
												if (!cameras) cameras = new Map();
												cameras.set(gltfNode, camera);
										}
								}
						}
				});
		}
		return cameras;
};
var createLights = (gltf, nodes, options)=>{
		var lights = null;
		if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') && gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {
				var gltfLights = gltf.extensions.KHR_lights_punctual.lights;
				if (gltfLights.length) {
						var _options_light, _options_light1, _options_light2;
						var preprocess = options == null ? undefined : (_options_light = options.light) == null ? undefined : _options_light.preprocess;
						var _options_light_process;
						var process = (_options_light_process = options == null ? undefined : (_options_light1 = options.light) == null ? undefined : _options_light1.process) != null ? _options_light_process : createLight;
						var postprocess = options == null ? undefined : (_options_light2 = options.light) == null ? undefined : _options_light2.postprocess;
						gltf.nodes.forEach((gltfNode, nodeIndex)=>{
								if (gltfNode.hasOwnProperty('extensions') && gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') && gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {
										var lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
										var gltfLight = gltfLights[lightIndex];
										if (gltfLight) {
												if (preprocess) {
														preprocess(gltfLight);
												}
												var light = process(gltfLight, nodes[nodeIndex]);
												if (postprocess) {
														postprocess(gltfLight, light);
												}
												if (light) {
														if (!lights) lights = new Map();
														lights.set(gltfNode, light);
												}
										}
								}
						});
				}
		}
		return lights;
};
var linkSkins = (gltf, renders, skins)=>{
		gltf.nodes.forEach((gltfNode)=>{
				if (gltfNode.hasOwnProperty('mesh') && gltfNode.hasOwnProperty('skin')) {
						var meshGroup = renders[gltfNode.mesh].meshes;
						meshGroup.forEach((mesh)=>{
								mesh.skin = skins[gltfNode.skin];
						});
				}
		});
};
var createResources = /*#__PURE__*/ _async_to_generator(function*(device, gltf, bufferViews, textures, options) {
		var _options_global, _options_global1;
		var preprocess = options == null ? undefined : (_options_global = options.global) == null ? undefined : _options_global.preprocess;
		var postprocess = options == null ? undefined : (_options_global1 = options.global) == null ? undefined : _options_global1.postprocess;
		if (preprocess) {
				preprocess(gltf);
		}
		if (gltf.asset && gltf.asset.generator === 'PlayCanvas') ;
		var nodeInstancingMap = new Map();
		var nodes = createNodes(gltf, options, nodeInstancingMap);
		var scenes = createScenes(gltf, nodes);
		var lights = createLights(gltf, nodes, options);
		var cameras = createCameras(gltf, nodes, options);
		var variants = createVariants(gltf);
		var bufferViewData = yield Promise.all(bufferViews);
		var { meshes, meshVariants, meshDefaultMaterials, promises } = createMeshes(device, gltf, bufferViewData, options);
		var animations = createAnimations(gltf, nodes, bufferViewData, options);
		createInstancing(device, gltf, nodeInstancingMap, bufferViewData);
		var textureAssets = yield Promise.all(textures);
		var textureInstances = textureAssets.map((t)=>t.resource);
		var materials = createMaterials(gltf, textureInstances, options);
		var skins = createSkins(device, gltf, nodes, bufferViewData);
		var renders = [];
		for(var i = 0; i < meshes.length; i++){
				renders[i] = new Render();
				renders[i].meshes = meshes[i];
		}
		linkSkins(gltf, renders, skins);
		var result = new GlbResources();
		result.gltf = gltf;
		result.nodes = nodes;
		result.scenes = scenes;
		result.animations = animations;
		result.textures = textureAssets;
		result.materials = materials;
		result.variants = variants;
		result.meshVariants = meshVariants;
		result.meshDefaultMaterials = meshDefaultMaterials;
		result.renders = renders;
		result.skins = skins;
		result.lights = lights;
		result.cameras = cameras;
		result.nodeInstancingMap = nodeInstancingMap;
		if (postprocess) {
				postprocess(gltf, result);
		}
		yield Promise.all(promises);
		return result;
});
var applySampler = (texture, gltfSampler)=>{
		var getFilter = (filter, defaultValue)=>{
				switch(filter){
						case 9728:
								return FILTER_NEAREST;
						case 9729:
								return FILTER_LINEAR;
						case 9984:
								return FILTER_NEAREST_MIPMAP_NEAREST;
						case 9985:
								return FILTER_LINEAR_MIPMAP_NEAREST;
						case 9986:
								return FILTER_NEAREST_MIPMAP_LINEAR;
						case 9987:
								return FILTER_LINEAR_MIPMAP_LINEAR;
						default:
								return defaultValue;
				}
		};
		var getWrap = (wrap, defaultValue)=>{
				switch(wrap){
						case 33071:
								return ADDRESS_CLAMP_TO_EDGE;
						case 33648:
								return ADDRESS_MIRRORED_REPEAT;
						case 10497:
								return ADDRESS_REPEAT;
						default:
								return defaultValue;
				}
		};
		if (texture) {
				gltfSampler = gltfSampler != null ? gltfSampler : {};
				texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
				texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
				texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
				texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
		}
};
var gltfTextureUniqueId = 0;
var getTextureSource = (gltfTexture)=>{
		var _gltfTexture_extensions_KHR_texture_basisu, _gltfTexture_extensions, _gltfTexture_extensions_EXT_texture_webp, _gltfTexture_extensions1;
		var _gltfTexture_extensions_KHR_texture_basisu_source, _ref;
		return (_ref = (_gltfTexture_extensions_KHR_texture_basisu_source = (_gltfTexture_extensions = gltfTexture.extensions) == null ? undefined : (_gltfTexture_extensions_KHR_texture_basisu = _gltfTexture_extensions.KHR_texture_basisu) == null ? undefined : _gltfTexture_extensions_KHR_texture_basisu.source) != null ? _gltfTexture_extensions_KHR_texture_basisu_source : (_gltfTexture_extensions1 = gltfTexture.extensions) == null ? undefined : (_gltfTexture_extensions_EXT_texture_webp = _gltfTexture_extensions1.EXT_texture_webp) == null ? undefined : _gltfTexture_extensions_EXT_texture_webp.source) != null ? _ref : gltfTexture.source;
};
var createImages = (gltf, bufferViews, urlBase, registry, options)=>{
		var _options_image, _options_image1, _options_image2;
		if (!gltf.images || gltf.images.length === 0) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_image = options.image) == null ? undefined : _options_image.preprocess;
		var processAsync = options == null ? undefined : (_options_image1 = options.image) == null ? undefined : _options_image1.processAsync;
		var postprocess = options == null ? undefined : (_options_image2 = options.image) == null ? undefined : _options_image2.postprocess;
		var mimeTypeFileExtensions = {
				'image/png': 'png',
				'image/jpeg': 'jpg',
				'image/basis': 'basis',
				'image/ktx': 'ktx',
				'image/ktx2': 'ktx2',
				'image/vnd-ms.dds': 'dds'
		};
		var getGammaTextures = (gltf)=>{
				var set = new Set();
				if (gltf.hasOwnProperty('materials')) {
						gltf.materials.forEach((gltfMaterial)=>{
								if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
										var pbrData = gltfMaterial.pbrMetallicRoughness;
										if (pbrData.hasOwnProperty('baseColorTexture')) {
												var gltfTexture = gltf.textures[pbrData.baseColorTexture.index];
												set.add(getTextureSource(gltfTexture));
										}
								}
								if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
										var gltfTexture1 = gltf.textures[gltfMaterial.emissiveTexture.index];
										set.add(getTextureSource(gltfTexture1));
								}
						});
				}
				return set;
		};
		var loadTexture = (gltfImage, url, bufferView, mimeType, options, srgb)=>{
				return new Promise((resolve, reject)=>{
						var continuation = (bufferViewData)=>{
								var name = (gltfImage.name || 'gltf-texture') + "-" + gltfTextureUniqueId++;
								var file = {
										url: url || name
								};
								if (bufferViewData) {
										file.contents = bufferViewData.slice(0).buffer;
								}
								if (mimeType) {
										var extension = mimeTypeFileExtensions[mimeType];
										if (extension) {
												file.filename = file.url + "." + extension;
										}
								}
								var data = {
										srgb
								};
								var asset = new Asset(name, 'texture', file, data, options);
								asset.on('load', (asset)=>resolve(asset));
								asset.on('error', (err)=>reject(err));
								registry.add(asset);
								registry.load(asset);
						};
						if (bufferView) {
								bufferView.then((bufferViewData)=>continuation(bufferViewData));
						} else {
								continuation(null);
						}
				});
		};
		var gammaTextures = getGammaTextures(gltf);
		return gltf.images.map((gltfImage, i)=>{
				if (preprocess) {
						preprocess(gltfImage);
				}
				var promise;
				if (processAsync) {
						promise = new Promise((resolve, reject)=>{
								processAsync(gltfImage, (err, textureAsset)=>{
										if (err) {
												reject(err);
										} else {
												resolve(textureAsset);
										}
								});
						});
				} else {
						promise = new Promise((resolve)=>{
								resolve(null);
						});
				}
				promise = promise.then((textureAsset)=>{
						var srgb = gammaTextures.has(i);
						if (textureAsset) {
								return textureAsset;
						} else if (gltfImage.hasOwnProperty('uri')) {
								if (isDataURI(gltfImage.uri)) {
										return loadTexture(gltfImage, gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null, srgb);
								}
								return loadTexture(gltfImage, ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, {
										crossOrigin: 'anonymous'
								}, srgb);
						} else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
								return loadTexture(gltfImage, null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null, srgb);
						}
						return Promise.reject(new Error("Invalid image found in gltf (neither uri or bufferView found). index=" + i));
				});
				if (postprocess) {
						promise = promise.then((textureAsset)=>{
								postprocess(gltfImage, textureAsset);
								return textureAsset;
						});
				}
				return promise;
		});
};
var createTextures = (gltf, images, options)=>{
		var _gltf_images, _gltf_textures, _options_texture, _options_texture1, _options_texture2;
		if (!(gltf == null ? undefined : (_gltf_images = gltf.images) == null ? undefined : _gltf_images.length) || !(gltf == null ? undefined : (_gltf_textures = gltf.textures) == null ? undefined : _gltf_textures.length)) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_texture = options.texture) == null ? undefined : _options_texture.preprocess;
		var processAsync = options == null ? undefined : (_options_texture1 = options.texture) == null ? undefined : _options_texture1.processAsync;
		var postprocess = options == null ? undefined : (_options_texture2 = options.texture) == null ? undefined : _options_texture2.postprocess;
		var seenImages = new Set();
		return gltf.textures.map((gltfTexture)=>{
				if (preprocess) {
						preprocess(gltfTexture);
				}
				var promise;
				if (processAsync) {
						promise = new Promise((resolve, reject)=>{
								processAsync(gltfTexture, gltf.images, (err, gltfImageIndex)=>{
										if (err) {
												reject(err);
										} else {
												resolve(gltfImageIndex);
										}
								});
						});
				} else {
						promise = new Promise((resolve)=>{
								resolve(null);
						});
				}
				promise = promise.then((gltfImageIndex)=>{
						gltfImageIndex = gltfImageIndex != null ? gltfImageIndex : getTextureSource(gltfTexture);
						var cloneAsset = seenImages.has(gltfImageIndex);
						seenImages.add(gltfImageIndex);
						return images[gltfImageIndex].then((imageAsset)=>{
								var asset = cloneAsset ? cloneTextureAsset(imageAsset) : imageAsset;
								var _gltf_samplers;
								applySampler(asset.resource, ((_gltf_samplers = gltf.samplers) != null ? _gltf_samplers : [])[gltfTexture.sampler]);
								return asset;
						});
				});
				if (postprocess) {
						promise = promise.then((textureAsset)=>{
								postprocess(gltfTexture, textureAsset);
								return textureAsset;
						});
				}
				return promise;
		});
};
var loadBuffers = (gltf, binaryChunk, urlBase, options)=>{
		var _options_buffer, _options_buffer1, _options_buffer2;
		if (!gltf.buffers || gltf.buffers.length === 0) {
				return [];
		}
		var preprocess = options == null ? undefined : (_options_buffer = options.buffer) == null ? undefined : _options_buffer.preprocess;
		var processAsync = options == null ? undefined : (_options_buffer1 = options.buffer) == null ? undefined : _options_buffer1.processAsync;
		var postprocess = options == null ? undefined : (_options_buffer2 = options.buffer) == null ? undefined : _options_buffer2.postprocess;
		return gltf.buffers.map((gltfBuffer, i)=>{
				if (preprocess) {
						preprocess(gltfBuffer);
				}
				var promise;
				if (processAsync) {
						promise = new Promise((resolve, reject)=>{
								processAsync(gltfBuffer, (err, arrayBuffer)=>{
										if (err) {
												reject(err);
										} else {
												resolve(arrayBuffer);
										}
								});
						});
				} else {
						promise = new Promise((resolve)=>{
								resolve(null);
						});
				}
				promise = promise.then((arrayBuffer)=>{
						if (arrayBuffer) {
								return arrayBuffer;
						} else if (gltfBuffer.hasOwnProperty('uri')) {
								if (isDataURI(gltfBuffer.uri)) {
										var byteString = atob(gltfBuffer.uri.split(',')[1]);
										var binaryArray = new Uint8Array(byteString.length);
										for(var j = 0; j < byteString.length; j++){
												binaryArray[j] = byteString.charCodeAt(j);
										}
										return binaryArray;
								}
								return new Promise((resolve, reject)=>{
										http.get(ABSOLUTE_URL.test(gltfBuffer.uri) ? gltfBuffer.uri : path.join(urlBase, gltfBuffer.uri), {
												cache: true,
												responseType: 'arraybuffer',
												retry: false
										}, (err, result)=>{
												if (err) {
														reject(err);
												} else {
														resolve(new Uint8Array(result));
												}
										});
								});
						}
						return binaryChunk;
				});
				if (postprocess) {
						promise = promise.then((buffer)=>{
								postprocess(gltf.buffers[i], buffer);
								return buffer;
						});
				}
				return promise;
		});
};
var parseGltf = (gltfChunk, callback)=>{
		var decodeBinaryUtf8 = (array)=>{
				if (typeof TextDecoder !== 'undefined') {
						return new TextDecoder().decode(array);
				}
				var str = '';
				for(var i = 0; i < array.length; i++){
						str += String.fromCharCode(array[i]);
				}
				return decodeURIComponent(escape(str));
		};
		var gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));
		if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
				callback("Invalid gltf version. Expected version 2.0 or above but found version '" + gltf.asset.version + "'.");
				return;
		}
		callback(null, gltf);
};
var parseGlb = (glbData, callback)=>{
		var data = glbData instanceof ArrayBuffer ? new DataView(glbData) : new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);
		var magic = data.getUint32(0, true);
		var version = data.getUint32(4, true);
		var length = data.getUint32(8, true);
		if (magic !== 0x46546C67) {
				callback("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
				return;
		}
		if (version !== 2) {
				callback("Invalid version number found in glb header. Expected 2, found " + version);
				return;
		}
		if (length <= 0 || length > data.byteLength) {
				callback("Invalid length found in glb header. Found " + length);
				return;
		}
		var chunks = [];
		var offset = 12;
		while(offset < length){
				var chunkLength = data.getUint32(offset, true);
				if (offset + chunkLength + 8 > data.byteLength) {
						callback("Invalid chunk length found in glb. Found " + chunkLength);
				}
				var chunkType = data.getUint32(offset + 4, true);
				var chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
				chunks.push({
						length: chunkLength,
						type: chunkType,
						data: chunkData
				});
				offset += chunkLength + 8;
		}
		if (chunks.length !== 1 && chunks.length !== 2) {
				callback('Invalid number of chunks found in glb file.');
				return;
		}
		if (chunks[0].type !== 0x4E4F534A) {
				callback("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + chunks[0].type.toString(16));
				return;
		}
		if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
				callback("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + chunks[1].type.toString(16));
				return;
		}
		callback(null, {
				gltfChunk: chunks[0].data,
				binaryChunk: chunks.length === 2 ? chunks[1].data : null
		});
};
var parseChunk = (filename, data, callback)=>{
		var hasGlbHeader = ()=>{
				var u8 = new Uint8Array(data);
				return u8[0] === 103 && u8[1] === 108 && u8[2] === 84 && u8[3] === 70;
		};
		if (filename && filename.toLowerCase().endsWith('.glb') || hasGlbHeader()) {
				parseGlb(data, callback);
		} else {
				callback(null, {
						gltfChunk: data,
						binaryChunk: null
				});
		}
};
var createBufferViews = (gltf, buffers, options)=>{
		var _loop = function(i) {
				var gltfBufferView = gltf.bufferViews[i];
				if (preprocess) {
						preprocess(gltfBufferView);
				}
				var promise = undefined;
				if (processAsync) {
						promise = new Promise((resolve, reject)=>{
								processAsync(gltfBufferView, buffers, (err, result)=>{
										if (err) {
												reject(err);
										} else {
												resolve(result);
										}
								});
						});
				} else {
						promise = new Promise((resolve)=>{
								resolve(null);
						});
				}
				promise = promise.then((buffer)=>{
						if (buffer) {
								return buffer;
						}
						return buffers[gltfBufferView.buffer].then((buffer)=>{
								return new Uint8Array(buffer.buffer, buffer.byteOffset + (gltfBufferView.byteOffset || 0), gltfBufferView.byteLength);
						});
				});
				if (gltfBufferView.hasOwnProperty('byteStride')) {
						promise = promise.then((typedArray)=>{
								typedArray.byteStride = gltfBufferView.byteStride;
								return typedArray;
						});
				}
				if (postprocess) {
						promise = promise.then((typedArray)=>{
								postprocess(gltfBufferView, typedArray);
								return typedArray;
						});
				}
				result.push(promise);
		};
		var _options_bufferView, _options_bufferView1, _options_bufferView2, _gltf_bufferViews;
		var result = [];
		var preprocess = options == null ? undefined : (_options_bufferView = options.bufferView) == null ? undefined : _options_bufferView.preprocess;
		var processAsync = options == null ? undefined : (_options_bufferView1 = options.bufferView) == null ? undefined : _options_bufferView1.processAsync;
		var postprocess = options == null ? undefined : (_options_bufferView2 = options.bufferView) == null ? undefined : _options_bufferView2.postprocess;
		if (!((_gltf_bufferViews = gltf.bufferViews) == null ? undefined : _gltf_bufferViews.length)) {
				return result;
		}
		for(var i = 0; i < gltf.bufferViews.length; ++i)_loop(i);
		return result;
};
class GlbParser {
		static parse(filename, urlBase, data, device, registry, options, callback) {
				parseChunk(filename, data, (err, chunks)=>{
						if (err) {
								callback(err);
								return;
						}
						parseGltf(chunks.gltfChunk, (err, gltf)=>{
								if (err) {
										callback(err);
										return;
								}
								var buffers = loadBuffers(gltf, chunks.binaryChunk, urlBase, options);
								var bufferViews = createBufferViews(gltf, buffers, options);
								var images = createImages(gltf, bufferViews, urlBase, registry, options);
								var textures = createTextures(gltf, images, options);
								createResources(device, gltf, bufferViews, textures, options).then((result)=>callback(null, result)).catch((err)=>callback(err));
						});
				});
		}
		static createDefaultMaterial() {
				return createMaterial({
						name: 'defaultGlbMaterial'
				}, []);
		}
}

export { GlbParser };
