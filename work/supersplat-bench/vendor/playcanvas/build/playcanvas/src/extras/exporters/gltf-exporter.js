import { CoreExporter } from './core-exporter.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Color } from '../../core/math/color.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CULLFACE_NONE, SEMANTIC_POSITION, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, INDEXFORMAT_UINT8, TYPE_FLOAT32, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_TEXCOORD7, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD0, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, SEMANTIC_COLOR, SEMANTIC_TANGENT, SEMANTIC_NORMAL, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { PROJECTION_ORTHOGRAPHIC, BLEND_NORMAL, BLEND_NONE } from '../../scene/constants.js';

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
var ARRAY_BUFFER = 34962;
var ELEMENT_ARRAY_BUFFER = 34963;
var getIndexComponentType = (indexFormat)=>{
		switch(indexFormat){
				case INDEXFORMAT_UINT8:
						return 5121;
				case INDEXFORMAT_UINT16:
						return 5123;
				case INDEXFORMAT_UINT32:
						return 5125;
		}
		return 0;
};
var getComponentType = (dataType)=>{
		switch(dataType){
				case TYPE_INT8:
						return 5120;
				case TYPE_UINT8:
						return 5121;
				case TYPE_INT16:
						return 5122;
				case TYPE_UINT16:
						return 5123;
				case TYPE_INT32:
						return 5124;
				case TYPE_UINT32:
						return 5125;
				case TYPE_FLOAT32:
						return 5126;
		}
		return 0;
};
var getAccessorType = (componentCount)=>{
		switch(componentCount){
				case 1:
						return 'SCALAR';
				case 2:
						return 'VEC2';
				case 3:
						return 'VEC3';
				case 4:
						return 'VEC4';
		}
		return 0;
};
var getSemantic = (engineSemantic)=>{
		switch(engineSemantic){
				case SEMANTIC_POSITION:
						return 'POSITION';
				case SEMANTIC_NORMAL:
						return 'NORMAL';
				case SEMANTIC_TANGENT:
						return 'TANGENT';
				case SEMANTIC_COLOR:
						return 'COLOR_0';
				case SEMANTIC_BLENDINDICES:
						return 'JOINTS_0';
				case SEMANTIC_BLENDWEIGHT:
						return 'WEIGHTS_0';
				case SEMANTIC_TEXCOORD0:
						return 'TEXCOORD_0';
				case SEMANTIC_TEXCOORD1:
						return 'TEXCOORD_1';
				case SEMANTIC_TEXCOORD2:
						return 'TEXCOORD_2';
				case SEMANTIC_TEXCOORD3:
						return 'TEXCOORD_3';
				case SEMANTIC_TEXCOORD4:
						return 'TEXCOORD_4';
				case SEMANTIC_TEXCOORD5:
						return 'TEXCOORD_5';
				case SEMANTIC_TEXCOORD6:
						return 'TEXCOORD_6';
				case SEMANTIC_TEXCOORD7:
						return 'TEXCOORD_7';
		}
		return '';
};
var getFilter = function getFilter(filter) {
		switch(filter){
				case FILTER_NEAREST:
						return 9728;
				case FILTER_LINEAR:
						return 9729;
				case FILTER_NEAREST_MIPMAP_NEAREST:
						return 9984;
				case FILTER_LINEAR_MIPMAP_NEAREST:
						return 9985;
				case FILTER_NEAREST_MIPMAP_LINEAR:
						return 9986;
				case FILTER_LINEAR_MIPMAP_LINEAR:
						return 9987;
		}
		return 0;
};
var getWrap = function getWrap(wrap) {
		switch(wrap){
				case ADDRESS_CLAMP_TO_EDGE:
						return 33071;
				case ADDRESS_MIRRORED_REPEAT:
						return 33648;
				case ADDRESS_REPEAT:
						return 10497;
		}
		return 0;
};
function isCanvasTransparent(canvas) {
		var context = canvas.getContext('2d');
		var pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
		for(var i = 3; i < pixelData.length; i += 4){
				if (pixelData[i] < 255) {
						return true;
				}
		}
		return false;
}
var textureSemantics = [
		'diffuseMap',
		'colorMap',
		'normalMap',
		'metalnessMap',
		'emissiveMap'
];
class GltfExporter extends CoreExporter {
		collectResources(root) {
				var resources = {
						buffers: [],
						cameras: [],
						entities: [],
						materials: [],
						skins: [],
						textures: [],
						entityMeshInstances: [],
						bufferViewMap: new Map(),
						compressableTexture: new Set()
				};
				var { materials, buffers, entityMeshInstances, textures } = resources;
				root.forEach((entity)=>{
						resources.entities.push(entity);
				});
				var collectMeshInstances = (meshInstances)=>{
						meshInstances.forEach((meshInstance)=>{
								var material = meshInstance.material;
								if (materials.indexOf(material) < 0) {
										resources.materials.push(material);
										textureSemantics.forEach((semantic)=>{
												var texture = material[semantic];
												if (texture && textures.indexOf(texture) < 0) {
														if (semantic !== 'normalMap') {
																resources.compressableTexture.add(texture);
														}
														textures.push(texture);
												}
										});
								}
								var node = meshInstance.node;
								var nodeMeshInstances = entityMeshInstances.find((e)=>e.node === node);
								if (!nodeMeshInstances) {
										nodeMeshInstances = {
												node: node,
												meshInstances: []
										};
										entityMeshInstances.push(nodeMeshInstances);
								}
								nodeMeshInstances.meshInstances.push(meshInstance);
								var mesh = meshInstance.mesh;
								var vertexBuffer = mesh.vertexBuffer;
								if (buffers.indexOf(vertexBuffer) < 0) {
										buffers.unshift(vertexBuffer);
								}
								var indexBuffer = mesh.indexBuffer[0];
								if (buffers.indexOf(indexBuffer) < 0) {
										buffers.push(indexBuffer);
								}
								if (mesh.skin && resources.skins.indexOf(mesh.skin) < 0) {
										resources.skins.push(mesh.skin);
								}
						});
				};
				resources.entities.forEach((entity)=>{
						if (entity.camera) {
								resources.cameras.push(entity.camera);
						}
						if (entity.render && entity.render.enabled) {
								collectMeshInstances(entity.render.meshInstances);
						}
						if (entity.model && entity.model.enabled && entity.model.meshInstances) {
								collectMeshInstances(entity.model.meshInstances);
						}
				});
				return resources;
		}
		writeBufferViews(resources, json) {
				json.bufferViews = [];
				for (var buffer of resources.buffers){
						GltfExporter.writeBufferView(resources, json, buffer);
				}
		}
		static writeBufferView(resources, json, buffer) {
				var _json_buffers;
				json.buffers = (_json_buffers = json.buffers) != null ? _json_buffers : [];
				var _json_buffers_;
				json.buffers[0] = (_json_buffers_ = json.buffers[0]) != null ? _json_buffers_ : {
						byteLength: 0
				};
				var bufferInfo = json.buffers[0];
				bufferInfo.byteLength = math.roundUp(bufferInfo.byteLength, 4);
				var offset = bufferInfo.byteLength;
				var addBufferView = (target, byteLength, byteOffset, byteStride)=>{
						var bufferView = {
								buffer: 0,
								byteLength: byteLength,
								byteOffset: byteOffset
						};
						if (target === ARRAY_BUFFER || target === ELEMENT_ARRAY_BUFFER) {
								bufferView.target = target;
						}
						if (byteStride !== undefined) {
								bufferView.byteStride = byteStride;
						}
						return json.bufferViews.push(bufferView) - 1;
				};
				var arrayBuffer;
				if (buffer instanceof VertexBuffer) {
						arrayBuffer = buffer.lock();
						var format = buffer.getFormat();
						if (format.interleaved) {
								var bufferViewIndex = addBufferView(ARRAY_BUFFER, arrayBuffer.byteLength, offset, format.size);
								resources.bufferViewMap.set(buffer, [
										bufferViewIndex
								]);
						} else {
								var bufferViewIndices = [];
								for (var element of format.elements){
										var bufferViewIndex1 = addBufferView(ARRAY_BUFFER, element.size * format.vertexCount, offset + element.offset, element.size);
										bufferViewIndices.push(bufferViewIndex1);
								}
								resources.bufferViewMap.set(buffer, bufferViewIndices);
						}
				} else if (buffer instanceof IndexBuffer) {
						arrayBuffer = buffer.lock();
						var bufferViewIndex2 = addBufferView(ELEMENT_ARRAY_BUFFER, arrayBuffer.byteLength, offset);
						resources.bufferViewMap.set(buffer, [
								bufferViewIndex2
						]);
				} else {
						arrayBuffer = buffer;
						var bufferViewIndex3 = addBufferView(undefined, arrayBuffer.byteLength, offset);
						resources.bufferViewMap.set(buffer, [
								bufferViewIndex3
						]);
				}
				bufferInfo.byteLength += arrayBuffer.byteLength;
		}
		writeCameras(resources, json) {
				if (resources.cameras.length > 0) {
						json.cameras = resources.cameras.map((cam)=>{
								var projection = cam.projection;
								var nearClip = cam.nearClip;
								var farClip = cam.farClip;
								var camera = {};
								if (projection === PROJECTION_ORTHOGRAPHIC) {
										camera.type = 'orthographic';
										camera.orthographic = {
												xmag: 1,
												ymag: 1,
												znear: nearClip,
												zfar: farClip
										};
								} else {
										var fov = cam.fov;
										camera.type = 'perspective';
										camera.perspective = {
												yfov: fov * Math.PI / 180,
												znear: nearClip,
												zfar: farClip
										};
								}
								return camera;
						});
				}
		}
		attachTexture(resources, material, destination, name, textureSemantic, json) {
				var texture = material[textureSemantic];
				if (texture) {
						var textureIndex = resources.textures.indexOf(texture);
						if (textureIndex < 0) console.warn("Texture " + texture.name + " wasn't collected.");
						destination[name] = {
								index: textureIndex
						};
						var scale = material["" + textureSemantic + "Tiling"];
						var offset = material["" + textureSemantic + "Offset"];
						var rotation = material["" + textureSemantic + "Rotation"];
						if (scale && !scale.equals(Vec2.ONE) || offset && !offset.equals(Vec2.ZERO) || rotation !== 0) {
								destination[name].extensions = {
										KHR_texture_transform: {}
								};
								var _json_extensionsUsed;
								json.extensionsUsed = (_json_extensionsUsed = json.extensionsUsed) != null ? _json_extensionsUsed : [];
								if (json.extensionsUsed.indexOf('KHR_texture_transform') < 0) {
										json.extensionsUsed.push('KHR_texture_transform');
								}
								var _json_extensionsRequired;
								json.extensionsRequired = (_json_extensionsRequired = json.extensionsRequired) != null ? _json_extensionsRequired : [];
								if (json.extensionsRequired.indexOf('KHR_texture_transform') < 0) {
										json.extensionsRequired.push('KHR_texture_transform');
								}
								if (scale && !scale.equals(Vec2.ONE)) {
										destination[name].extensions.KHR_texture_transform.scale = [
												scale.x,
												scale.y
										];
								}
								if (offset && !offset.equals(Vec2.ZERO)) {
										destination[name].extensions.KHR_texture_transform.offset = [
												offset.x,
												offset.y - 1 + scale.y
										];
								}
								if (rotation !== 0) {
										destination[name].extensions.KHR_texture_transform.rotation = rotation * math.DEG_TO_RAD;
								}
						}
				}
		}
		writeStandardMaterial(resources, mat, output, json) {
				var { diffuse, emissive, opacity, metalness, gloss, glossInvert } = mat;
				var pbr = output.pbrMetallicRoughness;
				if (!diffuse.equals(Color.WHITE) || opacity !== 1) {
						pbr.baseColorFactor = [
								diffuse.r,
								diffuse.g,
								diffuse.b,
								opacity
						];
				}
				if (metalness !== 1) {
						pbr.metallicFactor = metalness;
				}
				var roughness = glossInvert ? gloss : 1 - gloss;
				if (roughness !== 1) {
						pbr.roughnessFactor = roughness;
				}
				this.attachTexture(resources, mat, pbr, 'baseColorTexture', 'diffuseMap', json);
				this.attachTexture(resources, mat, pbr, 'metallicRoughnessTexture', 'metalnessMap', json);
				if (!emissive.equals(Color.BLACK)) {
						output.emissiveFactor = [
								emissive.r,
								emissive.g,
								emissive.b
						];
				}
		}
		writeMaterials(resources, json) {
				if (resources.materials.length > 0) {
						json.materials = resources.materials.map((mat)=>{
								var { name, blendType, cull, alphaTest } = mat;
								var material = {
										pbrMetallicRoughness: {}
								};
								if (name && name.length > 0) {
										material.name = name;
								}
								if (mat instanceof StandardMaterial) {
										this.writeStandardMaterial(resources, mat, material, json);
								}
								if (blendType === BLEND_NORMAL) {
										material.alphaMode = 'BLEND';
								} else if (blendType === BLEND_NONE) {
										if (alphaTest !== 0) {
												material.alphaMode = 'MASK';
												material.alphaCutoff = alphaTest;
										}
								}
								if (cull === CULLFACE_NONE) {
										material.doubleSided = true;
								}
								this.attachTexture(resources, mat, material, 'normalTexture', 'normalMap', json);
								this.attachTexture(resources, mat, material, 'occlusionTexture', 'aoMap', json);
								this.attachTexture(resources, mat, material, 'emissiveTexture', 'emissiveMap', json);
								return material;
						});
				}
		}
		writeNodes(resources, json) {
				if (resources.entities.length > 0) {
						json.nodes = resources.entities.map((entity)=>{
								var name = entity.name;
								var t = entity.getLocalPosition();
								var r = entity.getLocalRotation();
								var s = entity.getLocalScale();
								var node = {};
								if (name && name.length > 0) {
										node.name = name;
								}
								if (!t.equals(Vec3.ZERO)) {
										node.translation = [
												t.x,
												t.y,
												t.z
										];
								}
								if (!r.equals(Quat.IDENTITY)) {
										node.rotation = [
												r.x,
												r.y,
												r.z,
												r.w
										];
								}
								if (!s.equals(Vec3.ONE)) {
										node.scale = [
												s.x,
												s.y,
												s.z
										];
								}
								if (entity.camera && entity.camera.enabled) {
										node.camera = resources.cameras.indexOf(entity.camera);
								}
								var entityMeshInstance = resources.entityMeshInstances.find((e)=>e.node === entity);
								if (entityMeshInstance) {
										node.mesh = resources.entityMeshInstances.indexOf(entityMeshInstance);
										var meshInstance = entityMeshInstance.meshInstances[0];
										if (meshInstance && meshInstance.mesh.skin) {
												node.skin = resources.skins.indexOf(meshInstance.mesh.skin);
										}
								}
								if (entity.children.length > 0) {
										node.children = [];
										entity.children.forEach((child)=>{
												node.children.push(resources.entities.indexOf(child));
										});
								}
								return node;
						});
				}
		}
		writeMeshes(resources, json, options) {
				if (resources.entityMeshInstances.length > 0) {
						json.accessors = [];
						json.meshes = [];
						resources.entityMeshInstances.forEach((entityMeshInstances)=>{
								var mesh = {
										primitives: []
								};
								var meshInstances = entityMeshInstances.meshInstances;
								meshInstances.forEach((meshInstance)=>{
										var primitive = GltfExporter.createPrimitive(resources, json, meshInstance.mesh, options);
										primitive.material = resources.materials.indexOf(meshInstance.material);
										mesh.primitives.push(primitive);
								});
								json.meshes.push(mesh);
						});
				}
		}
		static createPrimitive(resources, json, mesh, options) {
				if (options === undefined) options = {};
				var primitive = {
						attributes: {}
				};
				var { vertexBuffer } = mesh;
				var { format } = vertexBuffer;
				var { interleaved, elements } = format;
				var numVertices = vertexBuffer.getNumVertices();
				elements.forEach((element, elementIndex)=>{
						var semantic = getSemantic(element.name);
						if (options.stripUnusedAttributes) {
								var isUsed = true;
								if (semantic.startsWith('TEXCOORD_')) {
										var texCoordIndex = parseInt(semantic.split('_')[1], 10);
										isUsed = resources.materials.some((material)=>{
												return textureSemantics.some((texSemantic)=>{
														var _material_;
														var texture = material[texSemantic];
														return texture && (texCoordIndex === 0 || ((_material_ = material["" + texSemantic + "Tiling"]) == null ? undefined : _material_.uv) === texCoordIndex);
												});
										});
								}
								if (semantic === 'COLOR_0') {
										isUsed = resources.materials.some((material)=>material.vertexColors);
								}
								if (semantic === 'TANGENT') {
										isUsed = resources.materials.some((material)=>material.normalMap);
								}
								if (semantic === 'JOINTS_0' || semantic === 'WEIGHTS_0') {
										isUsed = resources.entityMeshInstances.some((emi)=>emi.meshInstances.some((mi)=>mi.mesh.skin));
								}
								if (!isUsed) {
										return;
								}
						}
						var bufferView = resources.bufferViewMap.get(vertexBuffer);
						if (!bufferView) {
								GltfExporter.writeBufferView(resources, json, vertexBuffer);
								resources.buffers.push(vertexBuffer);
								bufferView = resources.bufferViewMap.get(vertexBuffer);
						}
						var viewIndex = bufferView[interleaved ? 0 : elementIndex];
						var accessor = {
								bufferView: viewIndex,
								byteOffset: interleaved ? element.offset : 0,
								componentType: getComponentType(element.dataType),
								type: getAccessorType(element.numComponents),
								count: numVertices
						};
						var idx = json.accessors.push(accessor) - 1;
						primitive.attributes[semantic] = idx;
						if (element.name === SEMANTIC_POSITION) {
								var positions = [];
								mesh.getPositions(positions);
								var min = new Vec3();
								var max = new Vec3();
								BoundingBox.computeMinMax(positions, min, max);
								accessor.min = [
										min.x,
										min.y,
										min.z
								];
								accessor.max = [
										max.x,
										max.y,
										max.z
								];
						}
				});
				var indexBuffer = mesh.indexBuffer[0];
				if (indexBuffer) {
						var bufferView = resources.bufferViewMap.get(indexBuffer);
						if (!bufferView) {
								GltfExporter.writeBufferView(resources, json, indexBuffer);
								resources.buffers.push(indexBuffer);
								bufferView = resources.bufferViewMap.get(indexBuffer);
						}
						var viewIndex = bufferView[0];
						var accessor = {
								bufferView: viewIndex,
								componentType: getIndexComponentType(indexBuffer.getFormat()),
								count: indexBuffer.getNumIndices(),
								type: 'SCALAR'
						};
						var idx = json.accessors.push(accessor) - 1;
						primitive.indices = idx;
				}
				return primitive;
		}
		writeSkins(resources, json) {
				if (resources.skins.length > 0) {
						json.skins = resources.skins.map((skin)=>{
								var matrices = new Float32Array(skin.inverseBindPose.length * 16);
								for(var i = 0; i < skin.inverseBindPose.length; i++){
										var ibm = skin.inverseBindPose[i];
										matrices.set(ibm.data, i * 16);
								}
								var matrixBuffer = matrices.buffer;
								GltfExporter.writeBufferView(resources, json, matrixBuffer);
								resources.buffers.push(matrixBuffer);
								var bufferView = resources.bufferViewMap.get(matrixBuffer);
								var accessor = {
										bufferView: bufferView[0],
										componentType: getComponentType(TYPE_FLOAT32),
										count: skin.inverseBindPose.length,
										type: 'MAT4'
								};
								var accessorIndex = json.accessors.push(accessor) - 1;
								var joints = skin.boneNames.map((boneName)=>{
										var node = resources.entities.find((entity)=>entity.name === boneName);
										return resources.entities.indexOf(node);
								});
								return {
										inverseBindMatrices: accessorIndex,
										joints: joints
								};
						});
				}
		}
		convertTextures(srcTextures, options) {
				var textureOptions = {
						maxTextureSize: options.maxTextureSize
				};
				var promises = [];
				srcTextures.forEach((srcTexture)=>{
						var promise = this.textureToCanvas(srcTexture, textureOptions);
						promise.then((canvas)=>{
								return new Promise((resolve)=>resolve(canvas));
						});
						promises.push(promise);
				});
				return promises;
		}
		writeTextures(resources, textureCanvases, json, options) {
				var _this, _loop = function(i) {
						var texture = textures[i];
						var canvas = textureCanvases[i];
						var isRGBA = isCanvasTransparent(canvas) || !resources.compressableTexture.has(texture);
						var mimeType = isRGBA ? 'image/png' : 'image/jpeg';
						promises.push(_this.getBlob(canvas, mimeType).then((blob)=>{
								var reader = new FileReader();
								reader.readAsArrayBuffer(blob);
								return new Promise((resolve)=>{
										reader.onloadend = ()=>{
												resolve(reader);
										};
								});
						}).then((reader)=>{
								var buffer = _this.getPaddedArrayBuffer(reader.result);
								GltfExporter.writeBufferView(resources, json, buffer);
								resources.buffers.push(buffer);
								var bufferView = resources.bufferViewMap.get(buffer);
								json.images[i] = {
										mimeType: mimeType,
										bufferView: bufferView[0]
								};
								json.samplers[i] = {
										minFilter: getFilter(texture.minFilter),
										magFilter: getFilter(texture.magFilter),
										wrapS: getWrap(texture.addressU),
										wrapT: getWrap(texture.addressV)
								};
								json.textures[i] = {
										sampler: i,
										source: i
								};
						}));
				};
				var textures = resources.textures;
				var promises = [];
				for(var i = 0; i < textureCanvases.length; i++)_this = this, _loop(i);
				return Promise.all(promises);
		}
		getBlob(canvas, mimeType) {
				if (canvas.toBlob !== undefined) {
						return new Promise((resolve)=>{
								canvas.toBlob(resolve, mimeType);
						});
				}
				var quality = 1.0;
				if (mimeType === 'image/jpeg') {
						quality = 0.92;
				}
				return canvas.convertToBlob({
						type: mimeType,
						quality: quality
				});
		}
		getPaddedArrayBuffer(arrayBuffer, paddingByte) {
				if (paddingByte === undefined) paddingByte = 0;
				var paddedLength = math.roundUp(arrayBuffer.byteLength, 4);
				if (paddedLength !== arrayBuffer.byteLength) {
						var array = new Uint8Array(paddedLength);
						array.set(new Uint8Array(arrayBuffer));
						if (paddingByte !== 0) {
								for(var i = arrayBuffer.byteLength; i < paddedLength; i++){
										array[i] = paddingByte;
								}
						}
						return array.buffer;
				}
				return arrayBuffer;
		}
		buildJson(resources, options) {
				var promises = this.convertTextures(resources.textures, options);
				var _this = this;
				return Promise.all(promises).then(/*#__PURE__*/ _async_to_generator(function*(textureCanvases) {
						var json = {
								asset: {
										version: '2.0',
										generator: 'PlayCanvas GltfExporter'
								},
								scenes: [
										{
												nodes: [
														0
												]
										}
								],
								images: [],
								samplers: [],
								textures: [],
								scene: 0
						};
						_this.writeBufferViews(resources, json);
						_this.writeCameras(resources, json);
						_this.writeMeshes(resources, json, options);
						_this.writeMaterials(resources, json);
						_this.writeNodes(resources, json, options);
						_this.writeSkins(resources, json);
						yield _this.writeTextures(resources, textureCanvases, json, options);
						if (!json.images.length) delete json.images;
						if (!json.samplers.length) delete json.samplers;
						if (!json.textures.length) delete json.textures;
						return json;
				}));
		}
		build(entity, options) {
				if (options === undefined) options = {};
				var resources = this.collectResources(entity);
				return this.buildJson(resources, options).then((json)=>{
						var encoder = new TextEncoder();
						var jsonData = encoder.encode(JSON.stringify(json));
						var headerLength = 12;
						var jsonHeaderLength = 8;
						var jsonDataLength = jsonData.length;
						var jsonPaddingLength = 4 - (jsonDataLength & 3) & 3;
						var binaryHeaderLength = 8;
						var binaryDataLength = json.buffers.reduce((total, buffer)=>math.roundUp(total + buffer.byteLength, 4), 0);
						var totalLength = headerLength + jsonHeaderLength + jsonDataLength + jsonPaddingLength;
						if (binaryDataLength > 0) {
								totalLength += binaryHeaderLength + binaryDataLength;
						}
						var glbBuffer = new ArrayBuffer(totalLength);
						var glbView = new DataView(glbBuffer);
						glbView.setUint32(0, 0x46546C67, true);
						glbView.setUint32(4, 2, true);
						glbView.setUint32(8, totalLength, true);
						glbView.setUint32(12, jsonDataLength + jsonPaddingLength, true);
						glbView.setUint32(16, 0x4E4F534A, true);
						var offset = headerLength + jsonHeaderLength;
						new Uint8Array(glbBuffer, offset, jsonDataLength).set(jsonData);
						offset += jsonDataLength;
						for(var i = 0; i < jsonPaddingLength; i++){
								glbView.setUint8(offset + i, 0x20);
						}
						offset += jsonPaddingLength;
						if (binaryDataLength > 0) {
								glbView.setUint32(offset, binaryDataLength, true);
								glbView.setUint32(offset + 4, 0x004E4942, true);
								offset += binaryHeaderLength;
								resources.buffers.forEach((buffer)=>{
										var src;
										var bufferViewId = resources.bufferViewMap.get(buffer)[0];
										var bufferOffset = json.bufferViews[bufferViewId].byteOffset;
										if (buffer instanceof ArrayBuffer) {
												src = new Uint8Array(buffer);
										} else {
												var srcBuffer = buffer.lock();
												if (srcBuffer instanceof ArrayBuffer) {
														src = new Uint8Array(srcBuffer);
												} else {
														src = new Uint8Array(srcBuffer.buffer, srcBuffer.byteOffset, srcBuffer.byteLength);
												}
										}
										var dst = new Uint8Array(glbBuffer, offset + bufferOffset, src.byteLength);
										dst.set(src);
								});
						}
						return Promise.resolve(glbBuffer);
				});
		}
}

export { GltfExporter };
