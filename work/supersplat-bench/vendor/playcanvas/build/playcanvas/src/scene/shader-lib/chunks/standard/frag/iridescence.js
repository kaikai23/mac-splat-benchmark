var iridescencePS = "\n#ifdef MAPFLOAT\nuniform float material_iridescence;\n#endif\nvoid getIridescence() {\n	float iridescence = 1.0;\n	#ifdef MAPFLOAT\n	iridescence *= material_iridescence;\n	#endif\n	#ifdef MAPTEXTURE\n	iridescence *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	dIridescence = iridescence; \n}\n";

export { iridescencePS as default };
