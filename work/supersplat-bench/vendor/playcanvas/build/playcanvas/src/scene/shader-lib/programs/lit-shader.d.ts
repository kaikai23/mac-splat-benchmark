export class LitShader {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {LitShaderOptions} options - The lit options.
     */
    constructor(device: GraphicsDevice, options: LitShaderOptions);
    device: GraphicsDevice;
    options: LitShaderOptions;
    attributes: {
        vertex_position: string;
    };
    chunks: any;
    shaderPassInfo: import("../../shader-pass.js").ShaderPassInfo;
    shadowPass: any;
    lighting: boolean;
    reflections: boolean;
    needsNormal: boolean;
    needsSceneColor: boolean;
    needsScreenSize: boolean;
    needsTransforms: boolean;
    varyings: string;
    varyingDefines: string;
    vshader: string;
    frontendDecl: string;
    frontendCode: string;
    frontendFunc: string;
    lightingUv: string;
    defines: any[];
    fshader: string;
    _vsAddBaseCode(code: any, chunks: any, options: any): any;
    _setMapTransform(codes: any, name: any, id: any, uv: any): any;
    _fsGetBaseCode(): any;
    _fsGetStartCode(code: any, device: any, chunks: any, options: any): any;
    _getLightSourceShapeString(shape: any): "" | "Rect" | "Disk" | "Sphere";
    generateVertexShader(useUv: any, useUnmodifiedUv: any, mapTransforms: any): void;
    _fsGetBeginCode(): string;
    _fsGetPickPassCode(): string;
    _fsGetDepthPassCode(): string;
    _fsGetPrePassCode(): string;
    _fsGetShadowPassCode(): string;
    _fsGetLitPassCode(): string;
    /**
     * Generates a fragment shader.
     *
     * @param {string} frontendDecl - Frontend declarations like `float dAlpha;`
     * @param {string} frontendCode - Frontend code containing `getOpacity()` etc.
     * @param {string} frontendFunc - E.g. `evaluateFrontend();`
     * @param {string} lightingUv - E.g. `vUv0`
     */
    generateFragmentShader(frontendDecl: string, frontendCode: string, frontendFunc: string, lightingUv: string): void;
}
import type { GraphicsDevice } from '../../../platform/graphics/graphics-device.js';
import type { LitShaderOptions } from './lit-shader-options.js';
