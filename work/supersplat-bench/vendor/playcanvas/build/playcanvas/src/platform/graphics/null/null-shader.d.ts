/**
 * A Null implementation of the Shader.
 */
export class NullShader {
    destroy(shader: any): void;
    loseContext(): void;
    restoreContext(device: any, shader: any): void;
}
