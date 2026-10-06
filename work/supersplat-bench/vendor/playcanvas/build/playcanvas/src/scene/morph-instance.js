import { BLENDEQUATION_ADD, BLENDMODE_ONE } from '../platform/graphics/constants.js';
import { drawQuadWithShader } from './graphics/quad-render-utils.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { createShaderFromCode } from './shader-lib/utils.js';
import { BlendState } from '../platform/graphics/blend-state.js';

var textureMorphVertexShader = "\n	attribute vec2 vertex_position;\n	varying vec2 uv0;\n	void main(void) {\n		gl_Position = vec4(vertex_position, 0.5, 1.0);\n		uv0 = vertex_position.xy * 0.5 + 0.5;\n	}\n	";
var blendStateAdditive = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
class MorphInstance {
		destroy() {
				this.shader = null;
				var morph = this.morph;
				if (morph) {
						this.morph = null;
						morph.decRefCount();
						if (morph.refCount < 1) {
								morph.destroy();
						}
				}
				if (this.rtPositions) {
						this.rtPositions.destroy();
						this.rtPositions = null;
				}
				if (this.texturePositions) {
						this.texturePositions.destroy();
						this.texturePositions = null;
				}
				if (this.rtNormals) {
						this.rtNormals.destroy();
						this.rtNormals = null;
				}
				if (this.textureNormals) {
						this.textureNormals.destroy();
						this.textureNormals = null;
				}
		}
		clone() {
				return new MorphInstance(this.morph);
		}
		_getWeightIndex(key) {
				if (typeof key === 'string') {
						var index = this._weightMap.get(key);
						return index;
				}
				return key;
		}
		getWeight(key) {
				var index = this._getWeightIndex(key);
				return this._weights[index];
		}
		setWeight(key, weight) {
				var index = this._getWeightIndex(key);
				this._weights[index] = weight;
				this._dirty = true;
		}
		_getFragmentShader(numTextures) {
				var textureDecl = '';
				var addingCode = '';
				for(var i = 0; i < numTextures; i++){
						textureDecl += "uniform highp sampler2D morphBlendTex" + i + ";";
						addingCode += "color.xyz += morphFactor[" + i + "] * texture2D(morphBlendTex" + i + ", uv0).xyz;";
				}
				return "\n\n            varying vec2 uv0;\n            " + (this.morph.intRenderFormat ? '#define MORPH_INT' : '') + "\n            " + (numTextures > 0 ? "uniform highp float morphFactor[" + numTextures + "];" : '') + "\n            " + textureDecl + "\n\n            #ifdef MORPH_INT\n                uniform vec3 aabbSize;\n                uniform vec3 aabbMin;\n            #endif\n\n            void main (void) {\n                highp vec4 color = vec4(0, 0, 0, 1);\n\n                " + addingCode + "\n\n                #ifdef MORPH_INT\n                    color.xyz = (color.xyz - aabbMin) / aabbSize * 65535.0;\n                    gl_FragColor = uvec4(color);\n                #else\n                    gl_FragColor = color;\n                #endif\n            }\n        ";
		}
		_getShader(count) {
				var shader = this.shaderCache[count];
				if (!shader) {
						var fs = this._getFragmentShader(count);
						var outputType = this.morph.intRenderFormat ? 'uvec4' : 'vec4';
						shader = createShaderFromCode(this.device, textureMorphVertexShader, fs, "textureMorph" + count, undefined, {
								fragmentOutputTypes: [
										outputType
								]
						});
						this.shaderCache[count] = shader;
				}
				return shader;
		}
		_updateTextureRenderTarget(renderTarget, srcTextureName, isPos) {
				var device = this.device;
				var submitBatch = (usedCount, blending)=>{
						this.morphFactor.setValue(this._shaderMorphWeights);
						device.setBlendState(blending ? blendStateAdditive : BlendState.NOBLEND);
						var shader = this._getShader(usedCount);
						drawQuadWithShader(device, renderTarget, shader);
				};
				this.setAabbUniforms(isPos);
				var usedCount = 0;
				var blending = false;
				var count = this._activeTargets.length;
				for(var i = 0; i < count; i++){
						var activeTarget = this._activeTargets[i];
						var tex = activeTarget.target[srcTextureName];
						if (tex) {
								this["morphBlendTex" + usedCount].setValue(tex);
								this._shaderMorphWeights[usedCount] = activeTarget.weight;
								usedCount++;
								if (usedCount >= this.maxSubmitCount) {
										submitBatch(usedCount, blending);
										usedCount = 0;
										blending = true;
								}
						}
				}
				if (usedCount > 0 || count === 0 && !this.zeroTextures) {
						submitBatch(usedCount, blending);
				}
		}
		_updateTextureMorph() {
				this.device;
				if (this._activeTargets.length > 0 || !this.zeroTextures) {
						if (this.rtPositions) {
								this._updateTextureRenderTarget(this.rtPositions, 'texturePositions', true);
						}
						if (this.rtNormals) {
								this._updateTextureRenderTarget(this.rtNormals, 'textureNormals', false);
						}
						this.zeroTextures = this._activeTargets.length === 0;
				}
		}
		setAabbUniforms(isPos) {
				if (isPos === undefined) isPos = true;
				this.aabbSizeId.setValue(isPos ? this._aabbSize : this._aabbNrmSize);
				this.aabbMinId.setValue(isPos ? this._aabbMin : this._aabbNrmMin);
		}
		prepareRendering(device) {
				this.setAabbUniforms();
		}
		update() {
				this._dirty = false;
				var targets = this.morph._targets;
				var activeCount = 0;
				var epsilon = 0.00001;
				for(var i = 0; i < targets.length; i++){
						var absWeight = Math.abs(this.getWeight(i));
						if (absWeight > epsilon) {
								if (this._activeTargets.length <= activeCount) {
										this._activeTargets[activeCount] = {};
								}
								var activeTarget = this._activeTargets[activeCount++];
								activeTarget.absWeight = absWeight;
								activeTarget.weight = this.getWeight(i);
								activeTarget.target = targets[i];
						}
				}
				this._activeTargets.length = activeCount;
				if (this.morph.intRenderFormat) {
						if (this._activeTargets.length > this.maxSubmitCount) {
								this._activeTargets.sort((l, r)=>{
										return l.absWeight < r.absWeight ? 1 : r.absWeight < l.absWeight ? -1 : 0;
								});
								this._activeTargets.length = this.maxSubmitCount;
						}
				}
				this._updateTextureMorph();
		}
		constructor(morph){
				this.shaderCache = [];
				this.morph = morph;
				morph.incRefCount();
				this.device = morph.device;
				this._weights = [];
				this._weightMap = new Map();
				for(var v = 0; v < morph._targets.length; v++){
						var target = morph._targets[v];
						if (target.name) {
								this._weightMap.set(target.name, v);
						}
						this.setWeight(v, target.defaultWeight);
				}
				this._activeTargets = [];
				this.maxSubmitCount = this.device.maxTextures;
				this._shaderMorphWeights = new Float32Array(this.maxSubmitCount);
				var createRT = (name, textureVar)=>{
						this[textureVar] = morph._createTexture(name, morph._renderTextureFormat);
						return new RenderTarget({
								colorBuffer: this[textureVar],
								depth: false
						});
				};
				if (morph.morphPositions) {
						this.rtPositions = createRT('MorphRTPos', 'texturePositions');
				}
				if (morph.morphNormals) {
						this.rtNormals = createRT('MorphRTNrm', 'textureNormals');
				}
				this._textureParams = new Float32Array([
						morph.morphTextureWidth,
						morph.morphTextureHeight
				]);
				var halfSize = morph.aabb.halfExtents;
				this._aabbSize = new Float32Array([
						halfSize.x * 4,
						halfSize.y * 4,
						halfSize.z * 4
				]);
				var min = morph.aabb.getMin();
				this._aabbMin = new Float32Array([
						min.x * 2,
						min.y * 2,
						min.z * 2
				]);
				this._aabbNrmSize = new Float32Array([
						2,
						2,
						2
				]);
				this._aabbNrmMin = new Float32Array([
						-1,
						-1,
						-1
				]);
				this.aabbSizeId = this.device.scope.resolve('aabbSize');
				this.aabbMinId = this.device.scope.resolve('aabbMin');
				for(var i = 0; i < this.maxSubmitCount; i++){
						this["morphBlendTex" + i] = this.device.scope.resolve("morphBlendTex" + i);
				}
				this.morphFactor = this.device.scope.resolve('morphFactor[0]');
				this.zeroTextures = false;
		}
}

export { MorphInstance };
