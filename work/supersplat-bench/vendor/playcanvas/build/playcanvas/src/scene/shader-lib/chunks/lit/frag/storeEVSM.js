var storeEVSMPS = "\nfloat exponent = VSM_EXPONENT;\ndepth = 2.0 * depth - 1.0;\ndepth =  exp(exponent * depth);\ngl_FragColor = vec4(depth, depth*depth, 1.0, 1.0);\n";

export { storeEVSMPS as default };
