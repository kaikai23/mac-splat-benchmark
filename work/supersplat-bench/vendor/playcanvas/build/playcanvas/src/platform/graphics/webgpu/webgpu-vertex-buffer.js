import { BUFFERUSAGE_VERTEX, BUFFERUSAGE_STORAGE } from '../constants.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuVertexBuffer extends WebgpuBuffer {
		unlock(vertexBuffer) {
				var device = vertexBuffer.device;
				super.unlock(device, vertexBuffer.storage);
		}
		constructor(vertexBuffer, format, options){
				super(BUFFERUSAGE_VERTEX | ((options == null ? undefined : options.storage) ? BUFFERUSAGE_STORAGE : 0));
		}
}

export { WebgpuVertexBuffer };
