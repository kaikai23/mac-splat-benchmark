import { Curve } from '../../core/math/curve.js';
import { CurveSet } from '../../core/math/curve-set.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { FILTER_LINEAR, PRIMITIVE_TRIANGLES, CULLFACE_NONE, SEMANTIC_ATTR0, TYPE_FLOAT32, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, BUFFER_DYNAMIC, INDEXFORMAT_UINT32, SEMANTIC_TEXCOORD0, typedArrayIndexFormats, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8, PIXELFORMAT_RGBA32F, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { EMITTERSHAPE_BOX, PARTICLESORT_NONE, PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD, PARTICLEMODE_GPU, BLEND_NORMAL } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ParticleCPUUpdater } from './cpu-updater.js';
import { ParticleGPUUpdater } from './gpu-updater.js';
import { ParticleMaterial } from './particle-material.js';

var particleVerts = [
		[
				-1,
				-1
		],
		[
				1,
				-1
		],
		[
				1,
				1
		],
		[
				-1,
				1
		]
];
function _createTexture(device, width, height, pixelData, format, mult8Bit, filter) {
		if (format === undefined) format = PIXELFORMAT_RGBA32F;
		var mipFilter = FILTER_NEAREST;
		if (filter && (format === PIXELFORMAT_RGBA8 || format === PIXELFORMAT_SRGBA8)) {
				mipFilter = FILTER_LINEAR;
		}
		var texture = new Texture(device, {
				width: width,
				height: height,
				format: format,
				cubemap: false,
				mipmaps: false,
				minFilter: mipFilter,
				magFilter: mipFilter,
				addressU: ADDRESS_CLAMP_TO_EDGE,
				addressV: ADDRESS_CLAMP_TO_EDGE,
				name: 'ParticleSystemTexture'
		});
		var pixels = texture.lock();
		if (format === PIXELFORMAT_RGBA8 || format === PIXELFORMAT_SRGBA8) {
				var temp = new Uint8Array(pixelData.length);
				for(var i = 0; i < pixelData.length; i++){
						temp[i] = pixelData[i] * mult8Bit * 255;
				}
				pixelData = temp;
		}
		pixels.set(pixelData);
		texture.unlock();
		return texture;
}
function saturate(x) {
		return Math.max(Math.min(x, 1), 0);
}
var default0Curve = new Curve([
		0,
		0,
		1,
		0
]);
var default1Curve = new Curve([
		0,
		1,
		1,
		1
]);
var default0Curve3 = new CurveSet([
		0,
		0,
		1,
		0
], [
		0,
		0,
		1,
		0
], [
		0,
		0,
		1,
		0
]);
var default1Curve3 = new CurveSet([
		0,
		1,
		1,
		1
], [
		0,
		1,
		1,
		1
], [
		0,
		1,
		1,
		1
]);
var particleTexHeight = 2;
var particleTexChannels = 4;
var extentsInnerRatioUniform = new Float32Array(3);
var spawnMatrix = new Mat4();
var tmpVec3 = new Vec3();
var bMin = new Vec3();
var bMax = new Vec3();
var setPropertyTarget;
var setPropertyOptions;
function setProperty(pName, defaultVal) {
		if (setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
				setPropertyTarget[pName] = setPropertyOptions[pName];
		} else {
				setPropertyTarget[pName] = defaultVal;
		}
}
function pack3NFloats(a, b, c) {
		var packed = a * 255 << 16 | b * 255 << 8 | c * 255;
		return packed / (1 << 24);
}
function packTextureXYZ_NXYZ(qXYZ, qXYZ2) {
		var num = qXYZ.length / 3;
		var colors = new Array(num * 4);
		for(var i = 0; i < num; i++){
				colors[i * 4] = qXYZ[i * 3];
				colors[i * 4 + 1] = qXYZ[i * 3 + 1];
				colors[i * 4 + 2] = qXYZ[i * 3 + 2];
				colors[i * 4 + 3] = pack3NFloats(qXYZ2[i * 3], qXYZ2[i * 3 + 1], qXYZ2[i * 3 + 2]);
		}
		return colors;
}
function packTextureRGBA(qRGB, qA) {
		var colors = new Array(qA.length * 4);
		for(var i = 0; i < qA.length; i++){
				colors[i * 4] = qRGB[i * 3];
				colors[i * 4 + 1] = qRGB[i * 3 + 1];
				colors[i * 4 + 2] = qRGB[i * 3 + 2];
				colors[i * 4 + 3] = qA[i];
		}
		return colors;
}
function packTexture5Floats(qA, qB, qC, qD, qE) {
		var colors = new Array(qA.length * 4);
		for(var i = 0; i < qA.length; i++){
				colors[i * 4] = qA[i];
				colors[i * 4 + 1] = qB[i];
				colors[i * 4 + 2] = 0;
				colors[i * 4 + 3] = pack3NFloats(qC[i], qD[i], qE[i]);
		}
		return colors;
}
function packTexture2Floats(qA, qB) {
		var colors = new Array(qA.length * 4);
		for(var i = 0; i < qA.length; i++){
				colors[i * 4] = qA[i];
				colors[i * 4 + 1] = qB[i];
				colors[i * 4 + 2] = 0;
				colors[i * 4 + 3] = 0;
		}
		return colors;
}
function calcEndTime(emitter) {
		var interval = Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime;
		return Date.now() + interval * 1000;
}
function subGraph(A, B) {
		var r = new Float32Array(A.length);
		for(var i = 0; i < A.length; i++){
				r[i] = A[i] - B[i];
		}
		return r;
}
function maxUnsignedGraphValue(A, outUMax) {
		var chans = outUMax.length;
		var values = A.length / chans;
		for(var i = 0; i < values; i++){
				for(var j = 0; j < chans; j++){
						var a = Math.abs(A[i * chans + j]);
						outUMax[j] = Math.max(outUMax[j], a);
				}
		}
}
function normalizeGraph(A, uMax) {
		var chans = uMax.length;
		var values = A.length / chans;
		for(var i = 0; i < values; i++){
				for(var j = 0; j < chans; j++){
						A[i * chans + j] /= uMax[j] === 0 ? 1 : uMax[j];
						A[i * chans + j] *= 0.5;
						A[i * chans + j] += 0.5;
				}
		}
}
function divGraphFrom2Curves(curve1, curve2, outUMax) {
		var sub = subGraph(curve2, curve1);
		maxUnsignedGraphValue(sub, outUMax);
		normalizeGraph(sub, outUMax);
		return sub;
}
var particleEmitterDeviceCache = new DeviceCache();
class ParticleEmitter {
		get defaultParamTexture() {
				return particleEmitterDeviceCache.get(this.graphicsDevice, ()=>{
						var resolution = 16;
						var centerPoint = resolution * 0.5 + 0.5;
						var dtex = new Float32Array(resolution * resolution * 4);
						for(var y = 0; y < resolution; y++){
								for(var x = 0; x < resolution; x++){
										var xgrad = x + 1 - centerPoint;
										var ygrad = y + 1 - centerPoint;
										var c = saturate(1 - saturate(Math.sqrt(xgrad * xgrad + ygrad * ygrad) / resolution) - 0.5);
										var p = y * resolution + x;
										dtex[p * 4] = 1;
										dtex[p * 4 + 1] = 1;
										dtex[p * 4 + 2] = 1;
										dtex[p * 4 + 3] = c;
								}
						}
						var texture = _createTexture(this.graphicsDevice, resolution, resolution, dtex, PIXELFORMAT_SRGBA8, 1.0, true);
						texture.minFilter = FILTER_LINEAR;
						texture.magFilter = FILTER_LINEAR;
						return texture;
				});
		}
		onChangeCamera() {
				this.resetMaterial();
		}
		calculateBoundsMad() {
				this.worldBoundsMul.x = 1.0 / this.worldBoundsSize.x;
				this.worldBoundsMul.y = 1.0 / this.worldBoundsSize.y;
				this.worldBoundsMul.z = 1.0 / this.worldBoundsSize.z;
				this.worldBoundsAdd.copy(this.worldBounds.center).mul(this.worldBoundsMul).mulScalar(-1);
				this.worldBoundsAdd.x += 0.5;
				this.worldBoundsAdd.y += 0.5;
				this.worldBoundsAdd.z += 0.5;
		}
		calculateWorldBounds() {
				if (!this.node) return;
				this.prevWorldBoundsSize.copy(this.worldBoundsSize);
				this.prevWorldBoundsCenter.copy(this.worldBounds.center);
				if (!this.useCpu) {
						var recalculateLocalBounds = false;
						if (this.emitterShape === EMITTERSHAPE_BOX) {
								recalculateLocalBounds = !this.emitterExtents.equals(this.prevEmitterExtents);
						} else {
								recalculateLocalBounds = !(this.emitterRadius === this.prevEmitterRadius);
						}
						if (recalculateLocalBounds) {
								this.calculateLocalBounds();
						}
				}
				var nodeWT = this.node.getWorldTransform();
				if (this.localSpace) {
						this.worldBoundsNoTrail.copy(this.localBounds);
				} else {
						this.worldBoundsNoTrail.setFromTransformedAabb(this.localBounds, nodeWT);
				}
				this.worldBoundsTrail[0].add(this.worldBoundsNoTrail);
				this.worldBoundsTrail[1].add(this.worldBoundsNoTrail);
				var now = this.simTimeTotal;
				if (now >= this.timeToSwitchBounds) {
						this.worldBoundsTrail[0].copy(this.worldBoundsTrail[1]);
						this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
						this.timeToSwitchBounds = now + this.lifetime;
				}
				this.worldBounds.copy(this.worldBoundsTrail[0]);
				this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
				if (this.localSpace) {
						this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
						this.meshInstance.mesh.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
				} else {
						this.meshInstance.aabb.copy(this.worldBounds);
						this.meshInstance.mesh.aabb.copy(this.worldBounds);
				}
				this.meshInstance._aabbVer = 1 - this.meshInstance._aabbVer;
				if (this.pack8) this.calculateBoundsMad();
		}
		resetWorldBounds() {
				if (!this.node) return;
				this.worldBoundsNoTrail.setFromTransformedAabb(this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());
				this.worldBoundsTrail[0].copy(this.worldBoundsNoTrail);
				this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
				this.worldBounds.copy(this.worldBoundsTrail[0]);
				this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
				this.prevWorldBoundsSize.copy(this.worldBoundsSize);
				this.prevWorldBoundsCenter.copy(this.worldBounds.center);
				this.simTimeTotal = 0;
				this.timeToSwitchBounds = 0;
		}
		calculateLocalBounds() {
				var minx = Number.MAX_VALUE;
				var miny = Number.MAX_VALUE;
				var minz = Number.MAX_VALUE;
				var maxx = -Number.MAX_VALUE;
				var maxy = -Number.MAX_VALUE;
				var maxz = -Number.MAX_VALUE;
				var maxR = 0;
				var maxScale = 0;
				var stepWeight = this.lifetime / this.precision;
				var wVels = [
						this.qVelocity,
						this.qVelocity2
				];
				var lVels = [
						this.qLocalVelocity,
						this.qLocalVelocity2
				];
				var accumX = [
						0,
						0
				];
				var accumY = [
						0,
						0
				];
				var accumZ = [
						0,
						0
				];
				var accumR = [
						0,
						0
				];
				var accumW = [
						0,
						0
				];
				var x, y, z;
				for(var i = 0; i < this.precision + 1; i++){
						var index = Math.min(i, this.precision - 1);
						for(var j = 0; j < 2; j++){
								x = lVels[j][index * 3 + 0] * stepWeight + accumX[j];
								y = lVels[j][index * 3 + 1] * stepWeight + accumY[j];
								z = lVels[j][index * 3 + 2] * stepWeight + accumZ[j];
								minx = Math.min(x, minx);
								miny = Math.min(y, miny);
								minz = Math.min(z, minz);
								maxx = Math.max(x, maxx);
								maxy = Math.max(y, maxy);
								maxz = Math.max(z, maxz);
								accumX[j] = x;
								accumY[j] = y;
								accumZ[j] = z;
						}
						for(var j1 = 0; j1 < 2; j1++){
								accumW[j1] += stepWeight * Math.sqrt(wVels[j1][index * 3 + 0] * wVels[j1][index * 3 + 0] + wVels[j1][index * 3 + 1] * wVels[j1][index * 3 + 1] + wVels[j1][index * 3 + 2] * wVels[j1][index * 3 + 2]);
						}
						accumR[0] += this.qRadialSpeed[index] * stepWeight;
						accumR[1] += this.qRadialSpeed2[index] * stepWeight;
						maxR = Math.max(maxR, Math.max(Math.abs(accumR[0]), Math.abs(accumR[1])));
						maxScale = Math.max(maxScale, this.qScale[index]);
				}
				if (this.emitterShape === EMITTERSHAPE_BOX) {
						x = this.emitterExtents.x * 0.5;
						y = this.emitterExtents.y * 0.5;
						z = this.emitterExtents.z * 0.5;
				} else {
						x = this.emitterRadius;
						y = this.emitterRadius;
						z = this.emitterRadius;
				}
				var w = Math.max(accumW[0], accumW[1]);
				bMin.x = minx - maxScale - x - maxR - w;
				bMin.y = miny - maxScale - y - maxR - w;
				bMin.z = minz - maxScale - z - maxR - w;
				bMax.x = maxx + maxScale + x + maxR + w;
				bMax.y = maxy + maxScale + y + maxR + w;
				bMax.z = maxz + maxScale + z + maxR + w;
				this.localBounds.setMinMax(bMin, bMax);
		}
		rebuild() {
				var gd = this.graphicsDevice;
				if (this.colorMap === null) this.colorMap = this.defaultParamTexture;
				this.spawnBounds = this.emitterShape === EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;
				this.useCpu = this.useCpu || this.sort > PARTICLESORT_NONE || gd.maxVertexTextures <= 1 || gd.fragmentUniformsCount < 64 || gd.forceCpuParticles;
				this._destroyResources();
				this.pack8 = (this.pack8 || !gd.textureFloatRenderable) && !this.useCpu;
				particleTexHeight = this.useCpu || this.pack8 ? 4 : 2;
				this.useMesh = !!this.mesh;
				this.numParticlesPot = math.nextPowerOfTwo(this.numParticles);
				this.rebuildGraphs();
				this.calculateLocalBounds();
				this.resetWorldBounds();
				if (this.node) {
						this.worldBounds.setFromTransformedAabb(this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());
						this.worldBoundsTrail[0].copy(this.worldBounds);
						this.worldBoundsTrail[1].copy(this.worldBounds);
						this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
						this.prevWorldBoundsSize.copy(this.worldBoundsSize);
						this.prevWorldBoundsCenter.copy(this.worldBounds.center);
						if (this.pack8) this.calculateBoundsMad();
				}
				this.vbToSort = new Array(this.numParticles);
				for(var iSort = 0; iSort < this.numParticles; iSort++)this.vbToSort[iSort] = [
						0,
						0
				];
				this.particleDistance = new Float32Array(this.numParticles);
				this._gpuUpdater.randomize();
				this.particleTex = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
				var emitterPos = this.node === null || this.localSpace ? Vec3.ZERO : this.node.getPosition();
				if (this.emitterShape === EMITTERSHAPE_BOX) {
						if (this.node === null || this.localSpace) {
								spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.spawnBounds);
						} else {
								spawnMatrix.setTRS(Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.localScale));
						}
						extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
						extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
						extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
				}
				for(var i = 0; i < this.numParticles; i++){
						this._cpuUpdater.calcSpawnPosition(this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, i);
						if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1;
				}
				this.particleTexStart = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
				for(var i1 = 0; i1 < this.particleTexStart.length; i1++){
						this.particleTexStart[i1] = this.particleTex[i1];
				}
				if (!this.useCpu) {
						if (this.pack8) {
								this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_RGBA8, 1, false);
								this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_RGBA8, 1, false);
								this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, PIXELFORMAT_RGBA8, 1, false);
						} else {
								this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
								this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
								this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart);
						}
						this.rtParticleTexIN = new RenderTarget({
								colorBuffer: this.particleTexIN,
								depth: false
						});
						this.rtParticleTexOUT = new RenderTarget({
								colorBuffer: this.particleTexOUT,
								depth: false
						});
						this.swapTex = false;
				}
				var shaderCodeStart = (this.localSpace ? '#define LOCAL_SPACE\n' : '') + shaderChunks.particleUpdaterInitPS + (this.pack8 ? shaderChunks.particleInputRgba8PS + shaderChunks.particleOutputRgba8PS : shaderChunks.particleInputFloatPS + shaderChunks.particleOutputFloatPS) + (this.emitterShape === EMITTERSHAPE_BOX ? shaderChunks.particleUpdaterAABBPS : shaderChunks.particleUpdaterSpherePS) + shaderChunks.particleUpdaterStartPS;
				var shaderCodeRespawn = shaderCodeStart + shaderChunks.particleUpdaterRespawnPS + shaderChunks.particleUpdaterEndPS;
				var shaderCodeNoRespawn = shaderCodeStart + shaderChunks.particleUpdaterNoRespawnPS + shaderChunks.particleUpdaterEndPS;
				var shaderCodeOnStop = shaderCodeStart + shaderChunks.particleUpdaterOnStopPS + shaderChunks.particleUpdaterEndPS;
				var params = "Shape:" + this.emitterShape + "-Pack:" + this.pack8 + "-Local:" + this.localSpace;
				this.shaderParticleUpdateRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeRespawn, "ParticleUpdateRespawn-" + params);
				this.shaderParticleUpdateNoRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeNoRespawn, "ParticleUpdateNoRespawn-" + params);
				this.shaderParticleUpdateOnStop = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeOnStop, "ParticleUpdateStop-" + params);
				this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
				this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
				this._allocate(this.numParticles);
				var mesh = new Mesh(gd);
				mesh.vertexBuffer = this.vertexBuffer;
				mesh.indexBuffer[0] = this.indexBuffer;
				mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
				mesh.primitive[0].base = 0;
				mesh.primitive[0].count = this.numParticles * this.numParticleIndices;
				mesh.primitive[0].indexed = true;
				this.material = this._createMaterial();
				this.resetMaterial();
				var wasVisible = this.meshInstance ? this.meshInstance.visible : true;
				this.meshInstance = new MeshInstance(mesh, this.material, this.node);
				this.meshInstance.pick = false;
				this.meshInstance.updateKey();
				this.meshInstance.cull = true;
				if (this.localSpace) {
						this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, this.node.getWorldTransform());
				} else {
						this.meshInstance.aabb.copy(this.worldBounds);
				}
				this.meshInstance._updateAabb = false;
				this.meshInstance.visible = wasVisible;
				this._setMaterialTextures();
				this.resetTime();
				this.addTime(0, false);
				if (this.preWarm) this.prewarm(this.lifetime);
		}
		_isAnimated() {
				return this.animNumFrames >= 1 && (this.animTilesX > 1 || this.animTilesY > 1) && (this.colorMap && this.colorMap !== this.defaultParamTexture || this.normalMap);
		}
		rebuildGraphs() {
				var precision = this.precision;
				var gd = this.graphicsDevice;
				this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
				this.qVelocity = this.velocityGraph.quantize(precision);
				this.qColor = this.colorGraph.quantizeClamped(precision, 0, 1);
				this.qRotSpeed = this.rotationSpeedGraph.quantize(precision);
				this.qScale = this.scaleGraph.quantize(precision);
				this.qAlpha = this.alphaGraph.quantize(precision);
				this.qRadialSpeed = this.radialSpeedGraph.quantize(precision);
				this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
				this.qVelocity2 = this.velocityGraph2.quantize(precision);
				this.qColor2 = this.colorGraph2.quantizeClamped(precision, 0, 1);
				this.qRotSpeed2 = this.rotationSpeedGraph2.quantize(precision);
				this.qScale2 = this.scaleGraph2.quantize(precision);
				this.qAlpha2 = this.alphaGraph2.quantize(precision);
				this.qRadialSpeed2 = this.radialSpeedGraph2.quantize(precision);
				for(var i = 0; i < precision; i++){
						this.qRotSpeed[i] *= math.DEG_TO_RAD;
						this.qRotSpeed2[i] *= math.DEG_TO_RAD;
				}
				this.localVelocityUMax = new Float32Array(3);
				this.velocityUMax = new Float32Array(3);
				this.colorUMax = new Float32Array(3);
				this.rotSpeedUMax = [
						0
				];
				this.scaleUMax = [
						0
				];
				this.alphaUMax = [
						0
				];
				this.radialSpeedUMax = [
						0
				];
				this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax);
				this.qVelocityDiv = divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax);
				this.qColorDiv = divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax);
				this.qRotSpeedDiv = divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
				this.qScaleDiv = divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
				this.qAlphaDiv = divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);
				this.qRadialSpeedDiv = divGraphFrom2Curves(this.qRadialSpeed, this.qRadialSpeed2, this.radialSpeedUMax);
				if (this.pack8) {
						var umax = [
								0,
								0,
								0
						];
						maxUnsignedGraphValue(this.qVelocity, umax);
						var umax2 = [
								0,
								0,
								0
						];
						maxUnsignedGraphValue(this.qVelocity2, umax2);
						var lumax = [
								0,
								0,
								0
						];
						maxUnsignedGraphValue(this.qLocalVelocity, lumax);
						var lumax2 = [
								0,
								0,
								0
						];
						maxUnsignedGraphValue(this.qLocalVelocity2, lumax2);
						var rumax = [
								0
						];
						maxUnsignedGraphValue(this.qRadialSpeed, rumax);
						var rumax2 = [
								0
						];
						maxUnsignedGraphValue(this.qRadialSpeed2, rumax2);
						var maxVel = Math.max(umax[0], umax2[0]);
						maxVel = Math.max(maxVel, umax[1]);
						maxVel = Math.max(maxVel, umax2[1]);
						maxVel = Math.max(maxVel, umax[2]);
						maxVel = Math.max(maxVel, umax2[2]);
						var lmaxVel = Math.max(lumax[0], lumax2[0]);
						lmaxVel = Math.max(lmaxVel, lumax[1]);
						lmaxVel = Math.max(lmaxVel, lumax2[1]);
						lmaxVel = Math.max(lmaxVel, lumax[2]);
						lmaxVel = Math.max(lmaxVel, lumax2[2]);
						var maxRad = Math.max(rumax[0], rumax2[0]);
						this.maxVel = maxVel + lmaxVel + maxRad;
				}
				if (!this.useCpu) {
						this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
						this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
						this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv));
						this.internalTex3 = _createTexture(gd, precision, 1, packTexture2Floats(this.qRadialSpeed, this.qRadialSpeedDiv));
				}
				this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), PIXELFORMAT_SRGBA8, 1.0, true);
		}
		_setMaterialTextures() {
				if (this.colorMap) {
						this.material.setParameter('colorMap', this.colorMap);
						if (this.lighting && this.normalMap) {
								this.material.setParameter('normalMap', this.normalMap);
						}
				}
		}
		_createMaterial() {
				var material = new ParticleMaterial(this);
				material.name = "EmitterMaterial:" + this.node.name;
				material.cull = CULLFACE_NONE;
				material.alphaWrite = false;
				material.blendType = this.blendType;
				material.depthWrite = this.depthWrite;
				return material;
		}
		resetMaterial() {
				var material = this.material;
				material.setParameter('stretch', this.stretch);
				if (this._isAnimated()) {
						material.setParameter('animTexTilesParams', this.animTilesParams);
						material.setParameter('animTexParams', this.animParams);
						material.setParameter('animTexIndexParams', this.animIndexParams);
				}
				material.setParameter('colorMult', this.intensity);
				if (!this.useCpu) {
						material.setParameter('internalTex0', this.internalTex0);
						material.setParameter('internalTex1', this.internalTex1);
						material.setParameter('internalTex2', this.internalTex2);
						material.setParameter('internalTex3', this.internalTex3);
				}
				material.setParameter('colorParam', this.colorParam);
				material.setParameter('numParticles', this.numParticles);
				material.setParameter('numParticlesPot', this.numParticlesPot);
				material.setParameter('lifetime', this.lifetime);
				material.setParameter('rate', this.rate);
				material.setParameter('rateDiv', this.rate2 - this.rate);
				material.setParameter('seed', this.seed);
				material.setParameter('scaleDivMult', this.scaleUMax[0]);
				material.setParameter('alphaDivMult', this.alphaUMax[0]);
				material.setParameter('radialSpeedDivMult', this.radialSpeedUMax[0]);
				material.setParameter('graphNumSamples', this.precision);
				material.setParameter('graphSampleSize', 1.0 / this.precision);
				material.setParameter('emitterScale', new Float32Array([
						1,
						1,
						1
				]));
				if (this.pack8) {
						this._gpuUpdater._setInputBounds();
						material.setParameter('inBoundsSize', this._gpuUpdater.inBoundsSizeUniform);
						material.setParameter('inBoundsCenter', this._gpuUpdater.inBoundsCenterUniform);
						material.setParameter('maxVel', this.maxVel);
				}
				if (this.wrap && this.wrapBounds) {
						this.wrapBoundsUniform[0] = this.wrapBounds.x;
						this.wrapBoundsUniform[1] = this.wrapBounds.y;
						this.wrapBoundsUniform[2] = this.wrapBounds.z;
						material.setParameter('wrapBounds', this.wrapBoundsUniform);
				}
				this._setMaterialTextures();
				if (this.depthSoftening > 0) {
						material.setParameter('softening', 1.0 / (this.depthSoftening * this.depthSoftening * 100));
				}
				if (this.stretch > 0.0) material.cull = CULLFACE_NONE;
				this._compParticleFaceParams();
		}
		_compParticleFaceParams() {
				var tangent, binormal;
				if (this.orientation === PARTICLEORIENTATION_SCREEN) {
						tangent = new Float32Array([
								1,
								0,
								0
						]);
						binormal = new Float32Array([
								0,
								0,
								1
						]);
				} else {
						var n;
						if (this.orientation === PARTICLEORIENTATION_WORLD) {
								n = this.particleNormal.normalize();
						} else {
								var emitterMat = this.node === null ? Mat4.IDENTITY : this.node.getWorldTransform();
								n = emitterMat.transformVector(this.particleNormal).normalize();
						}
						var t = new Vec3(1, 0, 0);
						if (Math.abs(t.dot(n)) === 1) {
								t.set(0, 0, 1);
						}
						var b = new Vec3().cross(n, t).normalize();
						t.cross(b, n).normalize();
						tangent = new Float32Array([
								t.x,
								t.y,
								t.z
						]);
						binormal = new Float32Array([
								b.x,
								b.y,
								b.z
						]);
				}
				this.material.setParameter('faceTangent', tangent);
				this.material.setParameter('faceBinorm', binormal);
		}
		_allocate(numParticles) {
				var psysVertCount = numParticles * this.numParticleVerts;
				var psysIndexCount = numParticles * this.numParticleIndices;
				if (this.vertexBuffer === undefined || this.vertexBuffer.getNumVertices() !== psysVertCount) {
						var elements = [];
						if (!this.useCpu) {
								elements.push({
										semantic: SEMANTIC_ATTR0,
										components: 4,
										type: TYPE_FLOAT32
								});
								if (this.useMesh) {
										elements.push({
												semantic: SEMANTIC_ATTR1,
												components: 2,
												type: TYPE_FLOAT32
										});
								}
						} else {
								elements.push({
										semantic: SEMANTIC_ATTR0,
										components: 4,
										type: TYPE_FLOAT32
								}, {
										semantic: SEMANTIC_ATTR1,
										components: 4,
										type: TYPE_FLOAT32
								}, {
										semantic: SEMANTIC_ATTR2,
										components: 4,
										type: TYPE_FLOAT32
								}, {
										semantic: SEMANTIC_ATTR3,
										components: 1,
										type: TYPE_FLOAT32
								}, {
										semantic: SEMANTIC_ATTR4,
										components: this.useMesh ? 4 : 2,
										type: TYPE_FLOAT32
								});
						}
						var vertexFormat = new VertexFormat(this.graphicsDevice, elements);
						this.vertexBuffer = new VertexBuffer(this.graphicsDevice, vertexFormat, psysVertCount, {
								usage: BUFFER_DYNAMIC
						});
						this.indexBuffer = new IndexBuffer(this.graphicsDevice, INDEXFORMAT_UINT32, psysIndexCount);
						var data = new Float32Array(this.vertexBuffer.lock());
						var meshData, stride, texCoordOffset;
						if (this.useMesh) {
								meshData = new Float32Array(this.mesh.vertexBuffer.lock());
								stride = meshData.length / this.mesh.vertexBuffer.numVertices;
								for(var elem = 0; elem < this.mesh.vertexBuffer.format.elements.length; elem++){
										if (this.mesh.vertexBuffer.format.elements[elem].name === SEMANTIC_TEXCOORD0) {
												texCoordOffset = this.mesh.vertexBuffer.format.elements[elem].offset / 4;
												break;
										}
								}
						}
						for(var i = 0; i < psysVertCount; i++){
								var id = Math.floor(i / this.numParticleVerts);
								if (!this.useMesh) {
										var vertID = i % 4;
										data[i * 4] = particleVerts[vertID][0];
										data[i * 4 + 1] = particleVerts[vertID][1];
										data[i * 4 + 2] = 0;
										data[i * 4 + 3] = id;
								} else {
										var vert = i % this.numParticleVerts;
										data[i * 6] = meshData[vert * stride];
										data[i * 6 + 1] = meshData[vert * stride + 1];
										data[i * 6 + 2] = meshData[vert * stride + 2];
										data[i * 6 + 3] = id;
										data[i * 6 + 4] = meshData[vert * stride + texCoordOffset + 0];
										data[i * 6 + 5] = 1.0 - meshData[vert * stride + texCoordOffset + 1];
								}
						}
						if (this.useCpu) {
								this.vbCPU = new Float32Array(data);
								this.vbOld = new Float32Array(this.vbCPU.length);
						}
						this.vertexBuffer.unlock();
						if (this.useMesh) {
								this.mesh.vertexBuffer.unlock();
						}
						var dst = 0;
						var indices = new Uint32Array(this.indexBuffer.lock());
						if (this.useMesh) {
								var ib = this.mesh.indexBuffer[0];
								meshData = new typedArrayIndexFormats[ib.format](ib.lock());
						}
						for(var i1 = 0; i1 < numParticles; i1++){
								if (!this.useMesh) {
										var baseIndex = i1 * 4;
										indices[dst++] = baseIndex;
										indices[dst++] = baseIndex + 1;
										indices[dst++] = baseIndex + 2;
										indices[dst++] = baseIndex;
										indices[dst++] = baseIndex + 2;
										indices[dst++] = baseIndex + 3;
								} else {
										for(var j = 0; j < this.numParticleIndices; j++){
												indices[i1 * this.numParticleIndices + j] = meshData[j] + i1 * this.numParticleVerts;
										}
								}
						}
						this.indexBuffer.unlock();
						if (this.useMesh) this.mesh.indexBuffer[0].unlock();
				}
		}
		reset() {
				this.beenReset = true;
				this.seed = Math.random();
				this.material.setParameter('seed', this.seed);
				if (this.useCpu) {
						for(var i = 0; i < this.particleTexStart.length; i++){
								this.particleTex[i] = this.particleTexStart[i];
						}
				} else {
						this._setMaterialTextures();
				}
				this.resetWorldBounds();
				this.resetTime();
				var origLoop = this.loop;
				this.loop = true;
				this.addTime(0, false);
				this.loop = origLoop;
				if (this.preWarm) {
						this.prewarm(this.lifetime);
				}
		}
		prewarm(time) {
				var lifetimeFraction = time / this.lifetime;
				var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
				var stepDelta = time / iterations;
				for(var i = 0; i < iterations; i++){
						this.addTime(stepDelta, false);
				}
		}
		resetTime() {
				this.endTime = calcEndTime(this);
		}
		finishFrame() {
				if (this.useCpu) this.vertexBuffer.unlock();
		}
		addTime(delta, isOnStop) {
				var device = this.graphicsDevice;
				this.simTimeTotal += delta;
				this.calculateWorldBounds();
				if (this._isAnimated()) {
						var tilesParams = this.animTilesParams;
						tilesParams[0] = 1.0 / this.animTilesX;
						tilesParams[1] = 1.0 / this.animTilesY;
						var params = this.animParams;
						params[0] = this.animStartFrame;
						params[1] = this.animNumFrames * this.animSpeed;
						params[2] = this.animNumFrames - 1;
						params[3] = this.animNumAnimations - 1;
						var animIndexParams = this.animIndexParams;
						animIndexParams[0] = this.animIndex;
						animIndexParams[1] = this.randomizeAnimIndex;
				}
				if (this.scene) {
						if (this.camera !== this.scene._activeCamera) {
								this.camera = this.scene._activeCamera;
								this.onChangeCamera();
						}
				}
				if (this.emitterShape === EMITTERSHAPE_BOX) {
						extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
						extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
						extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
						if (this.meshInstance.node === null) {
								spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.emitterExtents);
						} else {
								spawnMatrix.setTRS(Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.localScale));
						}
				}
				var emitterPos;
				var emitterScale = this.meshInstance.node === null ? Vec3.ONE : this.meshInstance.node.localScale;
				this.emitterScaleUniform[0] = emitterScale.x;
				this.emitterScaleUniform[1] = emitterScale.y;
				this.emitterScaleUniform[2] = emitterScale.z;
				this.material.setParameter('emitterScale', this.emitterScaleUniform);
				if (this.localSpace && this.meshInstance.node) {
						emitterPos = this.meshInstance.node.getPosition();
						this.emitterPosUniform[0] = emitterPos.x;
						this.emitterPosUniform[1] = emitterPos.y;
						this.emitterPosUniform[2] = emitterPos.z;
						this.material.setParameter('emitterPos', this.emitterPosUniform);
				}
				this._compParticleFaceParams();
				if (!this.useCpu) {
						this._gpuUpdater.update(device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop);
				} else {
						var data = new Float32Array(this.vertexBuffer.lock());
						this._cpuUpdater.update(data, this.vbToSort, this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, delta, isOnStop);
				}
				if (!this.loop) {
						if (Date.now() > this.endTime) {
								if (this.onFinished) this.onFinished();
								this.meshInstance.visible = false;
						}
				}
				if (this.meshInstance) {
						this.meshInstance.drawOrder = this.drawOrder;
				}
		}
		_destroyResources() {
				var _this_particleTexIN, _this_particleTexOUT, _this_rtParticleTexIN, _this_rtParticleTexOUT, _this_internalTex0, _this_internalTex1, _this_internalTex2, _this_internalTex3, _this_colorParam, _this_vertexBuffer, _this_indexBuffer, _this_material;
				(_this_particleTexIN = this.particleTexIN) == null ? undefined : _this_particleTexIN.destroy();
				this.particleTexIN = null;
				(_this_particleTexOUT = this.particleTexOUT) == null ? undefined : _this_particleTexOUT.destroy();
				this.particleTexOUT = null;
				if (this.particleTexStart && this.particleTexStart.destroy) {
						this.particleTexStart.destroy();
						this.particleTexStart = null;
				}
				(_this_rtParticleTexIN = this.rtParticleTexIN) == null ? undefined : _this_rtParticleTexIN.destroy();
				this.rtParticleTexIN = null;
				(_this_rtParticleTexOUT = this.rtParticleTexOUT) == null ? undefined : _this_rtParticleTexOUT.destroy();
				this.rtParticleTexOUT = null;
				(_this_internalTex0 = this.internalTex0) == null ? undefined : _this_internalTex0.destroy();
				this.internalTex0 = null;
				(_this_internalTex1 = this.internalTex1) == null ? undefined : _this_internalTex1.destroy();
				this.internalTex1 = null;
				(_this_internalTex2 = this.internalTex2) == null ? undefined : _this_internalTex2.destroy();
				this.internalTex2 = null;
				(_this_internalTex3 = this.internalTex3) == null ? undefined : _this_internalTex3.destroy();
				this.internalTex3 = null;
				(_this_colorParam = this.colorParam) == null ? undefined : _this_colorParam.destroy();
				this.colorParam = null;
				(_this_vertexBuffer = this.vertexBuffer) == null ? undefined : _this_vertexBuffer.destroy();
				this.vertexBuffer = undefined;
				(_this_indexBuffer = this.indexBuffer) == null ? undefined : _this_indexBuffer.destroy();
				this.indexBuffer = undefined;
				(_this_material = this.material) == null ? undefined : _this_material.destroy();
				this.material = null;
		}
		destroy() {
				this.camera = null;
				this._destroyResources();
		}
		constructor(graphicsDevice, options){
				this.material = null;
				this.internalTex0 = null;
				this.internalTex1 = null;
				this.internalTex2 = null;
				this.colorParam = null;
				this.graphicsDevice = graphicsDevice;
				var gd = graphicsDevice;
				var precision = 32;
				this.precision = precision;
				this._addTimeTime = 0;
				setPropertyTarget = this;
				setPropertyOptions = options;
				setProperty('numParticles', 1);
				if (this.numParticles > graphicsDevice.maxTextureSize) {
						this.numParticles = graphicsDevice.maxTextureSize;
				}
				setProperty('rate', 1);
				setProperty('rate2', this.rate);
				setProperty('lifetime', 50);
				setProperty('emitterExtents', new Vec3(0, 0, 0));
				setProperty('emitterExtentsInner', new Vec3(0, 0, 0));
				setProperty('emitterRadius', 0);
				setProperty('emitterRadiusInner', 0);
				setProperty('emitterShape', EMITTERSHAPE_BOX);
				setProperty('initialVelocity', 1);
				setProperty('wrap', false);
				setProperty('localSpace', false);
				setProperty('screenSpace', false);
				setProperty('wrapBounds', null);
				setProperty('colorMap', this.defaultParamTexture);
				setProperty('normalMap', null);
				setProperty('loop', true);
				setProperty('preWarm', false);
				setProperty('sort', PARTICLESORT_NONE);
				setProperty('mode', PARTICLEMODE_GPU);
				setProperty('scene', null);
				setProperty('lighting', false);
				setProperty('halfLambert', false);
				setProperty('intensity', 1.0);
				setProperty('stretch', 0.0);
				setProperty('alignToMotion', false);
				setProperty('depthSoftening', 0);
				setProperty('mesh', null);
				setProperty('particleNormal', new Vec3(0, 1, 0));
				setProperty('orientation', PARTICLEORIENTATION_SCREEN);
				setProperty('depthWrite', false);
				setProperty('noFog', false);
				setProperty('blendType', BLEND_NORMAL);
				setProperty('node', null);
				setProperty('startAngle', 0);
				setProperty('startAngle2', this.startAngle);
				setProperty('animTilesX', 1);
				setProperty('animTilesY', 1);
				setProperty('animStartFrame', 0);
				setProperty('animNumFrames', 1);
				setProperty('animNumAnimations', 1);
				setProperty('animIndex', 0);
				setProperty('randomizeAnimIndex', false);
				setProperty('animSpeed', 1);
				setProperty('animLoop', true);
				this._gpuUpdater = new ParticleGPUUpdater(this, gd);
				this._cpuUpdater = new ParticleCPUUpdater(this);
				this.emitterPosUniform = new Float32Array(3);
				this.wrapBoundsUniform = new Float32Array(3);
				this.emitterScaleUniform = new Float32Array([
						1,
						1,
						1
				]);
				setProperty('colorGraph', default1Curve3);
				setProperty('colorGraph2', this.colorGraph);
				setProperty('scaleGraph', default1Curve);
				setProperty('scaleGraph2', this.scaleGraph);
				setProperty('alphaGraph', default1Curve);
				setProperty('alphaGraph2', this.alphaGraph);
				setProperty('localVelocityGraph', default0Curve3);
				setProperty('localVelocityGraph2', this.localVelocityGraph);
				setProperty('velocityGraph', default0Curve3);
				setProperty('velocityGraph2', this.velocityGraph);
				setProperty('rotationSpeedGraph', default0Curve);
				setProperty('rotationSpeedGraph2', this.rotationSpeedGraph);
				setProperty('radialSpeedGraph', default0Curve);
				setProperty('radialSpeedGraph2', this.radialSpeedGraph);
				this.animTilesParams = new Float32Array(2);
				this.animParams = new Float32Array(4);
				this.animIndexParams = new Float32Array(2);
				this.vbToSort = null;
				this.vbOld = null;
				this.particleDistance = null;
				this.camera = null;
				this.swapTex = false;
				this.useMesh = true;
				this.useCpu = !graphicsDevice.supportsGpuParticles;
				this.pack8 = true;
				this.localBounds = new BoundingBox();
				this.worldBoundsNoTrail = new BoundingBox();
				this.worldBoundsTrail = [
						new BoundingBox(),
						new BoundingBox()
				];
				this.worldBounds = new BoundingBox();
				this.worldBoundsSize = new Vec3();
				this.prevWorldBoundsSize = new Vec3();
				this.prevWorldBoundsCenter = new Vec3();
				this.prevEmitterExtents = this.emitterExtents;
				this.prevEmitterRadius = this.emitterRadius;
				this.worldBoundsMul = new Vec3();
				this.worldBoundsAdd = new Vec3();
				this.timeToSwitchBounds = 0;
				this.shaderParticleUpdateRespawn = null;
				this.shaderParticleUpdateNoRespawn = null;
				this.shaderParticleUpdateOnStop = null;
				this.numParticleVerts = 0;
				this.numParticleIndices = 0;
				this.material = null;
				this.meshInstance = null;
				this.drawOrder = 0;
				this.seed = Math.random();
				this.fixedTimeStep = 1.0 / 60;
				this.maxSubSteps = 10;
				this.simTime = 0;
				this.simTimeTotal = 0;
				this.beenReset = false;
				this._layer = null;
				this.rebuild();
		}
}

export { ParticleEmitter };
