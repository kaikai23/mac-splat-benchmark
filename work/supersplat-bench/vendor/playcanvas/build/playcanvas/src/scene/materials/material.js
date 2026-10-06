import { CULLFACE_BACK, BLENDMODE_ONE, BLENDEQUATION_REVERSE_SUBTRACT, BLENDMODE_ZERO, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDEQUATION_MIN, BLENDEQUATION_MAX } from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { BLEND_NONE, BLEND_NORMAL, BLEND_SUBTRACTIVE, BLEND_PREMULTIPLIED, BLEND_ADDITIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN, BLEND_MULTIPLICATIVE, BLEND_MIN, BLEND_MAX } from '../constants.js';
import { getDefaultMaterial } from './default-material.js';

var blendModes = [];
blendModes[BLEND_SUBTRACTIVE] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_REVERSE_SUBTRACT
};
blendModes[BLEND_NONE] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ZERO,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_NORMAL] = {
		src: BLENDMODE_SRC_ALPHA,
		dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
		op: BLENDEQUATION_ADD,
		alphaSrc: BLENDMODE_ONE
};
blendModes[BLEND_PREMULTIPLIED] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ONE_MINUS_SRC_ALPHA,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVE] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_ADDITIVEALPHA] = {
		src: BLENDMODE_SRC_ALPHA,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE2X] = {
		src: BLENDMODE_DST_COLOR,
		dst: BLENDMODE_SRC_COLOR,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_SCREEN] = {
		src: BLENDMODE_ONE_MINUS_DST_COLOR,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_MULTIPLICATIVE] = {
		src: BLENDMODE_DST_COLOR,
		dst: BLENDMODE_ZERO,
		op: BLENDEQUATION_ADD
};
blendModes[BLEND_MIN] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_MIN
};
blendModes[BLEND_MAX] = {
		src: BLENDMODE_ONE,
		dst: BLENDMODE_ONE,
		op: BLENDEQUATION_MAX
};
var id = 0;
class Material {
		set chunks(value) {
				this._dirtyShader = true;
				this._chunks = value;
		}
		get chunks() {
				this._dirtyShader = true;
				return this._chunks;
		}
		set depthBias(value) {
				this._depthState.depthBias = value;
		}
		get depthBias() {
				return this._depthState.depthBias;
		}
		set slopeDepthBias(value) {
				this._depthState.depthBiasSlope = value;
		}
		get slopeDepthBias() {
				return this._depthState.depthBiasSlope;
		}
		set redWrite(value) {
				this._blendState.redWrite = value;
		}
		get redWrite() {
				return this._blendState.redWrite;
		}
		set greenWrite(value) {
				this._blendState.greenWrite = value;
		}
		get greenWrite() {
				return this._blendState.greenWrite;
		}
		set blueWrite(value) {
				this._blendState.blueWrite = value;
		}
		get blueWrite() {
				return this._blendState.blueWrite;
		}
		set alphaWrite(value) {
				this._blendState.alphaWrite = value;
		}
		get alphaWrite() {
				return this._blendState.alphaWrite;
		}
		get transparent() {
				return this._blendState.blend;
		}
		_updateTransparency() {
				var transparent = this.transparent;
				var meshInstances = this.meshInstances;
				for(var i = 0; i < meshInstances.length; i++){
						meshInstances[i].transparent = transparent;
				}
		}
		set blendState(value) {
				this._blendState.copy(value);
				this._updateTransparency();
		}
		get blendState() {
				return this._blendState;
		}
		set blendType(type) {
				var blendMode = blendModes[type];
				this._blendState.setColorBlend(blendMode.op, blendMode.src, blendMode.dst);
				var _blendMode_alphaOp, _blendMode_alphaSrc, _blendMode_alphaDst;
				this._blendState.setAlphaBlend((_blendMode_alphaOp = blendMode.alphaOp) != null ? _blendMode_alphaOp : blendMode.op, (_blendMode_alphaSrc = blendMode.alphaSrc) != null ? _blendMode_alphaSrc : blendMode.src, (_blendMode_alphaDst = blendMode.alphaDst) != null ? _blendMode_alphaDst : blendMode.dst);
				var blend = type !== BLEND_NONE;
				if (this._blendState.blend !== blend) {
						this._blendState.blend = blend;
						this._updateTransparency();
				}
				this._updateMeshInstanceKeys();
		}
		get blendType() {
				if (!this.transparent) {
						return BLEND_NONE;
				}
				var { colorOp, colorSrcFactor, colorDstFactor, alphaOp, alphaSrcFactor, alphaDstFactor } = this._blendState;
				for(var i = 0; i < blendModes.length; i++){
						var blendMode = blendModes[i];
						if (blendMode.src === colorSrcFactor && blendMode.dst === colorDstFactor && blendMode.op === colorOp && blendMode.src === alphaSrcFactor && blendMode.dst === alphaDstFactor && blendMode.op === alphaOp) {
								return i;
						}
				}
				return BLEND_NORMAL;
		}
		set depthState(value) {
				this._depthState.copy(value);
		}
		get depthState() {
				return this._depthState;
		}
		set depthTest(value) {
				this._depthState.test = value;
		}
		get depthTest() {
				return this._depthState.test;
		}
		set depthFunc(value) {
				this._depthState.func = value;
		}
		get depthFunc() {
				return this._depthState.func;
		}
		set depthWrite(value) {
				this._depthState.write = value;
		}
		get depthWrite() {
				return this._depthState.write;
		}
		copy(source) {
				var _source_stencilFront;
				this.name = source.name;
				this.alphaTest = source.alphaTest;
				this.alphaToCoverage = source.alphaToCoverage;
				this._blendState.copy(source._blendState);
				this._depthState.copy(source._depthState);
				this.cull = source.cull;
				this.stencilFront = (_source_stencilFront = source.stencilFront) == null ? undefined : _source_stencilFront.clone();
				if (source.stencilBack) {
						this.stencilBack = source.stencilFront === source.stencilBack ? this.stencilFront : source.stencilBack.clone();
				}
				this.clearParameters();
				for(var name in source.parameters){
						if (source.parameters.hasOwnProperty(name)) {
								this._setParameterSimple(name, source.parameters[name].data);
						}
				}
				this.defines.clear();
				source.defines.forEach((value, key)=>this.defines.set(key, value));
				var srcChunks = source._chunks;
				for(var p in srcChunks){
						if (srcChunks.hasOwnProperty(p)) {
								this._chunks[p] = srcChunks[p];
						}
				}
				return this;
		}
		clone() {
				var clone = new this.constructor();
				return clone.copy(this);
		}
		_updateMeshInstanceKeys() {
				var meshInstances = this.meshInstances;
				for(var i = 0; i < meshInstances.length; i++){
						meshInstances[i].updateKey();
				}
		}
		updateUniforms(device, scene) {
				if (this._dirtyShader) {
						this.clearVariants();
				}
		}
		getShaderVariant(params) {}
		update() {
				if (this._definesDirty) {
						this._definesDirty = false;
						this.clearVariants();
				}
				this.dirty = true;
		}
		clearParameters() {
				this.parameters = {};
		}
		getParameters() {
				return this.parameters;
		}
		clearVariants() {
				this.variants.clear();
				var meshInstances = this.meshInstances;
				var count = meshInstances.length;
				for(var i = 0; i < count; i++){
						meshInstances[i].clearShaders();
				}
		}
		getParameter(name) {
				return this.parameters[name];
		}
		_setParameterSimple(name, data) {
				var param = this.parameters[name];
				if (param) {
						param.data = data;
				} else {
						this.parameters[name] = {
								scopeId: null,
								data: data
						};
				}
		}
		setParameter(name, data) {
				if (data === undefined && typeof name === 'object') {
						var uniformObject = name;
						if (uniformObject.length) {
								for(var i = 0; i < uniformObject.length; i++){
										this.setParameter(uniformObject[i]);
								}
								return;
						}
						name = uniformObject.name;
						data = uniformObject.value;
				}
				this._setParameterSimple(name, data);
		}
		deleteParameter(name) {
				if (this.parameters[name]) {
						delete this.parameters[name];
				}
		}
		setParameters(device, names) {
				var parameters = this.parameters;
				if (names === undefined) names = parameters;
				for(var paramName in names){
						var parameter = parameters[paramName];
						if (parameter) {
								if (!parameter.scopeId) {
										parameter.scopeId = device.scope.resolve(paramName);
								}
								parameter.scopeId.setValue(parameter.data);
						}
				}
		}
		setDefine(name, value) {
				var modified = false;
				var { defines } = this;
				if (value !== undefined && value !== false) {
						modified = !defines.has(name) || defines.get(name) !== value;
						defines.set(name, value);
				} else {
						modified = defines.has(name);
						defines.delete(name);
				}
				this._definesDirty || (this._definesDirty = modified);
		}
		getDefine(name) {
				return this.defines.has(name);
		}
		destroy() {
				this.variants.clear();
				for(var i = 0; i < this.meshInstances.length; i++){
						var meshInstance = this.meshInstances[i];
						meshInstance.clearShaders();
						meshInstance._material = null;
						if (meshInstance.mesh) {
								var defaultMaterial = getDefaultMaterial(meshInstance.mesh.device);
								if (this !== defaultMaterial) {
										meshInstance.material = defaultMaterial;
								}
						}
				}
				this.meshInstances.length = 0;
		}
		addMeshInstanceRef(meshInstance) {
				this.meshInstances.push(meshInstance);
		}
		removeMeshInstanceRef(meshInstance) {
				var meshInstances = this.meshInstances;
				var i = meshInstances.indexOf(meshInstance);
				if (i !== -1) {
						meshInstances.splice(i, 1);
				}
		}
		constructor(){
				this.meshInstances = [];
				this.name = 'Untitled';
				this.userId = '';
				this.id = id++;
				this.variants = new Map();
				this.defines = new Map();
				this._definesDirty = false;
				this.parameters = {};
				this.alphaTest = 0;
				this.alphaToCoverage = false;
				this._blendState = new BlendState();
				this._depthState = new DepthState();
				this.cull = CULLFACE_BACK;
				this.stencilFront = null;
				this.stencilBack = null;
				this._chunks = {};
				this._dirtyShader = true;
				this._shaderVersion = 0;
				this._scene = null;
				this.dirty = true;
				if (new.target === Material) ;
		}
}

export { Material };
