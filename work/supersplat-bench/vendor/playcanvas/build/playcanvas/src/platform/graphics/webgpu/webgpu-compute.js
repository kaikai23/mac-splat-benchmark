import { BindGroup } from '../bind-group.js';
import { UniformBuffer } from '../uniform-buffer.js';

class WebgpuCompute {
		destroy() {
				this.uniformBuffers.forEach((ub)=>ub.destroy());
				this.uniformBuffers.length = 0;
				this.bindGroup.destroy();
				this.bindGroup = null;
		}
		updateBindGroup() {
				var { bindGroup } = this;
				bindGroup.updateUniformBuffers();
				bindGroup.update();
		}
		dispatch(x, y, z) {
				var device = this.compute.device;
				device.setBindGroup(0, this.bindGroup);
				var passEncoder = device.passEncoder;
				passEncoder.setPipeline(this.pipeline);
				passEncoder.dispatchWorkgroups(x, y, z);
		}
		constructor(compute){
				this.uniformBuffers = [];
				this.bindGroup = null;
				this.compute = compute;
				var { device, shader } = compute;
				var { computeBindGroupFormat, computeUniformBufferFormats } = shader.impl;
				this.bindGroup = new BindGroup(device, computeBindGroupFormat);
				if (computeUniformBufferFormats) {
						for(var name in computeUniformBufferFormats){
								if (computeUniformBufferFormats.hasOwnProperty(name)) {
										var ub = new UniformBuffer(device, computeUniformBufferFormats[name], true);
										this.uniformBuffers.push(ub);
										this.bindGroup.setUniformBuffer(name, ub);
								}
						}
				}
				this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
		}
}

export { WebgpuCompute };
