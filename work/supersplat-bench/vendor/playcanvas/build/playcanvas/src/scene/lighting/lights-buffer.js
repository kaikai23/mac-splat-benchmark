import { Vec3 } from '../../core/math/vec3.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTSHAPE_PUNCTUAL } from '../constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LightCamera } from '../renderer/light-camera.js';

var epsilon = 0.000001;
var tempVec3 = new Vec3();
var tempAreaLightSizes = new Float32Array(6);
var areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
var areaHalfAxisHeight = new Vec3(0, 0, 0.5);
var TextureIndex8 = {
		FLAGS: 0,
		COLOR_A: 1,
		COLOR_B: 2,
		SPOT_ANGLES: 3,
		SHADOW_BIAS: 4,
		COOKIE_A: 5,
		COOKIE_B: 6,
		COUNT: 7
};
var TextureIndexFloat = {
		POSITION_RANGE: 0,
		SPOT_DIRECTION: 1,
		PROJ_MAT_0: 2,
		ATLAS_VIEWPORT: 2,
		PROJ_MAT_1: 3,
		PROJ_MAT_2: 4,
		PROJ_MAT_3: 5,
		AREA_DATA_WIDTH: 6,
		AREA_DATA_HEIGHT: 7,
		COUNT: 8
};
var _defines;
class LightsBuffer {
		static getShaderDefines() {
				var buildShaderDefines = (object, prefix)=>{
						return Object.keys(object).map((key)=>"#define " + prefix + key + " " + object[key]).join('\n');
				};
				if (!_defines) {
						_defines = "\n\n                " + buildShaderDefines(TextureIndex8, 'CLUSTER_TEXTURE_8_') + "\n                " + buildShaderDefines(TextureIndexFloat, 'CLUSTER_TEXTURE_F_') + "\n            ";
				}
				return _defines;
		}
		destroy() {
				var _this_lightsTexture8, _this_lightsTextureFloat;
				(_this_lightsTexture8 = this.lightsTexture8) == null ? undefined : _this_lightsTexture8.destroy();
				this.lightsTexture8 = null;
				(_this_lightsTextureFloat = this.lightsTextureFloat) == null ? undefined : _this_lightsTextureFloat.destroy();
				this.lightsTextureFloat = null;
		}
		createTexture(device, width, height, format, name) {
				var tex = new Texture(device, {
						name: name,
						width: width,
						height: height,
						mipmaps: false,
						format: format,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						type: TEXTURETYPE_DEFAULT,
						magFilter: FILTER_NEAREST,
						minFilter: FILTER_NEAREST,
						anisotropy: 1
				});
				return tex;
		}
		setCompressionRanges(maxAttenuation, maxColorValue) {
				this.invMaxColorValue = 1 / maxColorValue;
				this.invMaxAttenuation = 1 / maxAttenuation;
		}
		setBounds(min, delta) {
				this.boundsMin.copy(min);
				this.boundsDelta.copy(delta);
		}
		uploadTextures() {
				this.lightsTextureFloat.lock().set(this.lightsFloat);
				this.lightsTextureFloat.unlock();
				this.lightsTexture8.lock().set(this.lights8);
				this.lightsTexture8.unlock();
		}
		updateUniforms() {
				this._lightsTexture8Id.setValue(this.lightsTexture8);
				this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
		}
		getSpotDirection(direction, spot) {
				var mat = spot._node.getWorldTransform();
				mat.getY(direction).mulScalar(-1);
				direction.normalize();
		}
		getLightAreaSizes(light) {
				var mat = light._node.getWorldTransform();
				mat.transformVector(areaHalfAxisWidth, tempVec3);
				tempAreaLightSizes[0] = tempVec3.x;
				tempAreaLightSizes[1] = tempVec3.y;
				tempAreaLightSizes[2] = tempVec3.z;
				mat.transformVector(areaHalfAxisHeight, tempVec3);
				tempAreaLightSizes[3] = tempVec3.x;
				tempAreaLightSizes[4] = tempVec3.y;
				tempAreaLightSizes[5] = tempVec3.z;
				return tempAreaLightSizes;
		}
		addLightDataFlags(data8, index, light, isSpot, castShadows, shadowIntensity) {
				data8[index + 0] = isSpot ? 255 : 0;
				data8[index + 1] = this.areaLightsEnabled ? light._shape * 64 : 0;
				data8[index + 2] = light._falloffMode * 255;
				data8[index + 3] = castShadows ? shadowIntensity * 255 : 0;
		}
		addLightDataColor(data8, index, light, isCookie) {
				var invMaxColorValue = this.invMaxColorValue;
				var color = light._colorLinear;
				FloatPacking.float2Bytes(color[0] * invMaxColorValue, data8, index + 0, 2);
				FloatPacking.float2Bytes(color[1] * invMaxColorValue, data8, index + 2, 2);
				FloatPacking.float2Bytes(color[2] * invMaxColorValue, data8, index + 4, 2);
				data8[index + 6] = isCookie ? 255 : 0;
				var isDynamic = !!(light.mask & MASK_AFFECT_DYNAMIC);
				var isLightmapped = !!(light.mask & MASK_AFFECT_LIGHTMAPPED);
				data8[index + 7] = isDynamic && isLightmapped ? 127 : isLightmapped ? 255 : 0;
		}
		addLightDataSpotAngles(data8, index, light) {
				FloatPacking.float2Bytes(light._innerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 0, 2);
				FloatPacking.float2Bytes(light._outerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 2, 2);
		}
		addLightDataShadowBias(data8, index, light) {
				var lightRenderData = light.getRenderData(null, 0);
				var biases = light._getUniformBiasValues(lightRenderData);
				FloatPacking.float2BytesRange(biases.bias, data8, index, -1, 20, 2);
				FloatPacking.float2Bytes(biases.normalBias, data8, index + 2, 2);
		}
		addLightDataCookies(data8, index, light) {
				var isRgb = light._cookieChannel === 'rgb';
				data8[index + 0] = Math.floor(light.cookieIntensity * 255);
				data8[index + 1] = isRgb ? 255 : 0;
				if (!isRgb) {
						var channel = light._cookieChannel;
						data8[index + 4] = channel === 'rrr' ? 255 : 0;
						data8[index + 5] = channel === 'ggg' ? 255 : 0;
						data8[index + 6] = channel === 'bbb' ? 255 : 0;
						data8[index + 7] = channel === 'aaa' ? 255 : 0;
				}
		}
		addLightData(light, lightIndex) {
				var isSpot = light._type === LIGHTTYPE_SPOT;
				var hasAtlasViewport = light.atlasViewportAllocated;
				var isCookie = this.cookiesEnabled && !!light._cookie && hasAtlasViewport;
				var isArea = this.areaLightsEnabled && light.shape !== LIGHTSHAPE_PUNCTUAL;
				var castShadows = this.shadowsEnabled && light.castShadows && hasAtlasViewport;
				var pos = light._node.getPosition();
				var lightProjectionMatrix = null;
				var atlasViewport = null;
				if (isSpot) {
						if (castShadows) {
								var lightRenderData = light.getRenderData(null, 0);
								lightProjectionMatrix = lightRenderData.shadowMatrix;
						} else if (isCookie) {
								lightProjectionMatrix = LightCamera.evalSpotCookieMatrix(light);
						}
				} else {
						if (castShadows || isCookie) {
								atlasViewport = light.atlasViewport;
						}
				}
				var data8 = this.lights8;
				var data8Start = lightIndex * this.lightsTexture8.width * 4;
				this.addLightDataFlags(data8, data8Start + 4 * TextureIndex8.FLAGS, light, isSpot, castShadows, light.shadowIntensity);
				this.addLightDataColor(data8, data8Start + 4 * TextureIndex8.COLOR_A, light, isCookie);
				if (isSpot) {
						this.addLightDataSpotAngles(data8, data8Start + 4 * TextureIndex8.SPOT_ANGLES, light);
				}
				if (light.castShadows) {
						this.addLightDataShadowBias(data8, data8Start + 4 * TextureIndex8.SHADOW_BIAS, light);
				}
				if (isCookie) {
						this.addLightDataCookies(data8, data8Start + 4 * TextureIndex8.COOKIE_A, light);
				}
				var dataFloat = this.lightsFloat;
				var dataFloatStart = lightIndex * this.lightsTextureFloat.width * 4;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 0] = pos.x;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 1] = pos.y;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 2] = pos.z;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 3] = light.attenuationEnd;
				if (isSpot) {
						this.getSpotDirection(tempVec3, light);
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 0] = tempVec3.x;
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 1] = tempVec3.y;
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 2] = tempVec3.z;
				}
				if (lightProjectionMatrix) {
						var matData = lightProjectionMatrix.data;
						for(var m = 0; m < 16; m++){
								dataFloat[dataFloatStart + 4 * TextureIndexFloat.PROJ_MAT_0 + m] = matData[m];
						}
				}
				if (atlasViewport) {
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 0] = atlasViewport.x;
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 1] = atlasViewport.y;
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 2] = atlasViewport.z / 3;
				}
				if (isArea) {
						var areaSizes = this.getLightAreaSizes(light);
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 0] = areaSizes[0];
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 1] = areaSizes[1];
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 2] = areaSizes[2];
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 0] = areaSizes[3];
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 1] = areaSizes[4];
						dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 2] = areaSizes[5];
				}
		}
		constructor(device){
				this.areaLightsEnabled = false;
				this.device = device;
				this.cookiesEnabled = false;
				this.shadowsEnabled = false;
				this.areaLightsEnabled = false;
				this.maxLights = 255;
				var pixelsPerLight8 = TextureIndex8.COUNT;
				this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
				this.lightsTexture8 = this.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_RGBA8, 'LightsTexture8');
				this._lightsTexture8Id = this.device.scope.resolve('lightsTexture8');
				var pixelsPerLightFloat = TextureIndexFloat.COUNT;
				this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
				this.lightsTextureFloat = this.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F, 'LightsTextureFloat');
				this._lightsTextureFloatId = this.device.scope.resolve('lightsTextureFloat');
				this.invMaxColorValue = 0;
				this.invMaxAttenuation = 0;
				this.boundsMin = new Vec3();
				this.boundsDelta = new Vec3();
		}
}

export { LightsBuffer };
