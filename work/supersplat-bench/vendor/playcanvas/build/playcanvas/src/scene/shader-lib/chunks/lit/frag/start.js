var startPS = "\nvoid main(void) {\n	dReflection = vec4(0);\n	#ifdef LIT_CLEARCOAT\n	ccSpecularLight = vec3(0);\n	ccReflection = vec3(0);\n	#endif\n";

export { startPS as default };
