var sharedFS = "\nvec2 getGrabScreenPos(vec4 clipPos) {\n	vec2 uv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;\n	#ifdef WEBGPU\n		uv.y = 1.0 - uv.y;\n	#endif\n	return uv;\n}\nvec2 getImageEffectUV(vec2 uv) {\n	#ifdef WEBGPU\n		uv.y = 1.0 - uv.y;\n	#endif\n	return uv;\n}\n";

export { sharedFS as default };
