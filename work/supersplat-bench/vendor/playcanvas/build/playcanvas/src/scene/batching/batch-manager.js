import { Mat3 } from '../../core/math/mat3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SEMANTIC_BLENDINDICES, TYPE_FLOAT32, typedArrayTypes, typedArrayTypesByteSize, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, typedArrayIndexFormats, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { Batch } from './batch.js';
import { BatchGroup } from './batch-group.js';
import { SkinBatchInstance } from './skin-batch-instance.js';

var _triFanIndices = [
		0,
		1,
		3,
		2,
		3,
		1
];
var _triStripIndices = [
		0,
		1,
		3,
		0,
		3,
		2
];
var mat3 = new Mat3();
function paramsIdentical(a, b) {
		if (a && !b) return false;
		if (!a && b) return false;
		a = a.data;
		b = b.data;
		if (a === b) return true;
		if (a instanceof Float32Array && b instanceof Float32Array) {
				if (a.length !== b.length) return false;
				for(var i = 0; i < a.length; i++){
						if (a[i] !== b[i]) return false;
				}
				return true;
		}
		return false;
}
function equalParamSets(params1, params2) {
		for(var param in params1){
				if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param])) {
						return false;
				}
		}
		for(var param1 in params2){
				if (params2.hasOwnProperty(param1) && !paramsIdentical(params2[param1], params1[param1])) {
						return false;
				}
		}
		return true;
}
function getScaleSign(mi) {
		return mi.node.worldTransform.scaleSign;
}
class BatchManager {
		destroy() {
				this.device = null;
				this.rootNode = null;
				this.scene = null;
				this._batchGroups = {};
				this._batchList = [];
				this._dirtyGroups = [];
		}
		addGroup(name, dynamic, maxAabbSize, id, layers) {
				if (id === undefined) {
						id = this._batchGroupCounter;
						this._batchGroupCounter++;
				}
				if (this._batchGroups[id]) {
						return undefined;
				}
				var group = new BatchGroup(id, name, dynamic, maxAabbSize, layers);
				this._batchGroups[id] = group;
				return group;
		}
		removeGroup(id) {
				if (!this._batchGroups[id]) {
						return;
				}
				var newBatchList = [];
				for(var i = 0; i < this._batchList.length; i++){
						if (this._batchList[i].batchGroupId === id) {
								this.destroyBatch(this._batchList[i]);
						} else {
								newBatchList.push(this._batchList[i]);
						}
				}
				this._batchList = newBatchList;
				this._removeModelsFromBatchGroup(this.rootNode, id);
				delete this._batchGroups[id];
		}
		markGroupDirty(id) {
				if (this._dirtyGroups.indexOf(id) < 0) {
						this._dirtyGroups.push(id);
				}
		}
		getGroupByName(name) {
				var groups = this._batchGroups;
				for(var group in groups){
						if (!groups.hasOwnProperty(group)) continue;
						if (groups[group].name === name) {
								return groups[group];
						}
				}
				return null;
		}
		getBatches(batchGroupId) {
				var results = [];
				var len = this._batchList.length;
				for(var i = 0; i < len; i++){
						var batch = this._batchList[i];
						if (batch.batchGroupId === batchGroupId) {
								results.push(batch);
						}
				}
				return results;
		}
		_removeModelsFromBatchGroup(node, id) {
				if (!node.enabled) return;
				if (node.model && node.model.batchGroupId === id) {
						node.model.batchGroupId = -1;
				}
				if (node.render && node.render.batchGroupId === id) {
						node.render.batchGroupId = -1;
				}
				if (node.element && node.element.batchGroupId === id) {
						node.element.batchGroupId = -1;
				}
				if (node.sprite && node.sprite.batchGroupId === id) {
						node.sprite.batchGroupId = -1;
				}
				for(var i = 0; i < node._children.length; i++){
						this._removeModelsFromBatchGroup(node._children[i], id);
				}
		}
		insert(type, groupId, node) {
				var group = this._batchGroups[groupId];
				if (group) {
						if (group._obj[type].indexOf(node) < 0) {
								group._obj[type].push(node);
								this.markGroupDirty(groupId);
						}
				}
		}
		remove(type, groupId, node) {
				var group = this._batchGroups[groupId];
				if (group) {
						var idx = group._obj[type].indexOf(node);
						if (idx >= 0) {
								group._obj[type].splice(idx, 1);
								this.markGroupDirty(groupId);
						}
				}
		}
		_extractRender(node, arr, group, groupMeshInstances) {
				if (node.render) {
						arr = groupMeshInstances[node.render.batchGroupId] = arr.concat(node.render.meshInstances);
						node.render.removeFromLayers();
				}
				return arr;
		}
		_extractModel(node, arr, group, groupMeshInstances) {
				if (node.model && node.model.model) {
						arr = groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
						node.model.removeModelFromLayers();
				}
				return arr;
		}
		_extractElement(node, arr, group) {
				if (!node.element) return;
				var valid = false;
				if (node.element._text && node.element._text._model.meshInstances.length > 0) {
						arr.push(node.element._text._model.meshInstances[0]);
						node.element.removeModelFromLayers(node.element._text._model);
						valid = true;
				} else if (node.element._image) {
						arr.push(node.element._image._renderable.meshInstance);
						node.element.removeModelFromLayers(node.element._image._renderable.model);
						if (node.element._image._renderable.unmaskMeshInstance) {
								arr.push(node.element._image._renderable.unmaskMeshInstance);
								if (!node.element._image._renderable.unmaskMeshInstance.stencilFront || !node.element._image._renderable.unmaskMeshInstance.stencilBack) {
										node.element._dirtifyMask();
										node.element._onPrerender();
								}
						}
						valid = true;
				}
				if (valid) {
						group._ui = true;
				}
		}
		_collectAndRemoveMeshInstances(groupMeshInstances, groupIds) {
				for(var g = 0; g < groupIds.length; g++){
						var id = groupIds[g];
						var group = this._batchGroups[id];
						if (!group) continue;
						var arr = groupMeshInstances[id];
						if (!arr) arr = groupMeshInstances[id] = [];
						for(var m = 0; m < group._obj.model.length; m++){
								arr = this._extractModel(group._obj.model[m], arr, group, groupMeshInstances);
						}
						for(var r = 0; r < group._obj.render.length; r++){
								arr = this._extractRender(group._obj.render[r], arr, group, groupMeshInstances);
						}
						for(var e = 0; e < group._obj.element.length; e++){
								this._extractElement(group._obj.element[e], arr, group);
						}
						for(var s = 0; s < group._obj.sprite.length; s++){
								var node = group._obj.sprite[s];
								if (node.sprite && node.sprite._meshInstance && (group.dynamic || node.sprite.sprite._renderMode === SPRITE_RENDERMODE_SIMPLE)) {
										arr.push(node.sprite._meshInstance);
										node.sprite.removeModelFromLayers();
										group._sprite = true;
										node.sprite._batchGroup = group;
								}
						}
				}
		}
		generate(groupIds) {
				var groupMeshInstances = {};
				if (!groupIds) {
						groupIds = Object.keys(this._batchGroups);
				}
				var newBatchList = [];
				for(var i = 0; i < this._batchList.length; i++){
						if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
								newBatchList.push(this._batchList[i]);
								continue;
						}
						this.destroyBatch(this._batchList[i]);
				}
				this._batchList = newBatchList;
				this._collectAndRemoveMeshInstances(groupMeshInstances, groupIds);
				if (groupIds === this._dirtyGroups) {
						this._dirtyGroups.length = 0;
				} else {
						var newDirtyGroups = [];
						for(var i1 = 0; i1 < this._dirtyGroups.length; i1++){
								if (groupIds.indexOf(this._dirtyGroups[i1]) < 0) newDirtyGroups.push(this._dirtyGroups[i1]);
						}
						this._dirtyGroups = newDirtyGroups;
				}
				var group, lists, groupData, batch;
				for(var groupId in groupMeshInstances){
						if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
						group = groupMeshInstances[groupId];
						groupData = this._batchGroups[groupId];
						if (!groupData) {
								continue;
						}
						lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize, groupData._ui || groupData._sprite);
						for(var i2 = 0; i2 < lists.length; i2++){
								batch = this.create(lists[i2], groupData.dynamic, parseInt(groupId, 10));
								if (batch) {
										batch.addToLayers(this.scene, groupData.layers);
								}
						}
				}
		}
		prepare(meshInstances, dynamic, maxAabbSize, translucent) {
				if (maxAabbSize === undefined) maxAabbSize = Number.POSITIVE_INFINITY;
				if (meshInstances.length === 0) return [];
				var halfMaxAabbSize = maxAabbSize * 0.5;
				var maxInstanceCount = 1024;
				var maxNumVertices = 0xffffffff;
				var aabb = new BoundingBox();
				var testAabb = new BoundingBox();
				var skipTranslucentAabb = null;
				var sf;
				var lists = [];
				var j = 0;
				if (translucent) {
						meshInstances.sort((a, b)=>{
								return a.drawOrder - b.drawOrder;
						});
				}
				var meshInstancesLeftA = meshInstances;
				var meshInstancesLeftB;
				var skipMesh = translucent ? function skipMesh(mi) {
						if (skipTranslucentAabb) {
								skipTranslucentAabb.add(mi.aabb);
						} else {
								skipTranslucentAabb = mi.aabb.clone();
						}
						meshInstancesLeftB.push(mi);
				} : function(mi) {
						meshInstancesLeftB.push(mi);
				};
				while(meshInstancesLeftA.length > 0){
						lists[j] = [
								meshInstancesLeftA[0]
						];
						meshInstancesLeftB = [];
						var material = meshInstancesLeftA[0].material;
						var layer = meshInstancesLeftA[0].layer;
						var defs = meshInstancesLeftA[0]._shaderDefs;
						var params = meshInstancesLeftA[0].parameters;
						var stencil = meshInstancesLeftA[0].stencilFront;
						var vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
						var drawOrder = meshInstancesLeftA[0].drawOrder;
						aabb.copy(meshInstancesLeftA[0].aabb);
						var scaleSign = getScaleSign(meshInstancesLeftA[0]);
						var vertexFormatBatchingHash = meshInstancesLeftA[0].mesh.vertexBuffer.format.batchingHash;
						var indexed = meshInstancesLeftA[0].mesh.primitive[0].indexed;
						skipTranslucentAabb = null;
						for(var i = 1; i < meshInstancesLeftA.length; i++){
								var mi = meshInstancesLeftA[i];
								if (dynamic && lists[j].length >= maxInstanceCount) {
										meshInstancesLeftB = meshInstancesLeftB.concat(meshInstancesLeftA.slice(i));
										break;
								}
								if (material !== mi.material || layer !== mi.layer || vertexFormatBatchingHash !== mi.mesh.vertexBuffer.format.batchingHash || indexed !== mi.mesh.primitive[0].indexed || defs !== mi._shaderDefs || vertCount + mi.mesh.vertexBuffer.getNumVertices() > maxNumVertices) {
										skipMesh(mi);
										continue;
								}
								testAabb.copy(aabb);
								testAabb.add(mi.aabb);
								if (testAabb.halfExtents.x > halfMaxAabbSize || testAabb.halfExtents.y > halfMaxAabbSize || testAabb.halfExtents.z > halfMaxAabbSize) {
										skipMesh(mi);
										continue;
								}
								if (stencil) {
										if (!(sf = mi.stencilFront) || stencil.func !== sf.func || stencil.zpass !== sf.zpass) {
												skipMesh(mi);
												continue;
										}
								}
								if (scaleSign !== getScaleSign(mi)) {
										skipMesh(mi);
										continue;
								}
								if (!equalParamSets(params, mi.parameters)) {
										skipMesh(mi);
										continue;
								}
								if (translucent && skipTranslucentAabb && skipTranslucentAabb.intersects(mi.aabb) && mi.drawOrder !== drawOrder) {
										skipMesh(mi);
										continue;
								}
								aabb.add(mi.aabb);
								vertCount += mi.mesh.vertexBuffer.getNumVertices();
								lists[j].push(mi);
						}
						j++;
						meshInstancesLeftA = meshInstancesLeftB;
				}
				return lists;
		}
		collectBatchedMeshData(meshInstances, dynamic) {
				var streams = null;
				var batchNumVerts = 0;
				var batchNumIndices = 0;
				var material = null;
				for(var i = 0; i < meshInstances.length; i++){
						if (meshInstances[i].visible) {
								var mesh = meshInstances[i].mesh;
								var numVerts = mesh.vertexBuffer.numVertices;
								batchNumVerts += numVerts;
								if (mesh.primitive[0].indexed) {
										batchNumIndices += mesh.primitive[0].count;
								} else {
										var primitiveType = mesh.primitive[0].type;
										if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
												if (mesh.primitive[0].count === 4) {
														batchNumIndices += 6;
												}
										}
								}
								if (!streams) {
										material = meshInstances[i].material;
										streams = {};
										var elems = mesh.vertexBuffer.format.elements;
										for(var j = 0; j < elems.length; j++){
												var semantic = elems[j].name;
												streams[semantic] = {
														numComponents: elems[j].numComponents,
														dataType: elems[j].dataType,
														normalize: elems[j].normalize,
														count: 0
												};
										}
										if (dynamic) {
												streams[SEMANTIC_BLENDINDICES] = {
														numComponents: 1,
														dataType: TYPE_FLOAT32,
														normalize: false,
														count: 0
												};
										}
								}
						}
				}
				return {
						streams: streams,
						batchNumVerts: batchNumVerts,
						batchNumIndices: batchNumIndices,
						material: material
				};
		}
		create(meshInstances, dynamic, batchGroupId) {
				if (!this._init) {
						this.vertexFormats = {};
						this._init = true;
				}
				var stream = null;
				var semantic;
				var mesh, numVerts;
				var batch = null;
				var batchData = this.collectBatchedMeshData(meshInstances, dynamic);
				if (batchData.streams) {
						var streams = batchData.streams;
						var material = batchData.material;
						var batchNumVerts = batchData.batchNumVerts;
						var batchNumIndices = batchData.batchNumIndices;
						batch = new Batch(meshInstances, dynamic, batchGroupId);
						this._batchList.push(batch);
						var indexBase, numIndices, indexData;
						var verticesOffset = 0;
						var indexOffset = 0;
						var transform;
						var indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
						var indices = new indexArrayType(batchNumIndices);
						for(semantic in streams){
								stream = streams[semantic];
								stream.typeArrayType = typedArrayTypes[stream.dataType];
								stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
								stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
						}
						for(var i = 0; i < meshInstances.length; i++){
								if (!meshInstances[i].visible) {
										continue;
								}
								mesh = meshInstances[i].mesh;
								numVerts = mesh.vertexBuffer.numVertices;
								if (!dynamic) {
										transform = meshInstances[i].node.getWorldTransform();
								}
								for(semantic in streams){
										if (semantic !== SEMANTIC_BLENDINDICES) {
												stream = streams[semantic];
												var subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
												var totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
												stream.count += totalComponents;
												if (!dynamic && stream.numComponents >= 3) {
														if (semantic === SEMANTIC_POSITION) {
																var m = transform.data;
																var m0 = m[0];
																var m1 = m[1];
																var m2 = m[2];
																var m4 = m[4];
																var m5 = m[5];
																var m6 = m[6];
																var m8 = m[8];
																var m9 = m[9];
																var m10 = m[10];
																var m12 = m[12];
																var m13 = m[13];
																var m14 = m[14];
																var x = undefined, y = undefined, z = undefined;
																for(var j = 0; j < totalComponents; j += stream.numComponents){
																		x = subarray[j];
																		y = subarray[j + 1];
																		z = subarray[j + 2];
																		subarray[j] = x * m0 + y * m4 + z * m8 + m12;
																		subarray[j + 1] = x * m1 + y * m5 + z * m9 + m13;
																		subarray[j + 2] = x * m2 + y * m6 + z * m10 + m14;
																}
														} else if (semantic === SEMANTIC_NORMAL || semantic === SEMANTIC_TANGENT) {
																mat3.invertMat4(transform).transpose();
																var [m01, m11, m21, m3, m41, m51, m61, m7, m81] = mat3.data;
																var x1 = undefined, y1 = undefined, z1 = undefined;
																for(var j1 = 0; j1 < totalComponents; j1 += stream.numComponents){
																		x1 = subarray[j1];
																		y1 = subarray[j1 + 1];
																		z1 = subarray[j1 + 2];
																		subarray[j1] = x1 * m01 + y1 * m3 + z1 * m61;
																		subarray[j1 + 1] = x1 * m11 + y1 * m41 + z1 * m7;
																		subarray[j1 + 2] = x1 * m21 + y1 * m51 + z1 * m81;
																}
														}
												}
										}
								}
								if (dynamic) {
										stream = streams[SEMANTIC_BLENDINDICES];
										for(var j2 = 0; j2 < numVerts; j2++){
												stream.buffer[stream.count++] = i;
										}
								}
								if (mesh.primitive[0].indexed) {
										indexBase = mesh.primitive[0].base;
										numIndices = mesh.primitive[0].count;
										var srcFormat = mesh.indexBuffer[0].getFormat();
										indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);
								} else {
										var primitiveType = mesh.primitive[0].type;
										if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
												if (mesh.primitive[0].count === 4) {
														indexBase = 0;
														numIndices = 6;
														indexData = primitiveType === PRIMITIVE_TRIFAN ? _triFanIndices : _triStripIndices;
												} else {
														numIndices = 0;
														continue;
												}
										}
								}
								for(var j3 = 0; j3 < numIndices; j3++){
										indices[j3 + indexOffset] = indexData[indexBase + j3] + verticesOffset;
								}
								indexOffset += numIndices;
								verticesOffset += numVerts;
						}
						mesh = new Mesh(this.device);
						for(semantic in streams){
								stream = streams[semantic];
								mesh.setVertexStream(semantic, stream.buffer, stream.numComponents, undefined, stream.dataType, stream.normalize);
						}
						if (indices.length > 0) {
								mesh.setIndices(indices);
						}
						mesh.update(PRIMITIVE_TRIANGLES, false);
						if (dynamic) {
								material = material.clone();
								material.update();
						}
						var meshInstance = new MeshInstance(mesh, material, this.rootNode);
						meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
						meshInstance.parameters = batch.origMeshInstances[0].parameters;
						meshInstance.layer = batch.origMeshInstances[0].layer;
						meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;
						meshInstance.batching = true;
						meshInstance.cull = batch.origMeshInstances[0].cull;
						var batchGroup = this._batchGroups[batchGroupId];
						if (batchGroup && batchGroup._ui) {
								meshInstance.cull = false;
						}
						if (dynamic) {
								var nodes = [];
								for(var i1 = 0; i1 < batch.origMeshInstances.length; i1++){
										nodes.push(batch.origMeshInstances[i1].node);
								}
								meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
						}
						meshInstance._updateAabb = false;
						meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
						meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
						meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
						meshInstance.flipFacesFactor = getScaleSign(batch.origMeshInstances[0]);
						meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
						batch.meshInstance = meshInstance;
						batch.updateBoundingBox();
				}
				return batch;
		}
		updateAll() {
				if (this._dirtyGroups.length > 0) {
						this.generate(this._dirtyGroups);
				}
				for(var i = 0; i < this._batchList.length; i++){
						if (!this._batchList[i].dynamic) continue;
						this._batchList[i].updateBoundingBox();
				}
		}
		clone(batch, clonedMeshInstances) {
				var batch2 = new Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
				this._batchList.push(batch2);
				var nodes = [];
				for(var i = 0; i < clonedMeshInstances.length; i++){
						nodes.push(clonedMeshInstances[i].node);
				}
				batch2.meshInstance = new MeshInstance(batch.meshInstance.mesh, batch.meshInstance.material, batch.meshInstance.node);
				batch2.meshInstance._updateAabb = false;
				batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
				batch2.meshInstance.cull = clonedMeshInstances[0].cull;
				batch2.meshInstance.layer = clonedMeshInstances[0].layer;
				if (batch.dynamic) {
						batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
				}
				batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
				return batch2;
		}
		destroyBatch(batch) {
				batch.destroy(this.scene, this._batchGroups[batch.batchGroupId].layers);
		}
		constructor(device, root, scene){
				this.device = device;
				this.rootNode = root;
				this.scene = scene;
				this._init = false;
				this._batchGroups = {};
				this._batchGroupCounter = 0;
				this._batchList = [];
				this._dirtyGroups = [];
		}
}

export { BatchManager };
