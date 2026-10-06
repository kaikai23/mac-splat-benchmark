import { Vec3 } from '../math/vec3.js';

class Plane {
		clone() {
				var cstr = this.constructor;
				return new cstr().copy(this);
		}
		copy(src) {
				this.normal.copy(src.normal);
				this.distance = src.distance;
				return this;
		}
		intersectsLine(start, end, point) {
				var d = this.distance;
				var d0 = this.normal.dot(start) + d;
				var d1 = this.normal.dot(end) + d;
				var t = d0 / (d0 - d1);
				var intersects = t >= 0 && t <= 1;
				if (intersects && point) {
						point.lerp(start, end, t);
				}
				return intersects;
		}
		intersectsRay(ray, point) {
				var denominator = this.normal.dot(ray.direction);
				if (denominator === 0) {
						return false;
				}
				var t = -(this.normal.dot(ray.origin) + this.distance) / denominator;
				if (t >= 0 && point) {
						point.copy(ray.direction).mulScalar(t).add(ray.origin);
				}
				return t >= 0;
		}
		normalize() {
				var invLength = 1 / this.normal.length();
				this.normal.mulScalar(invLength);
				this.distance *= invLength;
				return this;
		}
		set(nx, ny, nz, d) {
				this.normal.set(nx, ny, nz);
				this.distance = d;
				return this;
		}
		setFromPointNormal(point, normal) {
				this.normal.copy(normal);
				this.distance = -this.normal.dot(point);
				return this;
		}
		constructor(normal = Vec3.UP, distance = 0){
				this.normal = new Vec3();
				this.normal.copy(normal);
				this.distance = distance;
		}
}

export { Plane };
