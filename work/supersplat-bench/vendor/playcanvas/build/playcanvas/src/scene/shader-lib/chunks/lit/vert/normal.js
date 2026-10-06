var normalVS = "\nmat3 dNormalMatrix;\nvec3 getNormal() {\n	dNormalMatrix = getNormalMatrix(dModelMatrix);\n	vec3 localNormal = getLocalNormal(vertex_normal);\n	return normalize(dNormalMatrix * localNormal);\n}\n";

export { normalVS as default };
