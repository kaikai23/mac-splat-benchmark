var tangentBinormalVS = "\nvec3 getTangent() {\n	return normalize(dNormalMatrix * vertex_tangent.xyz);\n}\nvec3 getBinormal() {\n	return cross(vNormalW, vTangentW) * vertex_tangent.w;\n}\n";

export { tangentBinormalVS as default };
