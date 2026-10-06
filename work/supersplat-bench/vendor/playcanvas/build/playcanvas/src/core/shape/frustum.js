import { Plane } from './plane.js';

class Frustum {
		clone() {
				var cstr = this.constructor;
				return new cstr().copy(this);
		}
		copy(src) {
				for(var i = 0; i < 6; i++){
						this.planes[i].copy(src.planes[i]);
				}
				return this;
		}
		setFromMat4(matrix) {
				var [m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33] = matrix.data;
				var planes = this.planes;
				planes[0].set(m03 - m00, m13 - m10, m23 - m20, m33 - m30).normalize();
				planes[1].set(m03 + m00, m13 + m10, m23 + m20, m33 + m30).normalize();
				planes[2].set(m03 + m01, m13 + m11, m23 + m21, m33 + m31).normalize();
				planes[3].set(m03 - m01, m13 - m11, m23 - m21, m33 - m31).normalize();
				planes[4].set(m03 - m02, m13 - m12, m23 - m22, m33 - m32).normalize();
				planes[5].set(m03 + m02, m13 + m12, m23 + m22, m33 + m32).normalize();
		}
		containsPoint(point) {
				for(var p = 0; p < 6; p++){
						var { normal, distance } = this.planes[p];
						if (normal.dot(point) + distance <= 0) {
								return false;
						}
				}
				return true;
		}
		containsSphere(sphere) {
				var { center, radius } = sphere;
				var c = 0;
				for(var p = 0; p < 6; p++){
						var { normal, distance } = this.planes[p];
						var d = normal.dot(center) + distance;
						if (d <= -radius) {
								return 0;
						}
						if (d > radius) {
								c++;
						}
				}
				return c === 6 ? 2 : 1;
		}
		constructor(){
				this.planes = [];
				for(var i = 0; i < 6; i++){
						this.planes[i] = new Plane();
				}
		}
}

export { Frustum };
