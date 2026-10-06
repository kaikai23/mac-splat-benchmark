var fullscreenQuadVS = "\nattribute vec2 vertex_position;\nvarying vec2 vUv0;\nvoid main(void)\n{\n	gl_Position = vec4(vertex_position, 0.5, 1.0);\n	vUv0 = vertex_position.xy*0.5+0.5;\n}\n";

export { fullscreenQuadVS as default };
