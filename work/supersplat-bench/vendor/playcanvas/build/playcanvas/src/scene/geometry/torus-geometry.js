import { math } from '../../core/math/math.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class TorusGeometry extends Geometry {
		constructor(opts = {}){
				super();
				var _opts_tubeRadius;
				var rc = (_opts_tubeRadius = opts.tubeRadius) != null ? _opts_tubeRadius : 0.2;
				var _opts_ringRadius;
				var rt = (_opts_ringRadius = opts.ringRadius) != null ? _opts_ringRadius : 0.3;
				var _opts_sectorAngle;
				var sectorAngle = ((_opts_sectorAngle = opts.sectorAngle) != null ? _opts_sectorAngle : 360) * math.DEG_TO_RAD;
				var _opts_segments;
				var segments = (_opts_segments = opts.segments) != null ? _opts_segments : 30;
				var _opts_sides;
				var sides = (_opts_sides = opts.sides) != null ? _opts_sides : 20;
				var positions = [];
				var normals = [];
				var uvs = [];
				var indices = [];
				for(var i = 0; i <= sides; i++){
						for(var j = 0; j <= segments; j++){
								var x = Math.cos(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
								var y = Math.sin(2 * Math.PI * i / sides) * rc;
								var z = Math.sin(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
								var nx = Math.cos(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
								var ny = Math.sin(2 * Math.PI * i / sides);
								var nz = Math.sin(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
								var u = i / sides;
								var v = 1 - j / segments;
								positions.push(x, y, z);
								normals.push(nx, ny, nz);
								uvs.push(u, 1.0 - v);
								if (i < sides && j < segments) {
										var first = i * (segments + 1) + j;
										var second = (i + 1) * (segments + 1) + j;
										var third = i * (segments + 1) + (j + 1);
										var fourth = (i + 1) * (segments + 1) + (j + 1);
										indices.push(first, second, third);
										indices.push(second, fourth, third);
								}
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

export { TorusGeometry };
