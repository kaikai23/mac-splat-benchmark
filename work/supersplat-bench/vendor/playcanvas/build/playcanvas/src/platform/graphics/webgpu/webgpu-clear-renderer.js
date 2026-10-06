import { UniformBufferFormat, UniformFormat } from '../uniform-buffer-format.js';
import { BlendState } from '../blend-state.js';
import { BINDGROUP_MESH_UB, BINDGROUP_MESH, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, SHADERLANGUAGE_WGSL, UNIFORMTYPE_VEC4, UNIFORMTYPE_FLOAT, PRIMITIVE_TRISTRIP } from '../constants.js';
import { Shader } from '../shader.js';
import { DynamicBindGroup } from '../bind-group.js';
import { UniformBuffer } from '../uniform-buffer.js';
import { DepthState } from '../depth-state.js';

var primitive = {
		type: PRIMITIVE_TRISTRIP,
		base: 0,
		count: 4,
		indexed: false
};
class WebgpuClearRenderer {
		destroy() {
				this.shader.destroy();
				this.shader = null;
				this.uniformBuffer.destroy();
				this.uniformBuffer = null;
		}
		clear(device, renderTarget, options, defaultOptions) {
				options = options || defaultOptions;
				var _options_flags;
				var flags = (_options_flags = options.flags) != null ? _options_flags : defaultOptions.flags;
				if (flags !== 0) {
						var { uniformBuffer, dynamicBindGroup } = this;
						uniformBuffer.startUpdate(dynamicBindGroup);
						device.setBindGroup(BINDGROUP_MESH_UB, dynamicBindGroup.bindGroup, dynamicBindGroup.offsets);
						device.setBindGroup(BINDGROUP_MESH, device.emptyBindGroup);
						if (flags & CLEARFLAG_COLOR && (renderTarget.colorBuffer || renderTarget.impl.assignedColorTexture)) {
								var _options_color;
								var color = (_options_color = options.color) != null ? _options_color : defaultOptions.color;
								this.colorData.set(color);
								device.setBlendState(BlendState.NOBLEND);
						} else {
								device.setBlendState(BlendState.NOWRITE);
						}
						uniformBuffer.set('color', this.colorData);
						if (flags & CLEARFLAG_DEPTH && renderTarget.depth) {
								var _options_depth;
								var depth = (_options_depth = options.depth) != null ? _options_depth : defaultOptions.depth;
								uniformBuffer.set('depth', depth);
								device.setDepthState(DepthState.WRITEDEPTH);
						} else {
								uniformBuffer.set('depth', 1);
								device.setDepthState(DepthState.NODEPTH);
						}
						if (flags & CLEARFLAG_STENCIL && renderTarget.stencil) ;
						uniformBuffer.endUpdate();
						device.setCullMode(CULLFACE_NONE);
						device.setShader(this.shader);
						device.draw(primitive);
				}
		}
		constructor(device){
				var code = "\n\n            struct ub_mesh {\n                color : vec4f,\n                depth: f32\n            }\n\n            @group(2) @binding(0) var<uniform> ubMesh : ub_mesh;\n\n            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(\n                vec2(-1.0, 1.0), vec2(1.0, 1.0),\n                vec2(-1.0, -1.0), vec2(1.0, -1.0)\n            );\n\n            struct VertexOutput {\n                @builtin(position) position : vec4f\n            }\n\n            @vertex\n            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {\n                var output : VertexOutput;\n                output.position = vec4(pos[vertexIndex], ubMesh.depth, 1.0);\n                return output;\n            }\n\n            @fragment\n            fn fragmentMain() -> @location(0) vec4f {\n                return ubMesh.color;\n            }\n        ";
				this.shader = new Shader(device, {
						name: 'WebGPUClearRendererShader',
						shaderLanguage: SHADERLANGUAGE_WGSL,
						vshader: code,
						fshader: code
				});
				this.uniformBuffer = new UniformBuffer(device, new UniformBufferFormat(device, [
						new UniformFormat('color', UNIFORMTYPE_VEC4),
						new UniformFormat('depth', UNIFORMTYPE_FLOAT)
				]), false);
				this.dynamicBindGroup = new DynamicBindGroup();
				this.colorData = new Float32Array(4);
		}
}

export { WebgpuClearRenderer };
