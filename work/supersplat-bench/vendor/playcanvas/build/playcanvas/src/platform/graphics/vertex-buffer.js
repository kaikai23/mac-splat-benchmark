import { BUFFER_STATIC } from './constants.js';

var id = 0;
class VertexBuffer {
		destroy() {
				var device = this.device;
				var idx = device.buffers.indexOf(this);
				if (idx !== -1) {
						device.buffers.splice(idx, 1);
				}
				if (this.impl.initialized) {
						this.impl.destroy(device);
						this.adjustVramSizeTracking(device._vram, -this.storage.byteLength);
				}
		}
		adjustVramSizeTracking(vram, size) {
				vram.vb += size;
		}
		loseContext() {
				this.impl.loseContext();
		}
		getFormat() {
				return this.format;
		}
		getUsage() {
				return this.usage;
		}
		getNumVertices() {
				return this.numVertices;
		}
		lock() {
				return this.storage;
		}
		unlock() {
				this.impl.unlock(this);
		}
		setData(data) {
				if (data.byteLength !== this.numBytes) {
						return false;
				}
				this.storage = data;
				this.unlock();
				return true;
		}
		constructor(graphicsDevice, format, numVertices, options){
				this.usage = BUFFER_STATIC;
				var _options_usage;
				this.usage = (_options_usage = options == null ? undefined : options.usage) != null ? _options_usage : BUFFER_STATIC;
				this.device = graphicsDevice;
				this.format = format;
				this.numVertices = numVertices;
				this.id = id++;
				this.impl = graphicsDevice.createVertexBufferImpl(this, format, options);
				this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
				this.adjustVramSizeTracking(graphicsDevice._vram, this.numBytes);
				var initialData = options == null ? undefined : options.data;
				if (initialData) {
						this.setData(initialData);
				} else {
						this.storage = new ArrayBuffer(this.numBytes);
				}
				this.device.buffers.push(this);
		}
}

export { VertexBuffer };
