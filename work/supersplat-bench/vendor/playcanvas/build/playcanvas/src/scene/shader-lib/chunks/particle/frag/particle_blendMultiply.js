var particle_blendMultiplyPS = "\n	rgb = mix(vec3(1.0), rgb, vec3(a));\n	if (rgb.r + rgb.g + rgb.b > 2.99) discard;\n";

export { particle_blendMultiplyPS as default };
