var aoSpecOccSimplePS = "\nuniform float material_occludeSpecularIntensity;\nvoid occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {\n	float specOcc = mix(1.0, ao, material_occludeSpecularIntensity);\n	dSpecularLight *= specOcc;\n	dReflection *= specOcc;\n#ifdef LIT_SHEEN\n	sSpecularLight *= specOcc;\n	sReflection *= specOcc;\n#endif\n}\n";

export { aoSpecOccSimplePS as default };
