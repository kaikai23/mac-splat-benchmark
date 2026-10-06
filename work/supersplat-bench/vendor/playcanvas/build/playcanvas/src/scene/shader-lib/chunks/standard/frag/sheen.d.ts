declare const _default: "\n\nuniform vec3 material_sheen;\n\nvoid getSheen() {\n    vec3 sheenColor = material_sheen;\n\n    #ifdef MAPTEXTURE\n    sheenColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n    #endif\n\n    #ifdef MAPVERTEX\n    sheenColor *= saturate(vVertexColor.$VC);\n    #endif\n\n    sSpecularity = sheenColor;\n}\n";
export default _default;
