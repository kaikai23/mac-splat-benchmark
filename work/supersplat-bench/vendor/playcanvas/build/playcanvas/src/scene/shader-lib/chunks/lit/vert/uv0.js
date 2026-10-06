var uv0VS = "\n#ifdef NINESLICED\nvec2 getUv0() {\n	vec2 uv = vertex_position.xz;\n	vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));\n	vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));\n	uv += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;\n	uv = uv * -0.5 + 0.5;\n	uv = uv * atlasRect.zw + atlasRect.xy;\n	vMask = vertex_texCoord0.xy;\n	return uv;\n}\n#else\nvec2 getUv0() {\n	return vertex_texCoord0;\n}\n#endif\n";

export { uv0VS as default };
