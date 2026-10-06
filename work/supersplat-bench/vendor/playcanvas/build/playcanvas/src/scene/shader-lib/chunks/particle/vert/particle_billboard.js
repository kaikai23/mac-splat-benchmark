var particle_billboardVS = "\n	quadXY = rotate(quadXY, inAngle, rotMatrix);\n	vec3 localPos = billboard(particlePos, quadXY);\n";

export { particle_billboardVS as default };
