import { BoundingBox } from '../core/shape/bounding-box.js';

class MorphTarget {
		destroy() {
				var _this_texturePositions, _this_textureNormals;
				(_this_texturePositions = this.texturePositions) == null ? undefined : _this_texturePositions.destroy();
				this.texturePositions = null;
				(_this_textureNormals = this.textureNormals) == null ? undefined : _this_textureNormals.destroy();
				this.textureNormals = null;
		}
		get name() {
				return this._name;
		}
		get defaultWeight() {
				return this._defaultWeight;
		}
		get aabb() {
				if (!this._aabb) {
						this._aabb = new BoundingBox();
						if (this.deltaPositions) {
								this._aabb.compute(this.deltaPositions);
						}
				}
				return this._aabb;
		}
		get morphPositions() {
				return !!this.texturePositions;
		}
		get morphNormals() {
				return !!this.textureNormals;
		}
		clone() {
				return new MorphTarget(this.options);
		}
		_postInit() {
				if (!this.options.preserveData) {
						this.options = null;
				}
				this.used = true;
		}
		_setTexture(name, texture) {
				this[name] = texture;
		}
		constructor(options){
				this.used = false;
				this.options = options;
				this._name = options.name;
				this._defaultWeight = options.defaultWeight || 0;
				this._aabb = options.aabb;
				this.deltaPositions = options.deltaPositions;
		}
}

export { MorphTarget };
