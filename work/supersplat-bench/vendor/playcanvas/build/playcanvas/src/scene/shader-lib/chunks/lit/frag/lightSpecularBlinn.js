var lightSpecularBlinnPS = "\nfloat calcLightSpecular(float gloss, vec3 worldNormal, vec3 h) {\n	float nh = max( dot( h, worldNormal ), 0.0 );\n	float specPow = exp2(gloss * 11.0);\n	specPow = max(specPow, 0.0001);\n	return pow(nh, specPow) * (specPow + 2.0) / 8.0;\n}\nfloat getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {\n	return calcLightSpecular(gloss, worldNormal, h);\n}\n";

export { lightSpecularBlinnPS as default };
