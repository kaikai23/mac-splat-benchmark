/** @ignore */
export class GSplatInstance {
    /**
     * @param {GSplat} splat - The splat instance.
     * @param {SplatMaterialOptions} options - The options.
     */
    constructor(splat: GSplat, options: SplatMaterialOptions);
    /** @type {GSplat} */
    splat: GSplat;
    /** @type {Mesh} */
    mesh: Mesh;
    /** @type {MeshInstance} */
    meshInstance: MeshInstance;
    /** @type {Material} */
    material: Material;
    /** @type {Texture} */
    orderTexture: Texture;
    options: {};
    /** @type {GSplatSorter | null} */
    sorter: GSplatSorter | null;
    lastCameraPosition: Vec3;
    lastCameraDirection: Vec3;
    /**
     * List of cameras this instance is visible for. Updated every frame by the renderer.
     *
     * @type {Camera[]}
     * @ignore
     */
    cameras: Camera[];
    centers: Float32Array<ArrayBuffer>;
    destroy(): void;
    clone(): GSplatInstance;
    createMaterial(options: any): void;
    updateViewport(): void;
    /**
     * Sorts the GS vertices based on the given camera.
     * @param {GraphNode} cameraNode - The camera node used for sorting.
     */
    sort(cameraNode: GraphNode): void;
    update(): void;
}
import type { GSplat } from './gsplat.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import type { Material } from '../materials/material.js';
import type { Texture } from '../../platform/graphics/texture.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { Vec3 } from '../../core/math/vec3.js';
import type { Camera } from '../camera.js';
import type { GraphNode } from '../graph-node.js';
import type { SplatMaterialOptions } from './gsplat-material.js';
