var aoSpecOccConstSimplePS = "\nvoid occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {\n	dSpecularLight *= ao;\n	dReflection *= ao;\n#ifdef LIT_SHEEN\n	sSpecularLight *= ao;\n	sReflection *= ao;\n#endif\n}\n";

export { aoSpecOccConstSimplePS as default };
