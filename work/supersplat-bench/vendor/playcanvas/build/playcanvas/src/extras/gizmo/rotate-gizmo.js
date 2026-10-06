import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { ArcShape } from './shape/arc-shape.js';
import { GIZMOSPACE_LOCAL, GIZMOAXIS_FACE, GIZMOAXIS_Z, GIZMOAXIS_X, GIZMOAXIS_Y } from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';

var tmpV1 = new Vec3();
var tmpV2 = new Vec3();
var tmpV3 = new Vec3();
var tmpV4 = new Vec3();
var tmpM1 = new Mat4();
var tmpQ1 = new Quat();
var tmpQ2 = new Quat();
var FACING_THRESHOLD = 0.9;
var GUIDE_ANGLE_COLOR = new Color(0, 0, 0, 0.3);
class RotateGizmo extends TransformGizmo {
		set xyzTubeRadius(value) {
				this._setDiskProp('tubeRadius', value);
		}
		get xyzTubeRadius() {
				return this._shapes.x.tubeRadius;
		}
		set xyzRingRadius(value) {
				this._setDiskProp('ringRadius', value);
		}
		get xyzRingRadius() {
				return this._shapes.x.ringRadius;
		}
		set faceTubeRadius(value) {
				this._shapes.face.tubeRadius = value;
		}
		get faceTubeRadius() {
				return this._shapes.face.tubeRadius;
		}
		set faceRingRadius(value) {
				this._shapes.face.ringRadius = value;
		}
		get faceRingRadius() {
				return this._shapes.face.ringRadius;
		}
		set ringTolerance(value) {
				this._setDiskProp('tolerance', value);
				this._shapes.face.tolerance = value;
		}
		get ringTolerance() {
				return this._shapes.x.tolerance;
		}
		_setDiskProp(prop, value) {
				this._shapes.x[prop] = value;
				this._shapes.y[prop] = value;
				this._shapes.z[prop] = value;
		}
		_storeGuidePoints() {
				var gizmoPos = this.root.getPosition();
				var axis = this._selectedAxis;
				var isFacing = axis === GIZMOAXIS_FACE;
				var scale = isFacing ? this.faceRingRadius : this.xyzRingRadius;
				this._guideAngleStart.copy(this._selectionStartPoint).sub(gizmoPos).normalize();
				this._guideAngleStart.mulScalar(scale);
				this._guideAngleEnd.copy(this._guideAngleStart);
		}
		_updateGuidePoints(angleDelta) {
				var axis = this._selectedAxis;
				var isFacing = axis === GIZMOAXIS_FACE;
				if (isFacing) {
						tmpV1.copy(this.facing);
				} else {
						tmpV1.set(0, 0, 0);
						tmpV1[axis] = 1;
						this._rootStartRot.transformVector(tmpV1, tmpV1);
				}
				tmpQ1.setFromAxisAngle(tmpV1, angleDelta);
				tmpQ1.transformVector(this._guideAngleStart, this._guideAngleEnd);
		}
		_drawGuideAngleLine(pos, axis, point, color) {
				if (color === undefined) color = this._guideColors[axis];
				tmpV1.set(0, 0, 0);
				tmpV2.copy(point).mulScalar(this._scale);
				this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), color, false, this._layer);
		}
		_getLookAtEulerAngles(position) {
				tmpV1.set(0, 0, 0);
				tmpM1.setLookAt(tmpV1, position, Vec3.UP);
				tmpQ1.setFromMat4(tmpM1);
				tmpQ1.getEulerAngles(tmpV1);
				tmpV1.x += 90;
				return tmpV1;
		}
		_shapesLookAtCamera() {
				if (this._camera.projection === PROJECTION_PERSPECTIVE) {
						this._shapes.face.entity.lookAt(this._camera.entity.getPosition());
						this._shapes.face.entity.rotateLocal(90, 0, 0);
				} else {
						tmpQ1.copy(this._camera.entity.getRotation()).getEulerAngles(tmpV1);
						this._shapes.face.entity.setEulerAngles(tmpV1);
						this._shapes.face.entity.rotateLocal(-90, 0, 0);
				}
				var facingDir = tmpV1.copy(this.facing);
				tmpQ1.copy(this.root.getRotation()).invert().transformVector(facingDir, facingDir);
				var angle = Math.atan2(facingDir.z, facingDir.y) * math.RAD_TO_DEG;
				this._shapes.x.entity.setLocalEulerAngles(0, angle - 90, -90);
				angle = Math.atan2(facingDir.x, facingDir.z) * math.RAD_TO_DEG;
				this._shapes.y.entity.setLocalEulerAngles(0, angle, 0);
				angle = Math.atan2(facingDir.y, facingDir.x) * math.RAD_TO_DEG;
				this._shapes.z.entity.setLocalEulerAngles(90, 0, angle + 90);
		}
		_drag(state) {
				for(var axis in this._shapes){
						var shape = this._shapes[axis];
						if (axis === this._selectedAxis) {
								shape.drag(state);
						} else {
								shape.hide(state);
						}
				}
				this.fire(TransformGizmo.EVENT_RENDERUPDATE);
		}
		_storeNodeRotations() {
				var gizmoPos = this.root.getPosition();
				for(var i = 0; i < this.nodes.length; i++){
						var node = this.nodes[i];
						this._nodeLocalRotations.set(node, node.getLocalRotation().clone());
						this._nodeRotations.set(node, node.getRotation().clone());
						this._nodeOffsets.set(node, node.getPosition().clone().sub(gizmoPos));
				}
		}
		_setNodeRotations(axis, angleDelta) {
				var gizmoPos = this.root.getPosition();
				var isFacing = axis === GIZMOAXIS_FACE;
				tmpQ1.setFromAxisAngle(this._dirFromAxis(axis, tmpV1), angleDelta);
				for(var i = 0; i < this.nodes.length; i++){
						var node = this.nodes[i];
						if (!isFacing && this._coordSpace === GIZMOSPACE_LOCAL) {
								var rot = this._nodeLocalRotations.get(node);
								if (!rot) {
										continue;
								}
								tmpQ2.copy(rot).mul(tmpQ1);
								node.setLocalRotation(tmpQ2);
						} else {
								var rot1 = this._nodeRotations.get(node);
								if (!rot1) {
										continue;
								}
								var offset = this._nodeOffsets.get(node);
								if (!offset) {
										continue;
								}
								tmpV1.copy(offset);
								tmpQ1.transformVector(tmpV1, tmpV1);
								tmpQ2.copy(tmpQ1).mul(rot1);
								node.setEulerAngles(tmpQ2.getEulerAngles());
								node.setPosition(tmpV1.add(gizmoPos));
						}
				}
				if (this._coordSpace === GIZMOSPACE_LOCAL) {
						this._updateRotation();
				}
		}
		_screenToPoint(x, y) {
				var mouseWPos = this._camera.screenToWorld(x, y, 1);
				var axis = this._selectedAxis;
				var ray = this._createRay(mouseWPos);
				var plane = this._createPlane(axis, axis === GIZMOAXIS_FACE, false);
				var point = new Vec3();
				plane.intersectsRay(ray, point);
				return point;
		}
		_calculateAngle(point, x, y) {
				var gizmoPos = this.root.getPosition();
				var axis = this._selectedAxis;
				var plane = this._createPlane(axis, axis === GIZMOAXIS_FACE, false);
				var angle = 0;
				var facingDir = tmpV2.copy(this.facing);
				var facingDot = plane.normal.dot(facingDir);
				if (this.orbitRotation || Math.abs(facingDot) > FACING_THRESHOLD) {
						tmpV1.sub2(point, gizmoPos);
						tmpQ1.copy(this._camera.entity.getRotation()).invert().transformVector(tmpV1, tmpV1);
						angle = Math.sign(facingDot) * Math.atan2(tmpV1.y, tmpV1.x) * math.RAD_TO_DEG;
				} else {
						tmpV1.copy(gizmoPos);
						tmpV2.cross(plane.normal, facingDir).normalize().add(gizmoPos);
						this._camera.worldToScreen(tmpV1, tmpV3);
						this._camera.worldToScreen(tmpV2, tmpV4);
						tmpV1.sub2(tmpV4, tmpV3).normalize();
						tmpV2.set(x, y, 0);
						angle = tmpV1.dot(tmpV2);
				}
				return angle;
		}
		constructor(camera, layer){
				super(camera, layer), this._shapes = {
						z: new ArcShape(this._device, {
								axis: GIZMOAXIS_Z,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(90, 0, 90),
								defaultColor: this._meshColors.axis.z,
								hoverColor: this._meshColors.hover.z,
								sectorAngle: 180
						}),
						x: new ArcShape(this._device, {
								axis: GIZMOAXIS_X,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, -90),
								defaultColor: this._meshColors.axis.x,
								hoverColor: this._meshColors.hover.x,
								sectorAngle: 180
						}),
						y: new ArcShape(this._device, {
								axis: GIZMOAXIS_Y,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, 0),
								defaultColor: this._meshColors.axis.y,
								hoverColor: this._meshColors.hover.y,
								sectorAngle: 180
						}),
						face: new ArcShape(this._device, {
								axis: GIZMOAXIS_FACE,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: this._getLookAtEulerAngles(this._camera.entity.getPosition()),
								defaultColor: this._meshColors.axis.f,
								hoverColor: this._meshColors.hover.f,
								ringRadius: 0.55
						})
				}, this._selectionStartAngle = 0, this._nodeLocalRotations = new Map(), this._nodeRotations = new Map(), this._nodeOffsets = new Map(), this._guideAngleStartColor = GUIDE_ANGLE_COLOR.clone(), this._guideAngleStart = new Vec3(), this._guideAngleEnd = new Vec3(), this.snapIncrement = 5, this.orbitRotation = false;
				this._createTransform();
				this.on(TransformGizmo.EVENT_TRANSFORMSTART, (point, x, y)=>{
						this._selectionStartAngle = this._calculateAngle(point, x, y);
						this._storeNodeRotations();
						this._storeGuidePoints();
						this._drag(true);
				});
				this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point, x, y)=>{
						var axis = this._selectedAxis;
						var angleDelta = this._calculateAngle(point, x, y) - this._selectionStartAngle;
						if (this.snap) {
								angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
						}
						this._setNodeRotations(axis, angleDelta);
						this._updateGuidePoints(angleDelta);
				});
				this.on(TransformGizmo.EVENT_TRANSFORMEND, ()=>{
						this._drag(false);
				});
				this.on(TransformGizmo.EVENT_NODESDETACH, ()=>{
						this._nodeLocalRotations.clear();
						this._nodeRotations.clear();
						this._nodeOffsets.clear();
				});
				this._app.on('prerender', ()=>{
						this._shapesLookAtCamera();
						if (this._dragging) {
								var gizmoPos = this.root.getPosition();
								this._drawGuideAngleLine(gizmoPos, this._selectedAxis, this._guideAngleStart, this._guideAngleStartColor);
								this._drawGuideAngleLine(gizmoPos, this._selectedAxis, this._guideAngleEnd);
						}
				});
		}
}

export { RotateGizmo };
