var tonemappingLinearPS = "\nuniform float exposure;\nvec3 toneMap(vec3 color) {\n	return color * exposure;\n}\n";

export { tonemappingLinearPS as default };
