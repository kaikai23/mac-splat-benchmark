import { DynamicBuffers } from '../dynamic-buffers.js';
import { WebgpuDynamicBuffer } from './webgpu-dynamic-buffer.js';

class WebgpuDynamicBuffers extends DynamicBuffers {
		createBuffer(device, size, isStaging) {
				return new WebgpuDynamicBuffer(device, size, isStaging);
		}
		submit() {
				super.submit();
				var count = this.usedBuffers.length;
				if (count) {
						var device = this.device;
						var gpuBuffers = this.gpuBuffers;
						var commandEncoder = device.wgpu.createCommandEncoder();
						for(var i = count - 1; i >= 0; i--){
								var usedBuffer = this.usedBuffers[i];
								var { stagingBuffer, gpuBuffer, offset, size } = usedBuffer;
								var src = stagingBuffer.buffer;
								src.unmap();
								commandEncoder.copyBufferToBuffer(src, offset, gpuBuffer.buffer, offset, size);
								gpuBuffers.push(gpuBuffer);
						}
						var cb = commandEncoder.finish();
						device.addCommandBuffer(cb, true);
						for(var i1 = 0; i1 < count; i1++){
								var stagingBuffer1 = this.usedBuffers[i1].stagingBuffer;
								this.pendingStagingBuffers.push(stagingBuffer1);
						}
						this.usedBuffers.length = 0;
				}
		}
		onCommandBuffersSubmitted() {
				var count = this.pendingStagingBuffers.length;
				if (count) {
						var _this, _loop = function(i) {
								var stagingBuffer = _this.pendingStagingBuffers[i];
								stagingBuffer.buffer.mapAsync(GPUMapMode.WRITE).then(()=>{
										if (_this.stagingBuffers) {
												stagingBuffer.onAvailable();
												_this.stagingBuffers.push(stagingBuffer);
										}
								});
						};
						for(var i = 0; i < count; i++)_this = this, _loop(i);
						this.pendingStagingBuffers.length = 0;
				}
		}
		constructor(...args){
				super(...args), this.pendingStagingBuffers = [];
		}
}

export { WebgpuDynamicBuffers };
