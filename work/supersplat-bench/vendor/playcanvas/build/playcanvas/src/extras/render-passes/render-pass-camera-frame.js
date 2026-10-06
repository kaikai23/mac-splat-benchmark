import { LAYERID_SKYBOX, LAYERID_IMMEDIATE, GAMMA_NONE, TONEMAP_NONE } from '../../scene/constants.js';
import { FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderPassColorGrab } from '../../scene/graphics/render-pass-color-grab.js';
import { RenderPassForward } from '../../scene/renderer/render-pass-forward.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { RenderPassBloom } from './render-pass-bloom.js';
import { RenderPassCompose } from './render-pass-compose.js';
import { RenderPassTAA } from './render-pass-taa.js';
import { RenderPassDof } from './render-pass-dof.js';
import { RenderPassPrepass } from './render-pass-prepass.js';
import { RenderPassSsao } from './render-pass-ssao.js';
import { SSAOTYPE_NONE, SSAOTYPE_LIGHTING, SSAOTYPE_COMBINE } from './constants.js';
import { RenderPassDownsample } from './render-pass-downsample.js';
import { Color } from '../../core/math/color.js';

class CameraFrameOptions {
		constructor(){
				this.stencil = false;
				this.samples = 1;
				this.sceneColorMap = false;
				this.lastGrabLayerId = LAYERID_SKYBOX;
				this.lastGrabLayerIsTransparent = false;
				this.lastSceneLayerId = LAYERID_IMMEDIATE;
				this.lastSceneLayerIsTransparent = true;
				this.taaEnabled = false;
				this.bloomEnabled = false;
				this.ssaoType = SSAOTYPE_NONE;
				this.ssaoBlurEnabled = true;
				this.prepassEnabled = false;
				this.dofEnabled = false;
				this.dofNearBlur = false;
				this.dofHighQuality = true;
		}
}
var _defaultOptions = new CameraFrameOptions();
class RenderPassCameraFrame extends RenderPass {
		destroy() {
				this.reset();
		}
		reset() {
				this.sceneTexture = null;
				this.sceneTextureHalf = null;
				if (this.rt) {
						this.rt.destroyTextureBuffers();
						this.rt.destroy();
						this.rt = null;
				}
				if (this.rtHalf) {
						this.rtHalf.destroyTextureBuffers();
						this.rtHalf.destroy();
						this.rtHalf = null;
				}
				this.beforePasses.forEach((pass)=>pass.destroy());
				this.beforePasses.length = 0;
				this.prePass = null;
				this.scenePass = null;
				this.scenePassTransparent = null;
				this.colorGrabPass = null;
				this.composePass = null;
				this.bloomPass = null;
				this.ssaoPass = null;
				this.taaPass = null;
				this.afterPass = null;
				this.scenePassHalf = null;
				this.dofPass = null;
		}
		sanitizeOptions(options) {
				options = Object.assign({}, _defaultOptions, options);
				if (options.taaEnabled || options.ssaoType !== SSAOTYPE_NONE || options.dofEnabled) {
						options.prepassEnabled = true;
				}
				return options;
		}
		set renderTargetScale(value) {
				this._renderTargetScale = value;
				if (this.scenePass) {
						this.scenePass.scaleX = value;
						this.scenePass.scaleY = value;
				}
		}
		get renderTargetScale() {
				return this._renderTargetScale;
		}
		needsReset(options) {
				var currentOptions = this.options;
				var arraysNotEqual = (arr1, arr2)=>arr1 !== arr2 && (!(Array.isArray(arr1) && Array.isArray(arr2)) || arr1.length !== arr2.length || !arr1.every((value, index)=>value === arr2[index]));
				return options.ssaoType !== currentOptions.ssaoType || options.ssaoBlurEnabled !== currentOptions.ssaoBlurEnabled || options.taaEnabled !== currentOptions.taaEnabled || options.samples !== currentOptions.samples || options.stencil !== currentOptions.stencil || options.bloomEnabled !== currentOptions.bloomEnabled || options.prepassEnabled !== currentOptions.prepassEnabled || options.sceneColorMap !== currentOptions.sceneColorMap || options.dofEnabled !== currentOptions.dofEnabled || options.dofNearBlur !== currentOptions.dofNearBlur || options.dofHighQuality !== currentOptions.dofHighQuality || arraysNotEqual(options.formats, currentOptions.formats);
		}
		update(options) {
				options = this.sanitizeOptions(options);
				if (this.needsReset(options)) {
						this.reset();
				}
				this.options = options;
				if (!this.sceneTexture) {
						this.setupRenderPasses(this.options);
				}
		}
		createRenderTarget(name, depth, stencil, samples, flipY) {
				var texture = new Texture(this.device, {
						name: name,
						width: 4,
						height: 4,
						format: this.hdrFormat,
						mipmaps: false,
						minFilter: FILTER_LINEAR,
						magFilter: FILTER_LINEAR,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				return new RenderTarget({
						colorBuffer: texture,
						depth: depth,
						stencil: stencil,
						samples: samples,
						flipY: flipY
				});
		}
		setupRenderPasses(options) {
				var { device } = this;
				var cameraComponent = this.cameraComponent;
				var targetRenderTarget = cameraComponent.renderTarget;
				this.hdrFormat = device.getRenderableHdrFormat(options.formats, true, options.samples) || PIXELFORMAT_RGBA8;
				this._bloomEnabled = options.bloomEnabled && this.hdrFormat !== PIXELFORMAT_RGBA8;
				this._sceneHalfEnabled = this._bloomEnabled || options.dofEnabled;
				cameraComponent.shaderParams.ssaoEnabled = options.ssaoType === SSAOTYPE_LIGHTING;
				var flipY = !!(targetRenderTarget == null ? undefined : targetRenderTarget.flipY);
				this.rt = this.createRenderTarget('SceneColor', true, options.stencil, options.samples, flipY);
				this.sceneTexture = this.rt.colorBuffer;
				if (this._sceneHalfEnabled) {
						this.rtHalf = this.createRenderTarget('SceneColorHalf', false, false, 1, flipY);
						this.sceneTextureHalf = this.rtHalf.colorBuffer;
				}
				this.sceneOptions = {
						resizeSource: targetRenderTarget,
						scaleX: this.renderTargetScale,
						scaleY: this.renderTargetScale
				};
				this.createPasses(options);
				var allPasses = this.collectPasses();
				this.beforePasses = allPasses.filter((element)=>element !== undefined && element !== null);
		}
		collectPasses() {
				return [
						this.prePass,
						this.ssaoPass,
						this.scenePass,
						this.colorGrabPass,
						this.scenePassTransparent,
						this.taaPass,
						this.scenePassHalf,
						this.bloomPass,
						this.dofPass,
						this.composePass,
						this.afterPass
				];
		}
		createPasses(options) {
				this.setupScenePrepass(options);
				this.setupSsaoPass(options);
				var scenePassesInfo = this.setupScenePass(options);
				var sceneTextureWithTaa = this.setupTaaPass(options);
				this.setupSceneHalfPass(options, sceneTextureWithTaa);
				this.setupBloomPass(options, this.sceneTextureHalf);
				this.setupDofPass(options, this.sceneTexture, this.sceneTextureHalf);
				this.setupComposePass(options);
				this.setupAfterPass(options, scenePassesInfo);
		}
		setupScenePrepass(options) {
				if (options.prepassEnabled) {
						var { app, device, cameraComponent } = this;
						var { scene, renderer } = app;
						this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, this.sceneOptions);
				}
		}
		setupScenePassSettings(pass) {
				pass.gammaCorrection = GAMMA_NONE;
				pass.toneMapping = TONEMAP_NONE;
		}
		setupScenePass(options) {
				var { app, device, cameraComponent } = this;
				var { scene, renderer } = app;
				var composition = scene.layers;
				this.scenePass = new RenderPassForward(device, composition, scene, renderer);
				this.setupScenePassSettings(this.scenePass);
				this.scenePass.init(this.rt, this.sceneOptions);
				var lastLayerId = options.sceneColorMap ? options.lastGrabLayerId : options.lastSceneLayerId;
				var lastLayerIsTransparent = options.sceneColorMap ? options.lastGrabLayerIsTransparent : options.lastSceneLayerIsTransparent;
				var ret = {
						lastAddedIndex: 0,
						clearRenderTarget: true
				};
				ret.lastAddedIndex = this.scenePass.addLayers(composition, cameraComponent, ret.lastAddedIndex, ret.clearRenderTarget, lastLayerId, lastLayerIsTransparent);
				ret.clearRenderTarget = false;
				if (options.sceneColorMap) {
						this.colorGrabPass = new RenderPassColorGrab(device);
						this.colorGrabPass.source = this.rt;
						this.scenePassTransparent = new RenderPassForward(device, composition, scene, renderer);
						this.setupScenePassSettings(this.scenePassTransparent);
						this.scenePassTransparent.init(this.rt);
						ret.lastAddedIndex = this.scenePassTransparent.addLayers(composition, cameraComponent, ret.lastAddedIndex, ret.clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);
						if (!this.scenePassTransparent.rendersAnything) {
								this.scenePassTransparent.destroy();
								this.scenePassTransparent = null;
						}
						if (this.scenePassTransparent) {
								if (options.prepassEnabled) {
										this.scenePassTransparent.depthStencilOps.storeDepth = true;
								}
						}
				}
				return ret;
		}
		setupSsaoPass(options) {
				var { ssaoBlurEnabled, ssaoType } = options;
				var { device, cameraComponent } = this;
				if (ssaoType !== SSAOTYPE_NONE) {
						this.ssaoPass = new RenderPassSsao(device, this.sceneTexture, cameraComponent, ssaoBlurEnabled);
				}
		}
		setupSceneHalfPass(options, sourceTexture) {
				if (this._sceneHalfEnabled) {
						this.scenePassHalf = new RenderPassDownsample(this.device, this.sceneTexture, {
								boxFilter: true
						});
						this.scenePassHalf.name = 'RenderPassSceneHalf';
						this.scenePassHalf.init(this.rtHalf, {
								resizeSource: sourceTexture,
								scaleX: 0.5,
								scaleY: 0.5
						});
						this.scenePassHalf.setClearColor(Color.BLACK);
				}
		}
		setupBloomPass(options, inputTexture) {
				if (this._bloomEnabled) {
						this.bloomPass = new RenderPassBloom(this.device, inputTexture, this.hdrFormat);
				}
		}
		setupDofPass(options, inputTexture, inputTextureHalf) {
				if (options.dofEnabled) {
						this.dofPass = new RenderPassDof(this.device, this.cameraComponent, inputTexture, inputTextureHalf, options.dofHighQuality, options.dofNearBlur);
				}
		}
		setupTaaPass(options) {
				var textureWithTaa = this.sceneTexture;
				if (options.taaEnabled) {
						this.taaPass = new RenderPassTAA(this.device, this.sceneTexture, this.cameraComponent);
						textureWithTaa = this.taaPass.historyTexture;
				}
				return textureWithTaa;
		}
		setupComposePass(options) {
				var _this_bloomPass, _this_dofPass, _this_dofPass1, _this_dofPass2;
				this.composePass = new RenderPassCompose(this.device);
				this.composePass.bloomTexture = (_this_bloomPass = this.bloomPass) == null ? undefined : _this_bloomPass.bloomTexture;
				this.composePass.taaEnabled = options.taaEnabled;
				this.composePass.cocTexture = (_this_dofPass = this.dofPass) == null ? undefined : _this_dofPass.cocTexture;
				this.composePass.blurTexture = (_this_dofPass1 = this.dofPass) == null ? undefined : _this_dofPass1.blurTexture;
				this.composePass.blurTextureUpscale = !((_this_dofPass2 = this.dofPass) == null ? undefined : _this_dofPass2.highQuality);
				var cameraComponent = this.cameraComponent;
				var targetRenderTarget = cameraComponent.renderTarget;
				this.composePass.init(targetRenderTarget);
				this.composePass.ssaoTexture = options.ssaoType === SSAOTYPE_COMBINE ? this.ssaoPass.ssaoTexture : null;
		}
		setupAfterPass(options, scenePassesInfo) {
				var { app, cameraComponent } = this;
				var { scene, renderer } = app;
				var composition = scene.layers;
				var targetRenderTarget = cameraComponent.renderTarget;
				this.afterPass = new RenderPassForward(this.device, composition, scene, renderer);
				this.afterPass.init(targetRenderTarget);
				this.afterPass.addLayers(composition, cameraComponent, scenePassesInfo.lastAddedIndex, scenePassesInfo.clearRenderTarget);
		}
		frameUpdate() {
				var _this_taaPass, _this_scenePassHalf;
				super.frameUpdate();
				var _this_taaPass_update;
				var sceneTexture = (_this_taaPass_update = (_this_taaPass = this.taaPass) == null ? undefined : _this_taaPass.update()) != null ? _this_taaPass_update : this.rt.colorBuffer;
				this.composePass.sceneTexture = sceneTexture;
				(_this_scenePassHalf = this.scenePassHalf) == null ? undefined : _this_scenePassHalf.setSourceTexture(sceneTexture);
		}
		constructor(app, cameraComponent, options = {}){
				super(app.graphicsDevice), this._renderTargetScale = 1, this.rt = null;
				this.app = app;
				this.cameraComponent = cameraComponent;
				this.options = this.sanitizeOptions(options);
				this.setupRenderPasses(this.options);
		}
}

export { CameraFrameOptions, RenderPassCameraFrame };
