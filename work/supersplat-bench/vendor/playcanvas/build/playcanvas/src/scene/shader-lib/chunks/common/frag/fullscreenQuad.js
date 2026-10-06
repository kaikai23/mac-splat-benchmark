var fullscreenQuadPS = "\nvarying vec2 vUv0;\nuniform sampler2D source;\nvoid main(void) {\n	gl_FragColor = texture2D(source, vUv0);\n}\n";

export { fullscreenQuadPS as default };
