class WebgpuBuffer {
		destroy(device) {
				if (this.buffer) {
						this.buffer.destroy();
						this.buffer = null;
				}
		}
		get initialized() {
				return !!this.buffer;
		}
		loseContext() {}
		allocate(device, size) {
				this.buffer = device.wgpu.createBuffer({
						size,
						usage: this.usageFlags
				});
		}
		unlock(device, storage) {
				var wgpu = device.wgpu;
				if (!this.buffer) {
						var size = storage.byteLength + 3 & -4;
						this.usageFlags |= GPUBufferUsage.COPY_DST;
						this.allocate(device, size);
				}
				var _storage_byteOffset;
				var srcOffset = (_storage_byteOffset = storage.byteOffset) != null ? _storage_byteOffset : 0;
				var _storage_buffer;
				var srcData = new Uint8Array((_storage_buffer = storage.buffer) != null ? _storage_buffer : storage, srcOffset, storage.byteLength);
				var data = new Uint8Array(this.buffer.size);
				data.set(srcData);
				wgpu.queue.writeBuffer(this.buffer, 0, data, 0, data.length);
		}
		read(device, offset, size, data) {
				return device.readStorageBuffer(this, offset, size, data);
		}
		write(device, bufferOffset, data, dataOffset, size) {
				device.writeStorageBuffer(this, bufferOffset, data, dataOffset, size);
		}
		clear(device, offset, size) {
				device.clearStorageBuffer(this, offset, size);
		}
		constructor(usageFlags = 0){
				this.buffer = null;
				this.usageFlags = 0;
				this.usageFlags = usageFlags;
		}
}

export { WebgpuBuffer };
