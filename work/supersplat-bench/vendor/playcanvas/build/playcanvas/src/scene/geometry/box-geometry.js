import { Vec3 } from '../../core/math/vec3.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

var primitiveUv1Padding = 4.0 / 64;
var primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
class BoxGeometry extends Geometry {
		constructor(opts = {}){
				super();
				var _opts_halfExtents;
				var he = (_opts_halfExtents = opts.halfExtents) != null ? _opts_halfExtents : new Vec3(0.5, 0.5, 0.5);
				var _opts_widthSegments;
				var ws = (_opts_widthSegments = opts.widthSegments) != null ? _opts_widthSegments : 1;
				var _opts_lengthSegments;
				var ls = (_opts_lengthSegments = opts.lengthSegments) != null ? _opts_lengthSegments : 1;
				var _opts_heightSegments;
				var hs = (_opts_heightSegments = opts.heightSegments) != null ? _opts_heightSegments : 1;
				var _opts_yOffset;
				var yOffset = (_opts_yOffset = opts.yOffset) != null ? _opts_yOffset : 0;
				var minY = -he.y + yOffset;
				var maxY = he.y + yOffset;
				var corners = [
						new Vec3(-he.x, minY, he.z),
						new Vec3(he.x, minY, he.z),
						new Vec3(he.x, maxY, he.z),
						new Vec3(-he.x, maxY, he.z),
						new Vec3(he.x, minY, -he.z),
						new Vec3(-he.x, minY, -he.z),
						new Vec3(-he.x, maxY, -he.z),
						new Vec3(he.x, maxY, -he.z)
				];
				var faceAxes = [
						[
								0,
								1,
								3
						],
						[
								4,
								5,
								7
						],
						[
								3,
								2,
								6
						],
						[
								1,
								0,
								4
						],
						[
								1,
								4,
								2
						],
						[
								5,
								0,
								6
						]
				];
				var faceNormals = [
						[
								0,
								0,
								1
						],
						[
								0,
								0,
								-1
						],
						[
								0,
								1,
								0
						],
						[
								0,
								-1,
								0
						],
						[
								1,
								0,
								0
						],
						[
								-1,
								0,
								0
						]
				];
				var sides = {
						FRONT: 0,
						BACK: 1,
						TOP: 2,
						BOTTOM: 3,
						RIGHT: 4,
						LEFT: 5
				};
				var positions = [];
				var normals = [];
				var uvs = [];
				var indices = [];
				var vcounter = 0;
				var generateFace = (side, uSegments, vSegments)=>{
						var temp1 = new Vec3();
						var temp2 = new Vec3();
						var temp3 = new Vec3();
						var r = new Vec3();
						for(var i = 0; i <= uSegments; i++){
								for(var j = 0; j <= vSegments; j++){
										temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
										temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
										temp3.sub2(temp2, corners[faceAxes[side][0]]);
										r.add2(temp1, temp3);
										var u = i / uSegments;
										var v = j / vSegments;
										positions.push(r.x, r.y, r.z);
										normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
										uvs.push(u, 1 - v);
										u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
										v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
										u /= 3;
										v /= 3;
										u += side % 3 / 3;
										v += Math.floor(side / 3) / 3;
										if (i < uSegments && j < vSegments) {
												indices.push(vcounter + vSegments + 1, vcounter + 1, vcounter);
												indices.push(vcounter + vSegments + 1, vcounter + vSegments + 2, vcounter + 1);
										}
										vcounter++;
								}
						}
				};
				generateFace(sides.FRONT, ws, hs);
				generateFace(sides.BACK, ws, hs);
				generateFace(sides.TOP, ws, ls);
				generateFace(sides.BOTTOM, ws, ls);
				generateFace(sides.RIGHT, ls, hs);
				generateFace(sides.LEFT, ls, hs);
				this.positions = positions;
				this.normals = normals;
				this.uvs = uvs;
				this.uvs1 = uvs;
				this.indices = indices;
				if (opts.calculateTangents) {
						this.tangents = calculateTangents(positions, normals, uvs, indices);
				}
		}
}

export { BoxGeometry };
