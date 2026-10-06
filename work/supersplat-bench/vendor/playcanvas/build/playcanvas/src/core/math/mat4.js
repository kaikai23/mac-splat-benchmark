import { math } from './math.js';
import { Vec2 } from './vec2.js';
import { Vec3 } from './vec3.js';
import { Vec4 } from './vec4.js';

var _halfSize = new Vec2();
var x = new Vec3();
var y = new Vec3();
var z = new Vec3();
var scale = new Vec3();
class Mat4 {
		static _getPerspectiveHalfSize(halfSize, fov, aspect, znear, fovIsHorizontal) {
				if (fovIsHorizontal) {
						halfSize.x = znear * Math.tan(fov * Math.PI / 360);
						halfSize.y = halfSize.x / aspect;
				} else {
						halfSize.y = znear * Math.tan(fov * Math.PI / 360);
						halfSize.x = halfSize.y * aspect;
				}
		}
		add2(lhs, rhs) {
				var a = lhs.data, b = rhs.data, r = this.data;
				r[0] = a[0] + b[0];
				r[1] = a[1] + b[1];
				r[2] = a[2] + b[2];
				r[3] = a[3] + b[3];
				r[4] = a[4] + b[4];
				r[5] = a[5] + b[5];
				r[6] = a[6] + b[6];
				r[7] = a[7] + b[7];
				r[8] = a[8] + b[8];
				r[9] = a[9] + b[9];
				r[10] = a[10] + b[10];
				r[11] = a[11] + b[11];
				r[12] = a[12] + b[12];
				r[13] = a[13] + b[13];
				r[14] = a[14] + b[14];
				r[15] = a[15] + b[15];
				return this;
		}
		add(rhs) {
				return this.add2(this, rhs);
		}
		clone() {
				var cstr = this.constructor;
				return new cstr().copy(this);
		}
		copy(rhs) {
				var src = rhs.data, dst = this.data;
				dst[0] = src[0];
				dst[1] = src[1];
				dst[2] = src[2];
				dst[3] = src[3];
				dst[4] = src[4];
				dst[5] = src[5];
				dst[6] = src[6];
				dst[7] = src[7];
				dst[8] = src[8];
				dst[9] = src[9];
				dst[10] = src[10];
				dst[11] = src[11];
				dst[12] = src[12];
				dst[13] = src[13];
				dst[14] = src[14];
				dst[15] = src[15];
				return this;
		}
		equals(rhs) {
				var l = this.data, r = rhs.data;
				return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8] && l[9] === r[9] && l[10] === r[10] && l[11] === r[11] && l[12] === r[12] && l[13] === r[13] && l[14] === r[14] && l[15] === r[15];
		}
		isIdentity() {
				var m = this.data;
				return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 0 && m[5] === 1 && m[6] === 0 && m[7] === 0 && m[8] === 0 && m[9] === 0 && m[10] === 1 && m[11] === 0 && m[12] === 0 && m[13] === 0 && m[14] === 0 && m[15] === 1;
		}
		mul2(lhs, rhs) {
				var a = lhs.data;
				var b = rhs.data;
				var r = this.data;
				var a00 = a[0];
				var a01 = a[1];
				var a02 = a[2];
				var a03 = a[3];
				var a10 = a[4];
				var a11 = a[5];
				var a12 = a[6];
				var a13 = a[7];
				var a20 = a[8];
				var a21 = a[9];
				var a22 = a[10];
				var a23 = a[11];
				var a30 = a[12];
				var a31 = a[13];
				var a32 = a[14];
				var a33 = a[15];
				var b0, b1, b2, b3;
				b0 = b[0];
				b1 = b[1];
				b2 = b[2];
				b3 = b[3];
				r[0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
				r[1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
				r[2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
				r[3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
				b0 = b[4];
				b1 = b[5];
				b2 = b[6];
				b3 = b[7];
				r[4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
				r[5] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
				r[6] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
				r[7] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
				b0 = b[8];
				b1 = b[9];
				b2 = b[10];
				b3 = b[11];
				r[8] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
				r[9] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
				r[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
				r[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
				b0 = b[12];
				b1 = b[13];
				b2 = b[14];
				b3 = b[15];
				r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
				r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
				r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
				r[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
				return this;
		}
		mulAffine2(lhs, rhs) {
				var a = lhs.data;
				var b = rhs.data;
				var r = this.data;
				var a00 = a[0];
				var a01 = a[1];
				var a02 = a[2];
				var a10 = a[4];
				var a11 = a[5];
				var a12 = a[6];
				var a20 = a[8];
				var a21 = a[9];
				var a22 = a[10];
				var a30 = a[12];
				var a31 = a[13];
				var a32 = a[14];
				var b0, b1, b2;
				b0 = b[0];
				b1 = b[1];
				b2 = b[2];
				r[0] = a00 * b0 + a10 * b1 + a20 * b2;
				r[1] = a01 * b0 + a11 * b1 + a21 * b2;
				r[2] = a02 * b0 + a12 * b1 + a22 * b2;
				r[3] = 0;
				b0 = b[4];
				b1 = b[5];
				b2 = b[6];
				r[4] = a00 * b0 + a10 * b1 + a20 * b2;
				r[5] = a01 * b0 + a11 * b1 + a21 * b2;
				r[6] = a02 * b0 + a12 * b1 + a22 * b2;
				r[7] = 0;
				b0 = b[8];
				b1 = b[9];
				b2 = b[10];
				r[8] = a00 * b0 + a10 * b1 + a20 * b2;
				r[9] = a01 * b0 + a11 * b1 + a21 * b2;
				r[10] = a02 * b0 + a12 * b1 + a22 * b2;
				r[11] = 0;
				b0 = b[12];
				b1 = b[13];
				b2 = b[14];
				r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30;
				r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31;
				r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32;
				r[15] = 1;
				return this;
		}
		mul(rhs) {
				return this.mul2(this, rhs);
		}
		transformPoint(vec, res) {
				if (res === undefined) res = new Vec3();
				var m = this.data;
				var { x, y, z } = vec;
				res.x = x * m[0] + y * m[4] + z * m[8] + m[12];
				res.y = x * m[1] + y * m[5] + z * m[9] + m[13];
				res.z = x * m[2] + y * m[6] + z * m[10] + m[14];
				return res;
		}
		transformVector(vec, res) {
				if (res === undefined) res = new Vec3();
				var m = this.data;
				var { x, y, z } = vec;
				res.x = x * m[0] + y * m[4] + z * m[8];
				res.y = x * m[1] + y * m[5] + z * m[9];
				res.z = x * m[2] + y * m[6] + z * m[10];
				return res;
		}
		transformVec4(vec, res) {
				if (res === undefined) res = new Vec4();
				var m = this.data;
				var { x, y, z, w } = vec;
				res.x = x * m[0] + y * m[4] + z * m[8] + w * m[12];
				res.y = x * m[1] + y * m[5] + z * m[9] + w * m[13];
				res.z = x * m[2] + y * m[6] + z * m[10] + w * m[14];
				res.w = x * m[3] + y * m[7] + z * m[11] + w * m[15];
				return res;
		}
		setLookAt(position, target, up) {
				z.sub2(position, target).normalize();
				y.copy(up).normalize();
				x.cross(y, z).normalize();
				y.cross(z, x);
				var r = this.data;
				r[0] = x.x;
				r[1] = x.y;
				r[2] = x.z;
				r[3] = 0;
				r[4] = y.x;
				r[5] = y.y;
				r[6] = y.z;
				r[7] = 0;
				r[8] = z.x;
				r[9] = z.y;
				r[10] = z.z;
				r[11] = 0;
				r[12] = position.x;
				r[13] = position.y;
				r[14] = position.z;
				r[15] = 1;
				return this;
		}
		setFrustum(left, right, bottom, top, znear, zfar) {
				var temp1 = 2 * znear;
				var temp2 = right - left;
				var temp3 = top - bottom;
				var temp4 = zfar - znear;
				var r = this.data;
				r[0] = temp1 / temp2;
				r[1] = 0;
				r[2] = 0;
				r[3] = 0;
				r[4] = 0;
				r[5] = temp1 / temp3;
				r[6] = 0;
				r[7] = 0;
				r[8] = (right + left) / temp2;
				r[9] = (top + bottom) / temp3;
				r[10] = (-zfar - znear) / temp4;
				r[11] = -1;
				r[12] = 0;
				r[13] = 0;
				r[14] = -temp1 * zfar / temp4;
				r[15] = 0;
				return this;
		}
		setPerspective(fov, aspect, znear, zfar, fovIsHorizontal) {
				Mat4._getPerspectiveHalfSize(_halfSize, fov, aspect, znear, fovIsHorizontal);
				return this.setFrustum(-_halfSize.x, _halfSize.x, -_halfSize.y, _halfSize.y, znear, zfar);
		}
		setOrtho(left, right, bottom, top, near, far) {
				var r = this.data;
				r[0] = 2 / (right - left);
				r[1] = 0;
				r[2] = 0;
				r[3] = 0;
				r[4] = 0;
				r[5] = 2 / (top - bottom);
				r[6] = 0;
				r[7] = 0;
				r[8] = 0;
				r[9] = 0;
				r[10] = -2 / (far - near);
				r[11] = 0;
				r[12] = -(right + left) / (right - left);
				r[13] = -(top + bottom) / (top - bottom);
				r[14] = -(far + near) / (far - near);
				r[15] = 1;
				return this;
		}
		setFromAxisAngle(axis, angle) {
				angle *= math.DEG_TO_RAD;
				var { x, y, z } = axis;
				var c = Math.cos(angle);
				var s = Math.sin(angle);
				var t = 1 - c;
				var tx = t * x;
				var ty = t * y;
				var m = this.data;
				m[0] = tx * x + c;
				m[1] = tx * y + s * z;
				m[2] = tx * z - s * y;
				m[3] = 0;
				m[4] = tx * y - s * z;
				m[5] = ty * y + c;
				m[6] = ty * z + s * x;
				m[7] = 0;
				m[8] = tx * z + s * y;
				m[9] = ty * z - x * s;
				m[10] = t * z * z + c;
				m[11] = 0;
				m[12] = 0;
				m[13] = 0;
				m[14] = 0;
				m[15] = 1;
				return this;
		}
		setTranslate(x, y, z) {
				var m = this.data;
				m[0] = 1;
				m[1] = 0;
				m[2] = 0;
				m[3] = 0;
				m[4] = 0;
				m[5] = 1;
				m[6] = 0;
				m[7] = 0;
				m[8] = 0;
				m[9] = 0;
				m[10] = 1;
				m[11] = 0;
				m[12] = x;
				m[13] = y;
				m[14] = z;
				m[15] = 1;
				return this;
		}
		setScale(x, y, z) {
				var m = this.data;
				m[0] = x;
				m[1] = 0;
				m[2] = 0;
				m[3] = 0;
				m[4] = 0;
				m[5] = y;
				m[6] = 0;
				m[7] = 0;
				m[8] = 0;
				m[9] = 0;
				m[10] = z;
				m[11] = 0;
				m[12] = 0;
				m[13] = 0;
				m[14] = 0;
				m[15] = 1;
				return this;
		}
		setViewport(x, y, width, height) {
				var m = this.data;
				m[0] = width * 0.5;
				m[1] = 0;
				m[2] = 0;
				m[3] = 0;
				m[4] = 0;
				m[5] = height * 0.5;
				m[6] = 0;
				m[7] = 0;
				m[8] = 0;
				m[9] = 0;
				m[10] = 0.5;
				m[11] = 0;
				m[12] = x + width * 0.5;
				m[13] = y + height * 0.5;
				m[14] = 0.5;
				m[15] = 1;
				return this;
		}
		setReflection(normal, distance) {
				var a = normal.x;
				var b = normal.y;
				var c = normal.z;
				var data = this.data;
				data[0] = 1.0 - 2 * a * a;
				data[1] = -2 * a * b;
				data[2] = -2 * a * c;
				data[3] = 0;
				data[4] = -2 * a * b;
				data[5] = 1.0 - 2 * b * b;
				data[6] = -2 * b * c;
				data[7] = 0;
				data[8] = -2 * a * c;
				data[9] = -2 * b * c;
				data[10] = 1.0 - 2 * c * c;
				data[11] = 0;
				data[12] = -2 * a * distance;
				data[13] = -2 * b * distance;
				data[14] = -2 * c * distance;
				data[15] = 1;
				return this;
		}
		invert(src) {
				if (src === undefined) src = this;
				var s = src.data;
				var a00 = s[0];
				var a01 = s[1];
				var a02 = s[2];
				var a03 = s[3];
				var a10 = s[4];
				var a11 = s[5];
				var a12 = s[6];
				var a13 = s[7];
				var a20 = s[8];
				var a21 = s[9];
				var a22 = s[10];
				var a23 = s[11];
				var a30 = s[12];
				var a31 = s[13];
				var a32 = s[14];
				var a33 = s[15];
				var b00 = a00 * a11 - a01 * a10;
				var b01 = a00 * a12 - a02 * a10;
				var b02 = a00 * a13 - a03 * a10;
				var b03 = a01 * a12 - a02 * a11;
				var b04 = a01 * a13 - a03 * a11;
				var b05 = a02 * a13 - a03 * a12;
				var b06 = a20 * a31 - a21 * a30;
				var b07 = a20 * a32 - a22 * a30;
				var b08 = a20 * a33 - a23 * a30;
				var b09 = a21 * a32 - a22 * a31;
				var b10 = a21 * a33 - a23 * a31;
				var b11 = a22 * a33 - a23 * a32;
				var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
				if (det === 0) {
						this.setIdentity();
				} else {
						var invDet = 1 / det;
						var t = this.data;
						t[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
						t[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
						t[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
						t[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
						t[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
						t[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
						t[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
						t[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
						t[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
						t[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
						t[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
						t[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
						t[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
						t[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
						t[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
						t[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
				}
				return this;
		}
		set(src) {
				var dst = this.data;
				dst[0] = src[0];
				dst[1] = src[1];
				dst[2] = src[2];
				dst[3] = src[3];
				dst[4] = src[4];
				dst[5] = src[5];
				dst[6] = src[6];
				dst[7] = src[7];
				dst[8] = src[8];
				dst[9] = src[9];
				dst[10] = src[10];
				dst[11] = src[11];
				dst[12] = src[12];
				dst[13] = src[13];
				dst[14] = src[14];
				dst[15] = src[15];
				return this;
		}
		setIdentity() {
				var m = this.data;
				m[0] = 1;
				m[1] = 0;
				m[2] = 0;
				m[3] = 0;
				m[4] = 0;
				m[5] = 1;
				m[6] = 0;
				m[7] = 0;
				m[8] = 0;
				m[9] = 0;
				m[10] = 1;
				m[11] = 0;
				m[12] = 0;
				m[13] = 0;
				m[14] = 0;
				m[15] = 1;
				return this;
		}
		setTRS(t, r, s) {
				var qx = r.x;
				var qy = r.y;
				var qz = r.z;
				var qw = r.w;
				var sx = s.x;
				var sy = s.y;
				var sz = s.z;
				var x2 = qx + qx;
				var y2 = qy + qy;
				var z2 = qz + qz;
				var xx = qx * x2;
				var xy = qx * y2;
				var xz = qx * z2;
				var yy = qy * y2;
				var yz = qy * z2;
				var zz = qz * z2;
				var wx = qw * x2;
				var wy = qw * y2;
				var wz = qw * z2;
				var m = this.data;
				m[0] = (1 - (yy + zz)) * sx;
				m[1] = (xy + wz) * sx;
				m[2] = (xz - wy) * sx;
				m[3] = 0;
				m[4] = (xy - wz) * sy;
				m[5] = (1 - (xx + zz)) * sy;
				m[6] = (yz + wx) * sy;
				m[7] = 0;
				m[8] = (xz + wy) * sz;
				m[9] = (yz - wx) * sz;
				m[10] = (1 - (xx + yy)) * sz;
				m[11] = 0;
				m[12] = t.x;
				m[13] = t.y;
				m[14] = t.z;
				m[15] = 1;
				return this;
		}
		transpose(src) {
				if (src === undefined) src = this;
				var s = src.data;
				var t = this.data;
				if (s === t) {
						var tmp;
						tmp = s[1];
						t[1] = s[4];
						t[4] = tmp;
						tmp = s[2];
						t[2] = s[8];
						t[8] = tmp;
						tmp = s[3];
						t[3] = s[12];
						t[12] = tmp;
						tmp = s[6];
						t[6] = s[9];
						t[9] = tmp;
						tmp = s[7];
						t[7] = s[13];
						t[13] = tmp;
						tmp = s[11];
						t[11] = s[14];
						t[14] = tmp;
				} else {
						t[0] = s[0];
						t[1] = s[4];
						t[2] = s[8];
						t[3] = s[12];
						t[4] = s[1];
						t[5] = s[5];
						t[6] = s[9];
						t[7] = s[13];
						t[8] = s[2];
						t[9] = s[6];
						t[10] = s[10];
						t[11] = s[14];
						t[12] = s[3];
						t[13] = s[7];
						t[14] = s[11];
						t[15] = s[15];
				}
				return this;
		}
		getTranslation(t) {
				if (t === undefined) t = new Vec3();
				return t.set(this.data[12], this.data[13], this.data[14]);
		}
		getX(x) {
				if (x === undefined) x = new Vec3();
				return x.set(this.data[0], this.data[1], this.data[2]);
		}
		getY(y) {
				if (y === undefined) y = new Vec3();
				return y.set(this.data[4], this.data[5], this.data[6]);
		}
		getZ(z) {
				if (z === undefined) z = new Vec3();
				return z.set(this.data[8], this.data[9], this.data[10]);
		}
		getScale(scale) {
				if (scale === undefined) scale = new Vec3();
				this.getX(x);
				this.getY(y);
				this.getZ(z);
				scale.set(x.length(), y.length(), z.length());
				return scale;
		}
		get scaleSign() {
				this.getX(x);
				this.getY(y);
				this.getZ(z);
				x.cross(x, y);
				return x.dot(z) < 0 ? -1 : 1;
		}
		setFromEulerAngles(ex, ey, ez) {
				ex *= math.DEG_TO_RAD;
				ey *= math.DEG_TO_RAD;
				ez *= math.DEG_TO_RAD;
				var s1 = Math.sin(-ex);
				var c1 = Math.cos(-ex);
				var s2 = Math.sin(-ey);
				var c2 = Math.cos(-ey);
				var s3 = Math.sin(-ez);
				var c3 = Math.cos(-ez);
				var m = this.data;
				m[0] = c2 * c3;
				m[1] = -c2 * s3;
				m[2] = s2;
				m[3] = 0;
				m[4] = c1 * s3 + c3 * s1 * s2;
				m[5] = c1 * c3 - s1 * s2 * s3;
				m[6] = -c2 * s1;
				m[7] = 0;
				m[8] = s1 * s3 - c1 * c3 * s2;
				m[9] = c3 * s1 + c1 * s2 * s3;
				m[10] = c1 * c2;
				m[11] = 0;
				m[12] = 0;
				m[13] = 0;
				m[14] = 0;
				m[15] = 1;
				return this;
		}
		getEulerAngles(eulers) {
				if (eulers === undefined) eulers = new Vec3();
				this.getScale(scale);
				var sx = scale.x;
				var sy = scale.y;
				var sz = scale.z;
				if (sx === 0 || sy === 0 || sz === 0) {
						return eulers.set(0, 0, 0);
				}
				var m = this.data;
				var y = Math.asin(-m[2] / sx);
				var halfPi = Math.PI * 0.5;
				var x, z;
				if (y < halfPi) {
						if (y > -halfPi) {
								x = Math.atan2(m[6] / sy, m[10] / sz);
								z = Math.atan2(m[1] / sx, m[0] / sx);
						} else {
								z = 0;
								x = -Math.atan2(m[4] / sy, m[5] / sy);
						}
				} else {
						z = 0;
						x = Math.atan2(m[4] / sy, m[5] / sy);
				}
				return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
		}
		toString() {
				return "[" + this.data.join(', ') + "]";
		}
		constructor(){
				this.data = new Float32Array(16);
				this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
		}
}
Mat4.IDENTITY = Object.freeze(new Mat4());
Mat4.ZERO = Object.freeze(new Mat4().set([
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
]));

export { Mat4 };
