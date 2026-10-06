var normalMapPS = "\n#ifdef MAPTEXTURE\nuniform float material_bumpiness;\n#endif\nvoid getNormal() {\n#ifdef MAPTEXTURE\n	vec3 normalMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));\n	normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);\n	dNormalW = normalize(dTBN * addNormalDetail(normalMap));\n#else\n	dNormalW = dVertexNormalW;\n#endif\n}\n";

export { normalMapPS as default };
