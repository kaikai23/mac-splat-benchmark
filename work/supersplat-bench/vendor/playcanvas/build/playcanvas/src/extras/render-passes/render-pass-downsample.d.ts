/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */
/**
 * Render pass implementation of a down-sample filter.
 *
 * @category Graphics
 * @ignore
 */
export class RenderPassDownsample extends RenderPassShaderQuad {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture} sourceTexture - The source texture to downsample.
     * @param {object} [options] - The options for the render pass.
     * @param {boolean} [options.boxFilter] - Whether to use a box filter for downsampling.
     * @param {Texture|null} [options.premultiplyTexture] - The texture to premultiply the source texture
     * with. Only supported when boxFilter is true.
     * @param {string} [options.premultiplySrcChannel] - The source channel to premultiply.
     */
    constructor(device: GraphicsDevice, sourceTexture: Texture, options?: {
        boxFilter?: boolean;
        premultiplyTexture?: Texture | null;
        premultiplySrcChannel?: string;
    });
    sourceTexture: Texture;
    premultiplyTexture: Texture;
    sourceTextureId: import("../../index.js").ScopeId;
    premultiplyTextureId: import("../../index.js").ScopeId;
    sourceInvResolutionId: import("../../index.js").ScopeId;
    sourceInvResolutionValue: Float32Array<ArrayBuffer>;
    setSourceTexture(value: any): void;
    _sourceTexture: any;
}
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import type { Texture } from '../../platform/graphics/texture.js';
import type { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
