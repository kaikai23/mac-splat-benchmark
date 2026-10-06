var specularityFactorPS = "\n#ifdef MAPFLOAT\nuniform float material_specularityFactor;\n#endif\nvoid getSpecularityFactor() {\n	float specularityFactor = 1.0;\n	#ifdef MAPFLOAT\n	specularityFactor *= material_specularityFactor;\n	#endif\n	#ifdef MAPTEXTURE\n	specularityFactor *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	specularityFactor *= saturate(vVertexColor.$VC);\n	#endif\n	dSpecularityFactor = specularityFactor;\n}\n";

export { specularityFactorPS as default };
