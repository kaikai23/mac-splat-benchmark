import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';

class WebgpuMipmapRenderer {
		destroy() {
				this.shader.destroy();
				this.shader = null;
		}
		generate(webgpuTexture) {
				var textureDescr = webgpuTexture.desc;
				if (textureDescr.mipLevelCount <= 1) {
						return;
				}
				if (webgpuTexture.texture.volume) {
						return;
				}
				var device = this.device;
				var wgpu = device.wgpu;
				var webgpuShader = this.shader.impl;
				var pipeline = wgpu.createRenderPipeline({
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
												format: textureDescr.format
										}
								]
						},
						primitive: {
								topology: 'triangle-strip'
						}
				});
				var texture = webgpuTexture.texture;
				var numFaces = texture.cubemap ? 6 : texture.array ? texture.arrayLength : 1;
				var srcViews = [];
				for(var face = 0; face < numFaces; face++){
						srcViews.push(webgpuTexture.createView({
								dimension: '2d',
								baseMipLevel: 0,
								mipLevelCount: 1,
								baseArrayLayer: face
						}));
				}
				var commandEncoder = device.getCommandEncoder();
				for(var i = 1; i < textureDescr.mipLevelCount; i++){
						for(var face1 = 0; face1 < numFaces; face1++){
								var dstView = webgpuTexture.createView({
										dimension: '2d',
										baseMipLevel: i,
										mipLevelCount: 1,
										baseArrayLayer: face1
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
														resource: this.minSampler
												},
												{
														binding: 1,
														resource: srcViews[face1]
												}
										]
								});
								passEncoder.setPipeline(pipeline);
								passEncoder.setBindGroup(0, bindGroup);
								passEncoder.draw(4);
								passEncoder.end();
								srcViews[face1] = dstView;
						}
				}
				device.pipeline = null;
		}
		constructor(device){
				this.device = device;
				var code = "\n \n            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(\n                vec2(-1.0, 1.0), vec2(1.0, 1.0),\n                vec2(-1.0, -1.0), vec2(1.0, -1.0)\n            );\n\n            struct VertexOutput {\n                @builtin(position) position : vec4f,\n                @location(0) texCoord : vec2f\n            };\n\n            @vertex\n            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {\n              var output : VertexOutput;\n              output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);\n              output.position = vec4f(pos[vertexIndex], 0, 1);\n              return output;\n            }\n\n            @group(0) @binding(0) var imgSampler : sampler;\n            @group(0) @binding(1) var img : texture_2d<f32>;\n\n            @fragment\n            fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {\n              return textureSample(img, imgSampler, texCoord);\n            }\n        ";
				this.shader = new Shader(device, {
						name: 'WebGPUMipmapRendererShader',
						shaderLanguage: SHADERLANGUAGE_WGSL,
						vshader: code,
						fshader: code
				});
				this.minSampler = device.wgpu.createSampler({
						minFilter: 'linear'
				});
		}
}

export { WebgpuMipmapRenderer };
