import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';

var SH_C0 = 0.28209479177387814;
class SplatCompressedIterator {
		constructor(gsplatData, p, r, s, c, sh){
				var unpackUnorm = (value, bits)=>{
						var t = (1 << bits) - 1;
						return (value & t) / t;
				};
				var unpack111011 = (result, value)=>{
						result.x = unpackUnorm(value >>> 21, 11);
						result.y = unpackUnorm(value >>> 11, 10);
						result.z = unpackUnorm(value, 11);
				};
				var unpack8888 = (result, value)=>{
						result.x = unpackUnorm(value >>> 24, 8);
						result.y = unpackUnorm(value >>> 16, 8);
						result.z = unpackUnorm(value >>> 8, 8);
						result.w = unpackUnorm(value, 8);
				};
				var unpackRot = (result, value)=>{
						var norm = 1.0 / (Math.sqrt(2) * 0.5);
						var a = (unpackUnorm(value >>> 20, 10) - 0.5) * norm;
						var b = (unpackUnorm(value >>> 10, 10) - 0.5) * norm;
						var c = (unpackUnorm(value, 10) - 0.5) * norm;
						var m = Math.sqrt(1.0 - (a * a + b * b + c * c));
						switch(value >>> 30){
								case 0:
										result.set(a, b, c, m);
										break;
								case 1:
										result.set(m, b, c, a);
										break;
								case 2:
										result.set(b, m, c, a);
										break;
								case 3:
										result.set(b, c, m, a);
										break;
						}
				};
				var lerp = (a, b, t)=>a * (1 - t) + b * t;
				var { chunkData, chunkSize, vertexData, shData, shBands } = gsplatData;
				var shCoeffs = [
						3,
						8,
						15
				][shBands - 1];
				this.read = (i)=>{
						var ci = Math.floor(i / 256) * chunkSize;
						if (p) {
								unpack111011(p, vertexData[i * 4 + 0]);
								p.x = lerp(chunkData[ci + 0], chunkData[ci + 3], p.x);
								p.y = lerp(chunkData[ci + 1], chunkData[ci + 4], p.y);
								p.z = lerp(chunkData[ci + 2], chunkData[ci + 5], p.z);
						}
						if (r) {
								unpackRot(r, vertexData[i * 4 + 1]);
						}
						if (s) {
								unpack111011(s, vertexData[i * 4 + 2]);
								s.x = lerp(chunkData[ci + 6], chunkData[ci + 9], s.x);
								s.y = lerp(chunkData[ci + 7], chunkData[ci + 10], s.y);
								s.z = lerp(chunkData[ci + 8], chunkData[ci + 11], s.z);
						}
						if (c) {
								unpack8888(c, vertexData[i * 4 + 3]);
								if (chunkSize > 12) {
										c.x = lerp(chunkData[ci + 12], chunkData[ci + 15], c.x);
										c.y = lerp(chunkData[ci + 13], chunkData[ci + 16], c.y);
										c.z = lerp(chunkData[ci + 14], chunkData[ci + 17], c.z);
								}
						}
						if (sh && shBands > 0) {
								for(var j = 0; j < 3; ++j){
										for(var k = 0; k < 15; ++k){
												sh[j * 15 + k] = k < shCoeffs ? shData[(i * 3 + j) * shCoeffs + k] * (8 / 255) - 4 : 0;
										}
								}
						}
				};
		}
}
class GSplatCompressedData {
		createIter(p, r, s, c, sh) {
				return new SplatCompressedIterator(this, p, r, s, c, sh);
		}
		calcAabb(result) {
				var { chunkData, numChunks, chunkSize } = this;
				var s = Math.exp(Math.max(chunkData[9], chunkData[10], chunkData[11]));
				var mx = chunkData[0] - s;
				var my = chunkData[1] - s;
				var mz = chunkData[2] - s;
				var Mx = chunkData[3] + s;
				var My = chunkData[4] + s;
				var Mz = chunkData[5] + s;
				for(var i = 1; i < numChunks; ++i){
						var off = i * chunkSize;
						s = Math.exp(Math.max(chunkData[off + 9], chunkData[off + 10], chunkData[off + 11]));
						mx = Math.min(mx, chunkData[off + 0] - s);
						my = Math.min(my, chunkData[off + 1] - s);
						mz = Math.min(mz, chunkData[off + 2] - s);
						Mx = Math.max(Mx, chunkData[off + 3] + s);
						My = Math.max(My, chunkData[off + 4] + s);
						Mz = Math.max(Mz, chunkData[off + 5] + s);
				}
				result.center.set((mx + Mx) * 0.5, (my + My) * 0.5, (mz + Mz) * 0.5);
				result.halfExtents.set((Mx - mx) * 0.5, (My - my) * 0.5, (Mz - mz) * 0.5);
				return true;
		}
		getCenters(result) {
				var { vertexData, chunkData, numChunks, chunkSize } = this;
				var mx, my, mz, Mx, My, Mz;
				for(var c = 0; c < numChunks; ++c){
						var off = c * chunkSize;
						mx = chunkData[off + 0];
						my = chunkData[off + 1];
						mz = chunkData[off + 2];
						Mx = chunkData[off + 3];
						My = chunkData[off + 4];
						Mz = chunkData[off + 5];
						var end = Math.min(this.numSplats, (c + 1) * 256);
						for(var i = c * 256; i < end; ++i){
								var p = vertexData[i * 4];
								var px = (p >>> 21) / 2047;
								var py = (p >>> 11 & 0x3ff) / 1023;
								var pz = (p & 0x7ff) / 2047;
								result[i * 3 + 0] = (1 - px) * mx + px * Mx;
								result[i * 3 + 1] = (1 - py) * my + py * My;
								result[i * 3 + 2] = (1 - pz) * mz + pz * Mz;
						}
				}
		}
		calcFocalPoint(result) {
				var { chunkData, numChunks, chunkSize } = this;
				result.x = 0;
				result.y = 0;
				result.z = 0;
				for(var i = 0; i < numChunks; ++i){
						var off = i * chunkSize;
						result.x += chunkData[off + 0] + chunkData[off + 3];
						result.y += chunkData[off + 1] + chunkData[off + 4];
						result.z += chunkData[off + 2] + chunkData[off + 5];
				}
				result.mulScalar(0.5 / numChunks);
		}
		get isCompressed() {
				return true;
		}
		get numChunks() {
				return Math.ceil(this.numSplats / 256);
		}
		get chunkSize() {
				return this.chunkData.length / this.numChunks;
		}
		get shBands() {
				var _this_shData;
				var sizes = {
						3: 1,
						8: 2,
						15: 3
				};
				var _sizes_;
				return (_sizes_ = sizes[((_this_shData = this.shData) == null ? undefined : _this_shData.length) / this.numSplats / 3]) != null ? _sizes_ : 0;
		}
		decompress() {
				var members = [
						'x',
						'y',
						'z',
						'f_dc_0',
						'f_dc_1',
						'f_dc_2',
						'opacity',
						'scale_0',
						'scale_1',
						'scale_2',
						'rot_0',
						'rot_1',
						'rot_2',
						'rot_3'
				];
				var { shBands } = this;
				if (shBands > 0) {
						var shMembers = [];
						for(var i = 0; i < 45; ++i){
								shMembers.push("f_rest_" + i);
						}
						members.splice(members.indexOf('f_dc_0') + 1, 0, ...shMembers);
				}
				var data = {};
				members.forEach((name)=>{
						data[name] = new Float32Array(this.numSplats);
				});
				var p = new Vec3();
				var r = new Quat();
				var s = new Vec3();
				var c = new Vec4();
				var sh = shBands > 0 ? new Float32Array(45) : null;
				var iter = this.createIter(p, r, s, c, sh);
				for(var i1 = 0; i1 < this.numSplats; ++i1){
						iter.read(i1);
						data.x[i1] = p.x;
						data.y[i1] = p.y;
						data.z[i1] = p.z;
						data.rot_1[i1] = r.x;
						data.rot_2[i1] = r.y;
						data.rot_3[i1] = r.z;
						data.rot_0[i1] = r.w;
						data.scale_0[i1] = s.x;
						data.scale_1[i1] = s.y;
						data.scale_2[i1] = s.z;
						data.f_dc_0[i1] = (c.x - 0.5) / SH_C0;
						data.f_dc_1[i1] = (c.y - 0.5) / SH_C0;
						data.f_dc_2[i1] = (c.z - 0.5) / SH_C0;
						data.opacity[i1] = c.w <= 0 ? -40 : c.w >= 1 ? 40 : -Math.log(1 / c.w - 1);
						if (sh) {
								for(var c1 = 0; c1 < 45; ++c1){
										data["f_rest_" + c1][i1] = sh[c1];
								}
						}
				}
				return new GSplatData([
						{
								name: 'vertex',
								count: this.numSplats,
								properties: members.map((name)=>{
										return {
												name: name,
												type: 'float',
												byteSize: 4,
												storage: data[name]
										};
								})
						}
				]);
		}
}

export { GSplatCompressedData };
