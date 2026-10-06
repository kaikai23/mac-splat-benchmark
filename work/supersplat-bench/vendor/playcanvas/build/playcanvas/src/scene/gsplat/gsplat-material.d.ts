/**
 * - The options.
 */
export type SplatMaterialOptions = {
    /**
     * - Custom vertex shader, see SPLAT MANY example.
     */
    vertex?: string;
    /**
     * - Custom fragment shader, see SPLAT MANY example.
     */
    fragment?: string;
    /**
     * - List of shader defines.
     */
    defines?: string[];
    /**
     * - Custom shader chunks.
     */
    chunks?: {
        [x: string]: string;
    };
    /**
     * - Opacity dithering enum.
     */
    dither?: string;
};
/**
 * @typedef {object} SplatMaterialOptions - The options.
 * @property {string} [vertex] - Custom vertex shader, see SPLAT MANY example.
 * @property {string} [fragment] - Custom fragment shader, see SPLAT MANY example.
 * @property {string[]} [defines] - List of shader defines.
 * @property {Object<string, string>} [chunks] - Custom shader chunks.
 * @property {string} [dither] - Opacity dithering enum.
 *
 * @ignore
 */
/**
 * @param {SplatMaterialOptions} [options] - The options.
 * @returns {ShaderMaterial} The GS material.
 */
export function createGSplatMaterial(options?: SplatMaterialOptions): ShaderMaterial;
import { ShaderMaterial } from '../materials/shader-material.js';
