var sheenGlossPS = "\nuniform float material_sheenGloss;\nvoid getSheenGlossiness() {\n	float sheenGlossiness = material_sheenGloss;\n	#ifdef MAPTEXTURE\n	sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	sheenGlossiness *= saturate(vVertexColor.$VC);\n	#endif\n	#ifdef MAPINVERT\n	sheenGlossiness = 1.0 - sheenGlossiness;\n	#endif\n	sheenGlossiness += 0.0000001;\n	sGlossiness = sheenGlossiness;\n}\n";

export { sheenGlossPS as default };
