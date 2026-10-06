var emissivePS = "\nuniform vec3 material_emissive;\nuniform float material_emissiveIntensity;\nvoid getEmission() {\n	dEmission = material_emissive * material_emissiveIntensity;\n	#ifdef MAPTEXTURE\n	dEmission *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	dEmission *= gammaCorrectInput(saturate(vVertexColor.$VC));\n	#endif\n}\n";

export { emissivePS as default };
