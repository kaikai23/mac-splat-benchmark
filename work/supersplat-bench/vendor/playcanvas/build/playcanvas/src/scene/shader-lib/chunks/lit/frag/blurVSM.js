var blurVSMPS = "\nvarying vec2 vUv0;\nuniform sampler2D source;\nuniform vec2 pixelOffset;\n#ifdef GAUSS\nuniform float weight[SAMPLES];\n#endif\nvoid main(void) {\n	vec3 moments = vec3(0.0);\n	vec2 uv = vUv0 - pixelOffset * (float(SAMPLES) * 0.5);\n	for (int i=0; i<SAMPLES; i++) {\n		vec4 c = texture2D(source, uv + pixelOffset * float(i));\n		#ifdef GAUSS\n		moments += c.xyz * weight[i];\n		#else\n		moments += c.xyz;\n		#endif\n	}\n	#ifndef GAUSS\n	moments /= float(SAMPLES);\n	#endif\n	gl_FragColor = vec4(moments.x, moments.y, moments.z, 1.0);\n}\n";

export { blurVSMPS as default };
