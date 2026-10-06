var linearizeDepthPS = "\n#ifndef LINEARIZE_DEPTH\n#define LINEARIZE_DEPTH\nfloat linearizeDepth(float z, vec4 cameraParams) {\n	if (cameraParams.w == 0.0)\n		return (cameraParams.z * cameraParams.y) / (cameraParams.y + z * (cameraParams.z - cameraParams.y));\n	else\n		return cameraParams.z + z * (cameraParams.y - cameraParams.z);\n}\n#ifndef CAMERAPLANES\n#define CAMERAPLANES\nuniform vec4 camera_params;\n#endif\nfloat linearizeDepth(float z) {\n	return linearizeDepth(z, camera_params);\n}\n#endif\n";

export { linearizeDepthPS as default };
