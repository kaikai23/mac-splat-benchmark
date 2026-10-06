var particle_endVS = "\n	localPos *= scale * emitterScale;\n	localPos += particlePos;\n	#ifdef SCREEN_SPACE\n	gl_Position = vec4(localPos.x, localPos.y, 0.0, 1.0);\n	#else\n	gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);\n	#endif\n";

export { particle_endVS as default };
