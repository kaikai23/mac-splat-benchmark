var specularPS = "\n#ifdef MAPCOLOR\nuniform vec3 material_specular;\n#endif\nvoid getSpecularity() {\n	vec3 specularColor = vec3(1,1,1);\n	#ifdef MAPCOLOR\n	specularColor *= material_specular;\n	#endif\n	#ifdef MAPTEXTURE\n	specularColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	specularColor *= saturate(vVertexColor.$VC);\n	#endif\n	dSpecularity = specularColor;\n}\n";

export { specularPS as default };
