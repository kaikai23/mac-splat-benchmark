var lightDiffuseLambertPS = "\nfloat getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {\n	return max(dot(worldNormal, -lightDirNorm), 0.0);\n}\n";

export { lightDiffuseLambertPS as default };
