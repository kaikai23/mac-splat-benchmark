import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { PIXELFORMAT_SRGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { shadowTypeInfo, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI, SHADOW_PCF3_32F } from '../constants.js';
import { ShadowMap } from '../renderer/shadow-map.js';

var _tempArray = [];
var _tempArray2 = [];
var _viewport = new Vec4();
var _scissor = new Vec4();
class Slot {
		constructor(rect){
				this.size = Math.floor(rect.w * 1024);
				this.used = false;
				this.lightId = -1;
				this.rect = rect;
		}
}
class LightTextureAtlas {
		destroy() {
				this.destroyShadowAtlas();
				this.destroyCookieAtlas();
		}
		destroyShadowAtlas() {
				var _this_shadowAtlas;
				(_this_shadowAtlas = this.shadowAtlas) == null ? undefined : _this_shadowAtlas.destroy();
				this.shadowAtlas = null;
		}
		destroyCookieAtlas() {
				var _this_cookieAtlas, _this_cookieRenderTarget;
				(_this_cookieAtlas = this.cookieAtlas) == null ? undefined : _this_cookieAtlas.destroy();
				this.cookieAtlas = null;
				(_this_cookieRenderTarget = this.cookieRenderTarget) == null ? undefined : _this_cookieRenderTarget.destroy();
				this.cookieRenderTarget = null;
		}
		allocateShadowAtlas(resolution, shadowType) {
				if (shadowType === undefined) shadowType = SHADOW_PCF3_32F;
				var _this_shadowAtlas;
				var existingFormat = (_this_shadowAtlas = this.shadowAtlas) == null ? undefined : _this_shadowAtlas.texture.format;
				var requiredFormat = shadowTypeInfo.get(shadowType).format;
				if (!this.shadowAtlas || this.shadowAtlas.texture.width !== resolution || existingFormat !== requiredFormat) {
						this.version++;
						this.destroyShadowAtlas();
						this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, shadowType);
						this.shadowAtlas.cached = true;
						var scissorOffset = 4 / this.shadowAtlasResolution;
						this.scissorVec.set(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);
				}
		}
		allocateCookieAtlas(resolution) {
				if (this.cookieAtlas.width !== resolution) {
						this.cookieRenderTarget.resize(resolution, resolution);
						this.version++;
				}
		}
		allocateUniforms() {
				this._shadowAtlasTextureId = this.device.scope.resolve('shadowAtlasTexture');
				this._shadowAtlasParamsId = this.device.scope.resolve('shadowAtlasParams');
				this._shadowAtlasParams = new Float32Array(2);
				this._cookieAtlasTextureId = this.device.scope.resolve('cookieAtlasTexture');
		}
		updateUniforms() {
				var rt = this.shadowAtlas.renderTargets[0];
				var shadowBuffer = rt.depthBuffer;
				this._shadowAtlasTextureId.setValue(shadowBuffer);
				this._shadowAtlasParams[0] = this.shadowAtlasResolution;
				this._shadowAtlasParams[1] = this.shadowEdgePixels;
				this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);
				this._cookieAtlasTextureId.setValue(this.cookieAtlas);
		}
		subdivide(numLights, lightingParams) {
				var atlasSplit = lightingParams.atlasSplit;
				if (!atlasSplit) {
						var gridSize = Math.ceil(Math.sqrt(numLights));
						atlasSplit = _tempArray2;
						atlasSplit[0] = gridSize;
						atlasSplit.length = 1;
				}
				var arraysEqual = (a, b)=>a.length === b.length && a.every((v, i)=>v === b[i]);
				if (!arraysEqual(atlasSplit, this.atlasSplit)) {
						this.version++;
						this.slots.length = 0;
						this.atlasSplit.length = 0;
						this.atlasSplit.push(...atlasSplit);
						var splitCount = this.atlasSplit[0];
						if (splitCount > 1) {
								var invSize = 1 / splitCount;
								for(var i = 0; i < splitCount; i++){
										for(var j = 0; j < splitCount; j++){
												var rect = new Vec4(i * invSize, j * invSize, invSize, invSize);
												var nextLevelSplit = this.atlasSplit[1 + i * splitCount + j];
												if (nextLevelSplit > 1) {
														for(var x = 0; x < nextLevelSplit; x++){
																for(var y = 0; y < nextLevelSplit; y++){
																		var invSizeNext = invSize / nextLevelSplit;
																		var rectNext = new Vec4(rect.x + x * invSizeNext, rect.y + y * invSizeNext, invSizeNext, invSizeNext);
																		this.slots.push(new Slot(rectNext));
																}
														}
												} else {
														this.slots.push(new Slot(rect));
												}
										}
								}
						} else {
								this.slots.push(new Slot(new Vec4(0, 0, 1, 1)));
						}
						this.slots.sort((a, b)=>{
								return b.size - a.size;
						});
				}
		}
		collectLights(localLights, lightingParams) {
				var cookiesEnabled = lightingParams.cookiesEnabled;
				var shadowsEnabled = lightingParams.shadowsEnabled;
				var needsShadowAtlas = false;
				var needsCookieAtlas = false;
				var lights = _tempArray;
				lights.length = 0;
				var processLights = (list)=>{
						for(var i = 0; i < list.length; i++){
								var light = list[i];
								if (light.visibleThisFrame) {
										var lightShadow = shadowsEnabled && light.castShadows;
										var lightCookie = cookiesEnabled && !!light.cookie;
										needsShadowAtlas || (needsShadowAtlas = lightShadow);
										needsCookieAtlas || (needsCookieAtlas = lightCookie);
										if (lightShadow || lightCookie) {
												lights.push(light);
										}
								}
						}
				};
				if (cookiesEnabled || shadowsEnabled) {
						processLights(localLights);
				}
				lights.sort((a, b)=>{
						return b.maxScreenSize - a.maxScreenSize;
				});
				if (needsShadowAtlas) {
						this.allocateShadowAtlas(this.shadowAtlasResolution, lightingParams.shadowType);
				}
				if (needsCookieAtlas) {
						this.allocateCookieAtlas(this.cookieAtlasResolution);
				}
				if (needsShadowAtlas || needsCookieAtlas) {
						this.subdivide(lights.length, lightingParams);
				}
				return lights;
		}
		setupSlot(light, rect) {
				light.atlasViewport.copy(rect);
				var faceCount = light.numShadowFaces;
				for(var face = 0; face < faceCount; face++){
						if (light.castShadows || light._cookie) {
								_viewport.copy(rect);
								_scissor.copy(rect);
								if (light._type === LIGHTTYPE_SPOT) {
										_viewport.add(this.scissorVec);
								}
								if (light._type === LIGHTTYPE_OMNI) {
										var smallSize = _viewport.z / 3;
										var offset = this.cubeSlotsOffsets[face];
										_viewport.x += smallSize * offset.x;
										_viewport.y += smallSize * offset.y;
										_viewport.z = smallSize;
										_viewport.w = smallSize;
										_scissor.copy(_viewport);
								}
								if (light.castShadows) {
										var lightRenderData = light.getRenderData(null, face);
										lightRenderData.shadowViewport.copy(_viewport);
										lightRenderData.shadowScissor.copy(_scissor);
								}
						}
				}
		}
		assignSlot(light, slotIndex, slotReassigned) {
				light.atlasViewportAllocated = true;
				var slot = this.slots[slotIndex];
				slot.lightId = light.id;
				slot.used = true;
				if (slotReassigned) {
						light.atlasSlotUpdated = true;
						light.atlasVersion = this.version;
						light.atlasSlotIndex = slotIndex;
				}
		}
		update(localLights, lightingParams) {
				this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
				this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;
				var lights = this.collectLights(localLights, lightingParams);
				if (lights.length > 0) {
						var slots = this.slots;
						for(var i = 0; i < slots.length; i++){
								slots[i].used = false;
						}
						var assignCount = Math.min(lights.length, slots.length);
						for(var i1 = 0; i1 < assignCount; i1++){
								var light = lights[i1];
								if (light.castShadows) {
										light._shadowMap = this.shadowAtlas;
								}
								var previousSlot = slots[light.atlasSlotIndex];
								if (light.atlasVersion === this.version && light.id === (previousSlot == null ? undefined : previousSlot.lightId)) {
										var previousSlot1 = slots[light.atlasSlotIndex];
										if (previousSlot1.size === slots[i1].size && !previousSlot1.used) {
												this.assignSlot(light, light.atlasSlotIndex, false);
										}
								}
						}
						var usedCount = 0;
						for(var i2 = 0; i2 < assignCount; i2++){
								while(usedCount < slots.length && slots[usedCount].used){
										usedCount++;
								}
								var light1 = lights[i2];
								if (!light1.atlasViewportAllocated) {
										this.assignSlot(light1, usedCount, true);
								}
								var slot = slots[light1.atlasSlotIndex];
								this.setupSlot(light1, slot.rect);
						}
				}
				this.updateUniforms();
		}
		constructor(device){
				this.device = device;
				this.version = 1;
				this.shadowAtlasResolution = 2048;
				this.shadowAtlas = null;
				this.shadowEdgePixels = 3;
				this.cookieAtlasResolution = 4;
				this.cookieAtlas = new Texture(this.device, {
						name: 'CookieAtlas',
						width: this.cookieAtlasResolution,
						height: this.cookieAtlasResolution,
						format: PIXELFORMAT_SRGBA8,
						cubemap: false,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				this.cookieRenderTarget = new RenderTarget({
						colorBuffer: this.cookieAtlas,
						depth: false,
						flipY: true
				});
				this.slots = [];
				this.atlasSplit = [];
				this.cubeSlotsOffsets = [
						new Vec2(0, 0),
						new Vec2(0, 1),
						new Vec2(1, 0),
						new Vec2(1, 1),
						new Vec2(2, 0),
						new Vec2(2, 1)
				];
				this.scissorVec = new Vec4();
				this.allocateShadowAtlas(1);
				this.allocateCookieAtlas(1);
				this.allocateUniforms();
		}
}

export { LightTextureAtlas };
