import { Vec3 } from '../math/vec3.js';

var tmpVecA = new Vec3();
var tmpVecB = new Vec3();
var tmpVecC = new Vec3();
var tmpVecD = new Vec3();
var tmpVecE = new Vec3();
class BoundingBox {
		add(other) {
				var tc = this.center;
				var tcx = tc.x;
				var tcy = tc.y;
				var tcz = tc.z;
				var th = this.halfExtents;
				var thx = th.x;
				var thy = th.y;
				var thz = th.z;
				var tminx = tcx - thx;
				var tmaxx = tcx + thx;
				var tminy = tcy - thy;
				var tmaxy = tcy + thy;
				var tminz = tcz - thz;
				var tmaxz = tcz + thz;
				var oc = other.center;
				var ocx = oc.x;
				var ocy = oc.y;
				var ocz = oc.z;
				var oh = other.halfExtents;
				var ohx = oh.x;
				var ohy = oh.y;
				var ohz = oh.z;
				var ominx = ocx - ohx;
				var omaxx = ocx + ohx;
				var ominy = ocy - ohy;
				var omaxy = ocy + ohy;
				var ominz = ocz - ohz;
				var omaxz = ocz + ohz;
				if (ominx < tminx) tminx = ominx;
				if (omaxx > tmaxx) tmaxx = omaxx;
				if (ominy < tminy) tminy = ominy;
				if (omaxy > tmaxy) tmaxy = omaxy;
				if (ominz < tminz) tminz = ominz;
				if (omaxz > tmaxz) tmaxz = omaxz;
				tc.x = (tminx + tmaxx) * 0.5;
				tc.y = (tminy + tmaxy) * 0.5;
				tc.z = (tminz + tmaxz) * 0.5;
				th.x = (tmaxx - tminx) * 0.5;
				th.y = (tmaxy - tminy) * 0.5;
				th.z = (tmaxz - tminz) * 0.5;
		}
		copy(src) {
				this.center.copy(src.center);
				this.halfExtents.copy(src.halfExtents);
		}
		clone() {
				return new BoundingBox(this.center, this.halfExtents);
		}
		intersects(other) {
				var aMax = this.getMax();
				var aMin = this.getMin();
				var bMax = other.getMax();
				var bMin = other.getMin();
				return aMin.x <= bMax.x && aMax.x >= bMin.x && aMin.y <= bMax.y && aMax.y >= bMin.y && aMin.z <= bMax.z && aMax.z >= bMin.z;
		}
		_intersectsRay(ray, point) {
				var tMin = tmpVecA.copy(this.getMin()).sub(ray.origin);
				var tMax = tmpVecB.copy(this.getMax()).sub(ray.origin);
				var dir = ray.direction;
				if (dir.x === 0) {
						tMin.x = tMin.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
						tMax.x = tMax.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
				} else {
						tMin.x /= dir.x;
						tMax.x /= dir.x;
				}
				if (dir.y === 0) {
						tMin.y = tMin.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
						tMax.y = tMax.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
				} else {
						tMin.y /= dir.y;
						tMax.y /= dir.y;
				}
				if (dir.z === 0) {
						tMin.z = tMin.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
						tMax.z = tMax.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
				} else {
						tMin.z /= dir.z;
						tMax.z /= dir.z;
				}
				var realMin = tmpVecC.set(Math.min(tMin.x, tMax.x), Math.min(tMin.y, tMax.y), Math.min(tMin.z, tMax.z));
				var realMax = tmpVecD.set(Math.max(tMin.x, tMax.x), Math.max(tMin.y, tMax.y), Math.max(tMin.z, tMax.z));
				var minMax = Math.min(Math.min(realMax.x, realMax.y), realMax.z);
				var maxMin = Math.max(Math.max(realMin.x, realMin.y), realMin.z);
				var intersects = minMax >= maxMin && maxMin >= 0;
				if (intersects) {
						point.copy(ray.direction).mulScalar(maxMin).add(ray.origin);
				}
				return intersects;
		}
		_fastIntersectsRay(ray) {
				var diff = tmpVecA;
				var cross = tmpVecB;
				var prod = tmpVecC;
				var absDiff = tmpVecD;
				var absDir = tmpVecE;
				var rayDir = ray.direction;
				diff.sub2(ray.origin, this.center);
				absDiff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
				prod.mul2(diff, rayDir);
				if (absDiff.x > this.halfExtents.x && prod.x >= 0) {
						return false;
				}
				if (absDiff.y > this.halfExtents.y && prod.y >= 0) {
						return false;
				}
				if (absDiff.z > this.halfExtents.z && prod.z >= 0) {
						return false;
				}
				absDir.set(Math.abs(rayDir.x), Math.abs(rayDir.y), Math.abs(rayDir.z));
				cross.cross(rayDir, diff);
				cross.set(Math.abs(cross.x), Math.abs(cross.y), Math.abs(cross.z));
				if (cross.x > this.halfExtents.y * absDir.z + this.halfExtents.z * absDir.y) {
						return false;
				}
				if (cross.y > this.halfExtents.x * absDir.z + this.halfExtents.z * absDir.x) {
						return false;
				}
				if (cross.z > this.halfExtents.x * absDir.y + this.halfExtents.y * absDir.x) {
						return false;
				}
				return true;
		}
		intersectsRay(ray, point) {
				if (point) {
						return this._intersectsRay(ray, point);
				}
				return this._fastIntersectsRay(ray);
		}
		setMinMax(min, max) {
				this.center.add2(max, min).mulScalar(0.5);
				this.halfExtents.sub2(max, min).mulScalar(0.5);
		}
		getMin() {
				return this._min.copy(this.center).sub(this.halfExtents);
		}
		getMax() {
				return this._max.copy(this.center).add(this.halfExtents);
		}
		containsPoint(point) {
				var min = this.getMin();
				var max = this.getMax();
				if (point.x < min.x || point.x > max.x || point.y < min.y || point.y > max.y || point.z < min.z || point.z > max.z) {
						return false;
				}
				return true;
		}
		setFromTransformedAabb(aabb, m, ignoreScale) {
				if (ignoreScale === undefined) ignoreScale = false;
				var ac = aabb.center;
				var ar = aabb.halfExtents;
				var d = m.data;
				var mx0 = d[0];
				var mx1 = d[4];
				var mx2 = d[8];
				var my0 = d[1];
				var my1 = d[5];
				var my2 = d[9];
				var mz0 = d[2];
				var mz1 = d[6];
				var mz2 = d[10];
				if (ignoreScale) {
						var lengthSq = mx0 * mx0 + mx1 * mx1 + mx2 * mx2;
						if (lengthSq > 0) {
								var invLength = 1 / Math.sqrt(lengthSq);
								mx0 *= invLength;
								mx1 *= invLength;
								mx2 *= invLength;
						}
						lengthSq = my0 * my0 + my1 * my1 + my2 * my2;
						if (lengthSq > 0) {
								var invLength1 = 1 / Math.sqrt(lengthSq);
								my0 *= invLength1;
								my1 *= invLength1;
								my2 *= invLength1;
						}
						lengthSq = mz0 * mz0 + mz1 * mz1 + mz2 * mz2;
						if (lengthSq > 0) {
								var invLength2 = 1 / Math.sqrt(lengthSq);
								mz0 *= invLength2;
								mz1 *= invLength2;
								mz2 *= invLength2;
						}
				}
				this.center.set(d[12] + mx0 * ac.x + mx1 * ac.y + mx2 * ac.z, d[13] + my0 * ac.x + my1 * ac.y + my2 * ac.z, d[14] + mz0 * ac.x + mz1 * ac.y + mz2 * ac.z);
				this.halfExtents.set(Math.abs(mx0) * ar.x + Math.abs(mx1) * ar.y + Math.abs(mx2) * ar.z, Math.abs(my0) * ar.x + Math.abs(my1) * ar.y + Math.abs(my2) * ar.z, Math.abs(mz0) * ar.x + Math.abs(mz1) * ar.y + Math.abs(mz2) * ar.z);
		}
		static computeMinMax(vertices, min, max, numVerts) {
				if (numVerts === undefined) numVerts = vertices.length / 3;
				if (numVerts > 0) {
						var minx = vertices[0];
						var miny = vertices[1];
						var minz = vertices[2];
						var maxx = minx;
						var maxy = miny;
						var maxz = minz;
						var n = numVerts * 3;
						for(var i = 3; i < n; i += 3){
								var x = vertices[i];
								var y = vertices[i + 1];
								var z = vertices[i + 2];
								if (x < minx) minx = x;
								if (y < miny) miny = y;
								if (z < minz) minz = z;
								if (x > maxx) maxx = x;
								if (y > maxy) maxy = y;
								if (z > maxz) maxz = z;
						}
						min.set(minx, miny, minz);
						max.set(maxx, maxy, maxz);
				}
		}
		compute(vertices, numVerts) {
				BoundingBox.computeMinMax(vertices, tmpVecA, tmpVecB, numVerts);
				this.setMinMax(tmpVecA, tmpVecB);
		}
		intersectsBoundingSphere(sphere) {
				var sq = this._distanceToBoundingSphereSq(sphere);
				if (sq <= sphere.radius * sphere.radius) {
						return true;
				}
				return false;
		}
		_distanceToBoundingSphereSq(sphere) {
				var boxMin = this.getMin();
				var boxMax = this.getMax();
				var sq = 0;
				var axis = [
						'x',
						'y',
						'z'
				];
				for(var i = 0; i < 3; ++i){
						var out = 0;
						var pn = sphere.center[axis[i]];
						var bMin = boxMin[axis[i]];
						var bMax = boxMax[axis[i]];
						var val = 0;
						if (pn < bMin) {
								val = bMin - pn;
								out += val * val;
						}
						if (pn > bMax) {
								val = pn - bMax;
								out += val * val;
						}
						sq += out;
				}
				return sq;
		}
		_expand(expandMin, expandMax) {
				tmpVecA.add2(this.getMin(), expandMin);
				tmpVecB.add2(this.getMax(), expandMax);
				this.setMinMax(tmpVecA, tmpVecB);
		}
		constructor(center, halfExtents){
				this.center = new Vec3();
				this.halfExtents = new Vec3(0.5, 0.5, 0.5);
				this._min = new Vec3();
				this._max = new Vec3();
				if (center) {
						this.center.copy(center);
				}
				if (halfExtents) {
						this.halfExtents.copy(halfExtents);
				}
		}
}

export { BoundingBox };
