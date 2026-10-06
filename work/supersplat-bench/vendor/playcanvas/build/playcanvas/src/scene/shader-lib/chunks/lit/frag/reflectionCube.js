var reflectionCubePS = "\nuniform samplerCube texture_cubeMap;\nuniform float material_reflectivity;\nvec3 calcReflection(vec3 reflDir, float gloss) {\n	vec3 lookupVec = cubeMapProject(reflDir);\n	lookupVec.x *= -1.0;\n	return $DECODE(textureCube(texture_cubeMap, lookupVec));\n}\nvoid addReflection(vec3 reflDir, float gloss) {   \n	dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);\n}\n";

export { reflectionCubePS as default };
