import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8, BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';
import { shaderChunks } from '../scene/shader-lib/chunks/chunks.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { BlendState } from '../platform/graphics/blend-state.js';
import { DepthState } from '../platform/graphics/depth-state.js';
import { CylinderGeometry } from '../scene/geometry/cylinder-geometry.js';
import { BoxGeometry } from '../scene/geometry/box-geometry.js';
import { CapsuleGeometry } from '../scene/geometry/capsule-geometry.js';
import { ConeGeometry } from '../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../scene/geometry/torus-geometry.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { Material } from '../scene/materials/material.js';
import { Mesh } from '../scene/mesh.js';
import { Morph } from '../scene/morph.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { Scene } from '../scene/scene.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { getDefaultMaterial } from '../scene/materials/default-material.js';
import { StandardMaterialOptions } from '../scene/materials/standard-material-options.js';
import { LitShaderOptions } from '../scene/shader-lib/programs/lit-shader-options.js';
import { Layer } from '../scene/layer.js';
import { AssetRegistry } from '../framework/asset/asset-registry.js';
import { XrInputSource } from '../framework/xr/xr-input-source.js';
import { ElementInput } from '../framework/input/element-input.js';
import { MouseEvent } from '../platform/input/mouse-event.js';
import { AppBase } from '../framework/app-base.js';
import { getApplication } from '../framework/globals.js';
import { ModelComponent } from '../framework/components/model/component.js';
import { BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYFLAG_STATIC_OBJECT, BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYSTATE_ACTIVE_TAG, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION } from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { Geometry } from '../scene/geometry/geometry.js';
import { CameraComponent } from '../framework/components/camera/component.js';

Vec2.prototype.scale = Vec2.prototype.mulScalar;
Vec3.prototype.scale = Vec3.prototype.mulScalar;
Vec4.prototype.scale = Vec4.prototype.mulScalar;
var PIXELFORMAT_L8_A8 = PIXELFORMAT_LA8;
var PIXELFORMAT_R5_G6_B5 = PIXELFORMAT_RGB565;
var PIXELFORMAT_R5_G5_B5_A1 = PIXELFORMAT_RGBA5551;
var PIXELFORMAT_R4_G4_B4_A4 = PIXELFORMAT_RGBA4;
var PIXELFORMAT_R8_G8_B8 = PIXELFORMAT_RGB8;
var PIXELFORMAT_R8_G8_B8_A8 = PIXELFORMAT_RGBA8;
var PIXELFORMAT_SRGB = PIXELFORMAT_SRGB8;
var PIXELFORMAT_SRGBA = PIXELFORMAT_SRGBA8;
var BLENDMODE_CONSTANT_COLOR = BLENDMODE_CONSTANT;
var BLENDMODE_ONE_MINUS_CONSTANT_COLOR = BLENDMODE_ONE_MINUS_CONSTANT;
var BLENDMODE_CONSTANT_ALPHA = BLENDMODE_CONSTANT;
var BLENDMODE_ONE_MINUS_CONSTANT_ALPHA = BLENDMODE_ONE_MINUS_CONSTANT;
var _viewport = new Vec4();
function createSphere(device, opts) {
		return Mesh.fromGeometry(device, new SphereGeometry(opts));
}
function createPlane(device, opts) {
		return Mesh.fromGeometry(device, new PlaneGeometry(opts));
}
function createBox(device, opts) {
		return Mesh.fromGeometry(device, new BoxGeometry(opts));
}
function createTorus(device, opts) {
		return Mesh.fromGeometry(device, new TorusGeometry(opts));
}
function createCapsule(device, opts) {
		return Mesh.fromGeometry(device, new CapsuleGeometry(opts));
}
function createCone(device, opts) {
		return Mesh.fromGeometry(device, new ConeGeometry(opts));
}
function createCylinder(device, opts) {
		return Mesh.fromGeometry(device, new CylinderGeometry(opts));
}
function createMesh(device, positions, opts) {
		if (opts === undefined) opts = {};
		var geom = new Geometry();
		geom.positions = positions;
		geom.normals = opts.normals;
		geom.tangents = opts.tangents;
		geom.colors = opts.colors;
		geom.uvs = opts.uvs;
		geom.uvs1 = opts.uvs1;
		geom.blendIndices = opts.blendIndices;
		geom.blendWeights = opts.blendWeights;
		geom.indices = opts.indices;
		return Mesh.fromGeometry(device, geom, opts);
}
function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
		var viewport;
		if (rect) {
				var w = target ? target.width : device.width;
				var h = target ? target.height : device.height;
				viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
		}
		drawQuadWithShader(device, target, shader, viewport);
}
var deprecatedChunks = {
		'ambientPrefilteredCube.frag': 'ambientEnv.frag',
		'ambientPrefilteredCubeLod.frag': 'ambientEnv.frag',
		'dpAtlasQuad.frag': null,
		'genParaboloid.frag': null,
		'prefilterCubemap.frag': null,
		'reflectionDpAtlas.frag': 'reflectionEnv.frag',
		'reflectionPrefilteredCube.frag': 'reflectionEnv.frag',
		'reflectionPrefilteredCubeLod.frag': 'reflectionEnv.frag'
};
Object.keys(deprecatedChunks).forEach((chunkName)=>{
		Object.defineProperty(shaderChunks, chunkName, {
				get: function get() {
						return null;
				},
				set: function set() {}
		});
});
Object.defineProperties(RenderTarget.prototype, {
		_glFrameBuffer: {
				get: function get() {
						return this.impl._glFrameBuffer;
				},
				set: function set(rgbm) {}
		}
});
Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
		get: function get() {
				return null;
		}
});
Object.defineProperties(Texture.prototype, {
		rgbm: {
				get: function get() {
						return this.type === TEXTURETYPE_RGBM;
				},
				set: function set(rgbm) {
						this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
				}
		},
		swizzleGGGR: {
				get: function get() {
						return this.type === TEXTURETYPE_SWIZZLEGGGR;
				},
				set: function set(swizzleGGGR) {
						this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
				}
		},
		_glTexture: {
				get: function get() {
						return this.impl._glTexture;
				}
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'boneLimit', {
		get: function get() {
				return 1024;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'webgl2', {
		get: function get() {
				return this.isWebGL2;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'textureFloatHighPrecision', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'extBlendMinmax', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'extTextureHalfFloat', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'extTextureLod', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'textureHalfFloatFilterable', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'supportsMrt', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'supportsVolumeTextures', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'supportsInstancing', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'textureHalfFloatUpdatable', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'extTextureFloat', {
		get: function get() {
				return true;
		}
});
Object.defineProperty(GraphicsDevice.prototype, 'extStandardDerivatives', {
		get: function get() {
				return true;
		}
});
BlendState.DEFAULT = Object.freeze(new BlendState());
var _tempBlendState = new BlendState();
var _tempDepthState = new DepthState();
GraphicsDevice.prototype.setBlendFunction = function(blendSrc, blendDst) {
		var currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
		_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrc, blendDst);
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendFunctionSeparate = function(blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
		var currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
		_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrcAlpha, blendDstAlpha);
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquation = function(blendEquation) {
		var currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
		_tempBlendState.setAlphaBlend(blendEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquationSeparate = function(blendEquation, blendAlphaEquation) {
		var currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
		_tempBlendState.setAlphaBlend(blendAlphaEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setColorWrite = function(redWrite, greenWrite, blueWrite, alphaWrite) {
		var currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.getBlending = function() {
		return this.blendState.blend;
};
GraphicsDevice.prototype.setBlending = function(blending) {
		_tempBlendState.copy(this.blendState);
		_tempBlendState.blend = blending;
		this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setDepthWrite = function(write) {
		_tempDepthState.copy(this.depthState);
		_tempDepthState.write = write;
		this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthFunc = function(func) {
		_tempDepthState.copy(this.depthState);
		_tempDepthState.func = func;
		this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthTest = function(test) {
		_tempDepthState.copy(this.depthState);
		_tempDepthState.test = test;
		this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.getCullMode = function() {
		return this.cullMode;
};
var LitOptions = LitShaderOptions;
Object.defineProperty(Scene.prototype, 'defaultMaterial', {
		get: function get() {
				return getDefaultMaterial(getApplication().graphicsDevice);
		}
});
Object.defineProperty(Scene.prototype, 'fogColor', {
		set: function set(value) {
				this.fog.color = value;
		},
		get: function get() {
				return this.fog.color;
		}
});
Object.defineProperty(Scene.prototype, 'fogEnd', {
		set: function set(value) {
				this.fog.end = value;
		},
		get: function get() {
				return this.fog.end;
		}
});
Object.defineProperty(Scene.prototype, 'fogStart', {
		set: function set(value) {
				this.fog.start = value;
		},
		get: function get() {
				return this.fog.start;
		}
});
Object.defineProperty(Scene.prototype, 'fogDensity', {
		set: function set(value) {
				this.fog.density = value;
		},
		get: function get() {
				return this.fog.density;
		}
});
Object.defineProperty(Scene.prototype, 'toneMapping', {
		set: function set(value) {},
		get: function get() {
				return undefined;
		}
});
Object.defineProperty(Scene.prototype, 'gammaCorrection', {
		set: function set(value) {},
		get: function get() {
				return undefined;
		}
});
Object.defineProperty(Scene.prototype, 'rendering', {
		set: function set(value) {},
		get: function get() {
				return undefined;
		}
});
Object.defineProperty(LayerComposition.prototype, '_meshInstances', {
		get: function get() {
				return null;
		}
});
Object.defineProperty(Scene.prototype, 'drawCalls', {
		get: function get() {
				return null;
		}
});
[
		'128',
		'64',
		'32',
		'16',
		'8',
		'4'
].forEach((size, index)=>{
		Object.defineProperty(Scene.prototype, "skyboxPrefiltered" + size, {
				get: function get() {
						return this._prefilteredCubemaps[index];
				},
				set: function set(value) {
						this._prefilteredCubemaps[index] = value;
						this.updateShaders = true;
				}
		});
});
Object.defineProperty(Scene.prototype, 'models', {
		get: function get() {
				if (!this._models) {
						this._models = [];
				}
				return this._models;
		}
});
function _removedClassProperty(targetClass, name, comment) {
		Object.defineProperty(targetClass.prototype, name, {
				set: function set(value) {},
				get: function get() {
						return undefined;
				}
		});
}
_removedClassProperty(Layer, 'renderTarget');
_removedClassProperty(Layer, 'onPreCull');
_removedClassProperty(Layer, 'onPreRender');
_removedClassProperty(Layer, 'onPreRenderOpaque');
_removedClassProperty(Layer, 'onPreRenderTransparent');
_removedClassProperty(Layer, 'onPostCull');
_removedClassProperty(Layer, 'onPostRender');
_removedClassProperty(Layer, 'onPostRenderOpaque');
_removedClassProperty(Layer, 'onPostRenderTransparent');
_removedClassProperty(Layer, 'onDrawCall');
_removedClassProperty(Layer, 'layerReference');
_removedClassProperty(CameraComponent, 'onPreCull');
_removedClassProperty(CameraComponent, 'onPostCull');
_removedClassProperty(CameraComponent, 'onPreRender');
_removedClassProperty(CameraComponent, 'onPostRender');
_removedClassProperty(CameraComponent, 'onPreRenderLayer');
_removedClassProperty(CameraComponent, 'onPostRenderLayer');
ForwardRenderer.prototype.renderComposition = function(comp) {
		getApplication().renderComposition(comp);
};
MeshInstance.prototype.syncAabb = function() {};
Morph.prototype.getTarget = function(index) {
		return this.targets[index];
};
GraphNode.prototype.getChildren = function() {
		return this.children;
};
GraphNode.prototype.getName = function() {
		return this.name;
};
GraphNode.prototype.getPath = function() {
		return this.path;
};
GraphNode.prototype.getRoot = function() {
		return this.root;
};
GraphNode.prototype.getParent = function() {
		return this.parent;
};
GraphNode.prototype.setName = function(name) {
		this.name = name;
};
Object.defineProperty(Material.prototype, 'shader', {
		set: function set(value) {},
		get: function get() {
				return null;
		}
});
Object.defineProperty(Material.prototype, 'blend', {
		set: function set(value) {
				this.blendState.blend = value;
		},
		get: function get() {
				return this.blendState.blend;
		}
});
Object.defineProperty(StandardMaterial.prototype, 'shininess', {
		get: function get() {
				return this.gloss * 100;
		},
		set: function set(value) {
				this.gloss = value * 0.01;
		}
});
Object.defineProperty(StandardMaterial.prototype, 'useGammaTonemap', {
		get: function get() {
				return this.useTonemap;
		},
		set: function set(value) {
				this.useTonemap = value;
		}
});
function _defineAlias(newName, oldName) {
		Object.defineProperty(StandardMaterial.prototype, oldName, {
				get: function get() {
						return this[newName];
				},
				set: function set(value) {
						this[newName] = value;
				}
		});
}
function _deprecateTint(name) {
		Object.defineProperty(StandardMaterial.prototype, name, {
				get: function get() {
						return true;
				},
				set: function set(value) {}
		});
}
_deprecateTint('sheenTint');
_deprecateTint('diffuseTint');
_deprecateTint('emissiveTint');
_deprecateTint('ambientTint');
_defineAlias('specularTint', 'specularMapTint');
_defineAlias('aoVertexColor', 'aoMapVertexColor');
_defineAlias('diffuseVertexColor', 'diffuseMapVertexColor');
_defineAlias('specularVertexColor', 'specularMapVertexColor');
_defineAlias('emissiveVertexColor', 'emissiveMapVertexColor');
_defineAlias('metalnessVertexColor', 'metalnessMapVertexColor');
_defineAlias('glossVertexColor', 'glossMapVertexColor');
_defineAlias('opacityVertexColor', 'opacityMapVertexColor');
_defineAlias('lightVertexColor', 'lightMapVertexColor');
_defineAlias('sheenGloss', 'sheenGlossiess');
_defineAlias('clearCoatGloss', 'clearCostGlossiness');
function _defineOption(name, newName) {
		if (name !== 'pass') {
				Object.defineProperty(StandardMaterialOptions.prototype, name, {
						get: function get() {
								return this.litOptions[newName || name];
						},
						set: function set(value) {
								this.litOptions[newName || name] = value;
						}
				});
		}
}
_defineOption('refraction', 'useRefraction');
var tempOptions = new LitShaderOptions();
var litOptionProperties = Object.getOwnPropertyNames(tempOptions);
for(var litOption in litOptionProperties){
		_defineOption(litOptionProperties[litOption]);
}
AssetRegistry.prototype.getAssetById = function(id) {
		return this.get(id);
};
Object.defineProperty(XrInputSource.prototype, 'ray', {
		get: function get() {
				return this._rayLocal;
		}
});
Object.defineProperty(XrInputSource.prototype, 'position', {
		get: function get() {
				return this._localPosition;
		}
});
Object.defineProperty(XrInputSource.prototype, 'rotation', {
		get: function get() {
				return this._localRotation;
		}
});
Object.defineProperty(ElementInput.prototype, 'wheel', {
		get: function get() {
				return this.wheelDelta * -2;
		}
});
Object.defineProperty(MouseEvent.prototype, 'wheel', {
		get: function get() {
				return this.wheelDelta * -2;
		}
});
var RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;
var RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;
var RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;
var RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;
var RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;
var RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;
var RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;
var RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;
var RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;
var RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;
var RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;
AppBase.prototype.isFullscreen = function() {
		return !!document.fullscreenElement;
};
AppBase.prototype.enableFullscreen = function(element, success, error) {
		element = element || this.graphicsDevice.canvas;
		var s = function s1() {
				success();
				document.removeEventListener('fullscreenchange', s);
		};
		var e = function e1() {
				error();
				document.removeEventListener('fullscreenerror', e);
		};
		if (success) {
				document.addEventListener('fullscreenchange', s, false);
		}
		if (error) {
				document.addEventListener('fullscreenerror', e, false);
		}
		if (element.requestFullscreen) {
				element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		} else {
				error();
		}
};
AppBase.prototype.disableFullscreen = function(success) {
		var s = function s1() {
				success();
				document.removeEventListener('fullscreenchange', s);
		};
		if (success) {
				document.addEventListener('fullscreenchange', s, false);
		}
		document.exitFullscreen();
};
AppBase.prototype.getSceneUrl = function(name) {
		var entry = this.scenes.find(name);
		if (entry) {
				return entry.url;
		}
		return null;
};
AppBase.prototype.loadScene = function(url, callback) {
		this.scenes.loadScene(url, callback);
};
AppBase.prototype.loadSceneHierarchy = function(url, callback) {
		this.scenes.loadSceneHierarchy(url, callback);
};
AppBase.prototype.loadSceneSettings = function(url, callback) {
		this.scenes.loadSceneSettings(url, callback);
};
ModelComponent.prototype.setVisible = function(visible) {
		this.enabled = visible;
};
Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
		get: function get() {
				return this.type;
		},
		set: function set(type) {
				this.type = type;
		}
});
RigidBodyComponent.prototype.syncBodyToEntity = function() {
		this._updateDynamic();
};
RigidBodyComponentSystem.prototype.setGravity = function() {
		if (arguments.length === 1) {
				this.gravity.copy(arguments[0]);
		} else {
				this.gravity.set(arguments[0], arguments[1], arguments[2]);
		}
};

export { BLENDMODE_CONSTANT_ALPHA, BLENDMODE_CONSTANT_COLOR, BLENDMODE_ONE_MINUS_CONSTANT_ALPHA, BLENDMODE_ONE_MINUS_CONSTANT_COLOR, LitOptions, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, drawFullscreenQuad };
