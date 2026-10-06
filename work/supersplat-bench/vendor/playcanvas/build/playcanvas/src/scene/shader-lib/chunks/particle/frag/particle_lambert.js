var particle_lambertPS = "\n	vec3 negNormal = max(normal, vec3(0.0));\n	vec3 posNormal = max(-normal, vec3(0.0));\n";

export { particle_lambertPS as default };
