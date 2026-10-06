import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';

class WebgpuResolver {
		destroy() {
				this.shader.destroy();
				this.shader = null;
				this.pipelineCache = null;
		}
		getPipeline(format) {
				var pipeline = this.pipelineCache.get(format);
				if (!pipeline) {
						pipeline = this.createPipeline(format);
						this.pipelineCache.set(format, pipeline);
				}
				return pipeline;
		}
		createPipeline(format) {
				var webgpuShader = this.shader.impl;
				var pipeline = this.device.wgpu.createRenderPipeline({
						layout: 'auto',
						vertex: {
								module: webgpuShader.getVertexShaderModule(),
								entryPoint: webgpuShader.vertexEntryPoint
						},
						fragment: {
								module: webgpuShader.getFragmentShaderModule(),
								entryPoint: webgpuShader.fragmentEntryPoint,
								targets: [
										{
												format: format
										}
								]
						},
						primitive: {
								topology: 'triangle-strip'
						}
				});
				return pipeline;
		}
		resolveDepth(commandEncoder, sourceTexture, destinationTexture) {
				var device = this.device;
				var wgpu = device.wgpu;
				var pipeline = this.getPipeline(destinationTexture.format);
				var numFaces = sourceTexture.depthOrArrayLayers;
				for(var face = 0; face < numFaces; face++){
						var srcView = sourceTexture.createView({
								dimension: '2d',
								aspect: 'depth-only',
								baseMipLevel: 0,
								mipLevelCount: 1,
								baseArrayLayer: face
						});
						var dstView = destinationTexture.createView({
								dimension: '2d',
								baseMipLevel: 0,
								mipLevelCount: 1,
								baseArrayLayer: face
						});
						var passEncoder = commandEncoder.beginRenderPass({
								colorAttachments: [
										{
												view: dstView,
												loadOp: 'clear',
												storeOp: 'store'
										}
								]
						});
						var bindGroup = wgpu.createBindGroup({
								layout: pipeline.getBindGroupLayout(0),
								entries: [
										{
												binding: 0,
												resource: srcView
										}
								]
						});
						passEncoder.setPipeline(pipeline);
						passEncoder.setBindGroup(0, bindGroup);
						passEncoder.draw(4);
						passEncoder.end();
				}
				device.pipeline = null;
		}
		constructor(device){
				this.pipelineCache = new Map();
				this.device = device;
				var code = "\n \n            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(\n                vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)\n            );\n\n            struct VertexOutput {\n                @builtin(position) position : vec4f,\n            };\n\n            @vertex\n            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {\n              var output : VertexOutput;\n              output.position = vec4f(pos[vertexIndex], 0, 1);\n              return output;\n            }\n\n            @group(0) @binding(0) var img : texture_depth_multisampled_2d;\n\n            @fragment\n            fn fragmentMain(@builtin(position) fragColor: vec4f) -> @location(0) vec4f {\n                // load th depth value from sample index 0\n                var depth = textureLoad(img, vec2i(fragColor.xy), 0u);\n                return vec4f(depth, 0.0, 0.0, 0.0);\n            }\n        ";
				this.shader = new Shader(device, {
						name: 'WebGPUResolverDepthShader',
						shaderLanguage: SHADERLANGUAGE_WGSL,
						vshader: code,
						fshader: code
				});
		}
}

export { WebgpuResolver };
