var ambientConstantPS = "\nvoid addAmbient(vec3 worldNormal) {\n	dDiffuseLight += light_globalAmbient;\n}\n";

export { ambientConstantPS as default };
