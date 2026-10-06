var particle_meshVS = "\n	vec3 localPos = meshLocalPos;\n	localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);\n	localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);\n	billboard(particlePos, quadXY);\n";

export { particle_meshVS as default };
