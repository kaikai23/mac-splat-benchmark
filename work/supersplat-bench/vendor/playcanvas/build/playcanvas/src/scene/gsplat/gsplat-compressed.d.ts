export class GSplatCompressed {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatCompressedData} gsplatData - The splat data.
     */
    constructor(device: GraphicsDevice, gsplatData: GSplatCompressedData);
    device: GraphicsDevice;
    numSplats: any;
    numSplatsVisible: any;
    /** @type {BoundingBox} */
    aabb: BoundingBox;
    /** @type {Float32Array} */
    centers: Float32Array;
    /** @type {Texture} */
    packedTexture: Texture;
    /** @type {Texture} */
    chunkTexture: Texture;
    /** @type {Texture?} */
    shTexture0: Texture | null;
    /** @type {Texture?} */
    shTexture1: Texture | null;
    /** @type {Texture?} */
    shTexture2: Texture | null;
    numVisibleSplats: any;
    destroy(): void;
    /**
     * @param {SplatMaterialOptions} options - The splat material options.
     * @returns {Material} material - The material to set up for the splat rendering.
     */
    createMaterial(options: SplatMaterialOptions): Material;
    /**
     * Evaluates the texture size needed to store a given number of elements.
     * The function calculates a width and height that is close to a square
     * that can contain 'count' elements.
     *
     * @param {number} count - The number of elements to store in the texture.
     * @returns {Vec2} The width and height of the texture.
     */
    evalTextureSize(count: number): Vec2;
    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The width and height of the texture.
     * @param {Uint8Array|Uint16Array|Uint32Array} [data] - The initial data to fill the texture with.
     * @returns {Texture} The created texture instance.
     */
    createTexture(name: string, format: number, size: Vec2, data?: Uint8Array | Uint16Array | Uint32Array): Texture;
}
import type { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Texture } from '../../platform/graphics/texture.js';
import type { SplatMaterialOptions } from './gsplat-material.js';
import type { Material } from '../materials/material.js';
import { Vec2 } from '../../core/math/vec2.js';
import type { GSplatCompressedData } from './gsplat-compressed-data.js';
