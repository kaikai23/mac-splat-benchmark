import { Vec2 } from '../../core/math/vec2.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class PlaneGeometry extends Geometry {
		constructor(opts = {}){
				super();
				var _opts_halfExtents;
				var he = (_opts_halfExtents = opts.halfExtents) != null ? _opts_halfExtents : new Vec2(0.5, 0.5);
				var _opts_widthSegments;
				var ws = (_opts_widthSegments = opts.widthSegments) != null ? _opts_widthSegments : 5;
				var _opts_lengthSegments;
				var ls = (_opts_lengthSegments = opts.lengthSegments) != null ? _opts_lengthSegments : 5;
				var positions = [];
				var normals = [];
				var uvs = [];
				var indices = [];
				var vcounter = 0;
				for(var i = 0; i <= ws; i++){
						for(var j = 0; j <= ls; j++){
								var x = -he.x + 2 * he.x * i / ws;
								var y = 0.0;
								var z = -(-he.y + 2 * he.y * j / ls);
								var u = i / ws;
								var v = j / ls;
								positions.push(x, y, z);
								normals.push(0, 1, 0);
								uvs.push(u, 1 - v);
								if (i < ws && j < ls) {
										indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
										indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
								}
								vcounter++;
						}
				}
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

export { PlaneGeometry };
