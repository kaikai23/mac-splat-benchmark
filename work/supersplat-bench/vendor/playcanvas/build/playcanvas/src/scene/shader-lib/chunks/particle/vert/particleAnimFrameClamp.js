var particleAnimFrameClampVS = "\n	float animFrame = min(floor(texCoordsAlphaLife.w * animTexParams.y) + animTexParams.x, animTexParams.z);\n";

export { particleAnimFrameClampVS as default };
