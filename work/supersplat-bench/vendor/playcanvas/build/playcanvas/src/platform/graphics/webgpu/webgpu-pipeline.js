class WebgpuPipeline {
		getPipelineLayout(bindGroupFormats) {
				var bindGroupLayouts = [];
				bindGroupFormats.forEach((format)=>{
						bindGroupLayouts.push(format.bindGroupLayout);
				});
				var desc = {
						bindGroupLayouts: bindGroupLayouts
				};
				var pipelineLayout = this.device.wgpu.createPipelineLayout(desc);
				return pipelineLayout;
		}
		constructor(device){
				this.device = device;
		}
}

export { WebgpuPipeline };
