var reflectionCCPS = "\n#ifdef LIT_CLEARCOAT\nvoid addReflectionCC(vec3 reflDir, float gloss) {\n	ccReflection += calcReflection(reflDir, gloss);\n}\n#endif\n";

export { reflectionCCPS as default };
