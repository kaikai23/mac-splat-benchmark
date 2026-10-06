var particle_customFaceVS = "\n	quadXY = rotate(quadXY, inAngle, rotMatrix);\n	vec3 localPos = customFace(particlePos, quadXY);\n";

export { particle_customFaceVS as default };
