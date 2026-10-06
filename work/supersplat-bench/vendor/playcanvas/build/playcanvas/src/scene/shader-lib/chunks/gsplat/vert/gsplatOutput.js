var gsplatOutputVS = '\n#include "tonemappingPS"\n#include "decodePS"\n#include "gammaPS"\nvec3 prepareOutputFromGamma(vec3 gammaColor) {\n	#if TONEMAP == NONE\n		#if GAMMA == NONE\n			return decodeGamma(gammaColor);\n		#else\n			return gammaColor;\n		#endif\n	#else\n		return gammaCorrectOutput(toneMap(decodeGamma(gammaColor)));\n	#endif\n}\n';

export { gsplatOutputVS as default };
