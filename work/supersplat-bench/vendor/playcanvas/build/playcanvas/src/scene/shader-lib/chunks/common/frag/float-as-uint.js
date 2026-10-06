var floatAsUintPS = "\n#ifndef FLOAT_AS_UINT\n#define FLOAT_AS_UINT\nvec4 float2uint(float value) {\n	uint intBits = floatBitsToUint(value);\n	return vec4(\n		float((intBits >> 24u) & 0xFFu) / 255.0,\n		float((intBits >> 16u) & 0xFFu) / 255.0,\n		float((intBits >> 8u) & 0xFFu) / 255.0,\n		float(intBits & 0xFFu) / 255.0\n	);\n}\nfloat uint2float(vec4 value) {\n	uint intBits = \n		(uint(value.r * 255.0) << 24u) |\n		(uint(value.g * 255.0) << 16u) |\n		(uint(value.b * 255.0) << 8u) |\n		uint(value.a * 255.0);\n	return uintBitsToFloat(intBits);\n}\n#endif\n";

export { floatAsUintPS as default };
