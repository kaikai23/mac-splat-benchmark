/**
 * @import { Entity } from '../../../framework/entity'
 */
export class ScrollbarComponentData {
    enabled: boolean;
    orientation: number;
    value: number;
    /** @type {number} */
    handleSize: number;
    /** @type {Entity} */
    handleEntity: Entity;
}
import type { Entity } from '../../../framework/entity';
