var diffusePS = "\nuniform vec3 material_diffuse;\nvoid getAlbedo() {\n	dAlbedo = material_diffuse.rgb;\n#ifdef MAPTEXTURE\n	vec3 albedoBase = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n	dAlbedo *= addAlbedoDetail(albedoBase);\n#endif\n#ifdef MAPVERTEX\n	dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));\n#endif\n}\n";

export { diffusePS as default };
