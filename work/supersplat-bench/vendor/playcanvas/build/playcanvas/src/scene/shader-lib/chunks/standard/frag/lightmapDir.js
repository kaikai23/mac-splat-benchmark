var lightmapDirPS = "\nuniform sampler2D texture_lightMap;\nuniform sampler2D texture_dirLightMap;\nvoid getLightMap() {\n	dLightmap = $DECODE(texture2DBias(texture_lightMap, $UV, textureBias)).$CH;\n	vec3 dir = texture2DBias(texture_dirLightMap, $UV, textureBias).xyz * 2.0 - 1.0;\n	float dirDot = dot(dir, dir);\n	dLightmapDir = (dirDot > 0.001) ? dir / sqrt(dirDot) : vec3(0.0);\n}\n";

export { lightmapDirPS as default };
