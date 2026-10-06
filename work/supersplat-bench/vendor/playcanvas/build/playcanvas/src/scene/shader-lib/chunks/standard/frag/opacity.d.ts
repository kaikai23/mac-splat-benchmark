declare const _default: "\nuniform float material_opacity;\n\nvoid getOpacity() {\n    dAlpha = material_opacity;\n\n    #ifdef MAPTEXTURE\n    dAlpha *= texture2DBias($SAMPLER, $UV, textureBias).$CH;\n    #endif\n\n    #ifdef MAPVERTEX\n    dAlpha *= clamp(vVertexColor.$VC, 0.0, 1.0);\n    #endif\n}\n";
export default _default;
