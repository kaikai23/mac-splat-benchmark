var glossPS = "\n#ifdef MAPFLOAT\nuniform float material_gloss;\n#endif\nvoid getGlossiness() {\n	dGlossiness = 1.0;\n	#ifdef MAPFLOAT\n	dGlossiness *= material_gloss;\n	#endif\n	#ifdef MAPTEXTURE\n	dGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	dGlossiness *= saturate(vVertexColor.$VC);\n	#endif\n	#ifdef MAPINVERT\n	dGlossiness = 1.0 - dGlossiness;\n	#endif\n	dGlossiness += 0.0000001;\n}\n";

export { glossPS as default };
