var particleAnimFrameLoopVS = "\n	float animFrame = floor(mod(texCoordsAlphaLife.w * animTexParams.y + animTexParams.x, animTexParams.z + 1.0));\n";

export { particleAnimFrameLoopVS as default };
