var metalnessPS = "\n#ifdef MAPFLOAT\nuniform float material_metalness;\n#endif\nvoid getMetalness() {\n	float metalness = 1.0;\n	#ifdef MAPFLOAT\n	metalness *= material_metalness;\n	#endif\n	#ifdef MAPTEXTURE\n	metalness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	metalness *= saturate(vVertexColor.$VC);\n	#endif\n	dMetalness = metalness;\n}\n";

export { metalnessPS as default };
