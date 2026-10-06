/**
 * @import { BoundingBox } from '../../../core/shape/bounding-box.js'
 * @import { Entity } from '../../entity.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { GSplatComponentSystem } from './system.js'
 * @import { GSplatInstance } from '../../../scene/gsplat/gsplat-instance.js'
 * @import { Material } from '../../../scene/materials/material.js'
 * @import { SplatMaterialOptions } from '../../../scene/gsplat/gsplat-material.js'
 */
/**
 * The GSplatComponent enables an {@link Entity} to render 3D Gaussian Splats. Splats are always
 * loaded from {@link Asset}s rather than being created programmatically. The asset type is
 * `gsplat` which are in the `.ply` file format.
 *
 * Relevant examples:
 *
 * - [Loading a Splat](https://playcanvas.github.io/#/loaders/gsplat)
 * - [Custom Splat Shaders](https://playcanvas.github.io/#/loaders/gsplat-many)
 *
 * @hideconstructor
 * @category Graphics
 */
export class GSplatComponent extends Component {
    /**
     * Create a new GSplatComponent.
     *
     * @param {GSplatComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system: GSplatComponentSystem, entity: Entity);
    /** @private */
    private _layers;
    /**
     * @type {GSplatInstance|null}
     * @private
     */
    private _instance;
    /**
     * @type {BoundingBox|null}
     * @private
     */
    private _customAabb;
    /**
     * @type {AssetReference}
     * @private
     */
    private _assetReference;
    /**
     * @type {SplatMaterialOptions|null}
     * @private
     */
    private _materialOptions;
    /**
     * @type {EventHandle|null}
     * @private
     */
    private _evtLayersChanged;
    /**
     * @type {EventHandle|null}
     * @private
     */
    private _evtLayerAdded;
    /**
     * @type {EventHandle|null}
     * @private
     */
    private _evtLayerRemoved;
    /**
     * Sets a custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {BoundingBox|null}
     */
    set customAabb(value: BoundingBox | null);
    /**
     * Gets the custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {BoundingBox|null}
     */
    get customAabb(): BoundingBox | null;
    /**
     * Sets a {@link GSplatInstance} on the component. If not set or loaded, it returns null.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    set instance(value: GSplatInstance | null);
    /**
     * Gets the {@link GSplatInstance} on the component.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    get instance(): GSplatInstance | null;
    set materialOptions(value: SplatMaterialOptions);
    get materialOptions(): SplatMaterialOptions;
    /**
     * Gets the material used to render the gsplat.
     *
     * @type {Material|undefined}
     */
    get material(): Material | undefined;
    /**
     * Sets an array of layer IDs ({@link Layer#id}) to which this gsplat should belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value: number[]);
    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this gsplat belongs.
     *
     * @type {number[]}
     */
    get layers(): number[];
    /**
     * Sets the gsplat asset for this gsplat component. Can also be an asset id.
     *
     * @type {Asset|number}
     */
    set asset(value: Asset | number);
    /**
     * Gets the gsplat asset id for this gsplat component.
     *
     * @type {Asset|number}
     */
    get asset(): Asset | number;
    /**
     * Assign asset id to the component, without updating the component with the new asset.
     * This can be used to assign the asset id to already fully created component.
     *
     * @param {Asset|number} asset - The gsplat asset or asset id to assign.
     * @ignore
     */
    assignAsset(asset: Asset | number): void;
    /** @private */
    private destroyInstance;
    /** @private */
    private addToLayers;
    removeFromLayers(): void;
    /** @private */
    private onRemoveChild;
    /** @private */
    private onInsertChild;
    onRemove(): void;
    onLayersChanged(oldComp: any, newComp: any): void;
    onLayerAdded(layer: any): void;
    onLayerRemoved(layer: any): void;
    /**
     * Stop rendering this component without removing its mesh instance from the scene hierarchy.
     */
    hide(): void;
    /**
     * Enable rendering of the component if hidden using {@link GSplatComponent#hide}.
     */
    show(): void;
    _onGSplatAssetAdded(): void;
    _onGSplatAssetLoad(): void;
    _onGSplatAssetUnload(): void;
    _onGSplatAssetRemove(): void;
}
import { Component } from '../component.js';
import type { BoundingBox } from '../../../core/shape/bounding-box.js';
import type { GSplatInstance } from '../../../scene/gsplat/gsplat-instance.js';
import type { SplatMaterialOptions } from '../../../scene/gsplat/gsplat-material.js';
import type { Material } from '../../../scene/materials/material.js';
import { Asset } from '../../asset/asset.js';
import type { GSplatComponentSystem } from './system.js';
import type { Entity } from '../../entity.js';
