function _extends() {
		_extends = Object.assign || function(target) {
				for(var i = 1; i < arguments.length; i++){
						var source = arguments[i];
						for(var key in source){
								if (Object.prototype.hasOwnProperty.call(source, key)) {
										target[key] = source[key];
								}
						}
				}
				return target;
		};
		return _extends.apply(this, arguments);
}
function _textureParameter(name, channel, vertexColor) {
		if (channel === undefined) channel = true;
		if (vertexColor === undefined) vertexColor = true;
		var result = {};
		result["" + name + "Map"] = 'texture';
		result["" + name + "MapTiling"] = 'vec2';
		result["" + name + "MapOffset"] = 'vec2';
		result["" + name + "MapRotation"] = 'number';
		result["" + name + "MapUv"] = 'number';
		if (channel) {
				result["" + name + "MapChannel"] = 'string';
				if (vertexColor) {
						result["" + name + "VertexColor"] = 'boolean';
						result["" + name + "VertexColorChannel"] = 'string';
				}
		}
		return result;
}
var standardMaterialParameterTypes = _extends({
		name: 'string',
		chunks: 'chunks',
		mappingFormat: 'string',
		_engine: 'boolean',
		ambient: 'rgb'
}, _textureParameter('ao'), _textureParameter('aoDetail', true, false), {
		aoDetailMode: 'string',
		diffuse: 'rgb'
}, _textureParameter('diffuse'), _textureParameter('diffuseDetail', true, false), {
		diffuseDetailMode: 'string',
		specular: 'rgb',
		specularTint: 'boolean'
}, _textureParameter('specular'), {
		occludeSpecular: 'enum:occludeSpecular',
		specularityFactor: 'number',
		specularityFactorTint: 'boolean'
}, _textureParameter('specularityFactor'), {
		useMetalness: 'boolean',
		metalness: 'number',
		enableGGXSpecular: 'boolean',
		anisotropy: 'number',
		metalnessTint: 'boolean'
}, _textureParameter('metalness'), {
		useMetalnessSpecularColor: 'boolean',
		shininess: 'number',
		gloss: 'number',
		glossInvert: 'boolean'
}, _textureParameter('gloss'), {
		clearCoat: 'number'
}, _textureParameter('clearCoat'), {
		clearCoatGloss: 'number',
		clearCoatGlossInvert: 'boolean'
}, _textureParameter('clearCoatGloss'), {
		clearCoatBumpiness: 'number'
}, _textureParameter('clearCoatNormal', false), {
		useSheen: 'boolean',
		sheen: 'rgb'
}, _textureParameter('sheen'), {
		sheenGloss: 'number',
		sheenGlossInvert: 'boolean'
}, _textureParameter('sheenGloss'), {
		fresnelModel: 'number',
		emissive: 'rgb'
}, _textureParameter('emissive'), {
		emissiveIntensity: 'number'
}, _textureParameter('normal', false), {
		bumpiness: 'number'
}, _textureParameter('normalDetail', false), {
		normalDetailMapBumpiness: 'number'
}, _textureParameter('height', true, false), {
		heightMapFactor: 'number',
		alphaToCoverage: 'boolean',
		alphaTest: 'number',
		alphaFade: 'number',
		opacity: 'number'
}, _textureParameter('opacity'), {
		opacityFadesSpecular: 'boolean',
		opacityDither: 'string',
		opacityShadowDither: 'string',
		reflectivity: 'number',
		refraction: 'number',
		refractionTint: 'boolean'
}, _textureParameter('refraction'), {
		refractionIndex: 'number',
		dispersion: 'number',
		thickness: 'number',
		thicknessTint: 'boolean'
}, _textureParameter('thickness'), {
		attenuation: 'rgb',
		attenuationDistance: 'number',
		useDynamicRefraction: 'boolean',
		sphereMap: 'texture',
		cubeMap: 'cubemap',
		cubeMapProjection: 'number',
		cubeMapProjectionBox: 'boundingbox',
		useIridescence: 'boolean',
		iridescence: 'number',
		iridescenceTint: 'boolean'
}, _textureParameter('iridescence'), {
		iridescenceThicknessTint: 'boolean',
		iridescenceThicknessMin: 'number',
		iridescenceThicknessMax: 'number',
		iridescenceRefractionIndex: 'number'
}, _textureParameter('iridescenceThickness'), _textureParameter('light'), {
		depthTest: 'boolean',
		depthFunc: 'enum:depthFunc',
		depthWrite: 'boolean',
		depthBias: 'number',
		slopeDepthBias: 'number',
		cull: 'enum:cull',
		blendType: 'enum:blendType',
		useFog: 'boolean',
		useLighting: 'boolean',
		useSkybox: 'boolean',
		useTonemap: 'boolean',
		envAtlas: 'texture',
		twoSidedLighting: 'boolean'
});
var standardMaterialTextureParameters = [];
for(var key in standardMaterialParameterTypes){
		var type = standardMaterialParameterTypes[key];
		if (type === 'texture') {
				standardMaterialTextureParameters.push(key);
		}
}
var standardMaterialCubemapParameters = [];
for(var key1 in standardMaterialParameterTypes){
		var type1 = standardMaterialParameterTypes[key1];
		if (type1 === 'cubemap') {
				standardMaterialCubemapParameters.push(key1);
		}
}
var standardMaterialRemovedParameters = {
		aoMapVertexColor: 'boolean',
		diffuseMapTint: 'boolean',
		diffuseMapVertexColor: 'boolean',
		emissiveMapTint: 'boolean',
		emissiveMapVertexColor: 'boolean',
		glossMapVertexColor: 'boolean',
		metalnessMapVertexColor: 'boolean',
		opacityMapVertexColor: 'boolean',
		specularAntialias: 'boolean',
		specularMapTint: 'boolean',
		specularMapVertexColor: 'boolean',
		ambientTint: 'boolean',
		emissiveTint: 'boolean',
		diffuseTint: 'boolean',
		sheenTint: 'boolean',
		conserveEnergy: 'boolean',
		useGamma: 'boolean',
		useGammaTonemap: 'boolean',
		sheenGlossTint: 'boolean'
};

export { standardMaterialCubemapParameters, standardMaterialParameterTypes, standardMaterialRemovedParameters, standardMaterialTextureParameters };
