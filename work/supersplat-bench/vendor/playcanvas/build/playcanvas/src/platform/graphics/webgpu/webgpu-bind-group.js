class WebgpuBindGroup {
		update(bindGroup) {
				this.destroy();
				var device = bindGroup.device;
				var desc = this.createDescriptor(device, bindGroup);
				this.bindGroup = device.wgpu.createBindGroup(desc);
		}
		destroy() {
				this.bindGroup = null;
		}
		createDescriptor(device, bindGroup) {
				var entries = [];
				var format = bindGroup.format;
				var uniformBufferFormats = bindGroup.format.uniformBufferFormats;
				bindGroup.uniformBuffers.forEach((ub, i)=>{
						var slot = uniformBufferFormats[i].slot;
						var buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
						entries.push({
								binding: slot,
								resource: {
										buffer: buffer,
										offset: 0,
										size: ub.format.byteSize
								}
						});
				});
				var textureFormats = bindGroup.format.textureFormats;
				bindGroup.textures.forEach((tex, textureIndex)=>{
						var wgpuTexture = tex.impl;
						var textureFormat = format.textureFormats[textureIndex];
						var slot = textureFormats[textureIndex].slot;
						var view = wgpuTexture.getView(device);
						entries.push({
								binding: slot,
								resource: view
						});
						if (textureFormat.hasSampler) {
								var sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
								entries.push({
										binding: slot + 1,
										resource: sampler
								});
						}
				});
				var storageTextureFormats = bindGroup.format.storageTextureFormats;
				bindGroup.storageTextures.forEach((tex, textureIndex)=>{
						var wgpuTexture = tex.impl;
						var slot = storageTextureFormats[textureIndex].slot;
						var view = wgpuTexture.getView(device);
						entries.push({
								binding: slot,
								resource: view
						});
				});
				var storageBufferFormats = bindGroup.format.storageBufferFormats;
				bindGroup.storageBuffers.forEach((buffer, bufferIndex)=>{
						var wgpuBuffer = buffer.impl.buffer;
						var slot = storageBufferFormats[bufferIndex].slot;
						entries.push({
								binding: slot,
								resource: {
										buffer: wgpuBuffer
								}
						});
				});
				var desc = {
						layout: bindGroup.format.impl.bindGroupLayout,
						entries: entries
				};
				return desc;
		}
}

export { WebgpuBindGroup };
