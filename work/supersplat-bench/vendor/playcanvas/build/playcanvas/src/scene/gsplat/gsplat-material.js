import { SEMANTIC_POSITION, SEMANTIC_ATTR13, CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DITHER_NONE, BLEND_NONE, BLEND_PREMULTIPLIED } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';

var createGSplatMaterial = (options)=>{
		if (options === undefined) options = {};
		var _options_dither;
		var ditherEnum = (_options_dither = options.dither) != null ? _options_dither : DITHER_NONE;
		var dither = ditherEnum !== DITHER_NONE;
		var _options_vertex, _options_fragment;
		var material = new ShaderMaterial({
				uniqueName: 'SplatMaterial',
				vertexCode: (_options_vertex = options.vertex) != null ? _options_vertex : shaderChunks.gsplatVS,
				fragmentCode: (_options_fragment = options.fragment) != null ? _options_fragment : shaderChunks.gsplatPS,
				attributes: {
						vertex_position: SEMANTIC_POSITION,
						vertex_id_attrib: SEMANTIC_ATTR13
				}
		});
		material.setDefine("DITHER_" + ditherEnum.toUpperCase(), '');
		material.cull = CULLFACE_NONE;
		material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
		material.depthWrite = dither;
		material.update();
		return material;
};

export { createGSplatMaterial };
