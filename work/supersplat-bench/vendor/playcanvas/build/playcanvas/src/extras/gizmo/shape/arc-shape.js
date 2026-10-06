import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

var TORUS_RENDER_SEGMENTS = 80;
var TORUS_INTERSECT_SEGMENTS = 20;
class ArcShape extends Shape {
		_createTorusGeometry() {
				return new TorusGeometry({
						tubeRadius: this._tubeRadius + this._tolerance,
						ringRadius: this._ringRadius,
						sectorAngle: this._sectorAngle,
						segments: TORUS_INTERSECT_SEGMENTS
				});
		}
		_createTorusMesh(sectorAngle) {
				var geom = new TorusGeometry({
						tubeRadius: this._tubeRadius,
						ringRadius: this._ringRadius,
						sectorAngle: sectorAngle,
						segments: TORUS_RENDER_SEGMENTS
				});
				return this._createMesh(geom, this._shading);
		}
		_createDisk() {
				this._createRoot('disk');
				this._createRenderComponent(this.entity, [
						this._createTorusMesh(this._sectorAngle),
						this._createTorusMesh(360)
				]);
				this.drag(false);
		}
		set tubeRadius(value) {
				this._tubeRadius = value != null ? value : 0.1;
				this._updateTransform();
		}
		get tubeRadius() {
				return this._tubeRadius;
		}
		set ringRadius(value) {
				this._ringRadius = value != null ? value : 0.1;
				this._updateTransform();
		}
		get ringRadius() {
				return this._ringRadius;
		}
		set tolerance(value) {
				this._tolerance = value;
				this._updateTransform();
		}
		get tolerance() {
				return this._tolerance;
		}
		_updateTransform() {
				this.triData[0].fromGeometry(this._createTorusGeometry());
				this.meshInstances[0].mesh = this._createTorusMesh(this._sectorAngle);
				this.meshInstances[1].mesh = this._createTorusMesh(360);
		}
		drag(state) {
				this.meshInstances[0].visible = !state;
				this.meshInstances[1].visible = state;
		}
		hide(state) {
				if (state) {
						this.meshInstances[0].visible = false;
						this.meshInstances[1].visible = false;
						return;
				}
				this.drag(false);
		}
		constructor(device, options = {}){
				super(device, options), this._tubeRadius = 0.01, this._ringRadius = 0.5, this._tolerance = 0.05;
				var _options_tubeRadius;
				this._tubeRadius = (_options_tubeRadius = options.tubeRadius) != null ? _options_tubeRadius : this._tubeRadius;
				var _options_ringRadius;
				this._ringRadius = (_options_ringRadius = options.ringRadius) != null ? _options_ringRadius : this._ringRadius;
				var _options_sectorAngle;
				this._sectorAngle = (_options_sectorAngle = options.sectorAngle) != null ? _options_sectorAngle : this._sectorAngle;
				this.triData = [
						new TriData(this._createTorusGeometry())
				];
				this._createDisk();
		}
}

export { ArcShape };
