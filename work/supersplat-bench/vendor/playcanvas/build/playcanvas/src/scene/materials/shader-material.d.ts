/**
 * - The description of the shader used by the {@link ShaderMaterial}.
 */
export type ShaderDesc = {
    /**
     * - Unique name for the shader. If a shader with this name already
     * exists, it will be returned instead of a new shader instance.
     */
    uniqueName: string;
    /**
     * - The language used by the shader source. Can be:
     *
     * - {@link SHADERLANGUAGE_GLSL}
     * - {@link SHADERLANGUAGE_WGSL}
     *
     * Defaults to {@link SHADERLANGUAGE_GLSL}.
     */
    shaderLanguage?: string;
    /**
     * - The vertex shader code.
     */
    vertexCode?: string;
    /**
     * - The fragment shader code.
     */
    fragmentCode?: string;
    /**
     * - Object detailing the mapping of vertex shader
     * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
     * inputs to the shader. Defaults to undefined, which generates the default attributes.
     */
    attributes?: {
        [x: string]: string;
    };
};
/**
 * @typedef {object} ShaderDesc - The description of the shader used by the {@link ShaderMaterial}.
 * @property {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @property {string} [shaderLanguage] - The language used by the shader source. Can be:
 *
 * - {@link SHADERLANGUAGE_GLSL}
 * - {@link SHADERLANGUAGE_WGSL}
 *
 * Defaults to {@link SHADERLANGUAGE_GLSL}.
 * @property {string} [vertexCode] - The vertex shader code.
 * @property {string} [fragmentCode] - The fragment shader code.
 * @property {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @param {string | string[]} [fragmentOutputTypes] - Fragment shader output types, which default to
 * vec4. Passing a string will set the output type for all color attachments. Passing an array will
 * set the output type for each color attachment. @see ShaderUtils.createDefinition
 */
/**
 * A ShaderMaterial is a type of material that utilizes a specified shader for rendering purposes.
 *
 * A simple example which creates a material with custom vertex and fragment shaders:
 *
 * ```javascript
 * const material = new pc.ShaderMaterial({
 *     uniqueName: 'MyShader',
 *     attributes: { aPosition: pc.SEMANTIC_POSITION },
 *     vertexCode: `
 *         attribute vec3 aPosition;
 *         uniform mat4 matrix_viewProjection;
 *         void main(void)
 *         {
 *             gl_Position = matrix_viewProjection * pos;
 *         }`,
 *     fragmentCode: `
 *         void main(void) {
 *             gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
 *         }`
 * });
 * ```
 *
 * @category Graphics
 */
export class ShaderMaterial extends Material {
    /**
     * Create a new ShaderMaterial instance.
     *
     * @param {ShaderDesc} [shaderDesc] - The description of the shader to be used by the material.
     */
    constructor(shaderDesc?: ShaderDesc);
    /**
     * @type {ShaderDesc|undefined}
     * @private
     */
    private _shaderDesc;
    /**
     * Sets the shader description.
     *
     * @type {ShaderDesc|undefined}
     */
    set shaderDesc(value: ShaderDesc | undefined);
    /**
     * Gets the shader description.
     *
     * @type {ShaderDesc|undefined}
     */
    get shaderDesc(): ShaderDesc | undefined;
    /**
     * Copy a `ShaderMaterial`.
     *
     * @param {ShaderMaterial} source - The material to copy from.
     * @returns {ShaderMaterial} The destination material.
     */
    copy(source: ShaderMaterial): ShaderMaterial;
    getShaderVariant(params: any): import("../../index.js").Shader;
}
import { Material } from './material.js';
