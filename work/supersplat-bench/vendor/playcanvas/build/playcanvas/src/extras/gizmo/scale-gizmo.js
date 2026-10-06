import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { GIZMOAXIS_XYZ, GIZMOAXIS_Z, GIZMOAXIS_Y, GIZMOAXIS_X, GIZMOSPACE_LOCAL } from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';
import { BoxShape } from './shape/box-shape.js';
import { PlaneShape } from './shape/plane-shape.js';
import { BoxLineShape } from './shape/boxline-shape.js';

var tmpV1 = new Vec3();
var tmpV2 = new Vec3();
var tmpV3 = new Vec3();
var tmpQ1 = new Quat();
var GLANCE_EPSILON = 0.98;
class ScaleGizmo extends TransformGizmo {
		set coordSpace(value) {}
		get coordSpace() {
				return this._coordSpace;
		}
		set uniform(value) {
				this._useUniformScaling = value != null ? value : true;
		}
		get uniform() {
				return this._useUniformScaling;
		}
		set axisGap(value) {
				this._setArrowProp('gap', value);
		}
		get axisGap() {
				return this._shapes.x.gap;
		}
		set axisLineThickness(value) {
				this._setArrowProp('lineThickness', value);
		}
		get axisLineThickness() {
				return this._shapes.x.lineThickness;
		}
		set axisLineLength(value) {
				this._setArrowProp('lineLength', value);
		}
		get axisLineLength() {
				return this._shapes.x.lineLength;
		}
		set axisLineTolerance(value) {
				this._setArrowProp('tolerance', value);
		}
		get axisLineTolerance() {
				return this._shapes.x.tolerance;
		}
		set axisBoxSize(value) {
				this._setArrowProp('boxSize', value);
		}
		get axisBoxSize() {
				return this._shapes.x.boxSize;
		}
		set axisPlaneSize(value) {
				this._setPlaneProp('size', value);
		}
		get axisPlaneSize() {
				return this._shapes.yz.size;
		}
		set axisPlaneGap(value) {
				this._setPlaneProp('gap', value);
		}
		get axisPlaneGap() {
				return this._shapes.yz.gap;
		}
		set axisCenterSize(value) {
				this._shapes.xyz.size = value;
		}
		get axisCenterSize() {
				return this._shapes.xyz.size;
		}
		set axisCenterTolerance(value) {
				this._shapes.xyz.tolerance = value;
		}
		get axisCenterTolerance() {
				return this._shapes.xyz.tolerance;
		}
		_setArrowProp(prop, value) {
				this._shapes.x[prop] = value;
				this._shapes.y[prop] = value;
				this._shapes.z[prop] = value;
		}
		_setPlaneProp(prop, value) {
				this._shapes.yz[prop] = value;
				this._shapes.xz[prop] = value;
				this._shapes.xy[prop] = value;
		}
		_shapesLookAtCamera() {
				var facingDir = this.facing;
				var dot = facingDir.dot(this.root.right);
				this._shapes.x.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.x.flipped = dot < 0;
				}
				dot = facingDir.dot(this.root.up);
				this._shapes.y.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.y.flipped = dot < 0;
				}
				dot = facingDir.dot(this.root.forward);
				this._shapes.z.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.z.flipped = dot > 0;
				}
				tmpV1.cross(facingDir, this.root.right);
				this._shapes.yz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.yz.flipped = tmpV2.set(0, +(tmpV1.dot(this.root.forward) < 0), +(tmpV1.dot(this.root.up) < 0));
				}
				tmpV1.cross(facingDir, this.root.forward);
				this._shapes.xy.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.xy.flipped = tmpV2.set(+(tmpV1.dot(this.root.up) < 0), +(tmpV1.dot(this.root.right) > 0), 0);
				}
				tmpV1.cross(facingDir, this.root.up);
				this._shapes.xz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
				if (this.flipShapes) {
						this._shapes.xz.flipped = tmpV2.set(+(tmpV1.dot(this.root.forward) > 0), 0, +(tmpV1.dot(this.root.right) > 0));
				}
		}
		_storeNodeScales() {
				for(var i = 0; i < this.nodes.length; i++){
						var node = this.nodes[i];
						this._nodeScales.set(node, node.getLocalScale().clone());
				}
		}
		_setNodeScales(pointDelta) {
				for(var i = 0; i < this.nodes.length; i++){
						var node = this.nodes[i];
						var scale = this._nodeScales.get(node);
						if (!scale) {
								continue;
						}
						node.setLocalScale(tmpV1.copy(scale).mul(pointDelta).max(this.lowerBoundScale));
				}
		}
		_screenToPoint(x, y) {
				var gizmoPos = this.root.getPosition();
				var mouseWPos = this._camera.screenToWorld(x, y, 1);
				var axis = this._selectedAxis;
				var isPlane = this._selectedIsPlane;
				var isScaleUniform = this._useUniformScaling && isPlane || axis === GIZMOAXIS_XYZ;
				var ray = this._createRay(mouseWPos);
				var plane = this._createPlane(axis, isScaleUniform, !isPlane);
				var point = new Vec3();
				plane.intersectsRay(ray, point);
				if (isScaleUniform) {
						switch(axis){
								case GIZMOAXIS_X:
										tmpV1.copy(this.root.up);
										tmpV2.copy(this.root.forward).mulScalar(-1);
										break;
								case GIZMOAXIS_Y:
										tmpV1.copy(this.root.right);
										tmpV2.copy(this.root.forward).mulScalar(-1);
										break;
								case GIZMOAXIS_Z:
										tmpV1.copy(this.root.up);
										tmpV2.copy(this.root.right);
										break;
								default:
										tmpV1.copy(this._camera.entity.up);
										tmpV2.copy(this._camera.entity.right);
										break;
						}
						tmpV2.add(tmpV1).normalize();
						tmpV1.sub2(point, gizmoPos);
						var length = tmpV1.length();
						var v = length * tmpV1.normalize().dot(tmpV2);
						point.set(v, v, v);
						if (axis !== GIZMOAXIS_XYZ) {
								point[axis] = 1;
						}
						return point;
				}
				tmpQ1.copy(this._rootStartRot).invert().transformVector(point, point);
				if (!isPlane) {
						this._projectToAxis(point, axis);
				}
				return point;
		}
		constructor(camera, layer){
				super(camera, layer), this._shapes = {
						xyz: new BoxShape(this._device, {
								axis: GIZMOAXIS_XYZ,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								defaultColor: this._meshColors.axis.xyz,
								hoverColor: this._meshColors.hover.xyz
						}),
						yz: new PlaneShape(this._device, {
								axis: GIZMOAXIS_X,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, -90),
								defaultColor: this._meshColors.axis.x,
								hoverColor: this._meshColors.hover.x
						}),
						xz: new PlaneShape(this._device, {
								axis: GIZMOAXIS_Y,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, 0),
								defaultColor: this._meshColors.axis.y,
								hoverColor: this._meshColors.hover.y
						}),
						xy: new PlaneShape(this._device, {
								axis: GIZMOAXIS_Z,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(90, 0, 0),
								defaultColor: this._meshColors.axis.z,
								hoverColor: this._meshColors.hover.z
						}),
						x: new BoxLineShape(this._device, {
								axis: GIZMOAXIS_X,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, -90),
								defaultColor: this._meshColors.axis.x,
								hoverColor: this._meshColors.hover.x
						}),
						y: new BoxLineShape(this._device, {
								axis: GIZMOAXIS_Y,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(0, 0, 0),
								defaultColor: this._meshColors.axis.y,
								hoverColor: this._meshColors.hover.y
						}),
						z: new BoxLineShape(this._device, {
								axis: GIZMOAXIS_Z,
								layers: [
										this._layer.id
								],
								shading: this._shading,
								rotation: new Vec3(90, 0, 0),
								defaultColor: this._meshColors.axis.z,
								hoverColor: this._meshColors.hover.z
						})
				}, this._coordSpace = GIZMOSPACE_LOCAL, this._nodeScales = new Map(), this._useUniformScaling = false, this.snapIncrement = 1, this.flipShapes = true, this.lowerBoundScale = new Vec3(-Infinity, -Infinity, -Infinity);
				this._createTransform();
				this.on(TransformGizmo.EVENT_TRANSFORMSTART, ()=>{
						this._storeNodeScales();
				});
				this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point)=>{
						var pointDelta = tmpV3.copy(point).sub(this._selectionStartPoint);
						if (this.snap) {
								pointDelta.mulScalar(1 / this.snapIncrement);
								pointDelta.round();
								pointDelta.mulScalar(this.snapIncrement);
						}
						pointDelta.mulScalar(1 / this._scale);
						this._setNodeScales(pointDelta.add(Vec3.ONE));
				});
				this.on(TransformGizmo.EVENT_NODESDETACH, ()=>{
						this._nodeScales.clear();
				});
				this._app.on('prerender', ()=>{
						this._shapesLookAtCamera();
				});
		}
}

export { ScaleGizmo };
