/**
 * Internal WebGPU debug system. Note that the functions only execute in the debug build, and are
 * stripped out in other builds.
 */
export class WebgpuDebug {
    static _scopes: any[];
    static _markers: any[];
    /** @type {Map<string,number>} */
    static _loggedMessages: Map<string, number>;
    /**
     * Start a validation error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static validate(device: WebgpuGraphicsDevice): void;
    /**
     * Start an out-of-memory error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static memory(device: WebgpuGraphicsDevice): void;
    /**
     * Start an internal error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static internal(device: WebgpuGraphicsDevice): void;
    /**
     * End the previous error scope, and print errors if any.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {...any} args - Additional parameters that form the error message.
     */
    static end(device: WebgpuGraphicsDevice, ...args: any[]): void;
}
import type { WebgpuGraphicsDevice } from './webgpu-graphics-device.js';
