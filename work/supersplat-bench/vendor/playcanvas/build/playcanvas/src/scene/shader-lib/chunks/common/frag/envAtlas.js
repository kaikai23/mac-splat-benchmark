var envAtlasPS = "\nconst float atlasSize = 512.0;\nconst float seamSize = 1.0 / atlasSize;\nvec2 mapUv(vec2 uv, vec4 rect) {\n	return vec2(mix(rect.x + seamSize, rect.x + rect.z - seamSize, uv.x),\n				mix(rect.y + seamSize, rect.y + rect.w - seamSize, uv.y));\n}\nvec2 mapRoughnessUv(vec2 uv, float level) {\n	float t = 1.0 / exp2(level);\n	return mapUv(uv, vec4(0, 1.0 - t, t, t * 0.5));\n}\nvec2 mapShinyUv(vec2 uv, float level) {\n	float t = 1.0 / exp2(level);\n	return mapUv(uv, vec4(1.0 - t, 1.0 - t, t, t * 0.5));\n}\n";

export { envAtlasPS as default };
