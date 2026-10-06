var parallaxPS = "\nuniform float material_heightMapFactor;\nvoid getParallax() {\n	float parallaxScale = material_heightMapFactor;\n	float height = texture2DBias($SAMPLER, $UV, textureBias).$CH;\n	height = height * parallaxScale - parallaxScale*0.5;\n	vec3 viewDirT = dViewDirW * dTBN;\n	viewDirT.z += 0.42;\n	dUvOffset = height * (viewDirT.xy / viewDirT.z);\n}\n";

export { parallaxPS as default };
