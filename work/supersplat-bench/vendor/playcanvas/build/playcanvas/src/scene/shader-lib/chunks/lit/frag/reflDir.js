var reflDirPS = "\nvoid getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {\n	dReflDirW = normalize(-reflect(viewDir, worldNormal));\n}\n";

export { reflDirPS as default };
