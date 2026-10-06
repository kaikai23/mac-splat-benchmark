/**
 * A lighting cube represented by 6 colors, one per cube direction. Use for simple lighting on the
 * particle system.
 */
export class LightCube {
    colors: Float32Array<ArrayBuffer>;
    update(ambientLight: any, lights: any): void;
}
