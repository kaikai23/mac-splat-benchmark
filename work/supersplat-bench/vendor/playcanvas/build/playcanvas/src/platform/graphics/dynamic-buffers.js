import { math } from '../../core/math/math.js';

class UsedBuffer {
}
class DynamicBufferAllocation {
}
class DynamicBuffers {
		destroy() {
				this.gpuBuffers.forEach((gpuBuffer)=>{
						gpuBuffer.destroy(this.device);
				});
				this.gpuBuffers = null;
				this.stagingBuffers.forEach((stagingBuffer)=>{
						stagingBuffer.destroy(this.device);
				});
				this.stagingBuffers = null;
				this.usedBuffers = null;
				this.activeBuffer = null;
		}
		alloc(allocation, size) {
				if (this.activeBuffer) {
						var alignedStart = math.roundUp(this.activeBuffer.size, this.bufferAlignment);
						var space = this.bufferSize - alignedStart;
						if (space < size) {
								this.scheduleSubmit();
						}
				}
				if (!this.activeBuffer) {
						var gpuBuffer = this.gpuBuffers.pop();
						if (!gpuBuffer) {
								gpuBuffer = this.createBuffer(this.device, this.bufferSize, false);
						}
						var stagingBuffer = this.stagingBuffers.pop();
						if (!stagingBuffer) {
								stagingBuffer = this.createBuffer(this.device, this.bufferSize, true);
						}
						this.activeBuffer = new UsedBuffer();
						this.activeBuffer.stagingBuffer = stagingBuffer;
						this.activeBuffer.gpuBuffer = gpuBuffer;
						this.activeBuffer.offset = 0;
						this.activeBuffer.size = 0;
				}
				var activeBuffer = this.activeBuffer;
				var alignedStart1 = math.roundUp(activeBuffer.size, this.bufferAlignment);
				allocation.gpuBuffer = activeBuffer.gpuBuffer;
				allocation.offset = alignedStart1;
				allocation.storage = activeBuffer.stagingBuffer.alloc(alignedStart1, size);
				activeBuffer.size = alignedStart1 + size;
		}
		scheduleSubmit() {
				if (this.activeBuffer) {
						this.usedBuffers.push(this.activeBuffer);
						this.activeBuffer = null;
				}
		}
		submit() {
				this.scheduleSubmit();
		}
		constructor(device, bufferSize, bufferAlignment){
				this.gpuBuffers = [];
				this.stagingBuffers = [];
				this.usedBuffers = [];
				this.activeBuffer = null;
				this.device = device;
				this.bufferSize = bufferSize;
				this.bufferAlignment = bufferAlignment;
		}
}

export { DynamicBufferAllocation, DynamicBuffers };
