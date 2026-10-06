import { FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_R32F, PIXELFORMAT_R16F, pixelFormatInfo, ADDRESS_CLAMP_TO_EDGE, FUNC_LESS } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { SHADOW_VSM_32F, LIGHTTYPE_OMNI, shadowTypeInfo, SHADOW_PCSS_32F } from '../constants.js';

class ShadowMap {
		destroy() {
				if (this.texture) {
						this.texture.destroy();
						this.texture = null;
				}
				var targets = this.renderTargets;
				for(var i = 0; i < targets.length; i++){
						targets[i].destroy();
				}
				this.renderTargets.length = 0;
		}
		static getShadowFiltering(device, shadowType) {
				if (shadowType === SHADOW_VSM_32F) {
						return device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
				}
				return FILTER_LINEAR;
		}
		static create(device, light) {
				var shadowMap = null;
				if (light._type === LIGHTTYPE_OMNI) {
						shadowMap = this.createCubemap(device, light._shadowResolution, light._shadowType);
				} else {
						shadowMap = this.create2dMap(device, light._shadowResolution, light._shadowType);
				}
				return shadowMap;
		}
		static createAtlas(device, resolution, shadowType) {
				var shadowMap = this.create2dMap(device, resolution, shadowType);
				var targets = shadowMap.renderTargets;
				var rt = targets[0];
				for(var i = 0; i < 5; i++){
						targets.push(rt);
				}
				return shadowMap;
		}
		static create2dMap(device, size, shadowType) {
				var _pixelFormatInfo_get;
				var shadowInfo = shadowTypeInfo.get(shadowType);
				var format = shadowInfo.format;
				if (format === PIXELFORMAT_R32F && !device.textureFloatRenderable && device.textureHalfFloatRenderable) {
						format = PIXELFORMAT_R16F;
				}
				var formatName = (_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.name;
				var filter = this.getShadowFiltering(device, shadowType);
				var texture = new Texture(device, {
						format: format,
						width: size,
						height: size,
						mipmaps: false,
						minFilter: filter,
						magFilter: filter,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						name: "ShadowMap2D_" + formatName
				});
				var target = null;
				if (shadowInfo == null ? undefined : shadowInfo.pcf) {
						texture.compareOnRead = true;
						texture.compareFunc = FUNC_LESS;
						target = new RenderTarget({
								depthBuffer: texture
						});
				} else {
						target = new RenderTarget({
								colorBuffer: texture,
								depth: true
						});
				}
				if (device.isWebGPU) {
						target.flipY = true;
				}
				return new ShadowMap(texture, [
						target
				]);
		}
		static createCubemap(device, size, shadowType) {
				var _pixelFormatInfo_get;
				var shadowInfo = shadowTypeInfo.get(shadowType);
				var formatName = (_pixelFormatInfo_get = pixelFormatInfo.get(shadowInfo.format)) == null ? undefined : _pixelFormatInfo_get.name;
				var isPcss = shadowType === SHADOW_PCSS_32F;
				var filter = isPcss ? FILTER_NEAREST : FILTER_LINEAR;
				var cubemap = new Texture(device, {
						format: shadowInfo == null ? undefined : shadowInfo.format,
						width: size,
						height: size,
						cubemap: true,
						mipmaps: false,
						minFilter: filter,
						magFilter: filter,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						name: "ShadowMapCube_" + formatName
				});
				if (!isPcss) {
						cubemap.compareOnRead = true;
						cubemap.compareFunc = FUNC_LESS;
				}
				var targets = [];
				for(var i = 0; i < 6; i++){
						if (isPcss) {
								targets.push(new RenderTarget({
										colorBuffer: cubemap,
										face: i,
										depth: true
								}));
						} else {
								targets.push(new RenderTarget({
										depthBuffer: cubemap,
										face: i
								}));
						}
				}
				return new ShadowMap(cubemap, targets);
		}
		constructor(texture, targets){
				this.texture = texture;
				this.cached = false;
				this.renderTargets = targets;
		}
}

export { ShadowMap };
