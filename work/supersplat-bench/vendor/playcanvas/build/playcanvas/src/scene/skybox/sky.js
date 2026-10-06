import { Vec3 } from '../../core/math/vec3.js';
import { SKYTYPE_INFINITE } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { SkyMesh } from './sky-mesh.js';

class Sky {
		applySettings(render) {
				var _render_skyType;
				this.type = (_render_skyType = render.skyType) != null ? _render_skyType : SKYTYPE_INFINITE;
				var _render_skyMeshPosition;
				this.node.setLocalPosition(new Vec3((_render_skyMeshPosition = render.skyMeshPosition) != null ? _render_skyMeshPosition : [
						0,
						0,
						0
				]));
				var _render_skyMeshRotation;
				this.node.setLocalEulerAngles(new Vec3((_render_skyMeshRotation = render.skyMeshRotation) != null ? _render_skyMeshRotation : [
						0,
						0,
						0
				]));
				var _render_skyMeshScale;
				this.node.setLocalScale(new Vec3((_render_skyMeshScale = render.skyMeshScale) != null ? _render_skyMeshScale : [
						1,
						1,
						1
				]));
				if (render.skyCenter) {
						this._center = new Vec3(render.skyCenter);
				}
		}
		set type(value) {
				if (this._type !== value) {
						this._type = value;
						this.scene.updateShaders = true;
						this.updateSkyMesh();
				}
		}
		get type() {
				return this._type;
		}
		set center(value) {
				this._center.copy(value);
		}
		get center() {
				return this._center;
		}
		updateSkyMesh() {
				var texture = this.scene._getSkyboxTex();
				if (texture) {
						this.resetSkyMesh();
						this.skyMesh = new SkyMesh(this.device, this.scene, this.node, texture, this.type);
						this.scene.fire('set:skybox', texture);
				}
		}
		resetSkyMesh() {
				var _this_skyMesh;
				(_this_skyMesh = this.skyMesh) == null ? undefined : _this_skyMesh.destroy();
				this.skyMesh = null;
		}
		update() {
				if (this.type !== SKYTYPE_INFINITE) {
						var { center, centerArray } = this;
						var temp = new Vec3();
						this.node.getWorldTransform().transformPoint(center, temp);
						centerArray[0] = temp.x;
						centerArray[1] = temp.y;
						centerArray[2] = temp.z;
						this.projectedSkydomeCenterId.setValue(centerArray);
				}
		}
		constructor(scene){
				this._type = SKYTYPE_INFINITE;
				this._center = new Vec3(0, 1, 0);
				this.skyMesh = null;
				this.node = new GraphNode('SkyMeshNode');
				this.device = scene.device;
				this.scene = scene;
				this.center = new Vec3(0, 1, 0);
				this.centerArray = new Float32Array(3);
				this.projectedSkydomeCenterId = this.device.scope.resolve('projectedSkydomeCenter');
		}
}

export { Sky };
