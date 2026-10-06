var alphaTestPS = "\nuniform float alpha_ref;\nvoid alphaTest(float a) {\n	if (a < alpha_ref) discard;\n}\n";

export { alphaTestPS as default };
