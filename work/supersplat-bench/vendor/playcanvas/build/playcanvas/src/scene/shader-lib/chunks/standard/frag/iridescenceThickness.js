var iridescenceThicknessPS = "\nuniform float material_iridescenceThicknessMax;\n#ifdef MAPTEXTURE\nuniform float material_iridescenceThicknessMin;\n#endif\nvoid getIridescenceThickness() {\n	#ifdef MAPTEXTURE\n	float blend = texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	float iridescenceThickness = mix(material_iridescenceThicknessMin, material_iridescenceThicknessMax, blend);\n	#else\n	float iridescenceThickness = material_iridescenceThicknessMax;\n	#endif\n	dIridescenceThickness = iridescenceThickness; \n}\n";

export { iridescenceThicknessPS as default };
