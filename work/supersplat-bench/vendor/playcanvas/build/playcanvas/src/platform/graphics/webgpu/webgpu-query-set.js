class WebgpuQuerySet {
		destroy() {
				var _this_querySet, _this_queryBuffer;
				(_this_querySet = this.querySet) == null ? undefined : _this_querySet.destroy();
				this.querySet = null;
				(_this_queryBuffer = this.queryBuffer) == null ? undefined : _this_queryBuffer.destroy();
				this.queryBuffer = null;
				this.activeStagingBuffer = null;
				this.stagingBuffers.forEach((stagingBuffer)=>{
						stagingBuffer.destroy();
				});
				this.stagingBuffers = null;
		}
		getStagingBuffer() {
				var stagingBuffer = this.stagingBuffers.pop();
				if (!stagingBuffer) {
						stagingBuffer = this.device.wgpu.createBuffer({
								size: this.queryBuffer.size,
								usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
						});
				}
				return stagingBuffer;
		}
		resolve(count) {
				var device = this.device;
				var commandEncoder = device.getCommandEncoder();
				commandEncoder.resolveQuerySet(this.querySet, 0, count, this.queryBuffer, 0);
				var activeStagingBuffer = this.getStagingBuffer();
				this.activeStagingBuffer = activeStagingBuffer;
				commandEncoder.copyBufferToBuffer(this.queryBuffer, 0, activeStagingBuffer, 0, this.bytesPerSlot * count);
		}
		request(count, renderVersion) {
				var stagingBuffer = this.activeStagingBuffer;
				this.activeStagingBuffer = null;
				return stagingBuffer.mapAsync(GPUMapMode.READ).then(()=>{
						var _this_stagingBuffers;
						var srcTimings = new BigInt64Array(stagingBuffer.getMappedRange());
						var timings = [];
						for(var i = 0; i < count; i++){
								timings.push(Number(srcTimings[i * 2 + 1] - srcTimings[i * 2]) * 0.000001);
						}
						stagingBuffer.unmap();
						(_this_stagingBuffers = this.stagingBuffers) == null ? undefined : _this_stagingBuffers.push(stagingBuffer);
						return {
								renderVersion,
								timings
						};
				});
		}
		constructor(device, isTimestamp, capacity){
				this.stagingBuffers = [];
				this.activeStagingBuffer = null;
				this.device = device;
				this.capacity = capacity;
				this.bytesPerSlot = isTimestamp ? 8 : 4;
				var wgpu = device.wgpu;
				this.querySet = wgpu.createQuerySet({
						type: isTimestamp ? 'timestamp' : 'occlusion',
						count: capacity
				});
				this.queryBuffer = wgpu.createBuffer({
						size: this.bytesPerSlot * capacity,
						usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
				});
		}
}

export { WebgpuQuerySet };
