var particle_cpu_endVS = "\n	localPos *= particle_vertexData2.y * emitterScale;\n	localPos += particlePos;\n	gl_Position = matrix_viewProjection * vec4(localPos, 1.0);\n";

export { particle_cpu_endVS as default };
