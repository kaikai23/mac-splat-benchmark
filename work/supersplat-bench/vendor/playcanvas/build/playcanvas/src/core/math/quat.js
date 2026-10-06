import { math } from './math.js';
import { Vec3 } from './vec3.js';

class Quat {
		clone() {
				var cstr = this.constructor;
				return new cstr(this.x, this.y, this.z, this.w);
		}
		conjugate(src) {
				if (src === undefined) src = this;
				this.x = src.x * -1;
				this.y = src.y * -1;
				this.z = src.z * -1;
				this.w = src.w;
				return this;
		}
		copy(rhs) {
				this.x = rhs.x;
				this.y = rhs.y;
				this.z = rhs.z;
				this.w = rhs.w;
				return this;
		}
		equals(rhs) {
				return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
		}
		equalsApprox(rhs, epsilon) {
				if (epsilon === undefined) epsilon = 1e-6;
				return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
		}
		getAxisAngle(axis) {
				var rad = Math.acos(this.w) * 2;
				var s = Math.sin(rad / 2);
				if (s !== 0) {
						axis.x = this.x / s;
						axis.y = this.y / s;
						axis.z = this.z / s;
						if (axis.x < 0 || axis.y < 0 || axis.z < 0) {
								axis.x *= -1;
								axis.y *= -1;
								axis.z *= -1;
								rad *= -1;
						}
				} else {
						axis.x = 1;
						axis.y = 0;
						axis.z = 0;
				}
				return rad * math.RAD_TO_DEG;
		}
		getEulerAngles(eulers) {
				if (eulers === undefined) eulers = new Vec3();
				var x, y, z;
				var qx = this.x;
				var qy = this.y;
				var qz = this.z;
				var qw = this.w;
				var a2 = 2 * (qw * qy - qx * qz);
				if (a2 <= -0.99999) {
						x = 2 * Math.atan2(qx, qw);
						y = -Math.PI / 2;
						z = 0;
				} else if (a2 >= 0.99999) {
						x = 2 * Math.atan2(qx, qw);
						y = Math.PI / 2;
						z = 0;
				} else {
						x = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
						y = Math.asin(a2);
						z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
				}
				return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
		}
		invert(src) {
				if (src === undefined) src = this;
				return this.conjugate(src).normalize();
		}
		length() {
				return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
		}
		lengthSq() {
				return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
		}
		mul(rhs) {
				var q1x = this.x;
				var q1y = this.y;
				var q1z = this.z;
				var q1w = this.w;
				var q2x = rhs.x;
				var q2y = rhs.y;
				var q2z = rhs.z;
				var q2w = rhs.w;
				this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
				this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
				this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
				this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
				return this;
		}
		mulScalar(scalar, src) {
				if (src === undefined) src = this;
				this.x = src.x * scalar;
				this.y = src.y * scalar;
				this.z = src.z * scalar;
				this.w = src.w * scalar;
				return this;
		}
		mul2(lhs, rhs) {
				var q1x = lhs.x;
				var q1y = lhs.y;
				var q1z = lhs.z;
				var q1w = lhs.w;
				var q2x = rhs.x;
				var q2y = rhs.y;
				var q2z = rhs.z;
				var q2w = rhs.w;
				this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
				this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
				this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
				this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
				return this;
		}
		normalize(src) {
				if (src === undefined) src = this;
				var len = src.length();
				if (len === 0) {
						this.x = this.y = this.z = 0;
						this.w = 1;
				} else {
						len = 1 / len;
						this.x = src.x * len;
						this.y = src.y * len;
						this.z = src.z * len;
						this.w = src.w * len;
				}
				return this;
		}
		set(x, y, z, w) {
				this.x = x;
				this.y = y;
				this.z = z;
				this.w = w;
				return this;
		}
		setFromAxisAngle(axis, angle) {
				angle *= 0.5 * math.DEG_TO_RAD;
				var sa = Math.sin(angle);
				var ca = Math.cos(angle);
				this.x = sa * axis.x;
				this.y = sa * axis.y;
				this.z = sa * axis.z;
				this.w = ca;
				return this;
		}
		setFromEulerAngles(ex, ey, ez) {
				if (ex instanceof Vec3) {
						var vec = ex;
						ex = vec.x;
						ey = vec.y;
						ez = vec.z;
				}
				var halfToRad = 0.5 * math.DEG_TO_RAD;
				ex *= halfToRad;
				ey *= halfToRad;
				ez *= halfToRad;
				var sx = Math.sin(ex);
				var cx = Math.cos(ex);
				var sy = Math.sin(ey);
				var cy = Math.cos(ey);
				var sz = Math.sin(ez);
				var cz = Math.cos(ez);
				this.x = sx * cy * cz - cx * sy * sz;
				this.y = cx * sy * cz + sx * cy * sz;
				this.z = cx * cy * sz - sx * sy * cz;
				this.w = cx * cy * cz + sx * sy * sz;
				return this;
		}
		setFromMat4(m) {
				var d = m.data;
				var m00 = d[0];
				var m01 = d[1];
				var m02 = d[2];
				var m10 = d[4];
				var m11 = d[5];
				var m12 = d[6];
				var m20 = d[8];
				var m21 = d[9];
				var m22 = d[10];
				var l;
				l = m00 * m00 + m01 * m01 + m02 * m02;
				if (l === 0) return this.set(0, 0, 0, 1);
				l = 1 / Math.sqrt(l);
				m00 *= l;
				m01 *= l;
				m02 *= l;
				l = m10 * m10 + m11 * m11 + m12 * m12;
				if (l === 0) return this.set(0, 0, 0, 1);
				l = 1 / Math.sqrt(l);
				m10 *= l;
				m11 *= l;
				m12 *= l;
				l = m20 * m20 + m21 * m21 + m22 * m22;
				if (l === 0) return this.set(0, 0, 0, 1);
				l = 1 / Math.sqrt(l);
				m20 *= l;
				m21 *= l;
				m22 *= l;
				if (m22 < 0) {
						if (m00 > m11) {
								this.set(1 + m00 - m11 - m22, m01 + m10, m20 + m02, m12 - m21);
						} else {
								this.set(m01 + m10, 1 - m00 + m11 - m22, m12 + m21, m20 - m02);
						}
				} else {
						if (m00 < -m11) {
								this.set(m20 + m02, m12 + m21, 1 - m00 - m11 + m22, m01 - m10);
						} else {
								this.set(m12 - m21, m20 - m02, m01 - m10, 1 + m00 + m11 + m22);
						}
				}
				return this.mulScalar(1.0 / this.length());
		}
		setFromDirections(from, to) {
				var dotProduct = 1 + from.dot(to);
				if (dotProduct < Number.EPSILON) {
						if (Math.abs(from.x) > Math.abs(from.y)) {
								this.x = -from.z;
								this.y = 0;
								this.z = from.x;
								this.w = 0;
						} else {
								this.x = 0;
								this.y = -from.z;
								this.z = from.y;
								this.w = 0;
						}
				} else {
						this.x = from.y * to.z - from.z * to.y;
						this.y = from.z * to.x - from.x * to.z;
						this.z = from.x * to.y - from.y * to.x;
						this.w = dotProduct;
				}
				return this.normalize();
		}
		slerp(lhs, rhs, alpha) {
				var lx = lhs.x;
				var ly = lhs.y;
				var lz = lhs.z;
				var lw = lhs.w;
				var rx = rhs.x;
				var ry = rhs.y;
				var rz = rhs.z;
				var rw = rhs.w;
				var cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;
				if (cosHalfTheta < 0) {
						rw = -rw;
						rx = -rx;
						ry = -ry;
						rz = -rz;
						cosHalfTheta = -cosHalfTheta;
				}
				if (Math.abs(cosHalfTheta) >= 1) {
						this.w = lw;
						this.x = lx;
						this.y = ly;
						this.z = lz;
						return this;
				}
				var halfTheta = Math.acos(cosHalfTheta);
				var sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
				if (Math.abs(sinHalfTheta) < 0.001) {
						this.w = lw * 0.5 + rw * 0.5;
						this.x = lx * 0.5 + rx * 0.5;
						this.y = ly * 0.5 + ry * 0.5;
						this.z = lz * 0.5 + rz * 0.5;
						return this;
				}
				var ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
				var ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;
				this.w = lw * ratioA + rw * ratioB;
				this.x = lx * ratioA + rx * ratioB;
				this.y = ly * ratioA + ry * ratioB;
				this.z = lz * ratioA + rz * ratioB;
				return this;
		}
		transformVector(vec, res) {
				if (res === undefined) res = new Vec3();
				var x = vec.x, y = vec.y, z = vec.z;
				var qx = this.x, qy = this.y, qz = this.z, qw = this.w;
				var ix = qw * x + qy * z - qz * y;
				var iy = qw * y + qz * x - qx * z;
				var iz = qw * z + qx * y - qy * x;
				var iw = -qx * x - qy * y - qz * z;
				res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
				res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
				res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
				return res;
		}
		toString() {
				return "[" + this.x + ", " + this.y + ", " + this.z + ", " + this.w + "]";
		}
		constructor(x = 0, y = 0, z = 0, w = 1){
				if (x.length === 4) {
						this.x = x[0];
						this.y = x[1];
						this.z = x[2];
						this.w = x[3];
				} else {
						this.x = x;
						this.y = y;
						this.z = z;
						this.w = w;
				}
		}
}
Quat.IDENTITY = Object.freeze(new Quat(0, 0, 0, 1));
Quat.ZERO = Object.freeze(new Quat(0, 0, 0, 0));

export { Quat };
