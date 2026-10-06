var opacityPS = "\nuniform float material_opacity;\nvoid getOpacity() {\n	dAlpha = material_opacity;\n	#ifdef MAPTEXTURE\n	dAlpha *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	#endif\n	#ifdef MAPVERTEX\n	dAlpha *= clamp(vVertexColor.$VC, 0.0, 1.0);\n	#endif\n}\n";

export { opacityPS as default };
