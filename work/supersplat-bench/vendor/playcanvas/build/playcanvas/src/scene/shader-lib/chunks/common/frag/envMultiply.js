var envMultiplyPS = "\nuniform float skyboxIntensity;\nvec3 processEnvironment(vec3 color) {\n	return color * skyboxIntensity;\n}\n";

export { envMultiplyPS as default };
