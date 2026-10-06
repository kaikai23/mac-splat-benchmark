import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';

var calculateNormals = (positions, indices)=>{
		var triangleCount = indices.length / 3;
		var vertexCount = positions.length / 3;
		var p1 = new Vec3();
		var p2 = new Vec3();
		var p3 = new Vec3();
		var p1p2 = new Vec3();
		var p1p3 = new Vec3();
		var faceNormal = new Vec3();
		var normals = [];
		for(var i = 0; i < positions.length; i++){
				normals[i] = 0;
		}
		for(var i1 = 0; i1 < triangleCount; i1++){
				var i11 = indices[i1 * 3];
				var i2 = indices[i1 * 3 + 1];
				var i3 = indices[i1 * 3 + 2];
				p1.set(positions[i11 * 3], positions[i11 * 3 + 1], positions[i11 * 3 + 2]);
				p2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
				p3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
				p1p2.sub2(p2, p1);
				p1p3.sub2(p3, p1);
				faceNormal.cross(p1p2, p1p3).normalize();
				normals[i11 * 3] += faceNormal.x;
				normals[i11 * 3 + 1] += faceNormal.y;
				normals[i11 * 3 + 2] += faceNormal.z;
				normals[i2 * 3] += faceNormal.x;
				normals[i2 * 3 + 1] += faceNormal.y;
				normals[i2 * 3 + 2] += faceNormal.z;
				normals[i3 * 3] += faceNormal.x;
				normals[i3 * 3 + 1] += faceNormal.y;
				normals[i3 * 3 + 2] += faceNormal.z;
		}
		for(var i4 = 0; i4 < vertexCount; i4++){
				var nx = normals[i4 * 3];
				var ny = normals[i4 * 3 + 1];
				var nz = normals[i4 * 3 + 2];
				var invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
				normals[i4 * 3] *= invLen;
				normals[i4 * 3 + 1] *= invLen;
				normals[i4 * 3 + 2] *= invLen;
		}
		return normals;
};
var calculateTangents = (positions, normals, uvs, indices)=>{
		var triangleCount = indices.length / 3;
		var vertexCount = positions.length / 3;
		var v1 = new Vec3();
		var v2 = new Vec3();
		var v3 = new Vec3();
		var w1 = new Vec2();
		var w2 = new Vec2();
		var w3 = new Vec2();
		var sdir = new Vec3();
		var tdir = new Vec3();
		var tan1 = new Float32Array(vertexCount * 3);
		var tan2 = new Float32Array(vertexCount * 3);
		var tangents = [];
		for(var i = 0; i < triangleCount; i++){
				var i1 = indices[i * 3];
				var i2 = indices[i * 3 + 1];
				var i3 = indices[i * 3 + 2];
				v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
				v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
				v3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
				w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
				w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
				w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);
				var x1 = v2.x - v1.x;
				var x2 = v3.x - v1.x;
				var y1 = v2.y - v1.y;
				var y2 = v3.y - v1.y;
				var z1 = v2.z - v1.z;
				var z2 = v3.z - v1.z;
				var s1 = w2.x - w1.x;
				var s2 = w3.x - w1.x;
				var t1 = w2.y - w1.y;
				var t2 = w3.y - w1.y;
				var area = s1 * t2 - s2 * t1;
				if (area === 0) {
						sdir.set(0, 1, 0);
						tdir.set(1, 0, 0);
				} else {
						var r = 1 / area;
						sdir.set((t2 * x1 - t1 * x2) * r, (t2 * y1 - t1 * y2) * r, (t2 * z1 - t1 * z2) * r);
						tdir.set((s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
				}
				tan1[i1 * 3 + 0] += sdir.x;
				tan1[i1 * 3 + 1] += sdir.y;
				tan1[i1 * 3 + 2] += sdir.z;
				tan1[i2 * 3 + 0] += sdir.x;
				tan1[i2 * 3 + 1] += sdir.y;
				tan1[i2 * 3 + 2] += sdir.z;
				tan1[i3 * 3 + 0] += sdir.x;
				tan1[i3 * 3 + 1] += sdir.y;
				tan1[i3 * 3 + 2] += sdir.z;
				tan2[i1 * 3 + 0] += tdir.x;
				tan2[i1 * 3 + 1] += tdir.y;
				tan2[i1 * 3 + 2] += tdir.z;
				tan2[i2 * 3 + 0] += tdir.x;
				tan2[i2 * 3 + 1] += tdir.y;
				tan2[i2 * 3 + 2] += tdir.z;
				tan2[i3 * 3 + 0] += tdir.x;
				tan2[i3 * 3 + 1] += tdir.y;
				tan2[i3 * 3 + 2] += tdir.z;
		}
		var t11 = new Vec3();
		var t21 = new Vec3();
		var n = new Vec3();
		var temp = new Vec3();
		for(var i4 = 0; i4 < vertexCount; i4++){
				n.set(normals[i4 * 3], normals[i4 * 3 + 1], normals[i4 * 3 + 2]);
				t11.set(tan1[i4 * 3], tan1[i4 * 3 + 1], tan1[i4 * 3 + 2]);
				t21.set(tan2[i4 * 3], tan2[i4 * 3 + 1], tan2[i4 * 3 + 2]);
				var ndott = n.dot(t11);
				temp.copy(n).mulScalar(ndott);
				temp.sub2(t11, temp).normalize();
				tangents[i4 * 4] = temp.x;
				tangents[i4 * 4 + 1] = temp.y;
				tangents[i4 * 4 + 2] = temp.z;
				temp.cross(n, t11);
				tangents[i4 * 4 + 3] = temp.dot(t21) < 0.0 ? -1 : 1.0;
		}
		return tangents;
};

export { calculateNormals, calculateTangents };
