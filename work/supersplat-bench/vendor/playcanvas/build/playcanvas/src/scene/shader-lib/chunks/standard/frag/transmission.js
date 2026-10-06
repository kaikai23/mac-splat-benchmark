var transmissionPS = "\n#ifdef MAPFLOAT\nuniform float material_refraction;\n#endif\nvoid getRefraction() {\n	float refraction = 1.0;\n	#ifdef MAPFLOAT\n	refraction = material_refraction;\n	#endif\n	#ifdef MAPTEXTURE\n	refraction *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	refraction *= saturate(vVertexColor.$VC);\n	#endif\n	dTransmission = refraction;\n}\n";

export { transmissionPS as default };
