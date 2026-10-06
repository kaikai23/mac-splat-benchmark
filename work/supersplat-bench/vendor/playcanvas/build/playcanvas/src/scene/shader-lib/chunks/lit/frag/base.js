var basePS = "\nuniform vec3 view_position;\nuniform vec3 light_globalAmbient;\nfloat square(float x) {\n	return x*x;\n}\nfloat saturate(float x) {\n	return clamp(x, 0.0, 1.0);\n}\nvec3 saturate(vec3 x) {\n	return clamp(x, vec3(0.0), vec3(1.0));\n}\n";

export { basePS as default };
