import { PRIMITIVE_POINTS, BUFFER_GPUDYNAMIC } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { Shader } from './shader.js';
import { ShaderUtils } from './shader-utils.js';

class TransformFeedback {
		static createShader(graphicsDevice, vertexCode, name) {
				return new Shader(graphicsDevice, ShaderUtils.createDefinition(graphicsDevice, {
						name,
						vertexCode,
						useTransformFeedback: true
				}));
		}
		destroy() {
				this._outputBuffer.destroy();
		}
		process(shader, swap) {
				if (swap === undefined) swap = true;
				var device = this.device;
				var oldRt = device.getRenderTarget();
				device.setRenderTarget(null);
				device.updateBegin();
				device.setVertexBuffer(this._inputBuffer, 0);
				device.setRaster(false);
				device.setTransformFeedbackBuffer(this._outputBuffer);
				device.setShader(shader);
				device.draw({
						type: PRIMITIVE_POINTS,
						base: 0,
						count: this._inputBuffer.numVertices,
						indexed: false
				});
				device.setTransformFeedbackBuffer(null);
				device.setRaster(true);
				device.updateEnd();
				device.setRenderTarget(oldRt);
				if (swap) {
						var tmp = this._inputBuffer.impl.bufferId;
						this._inputBuffer.impl.bufferId = this._outputBuffer.impl.bufferId;
						this._outputBuffer.impl.bufferId = tmp;
						tmp = this._inputBuffer.impl.vao;
						this._inputBuffer.impl.vao = this._outputBuffer.impl.vao;
						this._outputBuffer.impl.vao = tmp;
				}
		}
		get inputBuffer() {
				return this._inputBuffer;
		}
		get outputBuffer() {
				return this._outputBuffer;
		}
		constructor(inputBuffer, usage = BUFFER_GPUDYNAMIC){
				this.device = inputBuffer.device;
				var gl = this.device.gl;
				this._inputBuffer = inputBuffer;
				if (usage === BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
						gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.impl.bufferId);
						gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
				}
				this._outputBuffer = new VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, {
						usage: usage,
						data: inputBuffer.storage
				});
		}
}

export { TransformFeedback };
