var cubeMapRotatePS = "\n#ifdef CUBEMAP_ROTATION\nuniform mat3 cubeMapRotationMatrix;\n#endif\nvec3 cubeMapRotate(vec3 refDir) {\n#ifdef CUBEMAP_ROTATION\n	return refDir * cubeMapRotationMatrix;\n#else\n	return refDir;\n#endif\n}\n";

export { cubeMapRotatePS as default };
