/**
 * Render pass implementation of the final post-processing composition.
 *
 * @category Graphics
 * @ignore
 */
export class RenderPassCompose extends RenderPassShaderQuad {
    constructor(graphicsDevice: any);
    sceneTexture: any;
    bloomIntensity: number;
    _bloomTexture: any;
    _cocTexture: any;
    blurTexture: any;
    blurTextureUpscale: boolean;
    _ssaoTexture: any;
    _toneMapping: number;
    _gradingEnabled: boolean;
    gradingSaturation: number;
    gradingContrast: number;
    gradingBrightness: number;
    gradingTint: Color;
    _shaderDirty: boolean;
    _vignetteEnabled: boolean;
    vignetteInner: number;
    vignetteOuter: number;
    vignetteCurvature: number;
    vignetteIntensity: number;
    _fringingEnabled: boolean;
    fringingIntensity: number;
    _taaEnabled: boolean;
    _sharpness: number;
    _gammaCorrection: number;
    _key: string;
    _debug: any;
    sceneTextureId: any;
    bloomTextureId: any;
    cocTextureId: any;
    ssaoTextureId: any;
    blurTextureId: any;
    bloomIntensityId: any;
    bcsId: any;
    tintId: any;
    vignetterParamsId: any;
    fringingIntensityId: any;
    sceneTextureInvResId: any;
    sceneTextureInvResValue: Float32Array<ArrayBuffer>;
    sharpnessId: any;
    set debug(value: any);
    get debug(): any;
    set bloomTexture(value: any);
    get bloomTexture(): any;
    set cocTexture(value: any);
    get cocTexture(): any;
    set ssaoTexture(value: any);
    get ssaoTexture(): any;
    set taaEnabled(value: boolean);
    get taaEnabled(): boolean;
    set gradingEnabled(value: boolean);
    get gradingEnabled(): boolean;
    set vignetteEnabled(value: boolean);
    get vignetteEnabled(): boolean;
    set fringingEnabled(value: boolean);
    get fringingEnabled(): boolean;
    set toneMapping(value: number);
    get toneMapping(): number;
    set sharpness(value: number);
    get sharpness(): number;
    get isSharpnessEnabled(): boolean;
}
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { Color } from '../../core/math/color.js';
