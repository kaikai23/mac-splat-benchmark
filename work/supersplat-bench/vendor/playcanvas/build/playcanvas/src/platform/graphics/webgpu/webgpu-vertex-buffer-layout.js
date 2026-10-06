import { semanticToLocation, TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, TYPE_FLOAT16 } from '../constants.js';

var gpuVertexFormats = [];
gpuVertexFormats[TYPE_INT8] = 'sint8';
gpuVertexFormats[TYPE_UINT8] = 'uint8';
gpuVertexFormats[TYPE_INT16] = 'sint16';
gpuVertexFormats[TYPE_UINT16] = 'uint16';
gpuVertexFormats[TYPE_INT32] = 'sint32';
gpuVertexFormats[TYPE_UINT32] = 'uint32';
gpuVertexFormats[TYPE_FLOAT32] = 'float32';
gpuVertexFormats[TYPE_FLOAT16] = 'float16';
var gpuVertexFormatsNormalized = [];
gpuVertexFormatsNormalized[TYPE_INT8] = 'snorm8';
gpuVertexFormatsNormalized[TYPE_UINT8] = 'unorm8';
gpuVertexFormatsNormalized[TYPE_INT16] = 'snorm16';
gpuVertexFormatsNormalized[TYPE_UINT16] = 'unorm16';
gpuVertexFormatsNormalized[TYPE_INT32] = 'sint32';
gpuVertexFormatsNormalized[TYPE_UINT32] = 'uint32';
gpuVertexFormatsNormalized[TYPE_FLOAT32] = 'float32';
gpuVertexFormatsNormalized[TYPE_FLOAT16] = 'float16';
class WebgpuVertexBufferLayout {
		get(vertexFormat0, vertexFormat1) {
				if (vertexFormat1 === undefined) vertexFormat1 = null;
				var key = this.getKey(vertexFormat0, vertexFormat1);
				var layout = this.cache.get(key);
				if (!layout) {
						layout = this.create(vertexFormat0, vertexFormat1);
						this.cache.set(key, layout);
				}
				return layout;
		}
		getKey(vertexFormat0, vertexFormat1) {
				if (vertexFormat1 === undefined) vertexFormat1 = null;
				return (vertexFormat0 == null ? undefined : vertexFormat0.renderingHashString) + "-" + (vertexFormat1 == null ? undefined : vertexFormat1.renderingHashString);
		}
		create(vertexFormat0, vertexFormat1) {
				var layout = [];
				var addFormat = (format)=>{
						var interleaved = format.interleaved;
						var stepMode = format.instancing ? 'instance' : 'vertex';
						var attributes = [];
						var elementCount = format.elements.length;
						for(var i = 0; i < elementCount; i++){
								var element = format.elements[i];
								var location = semanticToLocation[element.name];
								var formatTable = element.normalize ? gpuVertexFormatsNormalized : gpuVertexFormats;
								attributes.push({
										shaderLocation: location,
										offset: interleaved ? element.offset : 0,
										format: "" + formatTable[element.dataType] + (element.numComponents > 1 ? "x" + element.numComponents : '')
								});
								if (!interleaved || i === elementCount - 1) {
										layout.push({
												attributes: attributes,
												arrayStride: element.stride,
												stepMode: stepMode
										});
										attributes = [];
								}
						}
				};
				if (vertexFormat0) {
						addFormat(vertexFormat0);
				}
				if (vertexFormat1) {
						addFormat(vertexFormat1);
				}
				return layout;
		}
		constructor(){
				this.cache = new Map();
		}
}

export { WebgpuVertexBufferLayout };
