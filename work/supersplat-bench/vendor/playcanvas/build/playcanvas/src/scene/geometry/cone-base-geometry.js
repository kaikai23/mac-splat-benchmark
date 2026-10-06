import { Vec3 } from '../../core/math/vec3.js';
import { Geometry } from './geometry.js';

var primitiveUv1Padding = 4.0 / 64;
var primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
class ConeBaseGeometry extends Geometry {
		constructor(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps){
				super();
				var pos = new Vec3();
				var bottomToTop = new Vec3();
				var norm = new Vec3();
				var top = new Vec3();
				var bottom = new Vec3();
				var tangent = new Vec3();
				var positions = [];
				var normals = [];
				var uvs = [];
				var uvs1 = [];
				var indices = [];
				var offset;
				if (height > 0) {
						for(var i = 0; i <= heightSegments; i++){
								for(var j = 0; j <= capSegments; j++){
										var theta = j / capSegments * 2 * Math.PI - Math.PI;
										var sinTheta = Math.sin(theta);
										var cosTheta = Math.cos(theta);
										bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
										top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
										pos.lerp(bottom, top, i / heightSegments);
										bottomToTop.sub2(top, bottom).normalize();
										tangent.set(cosTheta, 0, -sinTheta);
										norm.cross(tangent, bottomToTop).normalize();
										positions.push(pos.x, pos.y, pos.z);
										normals.push(norm.x, norm.y, norm.z);
										var u = j / capSegments;
										var v = i / heightSegments;
										uvs.push(u, 1 - v);
										var _v = v;
										v = u;
										u = _v;
										u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
										v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
										u /= 3;
										uvs1.push(u, 1 - v);
										if (i < heightSegments && j < capSegments) {
												var first = i * (capSegments + 1) + j;
												var second = i * (capSegments + 1) + (j + 1);
												var third = (i + 1) * (capSegments + 1) + j;
												var fourth = (i + 1) * (capSegments + 1) + (j + 1);
												indices.push(first, second, third);
												indices.push(second, fourth, third);
										}
								}
						}
				}
				if (roundedCaps) {
						var latitudeBands = Math.floor(capSegments / 2);
						var longitudeBands = capSegments;
						var capOffset = height / 2;
						for(var lat = 0; lat <= latitudeBands; lat++){
								var theta1 = lat * Math.PI * 0.5 / latitudeBands;
								var sinTheta1 = Math.sin(theta1);
								var cosTheta1 = Math.cos(theta1);
								for(var lon = 0; lon <= longitudeBands; lon++){
										var phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
										var sinPhi = Math.sin(phi);
										var cosPhi = Math.cos(phi);
										var x = cosPhi * sinTheta1;
										var y = cosTheta1;
										var z = sinPhi * sinTheta1;
										var u1 = 1 - lon / longitudeBands;
										var v1 = 1 - lat / latitudeBands;
										positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
										normals.push(x, y, z);
										uvs.push(u1, 1 - v1);
										u1 = u1 * primitiveUv1PaddingScale + primitiveUv1Padding;
										v1 = v1 * primitiveUv1PaddingScale + primitiveUv1Padding;
										u1 /= 3;
										v1 /= 3;
										u1 += 1.0 / 3;
										uvs1.push(u1, 1 - v1);
								}
						}
						offset = (heightSegments + 1) * (capSegments + 1);
						for(var lat1 = 0; lat1 < latitudeBands; ++lat1){
								for(var lon1 = 0; lon1 < longitudeBands; ++lon1){
										var first1 = lat1 * (longitudeBands + 1) + lon1;
										var second1 = first1 + longitudeBands + 1;
										indices.push(offset + first1 + 1, offset + second1, offset + first1);
										indices.push(offset + first1 + 1, offset + second1 + 1, offset + second1);
								}
						}
						for(var lat2 = 0; lat2 <= latitudeBands; lat2++){
								var theta2 = Math.PI * 0.5 + lat2 * Math.PI * 0.5 / latitudeBands;
								var sinTheta2 = Math.sin(theta2);
								var cosTheta2 = Math.cos(theta2);
								for(var lon2 = 0; lon2 <= longitudeBands; lon2++){
										var phi1 = lon2 * 2 * Math.PI / longitudeBands - Math.PI / 2;
										var sinPhi1 = Math.sin(phi1);
										var cosPhi1 = Math.cos(phi1);
										var x1 = cosPhi1 * sinTheta2;
										var y1 = cosTheta2;
										var z1 = sinPhi1 * sinTheta2;
										var u2 = 1 - lon2 / longitudeBands;
										var v2 = 1 - lat2 / latitudeBands;
										positions.push(x1 * peakRadius, y1 * peakRadius - capOffset, z1 * peakRadius);
										normals.push(x1, y1, z1);
										uvs.push(u2, 1 - v2);
										u2 = u2 * primitiveUv1PaddingScale + primitiveUv1Padding;
										v2 = v2 * primitiveUv1PaddingScale + primitiveUv1Padding;
										u2 /= 3;
										v2 /= 3;
										u2 += 2.0 / 3;
										uvs1.push(u2, 1 - v2);
								}
						}
						offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
						for(var lat3 = 0; lat3 < latitudeBands; ++lat3){
								for(var lon3 = 0; lon3 < longitudeBands; ++lon3){
										var first2 = lat3 * (longitudeBands + 1) + lon3;
										var second2 = first2 + longitudeBands + 1;
										indices.push(offset + first2 + 1, offset + second2, offset + first2);
										indices.push(offset + first2 + 1, offset + second2 + 1, offset + second2);
								}
						}
				} else {
						offset = (heightSegments + 1) * (capSegments + 1);
						if (baseRadius > 0) {
								for(var i1 = 0; i1 < capSegments; i1++){
										var theta3 = i1 / capSegments * 2 * Math.PI;
										var x2 = Math.sin(theta3);
										var y2 = -height / 2;
										var z2 = Math.cos(theta3);
										var u3 = 1 - (x2 + 1) / 2;
										var v3 = (z2 + 1) / 2;
										positions.push(x2 * baseRadius, y2, z2 * baseRadius);
										normals.push(0, -1, 0);
										uvs.push(u3, 1 - v3);
										u3 = u3 * primitiveUv1PaddingScale + primitiveUv1Padding;
										v3 = v3 * primitiveUv1PaddingScale + primitiveUv1Padding;
										u3 /= 3;
										v3 /= 3;
										u3 += 1 / 3;
										uvs1.push(u3, 1 - v3);
										if (i1 > 1) {
												indices.push(offset, offset + i1, offset + i1 - 1);
										}
								}
						}
						offset += capSegments;
						if (peakRadius > 0) {
								for(var i2 = 0; i2 < capSegments; i2++){
										var theta4 = i2 / capSegments * 2 * Math.PI;
										var x3 = Math.sin(theta4);
										var y3 = height / 2;
										var z3 = Math.cos(theta4);
										var u4 = 1 - (x3 + 1) / 2;
										var v4 = (z3 + 1) / 2;
										positions.push(x3 * peakRadius, y3, z3 * peakRadius);
										normals.push(0, 1, 0);
										uvs.push(u4, 1 - v4);
										u4 = u4 * primitiveUv1PaddingScale + primitiveUv1Padding;
										v4 = v4 * primitiveUv1PaddingScale + primitiveUv1Padding;
										u4 /= 3;
										v4 /= 3;
										u4 += 2 / 3;
										uvs1.push(u4, 1 - v4);
										if (i2 > 1) {
												indices.push(offset, offset + i2 - 1, offset + i2);
										}
								}
						}
				}
				this.positions = positions;
				this.normals = normals;
				this.uvs = uvs;
				this.uvs1 = uvs1;
				this.indices = indices;
		}
}

export { ConeBaseGeometry };
