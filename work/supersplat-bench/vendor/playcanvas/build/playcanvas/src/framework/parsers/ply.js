import { GSplatData } from '../../scene/gsplat/gsplat-data.js';
import { GSplatCompressedData } from '../../scene/gsplat/gsplat-compressed-data.js';
import { GSplatResource } from './gsplat-resource.js';

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
var magicBytes = new Uint8Array([
		112,
		108,
		121,
		10
]);
var endHeaderBytes = new Uint8Array([
		10,
		101,
		110,
		100,
		95,
		104,
		101,
		97,
		100,
		101,
		114,
		10
]);
var dataTypeMap = new Map([
		[
				'char',
				Int8Array
		],
		[
				'uchar',
				Uint8Array
		],
		[
				'short',
				Int16Array
		],
		[
				'ushort',
				Uint16Array
		],
		[
				'int',
				Int32Array
		],
		[
				'uint',
				Uint32Array
		],
		[
				'float',
				Float32Array
		],
		[
				'double',
				Float64Array
		]
]);
class StreamBuf {
		read() {
				var _this = this;
				return _async_to_generator(function*() {
						var { value, done } = yield _this.reader.read();
						if (done) {
								throw new Error('Stream finished before end of header');
						}
						_this.push(value);
						_this.progressFunc == null ? undefined : _this.progressFunc.call(_this, value.byteLength);
				})();
		}
		push(data) {
				if (!this.data) {
						this.data = data;
						this.view = new DataView(this.data.buffer);
						this.tail = data.length;
				} else {
						var remaining = this.tail - this.head;
						var newSize = remaining + data.length;
						if (this.data.length >= newSize) {
								if (this.head > 0) {
										this.data.copyWithin(0, this.head, this.tail);
										this.data.set(data, remaining);
										this.head = 0;
										this.tail = newSize;
								} else {
										this.data.set(data, this.tail);
										this.tail += data.length;
								}
						} else {
								var tmp = new Uint8Array(newSize);
								if (this.head > 0 || this.tail < this.data.length) {
										tmp.set(this.data.subarray(this.head, this.tail), 0);
								} else {
										tmp.set(this.data, 0);
								}
								tmp.set(data, remaining);
								this.data = tmp;
								this.view = new DataView(this.data.buffer);
								this.head = 0;
								this.tail = newSize;
						}
				}
		}
		compact() {
				if (this.head > 0) {
						this.data.copyWithin(0, this.head, this.tail);
						this.tail -= this.head;
						this.head = 0;
				}
		}
		get remaining() {
				return this.tail - this.head;
		}
		getInt8() {
				var result = this.view.getInt8(this.head);
				this.head++;
				return result;
		}
		getUint8() {
				var result = this.view.getUint8(this.head);
				this.head++;
				return result;
		}
		getInt16() {
				var result = this.view.getInt16(this.head, true);
				this.head += 2;
				return result;
		}
		getUint16() {
				var result = this.view.getUint16(this.head, true);
				this.head += 2;
				return result;
		}
		getInt32() {
				var result = this.view.getInt32(this.head, true);
				this.head += 4;
				return result;
		}
		getUint32() {
				var result = this.view.getUint32(this.head, true);
				this.head += 4;
				return result;
		}
		getFloat32() {
				var result = this.view.getFloat32(this.head, true);
				this.head += 4;
				return result;
		}
		getFloat64() {
				var result = this.view.getFloat64(this.head, true);
				this.head += 8;
				return result;
		}
		constructor(reader, progressFunc){
				this.head = 0;
				this.tail = 0;
				this.reader = reader;
				this.progressFunc = progressFunc;
		}
}
var parseHeader = (lines)=>{
		var elements = [];
		var comments = [];
		var format;
		for(var i = 1; i < lines.length; ++i){
				var words = lines[i].split(' ');
				switch(words[0]){
						case 'comment':
								comments.push(words.slice(1).join(' '));
								break;
						case 'format':
								format = words[1];
								break;
						case 'element':
								elements.push({
										name: words[1],
										count: parseInt(words[2], 10),
										properties: []
								});
								break;
						case 'property':
								{
										if (!dataTypeMap.has(words[1])) {
												throw new Error("Unrecognized property data type '" + words[1] + "' in ply header");
										}
										var element = elements[elements.length - 1];
										element.properties.push({
												type: words[1],
												name: words[2],
												storage: null,
												byteSize: dataTypeMap.get(words[1]).BYTES_PER_ELEMENT
										});
										break;
								}
						default:
								throw new Error("Unrecognized header value '" + words[0] + "' in ply header");
				}
		}
		return {
				elements,
				format,
				comments
		};
};
var isCompressedPly = (elements)=>{
		var chunkProperties = [
				'min_x',
				'min_y',
				'min_z',
				'max_x',
				'max_y',
				'max_z',
				'min_scale_x',
				'min_scale_y',
				'min_scale_z',
				'max_scale_x',
				'max_scale_y',
				'max_scale_z',
				'min_r',
				'min_g',
				'min_b',
				'max_r',
				'max_g',
				'max_b'
		];
		var vertexProperties = [
				'packed_position',
				'packed_rotation',
				'packed_scale',
				'packed_color'
		];
		var shProperties = new Array(45).fill('').map((_, i)=>"f_rest_" + i);
		var hasBaseElements = ()=>{
				return elements[0].name === 'chunk' && elements[0].properties.every((p, i)=>p.name === chunkProperties[i] && p.type === 'float') && elements[1].name === 'vertex' && elements[1].properties.every((p, i)=>p.name === vertexProperties[i] && p.type === 'uint');
		};
		var hasSHElements = ()=>{
				return elements[2].name === 'sh' && [
						9,
						24,
						45
				].indexOf(elements[2].properties.length) !== -1 && elements[2].properties.every((p, i)=>p.name === shProperties[i] && p.type === 'uchar');
		};
		return elements.length === 2 && hasBaseElements() || elements.length === 3 && hasBaseElements() && hasSHElements();
};
var isFloatPly = (elements)=>{
		return elements.length === 1 && elements[0].name === 'vertex' && elements[0].properties.every((p)=>p.type === 'float');
};
var readCompressedPly = /*#__PURE__*/ _async_to_generator(function*(streamBuf, elements) {
		var result = new GSplatCompressedData();
		var numChunks = elements[0].count;
		var numChunkProperties = elements[0].properties.length;
		var numVertices = elements[1].count;
		var evalStorageSize = (count)=>{
				var width = Math.ceil(Math.sqrt(count));
				var height = Math.ceil(count / width);
				return width * height;
		};
		result.numSplats = numVertices;
		result.chunkData = new Float32Array(numChunks * numChunkProperties);
		result.vertexData = new Uint32Array(evalStorageSize(numVertices) * 4);
		var read = /*#__PURE__*/ _async_to_generator(function*(buffer, length) {
				var target = new Uint8Array(buffer);
				var cursor = 0;
				while(cursor < length){
						while(streamBuf.remaining === 0){
								yield streamBuf.read();
						}
						var toCopy = Math.min(length - cursor, streamBuf.remaining);
						var src = streamBuf.data;
						for(var i = 0; i < toCopy; ++i){
								target[cursor++] = src[streamBuf.head++];
						}
				}
		});
		yield read(result.chunkData.buffer, numChunks * numChunkProperties * 4);
		yield read(result.vertexData.buffer, numVertices * 4 * 4);
		if (elements.length === 3) {
				result.shData = new Uint8Array(elements[2].count * elements[2].properties.length);
				yield read(result.shData.buffer, result.shData.byteLength);
		}
		return result;
});
var readFloatPly = /*#__PURE__*/ _async_to_generator(function*(streamBuf, elements) {
		var element = elements[0];
		var properties = element.properties;
		var numProperties = properties.length;
		var storage = properties.map((p)=>p.storage);
		var inputSize = properties.reduce((a, p)=>a + p.byteSize, 0);
		var vertexIdx = 0;
		var floatData;
		var checkFloatData = ()=>{
				var buffer = streamBuf.data.buffer;
				if ((floatData == null ? undefined : floatData.buffer) !== buffer) {
						floatData = new Float32Array(buffer, 0, buffer.byteLength / 4);
				}
		};
		checkFloatData();
		while(vertexIdx < element.count){
				while(streamBuf.remaining < inputSize){
						yield streamBuf.read();
						checkFloatData();
				}
				var toRead = Math.min(element.count - vertexIdx, Math.floor(streamBuf.remaining / inputSize));
				for(var j = 0; j < numProperties; ++j){
						var s = storage[j];
						for(var n = 0; n < toRead; ++n){
								s[n + vertexIdx] = floatData[n * numProperties + j];
						}
				}
				vertexIdx += toRead;
				streamBuf.head += toRead * inputSize;
		}
		return new GSplatData(elements);
});
var readGeneralPly = /*#__PURE__*/ _async_to_generator(function*(streamBuf, elements) {
		for(var i = 0; i < elements.length; ++i){
				var element = elements[i];
				var inputSize = element.properties.reduce((a, p)=>a + p.byteSize, 0);
				var propertyParsingFunctions = element.properties.map((p)=>{
						if (p.storage) {
								switch(p.type){
										case 'char':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getInt8();
												};
										case 'uchar':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getUint8();
												};
										case 'short':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getInt16();
												};
										case 'ushort':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getUint16();
												};
										case 'int':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getInt32();
												};
										case 'uint':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getUint32();
												};
										case 'float':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getFloat32();
												};
										case 'double':
												return (streamBuf, c)=>{
														p.storage[c] = streamBuf.getFloat64();
												};
										default:
												throw new Error("Unsupported property data type '" + p.type + "' in ply header");
								}
						} else {
								return (streamBuf)=>{
										streamBuf.head += p.byteSize;
								};
						}
				});
				var c = 0;
				while(c < element.count){
						while(streamBuf.remaining < inputSize){
								yield streamBuf.read();
						}
						var toRead = Math.min(element.count - c, Math.floor(streamBuf.remaining / inputSize));
						for(var n = 0; n < toRead; ++n){
								for(var j = 0; j < element.properties.length; ++j){
										propertyParsingFunctions[j](streamBuf, c);
								}
								c++;
						}
				}
		}
		return new GSplatData(elements);
});
var readPly = /*#__PURE__*/ _async_to_generator(function*(reader, propertyFilter, progressFunc) {
		if (propertyFilter === undefined) propertyFilter = null;
		if (progressFunc === undefined) progressFunc = null;
		var find = (buf, search)=>{
				var endIndex = buf.length - search.length;
				var i, j;
				for(i = 0; i <= endIndex; ++i){
						for(j = 0; j < search.length; ++j){
								if (buf[i + j] !== search[j]) {
										break;
								}
						}
						if (j === search.length) {
								return i;
						}
				}
				return -1;
		};
		var startsWith = (a, b)=>{
				if (a.length < b.length) {
						return false;
				}
				for(var i = 0; i < b.length; ++i){
						if (a[i] !== b[i]) {
								return false;
						}
				}
				return true;
		};
		var streamBuf = new StreamBuf(reader, progressFunc);
		var headerLength;
		while(true){
				yield streamBuf.read();
				if (streamBuf.tail >= magicBytes.length && !startsWith(streamBuf.data, magicBytes)) {
						throw new Error('Invalid ply header');
				}
				headerLength = find(streamBuf.data, endHeaderBytes);
				if (headerLength !== -1) {
						break;
				}
		}
		var lines = new TextDecoder('ascii').decode(streamBuf.data.subarray(0, headerLength)).split('\n');
		var { elements, format, comments } = parseHeader(lines);
		if (format !== 'binary_little_endian') {
				throw new Error('Unsupported ply format');
		}
		streamBuf.head = headerLength + endHeaderBytes.length;
		streamBuf.compact();
		var readData = /*#__PURE__*/ _async_to_generator(function*() {
				if (isCompressedPly(elements)) {
						return yield readCompressedPly(streamBuf, elements);
				}
				elements.forEach((e)=>{
						e.properties.forEach((p)=>{
								var storageType = dataTypeMap.get(p.type);
								if (storageType) {
										var storage = !propertyFilter || propertyFilter(p.name) ? new storageType(e.count) : null;
										p.storage = storage;
								}
						});
				});
				if (isFloatPly(elements)) {
						return yield readFloatPly(streamBuf, elements);
				}
				return yield readGeneralPly(streamBuf, elements);
		});
		return {
				data: yield readData(),
				comments
		};
});
var defaultElementFilter = (val)=>true;
class PlyParser {
		load(url, callback, asset) {
				var _this = this;
				return _async_to_generator(function*() {
						try {
								var response = yield fetch(url.load);
								if (!response || !response.body) {
										callback('Error loading resource', null);
								} else {
										var _response_headers_get;
										var totalLength = parseInt((_response_headers_get = response.headers.get('content-length')) != null ? _response_headers_get : '0', 10);
										var totalReceived = 0;
										var _asset_data_elementFilter;
										var { data, comments } = yield readPly(response.body.getReader(), (_asset_data_elementFilter = asset.data.elementFilter) != null ? _asset_data_elementFilter : defaultElementFilter, (bytes)=>{
												totalReceived += bytes;
												if (asset) {
														asset.fire('progress', totalReceived, totalLength);
												}
										});
										if (!data.isCompressed) {
												var _asset_data_reorder;
												if ((_asset_data_reorder = asset.data.reorder) != null ? _asset_data_reorder : true) {
														data.reorderData();
												}
										}
										var resource = new GSplatResource(_this.device, data.isCompressed && asset.data.decompress ? data.decompress() : data, comments);
										callback(null, resource);
								}
						} catch (err) {
								callback(err, null);
						}
				})();
		}
		open(url, data) {
				return data;
		}
		constructor(device, assets, maxRetries){
				this.device = device;
				this.assets = assets;
				this.maxRetries = maxRetries;
		}
}

export { PlyParser };
