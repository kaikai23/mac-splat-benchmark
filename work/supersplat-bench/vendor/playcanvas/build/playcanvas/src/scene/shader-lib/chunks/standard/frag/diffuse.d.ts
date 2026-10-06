declare const _default: "\nuniform vec3 material_diffuse;\n\nvoid getAlbedo() {\n    dAlbedo = material_diffuse.rgb;\n\n#ifdef MAPTEXTURE\n    vec3 albedoBase = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n    dAlbedo *= addAlbedoDetail(albedoBase);\n#endif\n\n#ifdef MAPVERTEX\n    dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));\n#endif\n}\n";
export default _default;
