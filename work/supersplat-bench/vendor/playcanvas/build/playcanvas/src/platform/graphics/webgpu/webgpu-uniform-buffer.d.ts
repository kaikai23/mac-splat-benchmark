/**
 * A WebGPU implementation of the UniformBuffer.
 */
export class WebgpuUniformBuffer extends WebgpuBuffer {
    constructor(uniformBuffer: any);
    unlock(uniformBuffer: any): void;
}
import { WebgpuBuffer } from './webgpu-buffer.js';
