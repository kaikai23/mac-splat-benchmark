import { BUFFERUSAGE_STORAGE } from './constants.js';

var id = 0;
class StorageBuffer {
		destroy() {
				var device = this.device;
				var idx = device.buffers.indexOf(this);
				if (idx !== -1) {
						device.buffers.splice(idx, 1);
				}
				this.adjustVramSizeTracking(device._vram, -this.byteSize);
				this.impl.destroy(device);
		}
		adjustVramSizeTracking(vram, size) {
				vram.sb += size;
		}
		read(offset, size, data) {
				if (offset === undefined) offset = 0;
				if (size === undefined) size = this.byteSize;
				if (data === undefined) data = null;
				return this.impl.read(this.device, offset, size, data);
		}
		write(bufferOffset, data, dataOffset, size) {
				if (bufferOffset === undefined) bufferOffset = 0;
				if (dataOffset === undefined) dataOffset = 0;
				this.impl.write(this.device, bufferOffset, data, dataOffset, size);
		}
		clear(offset, size) {
				if (offset === undefined) offset = 0;
				if (size === undefined) size = this.byteSize;
				this.impl.clear(this.device, offset, size);
		}
		constructor(graphicsDevice, byteSize, bufferUsage = 0){
				this.id = id++;
				this.device = graphicsDevice;
				this.byteSize = byteSize;
				this.bufferUsage = bufferUsage;
				this.impl = graphicsDevice.createBufferImpl(BUFFERUSAGE_STORAGE | bufferUsage);
				this.impl.allocate(graphicsDevice, byteSize);
				this.device.buffers.push(this);
				this.adjustVramSizeTracking(graphicsDevice._vram, this.byteSize);
		}
}

export { StorageBuffer };
