export class ChunkUtils {
    static decodeFunc(encoding: any): any;
    static encodeFunc(encoding: any): any;
    /**
     * Returns a screenDepth chunk configured for the given camera shader parameters.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraShaderParams} cameraShaderParams - The camera shader parameters.
     * @returns {string} The screenDepth chunk.
     * @ignore
     */
    static getScreenDepthChunk(device: GraphicsDevice, cameraShaderParams: CameraShaderParams): string;
}
import type { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import type { CameraShaderParams } from '../camera-shader-params.js';
