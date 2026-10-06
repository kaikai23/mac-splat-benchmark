var clearCoatGlossPS = "\n#ifdef MAPFLOAT\nuniform float material_clearCoatGloss;\n#endif\nvoid getClearCoatGlossiness() {\n	ccGlossiness = 1.0;\n	#ifdef MAPFLOAT\n	ccGlossiness *= material_clearCoatGloss;\n	#endif\n	#ifdef MAPTEXTURE\n	ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	ccGlossiness *= saturate(vVertexColor.$VC);\n	#endif\n	#ifdef MAPINVERT\n	ccGlossiness = 1.0 - ccGlossiness;\n	#endif\n	ccGlossiness += 0.0000001;\n}\n";

export { clearCoatGlossPS as default };
