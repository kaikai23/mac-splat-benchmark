import { Vec3 } from '../math/vec3.js';

var tmpVecA = new Vec3();
var tmpVecB = new Vec3();
class BoundingSphere {
		containsPoint(point) {
				var lenSq = tmpVecA.sub2(point, this.center).lengthSq();
				var r = this.radius;
				return lenSq < r * r;
		}
		intersectsRay(ray, point) {
				var m = tmpVecA.copy(ray.origin).sub(this.center);
				var b = m.dot(tmpVecB.copy(ray.direction).normalize());
				var c = m.dot(m) - this.radius * this.radius;
				if (c > 0 && b > 0) {
						return false;
				}
				var discr = b * b - c;
				if (discr < 0) {
						return false;
				}
				var t = Math.abs(-b - Math.sqrt(discr));
				if (point) {
						point.copy(ray.direction).mulScalar(t).add(ray.origin);
				}
				return true;
		}
		intersectsBoundingSphere(sphere) {
				tmpVecA.sub2(sphere.center, this.center);
				var totalRadius = sphere.radius + this.radius;
				if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
						return true;
				}
				return false;
		}
		constructor(center = new Vec3(), radius = 0.5){
				this.center = center;
				this.radius = radius;
		}
}

export { BoundingSphere };
