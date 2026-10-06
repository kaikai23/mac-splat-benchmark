var iorPS = "\n#ifdef MAPFLOAT\nuniform float material_refractionIndex;\n#endif\nvoid getIor() {\n#ifdef MAPFLOAT\n	dIor = material_refractionIndex;\n#else\n	dIor = 1.0 / 1.5;\n#endif\n}\n";

export { iorPS as default };
