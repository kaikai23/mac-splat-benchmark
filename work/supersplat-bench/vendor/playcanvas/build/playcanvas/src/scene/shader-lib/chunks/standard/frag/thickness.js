var thicknessPS = "\n#ifdef MAPFLOAT\nuniform float material_thickness;\n#endif\nvoid getThickness() {\n	dThickness = 1.0;\n	#ifdef MAPFLOAT\n	dThickness *= material_thickness;\n	#endif\n	#ifdef MAPTEXTURE\n	dThickness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	dThickness *= saturate(vVertexColor.$VC);\n	#endif\n}\n";

export { thicknessPS as default };
