import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_R32U, SEMANTIC_ATTR13, TYPE_UINT32, BUFFER_STATIC } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';

var mat = new Mat4();
var cameraPosition = new Vec3();
var cameraDirection = new Vec3();
var viewport = [
		0,
		0
];
class GSplatInstance {
		destroy() {
				var _this_material, _this_meshInstance, _this_sorter;
				(_this_material = this.material) == null ? undefined : _this_material.destroy();
				(_this_meshInstance = this.meshInstance) == null ? undefined : _this_meshInstance.destroy();
				(_this_sorter = this.sorter) == null ? undefined : _this_sorter.destroy();
		}
		clone() {
				return new GSplatInstance(this.splat, this.options);
		}
		createMaterial(options) {
				this.material = this.splat.createMaterial(options);
				this.material.setParameter('splatOrder', this.orderTexture);
				if (this.meshInstance) {
						this.meshInstance.material = this.material;
				}
		}
		updateViewport() {
				var device = this.splat.device;
				viewport[0] = device.width;
				viewport[1] = device.height;
				if (this.cameras.length > 0) {
						var camera = this.cameras[0];
						var xr = camera.xr;
						if (xr && xr.active && xr.views.list.length === 2) {
								viewport[0] /= 2;
						}
				}
				this.material.setParameter('viewport', viewport);
		}
		sort(cameraNode) {
				if (this.sorter) {
						var cameraMat = cameraNode.getWorldTransform();
						cameraMat.getTranslation(cameraPosition);
						cameraMat.getZ(cameraDirection);
						var modelMat = this.meshInstance.node.getWorldTransform();
						var invModelMat = mat.invert(modelMat);
						invModelMat.transformPoint(cameraPosition, cameraPosition);
						invModelMat.transformVector(cameraDirection, cameraDirection);
						if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
								this.lastCameraPosition.copy(cameraPosition);
								this.lastCameraDirection.copy(cameraDirection);
								this.sorter.setCamera(cameraPosition, cameraDirection);
						}
				}
				this.updateViewport();
		}
		update() {
				if (this.cameras.length > 0) {
						var camera = this.cameras[0];
						this.sort(camera._node);
						this.cameras.length = 0;
				}
		}
		constructor(splat, options){
				this.options = {};
				this.sorter = null;
				this.lastCameraPosition = new Vec3();
				this.lastCameraDirection = new Vec3();
				this.cameras = [];
				this.splat = splat;
				options = Object.assign(this.options, options);
				var device = splat.device;
				this.orderTexture = this.splat.createTexture('splatOrder', PIXELFORMAT_R32U, this.splat.evalTextureSize(this.splat.numSplats));
				this.createMaterial(options);
				var splatInstanceSize = 128;
				var numSplats = Math.ceil(splat.numSplats / splatInstanceSize) * splatInstanceSize;
				var numSplatInstances = numSplats / splatInstanceSize;
				var indexData = new Uint32Array(numSplatInstances);
				for(var i = 0; i < numSplatInstances; ++i){
						indexData[i] = i * splatInstanceSize;
				}
				var vertexFormat = new VertexFormat(device, [
						{
								semantic: SEMANTIC_ATTR13,
								components: 1,
								type: TYPE_UINT32,
								asInt: true
						}
				]);
				var indicesVB = new VertexBuffer(device, vertexFormat, numSplatInstances, {
						usage: BUFFER_STATIC,
						data: indexData.buffer
				});
				var meshPositions = new Float32Array(12 * splatInstanceSize);
				var meshIndices = new Uint32Array(6 * splatInstanceSize);
				for(var i1 = 0; i1 < splatInstanceSize; ++i1){
						meshPositions.set([
								-1,
								-1,
								i1,
								1,
								-1,
								i1,
								1,
								1,
								i1,
								-1,
								1,
								i1
						], i1 * 12);
						var b = i1 * 4;
						meshIndices.set([
								0 + b,
								1 + b,
								2 + b,
								0 + b,
								2 + b,
								3 + b
						], i1 * 6);
				}
				var mesh = new Mesh(device);
				mesh.setPositions(meshPositions, 3);
				mesh.setIndices(meshIndices);
				mesh.update();
				this.mesh = mesh;
				this.mesh.aabb.copy(splat.aabb);
				this.meshInstance = new MeshInstance(this.mesh, this.material);
				this.meshInstance.setInstancing(indicesVB, true);
				this.meshInstance.gsplatInstance = this;
				this.meshInstance.instancingCount = 0;
				this.centers = new Float32Array(splat.centers);
				if (!options.dither || options.dither === DITHER_NONE) {
						this.sorter = new GSplatSorter();
						this.sorter.init(this.orderTexture, this.centers);
						this.sorter.on('updated', (count)=>{
								this.meshInstance.instancingCount = Math.ceil(count / splatInstanceSize);
								this.material.setParameter('numSplats', count);
						});
				}
		}
}

export { GSplatInstance };
