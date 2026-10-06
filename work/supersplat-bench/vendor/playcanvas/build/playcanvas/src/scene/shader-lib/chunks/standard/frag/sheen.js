var sheenPS = "\nuniform vec3 material_sheen;\nvoid getSheen() {\n	vec3 sheenColor = material_sheen;\n	#ifdef MAPTEXTURE\n	sheenColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	sheenColor *= saturate(vVertexColor.$VC);\n	#endif\n	sSpecularity = sheenColor;\n}\n";

export { sheenPS as default };
