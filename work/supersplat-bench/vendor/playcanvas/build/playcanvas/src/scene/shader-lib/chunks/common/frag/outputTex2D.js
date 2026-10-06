var outputTex2DPS = "\nvarying vec2 vUv0;\nuniform sampler2D source;\nvoid main(void) {\n	gl_FragColor = texture2D(source, vUv0);\n}\n";

export { outputTex2DPS as default };
