/**
 * A WebGPU implementation of the VertexBuffer.
 */
export class WebgpuVertexBuffer extends WebgpuBuffer {
    constructor(vertexBuffer: any, format: any, options: any);
    unlock(vertexBuffer: any): void;
}
import { WebgpuBuffer } from './webgpu-buffer.js';
