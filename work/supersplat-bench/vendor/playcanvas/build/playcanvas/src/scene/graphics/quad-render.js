import { Vec4 } from '../../core/math/vec4.js';
import { BindGroup, DynamicBindGroup } from '../../platform/graphics/bind-group.js';
import { BINDGROUP_VIEW, BINDGROUP_MESH, BINDGROUP_MESH_UB, PRIMITIVE_TRISTRIP } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { processShader } from '../shader-lib/utils.js';

var _quadPrimitive = {
		type: PRIMITIVE_TRISTRIP,
		base: 0,
		count: 4,
		indexed: false
};
var _tempViewport = new Vec4();
var _tempScissor = new Vec4();
var _dynamicBindGroup = new DynamicBindGroup();
class QuadRender {
		destroy() {
				var _this_uniformBuffer, _this_bindGroup;
				(_this_uniformBuffer = this.uniformBuffer) == null ? undefined : _this_uniformBuffer.destroy();
				this.uniformBuffer = null;
				(_this_bindGroup = this.bindGroup) == null ? undefined : _this_bindGroup.destroy();
				this.bindGroup = null;
		}
		render(viewport, scissor) {
				var device = this.shader.device;
				if (viewport) {
						_tempViewport.set(device.vx, device.vy, device.vw, device.vh);
						_tempScissor.set(device.sx, device.sy, device.sw, device.sh);
						scissor = scissor != null ? scissor : viewport;
						device.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
						device.setScissor(scissor.x, scissor.y, scissor.z, scissor.w);
				}
				device.setVertexBuffer(device.quadVertexBuffer, 0);
				var shader = this.shader;
				device.setShader(shader);
				if (device.supportsUniformBuffers) {
						device.setBindGroup(BINDGROUP_VIEW, device.emptyBindGroup);
						var bindGroup = this.bindGroup;
						bindGroup.update();
						device.setBindGroup(BINDGROUP_MESH, bindGroup);
						var uniformBuffer = this.uniformBuffer;
						if (uniformBuffer) {
								uniformBuffer.update(_dynamicBindGroup);
								device.setBindGroup(BINDGROUP_MESH_UB, _dynamicBindGroup.bindGroup, _dynamicBindGroup.offsets);
						} else {
								device.setBindGroup(BINDGROUP_MESH_UB, device.emptyBindGroup);
						}
				}
				device.draw(_quadPrimitive);
				if (viewport) {
						device.setViewport(_tempViewport.x, _tempViewport.y, _tempViewport.z, _tempViewport.w);
						device.setScissor(_tempScissor.x, _tempScissor.y, _tempScissor.z, _tempScissor.w);
				}
		}
		constructor(shader){
				var device = shader.device;
				this.shader = shader;
				if (device.supportsUniformBuffers) {
						var processingOptions = new ShaderProcessorOptions();
						this.shader = processShader(shader, processingOptions);
						var ubFormat = this.shader.meshUniformBufferFormat;
						if (ubFormat) {
								this.uniformBuffer = new UniformBuffer(device, ubFormat, false);
						}
						var bindGroupFormat = this.shader.meshBindGroupFormat;
						this.bindGroup = new BindGroup(device, bindGroupFormat);
				}
		}
}

export { QuadRender };
