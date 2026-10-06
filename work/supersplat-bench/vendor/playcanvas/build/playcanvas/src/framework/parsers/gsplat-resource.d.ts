/**
 * @import { GSplatData } from '../../scene/gsplat/gsplat-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { SplatMaterialOptions } from '../../scene/gsplat/gsplat-material.js'
 */
/**
 * The resource for the gsplat asset type.
 *
 * @category Graphics
 */
export class GSplatResource {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatData} splatData - The splat data.
     * @param {string[]} comments - The PLY file header comments
     * @ignore
     */
    constructor(device: GraphicsDevice, splatData: GSplatData, comments: string[]);
    /**
     * @type {GraphicsDevice}
     * @ignore
     */
    device: GraphicsDevice;
    /**
     * @type {GSplatData}
     * @ignore
     */
    splatData: GSplatData;
    /**
     * @type {GSplat | GSplatCompressed | null}
     * @ignore
     */
    splat: GSplat | GSplatCompressed | null;
    /**
     * @type {string[] | null}
     * @ignore
     */
    comments: string[] | null;
    destroy(): void;
    createSplat(): GSplatCompressed | GSplat;
    /**
     * Instantiates an entity with a {@link GSplatComponent}.
     *
     * @param {SplatMaterialOptions} [options] - The options.
     * @returns {Entity} The entity with {@link GSplatComponent}.
     */
    instantiate(options?: SplatMaterialOptions): Entity;
    createInstance(options?: {}): GSplatInstance;
}
import type { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import type { GSplatData } from '../../scene/gsplat/gsplat-data.js';
import { GSplat } from '../../scene/gsplat/gsplat.js';
import { GSplatCompressed } from '../../scene/gsplat/gsplat-compressed.js';
import type { SplatMaterialOptions } from '../../scene/gsplat/gsplat-material.js';
import { Entity } from '../entity.js';
import { GSplatInstance } from '../../scene/gsplat/gsplat-instance.js';
