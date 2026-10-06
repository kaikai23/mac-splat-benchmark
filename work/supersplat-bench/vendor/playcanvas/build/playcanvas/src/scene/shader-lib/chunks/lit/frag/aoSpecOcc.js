var aoSpecOccPS = "\nuniform float material_occludeSpecularIntensity;\nvoid occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {\n	float specPow = exp2(gloss * 11.0);\n	float specOcc = saturate(pow(dot(worldNormal, viewDir) + ao, 0.01*specPow) - 1.0 + ao);\n	specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);\n	dSpecularLight *= specOcc;\n	dReflection *= specOcc;\n	\n#ifdef LIT_SHEEN\n	sSpecularLight *= specOcc;\n	sReflection *= specOcc;\n#endif\n}\n";

export { aoSpecOccPS as default };
