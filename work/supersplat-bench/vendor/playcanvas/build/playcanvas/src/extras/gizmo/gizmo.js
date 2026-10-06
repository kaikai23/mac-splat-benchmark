import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Ray } from '../../core/shape/ray.js';
import { EventHandler } from '../../core/event-handler.js';
import { SORTMODE_NONE, PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { Entity } from '../../framework/entity.js';
import { Layer } from '../../scene/layer.js';
import { GIZMOSPACE_WORLD, GIZMOSPACE_LOCAL } from './constants.js';

var tmpV1 = new Vec3();
var tmpV2 = new Vec3();
var tmpM1 = new Mat4();
var tmpM2 = new Mat4();
var tmpR1 = new Ray();
var LAYER_NAME = 'Gizmo';
var MIN_SCALE = 1e-4;
var PERS_SCALE_RATIO = 0.3;
var ORTHO_SCALE_RATIO = 0.32;
var UPDATE_EPSILON = 1e-6;
class Gizmo extends EventHandler {
		static createLayer(app, layerName, layerIndex) {
				if (layerName === undefined) layerName = LAYER_NAME;
				var layer = new Layer({
						name: layerName,
						clearDepthBuffer: true,
						opaqueSortMode: SORTMODE_NONE,
						transparentSortMode: SORTMODE_NONE
				});
				app.scene.layers.insert(layer, layerIndex != null ? layerIndex : app.scene.layers.layerList.length);
				return layer;
		}
		get layer() {
				return this._layer;
		}
		set coordSpace(value) {
				this._coordSpace = value != null ? value : GIZMOSPACE_WORLD;
				this._updateRotation();
		}
		get coordSpace() {
				return this._coordSpace;
		}
		set size(value) {
				this._size = value;
				this._updateScale();
		}
		get size() {
				return this._size;
		}
		get facing() {
				if (this._camera.projection === PROJECTION_PERSPECTIVE) {
						var gizmoPos = this.root.getPosition();
						var cameraPos = this._camera.entity.getPosition();
						return tmpV2.sub2(cameraPos, gizmoPos).normalize();
				}
				return tmpV2.copy(this._camera.entity.forward).mulScalar(-1);
		}
		_onPointerDown(e) {
				if (!this.root.enabled || document.pointerLockElement) {
						return;
				}
				var selection = this._getSelection(e.offsetX, e.offsetY);
				if (selection[0]) {
						e.preventDefault();
						e.stopPropagation();
				}
				var { canvas } = this._device;
				canvas.setPointerCapture(e.pointerId);
				this.fire(Gizmo.EVENT_POINTERDOWN, e.offsetX, e.offsetY, selection[0]);
		}
		_onPointerMove(e) {
				if (!this.root.enabled || document.pointerLockElement) {
						return;
				}
				var selection = this._getSelection(e.offsetX, e.offsetY);
				if (selection[0]) {
						e.preventDefault();
						e.stopPropagation();
				}
				this.fire(Gizmo.EVENT_POINTERMOVE, e.offsetX, e.offsetY, selection[0]);
		}
		_onPointerUp(e) {
				if (!this.root.enabled || document.pointerLockElement) {
						return;
				}
				var selection = this._getSelection(e.offsetX, e.offsetY);
				if (selection[0]) {
						e.preventDefault();
						e.stopPropagation();
				}
				var { canvas } = this._device;
				canvas.releasePointerCapture(e.pointerId);
				this.fire(Gizmo.EVENT_POINTERUP, e.offsetX, e.offsetY, selection[0]);
		}
		_updatePosition() {
				tmpV1.set(0, 0, 0);
				for(var i = 0; i < this.nodes.length; i++){
						var node = this.nodes[i];
						tmpV1.add(node.getPosition());
				}
				tmpV1.mulScalar(1.0 / (this.nodes.length || 1));
				if (tmpV1.distance(this.root.getPosition()) < UPDATE_EPSILON) {
						return;
				}
				this.root.setPosition(tmpV1);
				this.fire(Gizmo.EVENT_POSITIONUPDATE, tmpV1);
		}
		_updateRotation() {
				tmpV1.set(0, 0, 0);
				if (this._coordSpace === GIZMOSPACE_LOCAL && this.nodes.length !== 0) {
						tmpV1.copy(this.nodes[this.nodes.length - 1].getEulerAngles());
				}
				if (tmpV1.distance(this.root.getEulerAngles()) < UPDATE_EPSILON) {
						return;
				}
				this.root.setEulerAngles(tmpV1);
				this.fire(Gizmo.EVENT_ROTATIONUPDATE, tmpV1);
		}
		_updateScale() {
				if (this._camera.projection === PROJECTION_PERSPECTIVE) {
						var gizmoPos = this.root.getPosition();
						var cameraPos = this._camera.entity.getPosition();
						var dist = gizmoPos.distance(cameraPos);
						this._scale = Math.tan(0.5 * this._camera.fov * math.DEG_TO_RAD) * dist * PERS_SCALE_RATIO;
				} else {
						this._scale = this._camera.orthoHeight * ORTHO_SCALE_RATIO;
				}
				this._scale = Math.max(this._scale * this._size, MIN_SCALE);
				if (Math.abs(this._scale - this.root.getLocalScale().x) < UPDATE_EPSILON) {
						return;
				}
				this.root.setLocalScale(this._scale, this._scale, this._scale);
				this.fire(Gizmo.EVENT_SCALEUPDATE, this._scale);
		}
		_getSelection(x, y) {
				var start = this._camera.screenToWorld(x, y, 0);
				var end = this._camera.screenToWorld(x, y, this._camera.farClip - this._camera.nearClip);
				var dir = tmpV1.copy(end).sub(start).normalize();
				var selection = [];
				for(var i = 0; i < this.intersectShapes.length; i++){
						var shape = this.intersectShapes[i];
						if (shape.disabled || !shape.entity.enabled) {
								continue;
						}
						var parentTM = shape.entity.getWorldTransform();
						for(var j = 0; j < shape.triData.length; j++){
								var { tris, transform, priority } = shape.triData[j];
								var triWTM = tmpM1.copy(parentTM).mul(transform);
								var invTriWTM = tmpM2.copy(triWTM).invert();
								var ray = tmpR1;
								invTriWTM.transformPoint(start, ray.origin);
								invTriWTM.transformVector(dir, ray.direction);
								ray.direction.normalize();
								for(var k = 0; k < tris.length; k++){
										if (tris[k].intersectsRay(ray, tmpV1)) {
												selection.push({
														dist: triWTM.transformPoint(tmpV1).sub(start).length(),
														meshInstances: shape.meshInstances,
														priority: priority
												});
										}
								}
						}
				}
				if (selection.length) {
						selection.sort((s0, s1)=>{
								if (s0.priority !== 0 && s1.priority !== 0) {
										return s1.priority - s0.priority;
								}
								return s0.dist - s1.dist;
						});
						return selection[0].meshInstances;
				}
				return [];
		}
		attach(nodes) {
				if (nodes === undefined) nodes = [];
				if (Array.isArray(nodes)) {
						if (nodes.length === 0) {
								return;
						}
						this.nodes = nodes;
				} else {
						this.nodes = [
								nodes
						];
				}
				this._updatePosition();
				this._updateRotation();
				this._updateScale();
				this.fire(Gizmo.EVENT_NODESATTACH);
				this.root.enabled = true;
				this.fire(Gizmo.EVENT_RENDERUPDATE);
		}
		detach() {
				this.root.enabled = false;
				this.fire(Gizmo.EVENT_RENDERUPDATE);
				this.fire(Gizmo.EVENT_NODESDETACH);
				this.nodes = [];
		}
		destroy() {
				this.detach();
				this._device.canvas.removeEventListener('pointerdown', this._onPointerDown);
				this._device.canvas.removeEventListener('pointermove', this._onPointerMove);
				this._device.canvas.removeEventListener('pointerup', this._onPointerUp);
				this.root.destroy();
		}
		constructor(camera, layer){
				super(), this._size = 1, this._scale = 1, this._coordSpace = GIZMOSPACE_WORLD, this.nodes = [], this.intersectShapes = [];
				this._camera = camera;
				this._app = camera.system.app;
				this._device = this._app.graphicsDevice;
				this._layer = layer;
				camera.layers = camera.layers.concat(layer.id);
				this.root = new Entity('gizmo');
				this._app.root.addChild(this.root);
				this.root.enabled = false;
				this._updateScale();
				this._onPointerDown = this._onPointerDown.bind(this);
				this._onPointerMove = this._onPointerMove.bind(this);
				this._onPointerUp = this._onPointerUp.bind(this);
				this._device.canvas.addEventListener('pointerdown', this._onPointerDown);
				this._device.canvas.addEventListener('pointermove', this._onPointerMove);
				this._device.canvas.addEventListener('pointerup', this._onPointerUp);
				this._app.on('update', ()=>{
						this._updatePosition();
						this._updateRotation();
						this._updateScale();
				});
				this._app.on('destroy', ()=>this.destroy());
		}
}
Gizmo.EVENT_POINTERDOWN = 'pointer:down';
Gizmo.EVENT_POINTERMOVE = 'pointer:move';
Gizmo.EVENT_POINTERUP = 'pointer:up';
Gizmo.EVENT_POSITIONUPDATE = 'position:update';
Gizmo.EVENT_ROTATIONUPDATE = 'rotation:update';
Gizmo.EVENT_SCALEUPDATE = 'scale:update';
Gizmo.EVENT_NODESATTACH = 'nodes:attach';
Gizmo.EVENT_NODESDETACH = 'nodes:detach';
Gizmo.EVENT_RENDERUPDATE = 'render:update';

export { Gizmo };
