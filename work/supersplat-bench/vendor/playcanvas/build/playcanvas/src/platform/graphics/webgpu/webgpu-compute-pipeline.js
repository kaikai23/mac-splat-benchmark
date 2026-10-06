import { WebgpuPipeline } from './webgpu-pipeline.js';

class WebgpuComputePipeline extends WebgpuPipeline {
		get(shader, bindGroupFormat) {
				var pipelineLayout = this.getPipelineLayout([
						bindGroupFormat.impl
				]);
				var pipeline = this.create(shader, pipelineLayout);
				return pipeline;
		}
		create(shader, pipelineLayout) {
				var wgpu = this.device.wgpu;
				var webgpuShader = shader.impl;
				var desc = {
						compute: {
								module: webgpuShader.getComputeShaderModule(),
								entryPoint: webgpuShader.computeEntryPoint
						},
						layout: pipelineLayout
				};
				var pipeline = wgpu.createComputePipeline(desc);
				return pipeline;
		}
}

export { WebgpuComputePipeline };
