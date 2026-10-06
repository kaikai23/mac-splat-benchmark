import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

var mat4 = new Mat4();
var quat = new Quat();
var aabb = new BoundingBox();
var aabb2 = new BoundingBox();
var debugColor = new Color(1, 1, 0, 0.4);
var SH_C0 = 0.28209479177387814;
class SplatIterator {
		constructor(gsplatData, p, r, s, c){
				var x = gsplatData.getProp('x');
				var y = gsplatData.getProp('y');
				var z = gsplatData.getProp('z');
				var rx = gsplatData.getProp('rot_1');
				var ry = gsplatData.getProp('rot_2');
				var rz = gsplatData.getProp('rot_3');
				var rw = gsplatData.getProp('rot_0');
				var sx = gsplatData.getProp('scale_0');
				var sy = gsplatData.getProp('scale_1');
				var sz = gsplatData.getProp('scale_2');
				var cr = gsplatData.getProp('f_dc_0');
				var cg = gsplatData.getProp('f_dc_1');
				var cb = gsplatData.getProp('f_dc_2');
				var ca = gsplatData.getProp('opacity');
				var sigmoid = (v)=>{
						if (v > 0) {
								return 1 / (1 + Math.exp(-v));
						}
						var t = Math.exp(v);
						return t / (1 + t);
				};
				this.read = (i)=>{
						if (p) {
								p.x = x[i];
								p.y = y[i];
								p.z = z[i];
						}
						if (r) {
								r.set(rx[i], ry[i], rz[i], rw[i]);
						}
						if (s) {
								s.set(Math.exp(sx[i]), Math.exp(sy[i]), Math.exp(sz[i]));
						}
						if (c) {
								c.set(0.5 + cr[i] * SH_C0, 0.5 + cg[i] * SH_C0, 0.5 + cb[i] * SH_C0, sigmoid(ca[i]));
						}
				};
		}
}
var calcSplatMat = (result, p, r)=>{
		quat.set(r.x, r.y, r.z, r.w).normalize();
		result.setTRS(p, quat, Vec3.ONE);
};
class GSplatData {
		static calcSplatAabb(result, p, r, s) {
				calcSplatMat(mat4, p, r);
				aabb.center.set(0, 0, 0);
				aabb.halfExtents.set(s.x * 2, s.y * 2, s.z * 2);
				result.setFromTransformedAabb(aabb, mat4);
		}
		getProp(name, elementName) {
				if (elementName === undefined) elementName = 'vertex';
				var _this_getElement_properties_find, _this_getElement;
				return (_this_getElement = this.getElement(elementName)) == null ? undefined : (_this_getElement_properties_find = _this_getElement.properties.find((p)=>p.name === name)) == null ? undefined : _this_getElement_properties_find.storage;
		}
		getElement(name) {
				return this.elements.find((e)=>e.name === name);
		}
		addProp(name, storage) {
				this.getElement('vertex').properties.push({
						type: 'float',
						name,
						storage,
						byteSize: 4
				});
		}
		createIter(p, r, s, c) {
				return new SplatIterator(this, p, r, s, c);
		}
		calcAabb(result, pred) {
				var mx, my, mz, Mx, My, Mz;
				var first = true;
				var x = this.getProp('x');
				var y = this.getProp('y');
				var z = this.getProp('z');
				var sx = this.getProp('scale_0');
				var sy = this.getProp('scale_1');
				var sz = this.getProp('scale_2');
				for(var i = 0; i < this.numSplats; ++i){
						if (pred && !pred(i)) {
								continue;
						}
						var scaleVal = 2.0 * Math.exp(Math.max(sx[i], sy[i], sz[i]));
						var px = x[i];
						var py = y[i];
						var pz = z[i];
						if (first) {
								first = false;
								mx = px - scaleVal;
								my = py - scaleVal;
								mz = pz - scaleVal;
								Mx = px + scaleVal;
								My = py + scaleVal;
								Mz = pz + scaleVal;
						} else {
								mx = Math.min(mx, px - scaleVal);
								my = Math.min(my, py - scaleVal);
								mz = Math.min(mz, pz - scaleVal);
								Mx = Math.max(Mx, px + scaleVal);
								My = Math.max(My, py + scaleVal);
								Mz = Math.max(Mz, pz + scaleVal);
						}
				}
				if (!first) {
						result.center.set((mx + Mx) * 0.5, (my + My) * 0.5, (mz + Mz) * 0.5);
						result.halfExtents.set((Mx - mx) * 0.5, (My - my) * 0.5, (Mz - mz) * 0.5);
				}
				return !first;
		}
		calcAabbExact(result, pred) {
				var p = new Vec3();
				var r = new Quat();
				var s = new Vec3();
				var iter = this.createIter(p, r, s);
				var first = true;
				for(var i = 0; i < this.numSplats; ++i){
						if (pred && !pred(i)) {
								continue;
						}
						iter.read(i);
						if (first) {
								first = false;
								GSplatData.calcSplatAabb(result, p, r, s);
						} else {
								GSplatData.calcSplatAabb(aabb2, p, r, s);
								result.add(aabb2);
						}
				}
				return !first;
		}
		getCenters(result) {
				var x = this.getProp('x');
				var y = this.getProp('y');
				var z = this.getProp('z');
				for(var i = 0; i < this.numSplats; ++i){
						result[i * 3 + 0] = x[i];
						result[i * 3 + 1] = y[i];
						result[i * 3 + 2] = z[i];
				}
		}
		calcFocalPoint(result, pred) {
				var x = this.getProp('x');
				var y = this.getProp('y');
				var z = this.getProp('z');
				var sx = this.getProp('scale_0');
				var sy = this.getProp('scale_1');
				var sz = this.getProp('scale_2');
				result.x = 0;
				result.y = 0;
				result.z = 0;
				var sum = 0;
				for(var i = 0; i < this.numSplats; ++i){
						if (pred && !pred(i)) {
								continue;
						}
						var weight = 1.0 / (1.0 + Math.exp(Math.max(sx[i], sy[i], sz[i])));
						result.x += x[i] * weight;
						result.y += y[i] * weight;
						result.z += z[i] * weight;
						sum += weight;
				}
				result.mulScalar(1 / sum);
		}
		renderWireframeBounds(scene, worldMat) {
				var p = new Vec3();
				var r = new Quat();
				var s = new Vec3();
				var min = new Vec3();
				var max = new Vec3();
				var iter = this.createIter(p, r, s);
				for(var i = 0; i < this.numSplats; ++i){
						iter.read(i);
						calcSplatMat(mat4, p, r);
						mat4.mul2(worldMat, mat4);
						min.set(s.x * -2, s.y * -2, s.z * -2);
						max.set(s.x * 2.0, s.y * 2.0, s.z * 2.0);
						scene.immediate.drawWireAlignedBox(min, max, debugColor, true, scene.defaultDrawLayer, mat4);
				}
		}
		get isCompressed() {
				return false;
		}
		get shBands() {
				var numProps = ()=>{
						for(var i = 0; i < 45; ++i){
								if (!this.getProp("f_rest_" + i)) {
										return i;
								}
						}
						return 45;
				};
				var sizes = {
						9: 1,
						24: 2,
						45: 3
				};
				var _sizes_numProps;
				return (_sizes_numProps = sizes[numProps()]) != null ? _sizes_numProps : 0;
		}
		calcMortonOrder() {
				var calcMinMax = (arr)=>{
						var min = arr[0];
						var max = arr[0];
						for(var i = 1; i < arr.length; i++){
								if (arr[i] < min) min = arr[i];
								if (arr[i] > max) max = arr[i];
						}
						return {
								min,
								max
						};
				};
				var encodeMorton3 = (x, y, z)=>{
						var Part1By2 = (x)=>{
								x &= 0x000003ff;
								x = (x ^ x << 16) & 0xff0000ff;
								x = (x ^ x << 8) & 0x0300f00f;
								x = (x ^ x << 4) & 0x030c30c3;
								x = (x ^ x << 2) & 0x09249249;
								return x;
						};
						return (Part1By2(z) << 2) + (Part1By2(y) << 1) + Part1By2(x);
				};
				var x = this.getProp('x');
				var y = this.getProp('y');
				var z = this.getProp('z');
				var { min: minX, max: maxX } = calcMinMax(x);
				var { min: minY, max: maxY } = calcMinMax(y);
				var { min: minZ, max: maxZ } = calcMinMax(z);
				var sizeX = minX === maxX ? 0 : 1024 / (maxX - minX);
				var sizeY = minY === maxY ? 0 : 1024 / (maxY - minY);
				var sizeZ = minZ === maxZ ? 0 : 1024 / (maxZ - minZ);
				var codes = new Map();
				for(var i = 0; i < this.numSplats; i++){
						var ix = Math.floor((x[i] - minX) * sizeX);
						var iy = Math.floor((y[i] - minY) * sizeY);
						var iz = Math.floor((z[i] - minZ) * sizeZ);
						var code = encodeMorton3(ix, iy, iz);
						var val = codes.get(code);
						if (val) {
								val.push(i);
						} else {
								codes.set(code, [
										i
								]);
						}
				}
				var keys = Array.from(codes.keys()).sort((a, b)=>a - b);
				var indices = new Uint32Array(this.numSplats);
				var idx = 0;
				for(var i1 = 0; i1 < keys.length; ++i1){
						var val1 = codes.get(keys[i1]);
						for(var j = 0; j < val1.length; ++j){
								indices[idx++] = val1[j];
						}
				}
				return indices;
		}
		reorder(order) {
				var cache = new Map();
				var getStorage = (size)=>{
						if (cache.has(size)) {
								var buffer = cache.get(size);
								cache.delete(size);
								return buffer;
						}
						return new ArrayBuffer(size);
				};
				var returnStorage = (buffer)=>{
						cache.set(buffer.byteLength, buffer);
				};
				var reorder = (data)=>{
						var result = new data.constructor(getStorage(data.byteLength));
						for(var i = 0; i < order.length; i++){
								result[i] = data[order[i]];
						}
						returnStorage(data.buffer);
						return result;
				};
				this.elements.forEach((element)=>{
						element.properties.forEach((property)=>{
								if (property.storage) {
										property.storage = reorder(property.storage);
								}
						});
				});
		}
		reorderData() {
				this.reorder(this.calcMortonOrder());
		}
		constructor(elements){
				this.elements = elements;
				this.numSplats = this.getElement('vertex').count;
		}
}

export { GSplatData };
