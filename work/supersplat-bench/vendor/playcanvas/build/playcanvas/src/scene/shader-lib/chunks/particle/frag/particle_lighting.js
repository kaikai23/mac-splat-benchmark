var particle_lightingPS = "\n	vec3 light = negNormal.x*lightCube[0] + posNormal.x*lightCube[1] +\n						negNormal.y*lightCube[2] + posNormal.y*lightCube[3] +\n						negNormal.z*lightCube[4] + posNormal.z*lightCube[5];\n	rgb *= light;\n";

export { particle_lightingPS as default };
