function DracoWorker(jsUrl, wasmUrl) {
		var draco;
		var POSITION_ATTRIBUTE = 0;
		var NORMAL_ATTRIBUTE = 1;
		var wrap = (typedArray, dataType)=>{
				switch(dataType){
						case draco.DT_INT8:
								return new Int8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
						case draco.DT_INT16:
								return new Int16Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 2);
						case draco.DT_INT32:
								return new Int32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
						case draco.DT_UINT8:
								return new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
						case draco.DT_UINT16:
								return new Uint16Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 2);
						case draco.DT_UINT32:
								return new Uint32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
						case draco.DT_FLOAT32:
								return new Float32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
				}
				return null;
		};
		var componentSizeInBytes = (dataType)=>{
				switch(dataType){
						case draco.DT_INT8:
								return 1;
						case draco.DT_INT16:
								return 2;
						case draco.DT_INT32:
								return 4;
						case draco.DT_UINT8:
								return 1;
						case draco.DT_UINT16:
								return 2;
						case draco.DT_UINT32:
								return 4;
						case draco.DT_FLOAT32:
								return 4;
				}
				return 1;
		};
		var attributeSizeInBytes = (attribute)=>{
				return attribute.num_components() * componentSizeInBytes(attribute.data_type());
		};
		var attributeOrder = {
				0: 0,
				1: 1,
				5: 2,
				2: 3,
				7: 4,
				8: 5,
				4: 6,
				3: 7
		};
		var generateNormals = (vertices, indices)=>{
				var subtract = (dst, a, b)=>{
						dst[0] = a[0] - b[0];
						dst[1] = a[1] - b[1];
						dst[2] = a[2] - b[2];
				};
				var cross = (dst, a, b)=>{
						dst[0] = a[1] * b[2] - b[1] * a[2];
						dst[1] = a[2] * b[0] - b[2] * a[0];
						dst[2] = a[0] * b[1] - b[0] * a[1];
				};
				var normalize = (dst, offset)=>{
						var a = dst[offset + 0];
						var b = dst[offset + 1];
						var c = dst[offset + 2];
						var l = 1.0 / Math.sqrt(a * a + b * b + c * c);
						dst[offset + 0] *= l;
						dst[offset + 1] *= l;
						dst[offset + 2] *= l;
				};
				var copy = (dst, src, srcOffset)=>{
						for(var i = 0; i < 3; ++i){
								dst[i] = src[srcOffset + i];
						}
				};
				var numTriangles = indices.length / 3;
				var numVertices = vertices.length / 3;
				var result = new Float32Array(vertices.length);
				var a = [
						0,
						0,
						0
				], b = [
						0,
						0,
						0
				], c = [
						0,
						0,
						0
				], t1 = [
						0,
						0,
						0
				], t2 = [
						0,
						0,
						0
				], n = [
						0,
						0,
						0
				];
				for(var i = 0; i < numTriangles; ++i){
						var v0 = indices[i * 3 + 0] * 3;
						var v1 = indices[i * 3 + 1] * 3;
						var v2 = indices[i * 3 + 2] * 3;
						copy(a, vertices, v0);
						copy(b, vertices, v1);
						copy(c, vertices, v2);
						subtract(t1, b, a);
						subtract(t2, c, a);
						cross(n, t1, t2);
						normalize(n, 0);
						for(var j = 0; j < 3; ++j){
								result[v0 + j] += n[j];
								result[v1 + j] += n[j];
								result[v2 + j] += n[j];
						}
				}
				for(var i1 = 0; i1 < numVertices; ++i1){
						normalize(result, i1 * 3);
				}
				return new Uint8Array(result.buffer);
		};
		var decodeMesh = (inputBuffer)=>{
				var result = {};
				var buffer = new draco.DecoderBuffer();
				buffer.Init(inputBuffer, inputBuffer.length);
				var decoder = new draco.Decoder();
				if (decoder.GetEncodedGeometryType(buffer) !== draco.TRIANGULAR_MESH) {
						result.error = 'Failed to decode draco mesh: not a mesh';
						return result;
				}
				var mesh = new draco.Mesh();
				var status = decoder.DecodeBufferToMesh(buffer, mesh);
				if (!status || !status.ok() || draco.getPointer(mesh) === 0) {
						result.error = 'Failed to decode draco asset';
						return result;
				}
				var numIndices = mesh.num_faces() * 3;
				var shortIndices = mesh.num_points() <= 65535;
				var indicesSize = numIndices * (shortIndices ? 2 : 4);
				var indicesPtr = draco._malloc(indicesSize);
				if (shortIndices) {
						decoder.GetTrianglesUInt16Array(mesh, indicesSize, indicesPtr);
						result.indices = new Uint16Array(draco.HEAPU16.buffer, indicesPtr, numIndices).slice().buffer;
				} else {
						decoder.GetTrianglesUInt32Array(mesh, indicesSize, indicesPtr);
						result.indices = new Uint32Array(draco.HEAPU32.buffer, indicesPtr, numIndices).slice().buffer;
				}
				draco._free(indicesPtr);
				var attributes = [];
				for(var i = 0; i < mesh.num_attributes(); ++i){
						attributes.push(decoder.GetAttribute(mesh, i));
				}
				attributes.sort((a, b)=>{
						var _attributeOrder_a_attribute_type, _attributeOrder_b_attribute_type;
						return ((_attributeOrder_a_attribute_type = attributeOrder[a.attribute_type()]) != null ? _attributeOrder_a_attribute_type : attributeOrder.length) - ((_attributeOrder_b_attribute_type = attributeOrder[b.attribute_type()]) != null ? _attributeOrder_b_attribute_type : attributeOrder.length);
				});
				result.attributes = attributes.map((a)=>a.unique_id());
				var totalVertexSize = 0;
				var offsets = attributes.map((a)=>{
						var offset = totalVertexSize;
						totalVertexSize += Math.ceil(attributeSizeInBytes(a) / 4) * 4;
						return offset;
				});
				var hasNormals = attributes.some((a)=>a.attribute_type() === NORMAL_ATTRIBUTE);
				var normalOffset = offsets[1];
				if (!hasNormals) {
						for(var i1 = 1; i1 < offsets.length; ++i1){
								offsets[i1] += 12;
						}
						totalVertexSize += 12;
				}
				result.vertices = new ArrayBuffer(mesh.num_points() * totalVertexSize);
				var dst = new Uint8Array(result.vertices);
				for(var i2 = 0; i2 < mesh.num_attributes(); ++i2){
						var attribute = attributes[i2];
						var sizeInBytes = attributeSizeInBytes(attribute);
						var ptrSize = mesh.num_points() * sizeInBytes;
						var ptr = draco._malloc(ptrSize);
						decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, attribute.data_type(), ptrSize, ptr);
						var src = new Uint8Array(draco.HEAPU8.buffer, ptr, ptrSize);
						for(var j = 0; j < mesh.num_points(); ++j){
								for(var c = 0; c < sizeInBytes; ++c){
										dst[j * totalVertexSize + offsets[i2] + c] = src[j * sizeInBytes + c];
								}
						}
						if (!hasNormals && attribute.attribute_type() === POSITION_ATTRIBUTE) {
								var normals = generateNormals(wrap(src, attribute.data_type()), shortIndices ? new Uint16Array(result.indices) : new Uint32Array(result.indices));
								for(var j1 = 0; j1 < mesh.num_points(); ++j1){
										for(var c1 = 0; c1 < 12; ++c1){
												dst[j1 * totalVertexSize + normalOffset + c1] = normals[j1 * 12 + c1];
										}
								}
						}
						draco._free(ptr);
				}
				draco.destroy(mesh);
				draco.destroy(decoder);
				draco.destroy(buffer);
				return result;
		};
		var decode = (data)=>{
				var result = decodeMesh(new Uint8Array(data.buffer));
				self.postMessage({
						jobId: data.jobId,
						error: result.error,
						indices: result.indices,
						vertices: result.vertices,
						attributes: result.attributes
				}, [
						result.indices,
						result.vertices
				].filter((t)=>t != null));
		};
		var workQueue = [];
		self.onmessage = (message)=>{
				var data = message.data;
				switch(data.type){
						case 'init':
								self.DracoDecoderModule({
										instantiateWasm: (imports, successCallback)=>{
												WebAssembly.instantiate(data.module, imports).then((result)=>successCallback(result)).catch((reason)=>console.error("instantiate failed + " + reason));
												return {};
										}
								}).then((instance)=>{
										draco = instance;
										workQueue.forEach((data)=>decode(data));
								});
								break;
						case 'decodeMesh':
								if (draco) {
										decode(data);
								} else {
										workQueue.push(data);
								}
								break;
				}
		};
}

export { DracoWorker };
