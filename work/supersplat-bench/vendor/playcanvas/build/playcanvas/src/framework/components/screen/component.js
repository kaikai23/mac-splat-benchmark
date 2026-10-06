import { Mat4 } from '../../../core/math/mat4.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Entity } from '../../entity.js';
import { SCALEMODE_NONE, SCALEMODE_BLEND } from './constants.js';
import { Component } from '../component.js';

var _transform = new Mat4();
class ScreenComponent extends Component {
		syncDrawOrder() {
				this.system.queueDrawOrderSync(this.entity.getGuid(), this._processDrawOrderSync, this);
		}
		_recurseDrawOrderSync(e, i) {
				if (!(e instanceof Entity)) {
						return i;
				}
				if (e.element) {
						var prevDrawOrder = e.element.drawOrder;
						e.element.drawOrder = i++;
						if (e.element._batchGroupId >= 0 && prevDrawOrder !== e.element.drawOrder) {
								var _this_system_app_batcher;
								(_this_system_app_batcher = this.system.app.batcher) == null ? undefined : _this_system_app_batcher.markGroupDirty(e.element._batchGroupId);
						}
				}
				if (e.particlesystem) {
						e.particlesystem.drawOrder = i++;
				}
				var children = e.children;
				for(var j = 0; j < children.length; j++){
						i = this._recurseDrawOrderSync(children[j], i);
				}
				return i;
		}
		_processDrawOrderSync() {
				var i = 1;
				this._recurseDrawOrderSync(this.entity, i);
				this.fire('syncdraworder');
		}
		_calcProjectionMatrix() {
				var w = this._resolution.x / this.scale;
				var h = this._resolution.y / this.scale;
				var left = 0;
				var right = w;
				var bottom = -h;
				var top = 0;
				var near = 1;
				var far = -1;
				this._screenMatrix.setOrtho(left, right, bottom, top, near, far);
				if (!this._screenSpace) {
						_transform.setScale(0.5 * w, 0.5 * h, 1);
						this._screenMatrix.mul2(_transform, this._screenMatrix);
				}
		}
		_updateScale() {
				this.scale = this._calcScale(this._resolution, this.referenceResolution);
		}
		_calcScale(resolution, referenceResolution) {
				var lx = Math.log2((resolution.x || 1) / referenceResolution.x);
				var ly = Math.log2((resolution.y || 1) / referenceResolution.y);
				return Math.pow(2, lx * (1 - this._scaleBlend) + ly * this._scaleBlend);
		}
		_onResize(width, height) {
				if (this._screenSpace) {
						this._resolution.set(width, height);
						this.resolution = this._resolution;
				}
		}
		_bindElement(element) {
				this._elements.add(element);
		}
		_unbindElement(element) {
				this._elements.delete(element);
		}
		onRemove() {
				this.system.app.graphicsDevice.off('resizecanvas', this._onResize, this);
				this.fire('remove');
				this._elements.forEach((element)=>element._onScreenRemove());
				this._elements.clear();
				this.off();
		}
		set resolution(value) {
				if (!this._screenSpace) {
						this._resolution.set(value.x, value.y);
				} else {
						this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
				}
				this._updateScale();
				this._calcProjectionMatrix();
				if (!this.entity._dirtyLocal) {
						this.entity._dirtifyLocal();
				}
				this.fire('set:resolution', this._resolution);
				this._elements.forEach((element)=>element._onScreenResize(this._resolution));
		}
		get resolution() {
				return this._resolution;
		}
		set referenceResolution(value) {
				this._referenceResolution.set(value.x, value.y);
				this._updateScale();
				this._calcProjectionMatrix();
				if (!this.entity._dirtyLocal) {
						this.entity._dirtifyLocal();
				}
				this.fire('set:referenceresolution', this._resolution);
				this._elements.forEach((element)=>element._onScreenResize(this._resolution));
		}
		get referenceResolution() {
				if (this._scaleMode === SCALEMODE_NONE) {
						return this._resolution;
				}
				return this._referenceResolution;
		}
		set screenSpace(value) {
				this._screenSpace = value;
				if (this._screenSpace) {
						this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
				}
				this.resolution = this._resolution;
				if (!this.entity._dirtyLocal) {
						this.entity._dirtifyLocal();
				}
				this.fire('set:screenspace', this._screenSpace);
				this._elements.forEach((element)=>element._onScreenSpaceChange());
		}
		get screenSpace() {
				return this._screenSpace;
		}
		set scaleMode(value) {
				if (value !== SCALEMODE_NONE && value !== SCALEMODE_BLEND) {
						value = SCALEMODE_NONE;
				}
				if (!this._screenSpace && value !== SCALEMODE_NONE) {
						value = SCALEMODE_NONE;
				}
				this._scaleMode = value;
				this.resolution = this._resolution;
				this.fire('set:scalemode', this._scaleMode);
		}
		get scaleMode() {
				return this._scaleMode;
		}
		set scaleBlend(value) {
				this._scaleBlend = value;
				this._updateScale();
				this._calcProjectionMatrix();
				if (!this.entity._dirtyLocal) {
						this.entity._dirtifyLocal();
				}
				this.fire('set:scaleblend', this._scaleBlend);
				this._elements.forEach((element)=>element._onScreenResize(this._resolution));
		}
		get scaleBlend() {
				return this._scaleBlend;
		}
		set priority(value) {
				if (value > 0xFF) {
						value = 0xFF;
				}
				if (this._priority === value) {
						return;
				}
				this._priority = value;
				this.syncDrawOrder();
		}
		get priority() {
				return this._priority;
		}
		constructor(system, entity){
				super(system, entity);
				this._resolution = new Vec2(640, 320);
				this._referenceResolution = new Vec2(640, 320);
				this._scaleMode = SCALEMODE_NONE;
				this.scale = 1;
				this._scaleBlend = 0.5;
				this._priority = 0;
				this._screenSpace = false;
				this.cull = this._screenSpace;
				this._screenMatrix = new Mat4();
				this._elements = new Set();
				system.app.graphicsDevice.on('resizecanvas', this._onResize, this);
		}
}

export { ScreenComponent };
