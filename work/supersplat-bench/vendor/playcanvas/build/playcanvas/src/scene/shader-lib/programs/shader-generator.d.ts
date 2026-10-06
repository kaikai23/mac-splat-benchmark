export class ShaderGenerator {
    static begin(): string;
    static end(): string;
    /**
     * @param {Map<string, string>} defines - the set of defines to be used in the shader.
     * @returns {number} the hash code of the defines.
     */
    static definesHash(defines: Map<string, string>): number;
}
