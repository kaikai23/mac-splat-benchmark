var gsplatColorVS = "\nuniform mediump sampler2D splatColor;\nvec4 readColor(in SplatSource source) {\n	return texelFetch(splatColor, source.uv, 0);\n}\n";

export { gsplatColorVS as default };
