import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Tri } from '../../core/shape/tri.js';
import { Geometry } from '../../scene/geometry/geometry.js';

var tmpV1 = new Vec3();
var tmpV2 = new Vec3();
var tmpV3 = new Vec3();
class TriData {
		get transform() {
				return this._transform;
		}
		get priority() {
				return this._priority;
		}
		setTransform(pos, rot, scale) {
				if (pos === undefined) pos = new Vec3();
				if (rot === undefined) rot = new Quat();
				if (scale === undefined) scale = new Vec3();
				this.transform.setTRS(pos, rot, scale);
		}
		fromGeometry(geometry) {
				if (!geometry || !(geometry instanceof Geometry)) {
						throw new Error('No geometry provided.');
				}
				var _geometry_positions;
				var positions = (_geometry_positions = geometry.positions) != null ? _geometry_positions : [];
				var _geometry_indices;
				var indices = (_geometry_indices = geometry.indices) != null ? _geometry_indices : [];
				this.tris = [];
				for(var k = 0; k < indices.length; k += 3){
						var i1 = indices[k];
						var i2 = indices[k + 1];
						var i3 = indices[k + 2];
						tmpV1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
						tmpV2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
						tmpV3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
						var tri = new Tri(tmpV1, tmpV2, tmpV3);
						this.tris.push(tri);
				}
		}
		constructor(geometry, priority = 0){
				this._priority = 0;
				this._transform = new Mat4();
				this.tris = [];
				this.fromGeometry(geometry);
				this._priority = priority;
		}
}

export { TriData };
