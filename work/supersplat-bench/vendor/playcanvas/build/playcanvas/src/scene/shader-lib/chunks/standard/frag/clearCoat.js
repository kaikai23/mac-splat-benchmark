var clearCoatPS = "\n#ifdef MAPFLOAT\nuniform float material_clearCoat;\n#endif\nvoid getClearCoat() {\n	ccSpecularity = 1.0;\n	#ifdef MAPFLOAT\n	ccSpecularity *= material_clearCoat;\n	#endif\n	#ifdef MAPTEXTURE\n	ccSpecularity *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	ccSpecularity *= saturate(vVertexColor.$VC);\n	#endif\n}\n";

export { clearCoatPS as default };
