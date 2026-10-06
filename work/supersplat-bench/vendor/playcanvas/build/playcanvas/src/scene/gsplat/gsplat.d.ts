/** @ignore */
export class GSplat {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatData} gsplatData - The splat data.
     */
    constructor(device: GraphicsDevice, gsplatData: GSplatData);
    device: GraphicsDevice;
    numSplats: number;
    numSplatsVisible: number;
    /** @type {Float32Array} */
    centers: Float32Array;
    /** @type {BoundingBox} */
    aabb: BoundingBox;
    /** @type {Texture} */
    colorTexture: Texture;
    /** @type {Texture} */
    transformATexture: Texture;
    /** @type {Texture} */
    transformBTexture: Texture;
    /** @type {0 | 1 | 2 | 3} */
    shBands: 0 | 1 | 2 | 3;
    /** @type {Texture | undefined} */
    sh1to3Texture: Texture | undefined;
    /** @type {Texture | undefined} */
    sh4to7Texture: Texture | undefined;
    /** @type {Texture | undefined} */
    sh8to11Texture: Texture | undefined;
    /** @type {Texture | undefined} */
    sh12to15Texture: Texture | undefined;
    destroy(): void;
    /**
     * @returns {Material} material - The material to set up for the splat rendering.
     */
    createMaterial(options: any): Material;
    /**
     * Evaluates the texture size needed to store a given number of elements.
     * The function calculates a width and height that is close to a square
     * that can contain 'count' elements.
     *
     * @param {number} count - The number of elements to store in the texture.
     * @returns {Vec2} An instance of Vec2 representing the width and height of the texture.
     */
    evalTextureSize(count: number): Vec2;
    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The size of the texture in a Vec2 object, containing width (x) and height (y).
     * @returns {Texture} The created texture instance.
     */
    createTexture(name: string, format: number, size: Vec2): Texture;
    /**
     * Updates pixel data of this.colorTexture based on the supplied color components and opacity.
     * Assumes that the texture is using an RGBA format where RGB are color components influenced
     * by SH spherical harmonics and A is opacity after a sigmoid transformation.
     *
     * @param {GSplatData} gsplatData - The source data
     */
    updateColorData(gsplatData: GSplatData): void;
    /**
     * @param {GSplatData} gsplatData - The source data
     */
    updateTransformData(gsplatData: GSplatData): void;
    /**
     * @param {GSplatData} gsplatData - The source data
     */
    updateSHData(gsplatData: GSplatData): void;
}
import type { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Texture } from '../../platform/graphics/texture.js';
import type { Material } from '../materials/material.js';
import { Vec2 } from '../../core/math/vec2.js';
import type { GSplatData } from './gsplat-data.js';
