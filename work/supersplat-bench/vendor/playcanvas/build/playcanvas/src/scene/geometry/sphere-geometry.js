import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class SphereGeometry extends Geometry {
		constructor(opts = {}){
				super();
				var _opts_radius;
				var radius = (_opts_radius = opts.radius) != null ? _opts_radius : 0.5;
				var _opts_latitudeBands;
				var latitudeBands = (_opts_latitudeBands = opts.latitudeBands) != null ? _opts_latitudeBands : 16;
				var _opts_longitudeBands;
				var longitudeBands = (_opts_longitudeBands = opts.longitudeBands) != null ? _opts_longitudeBands : 16;
				var positions = [];
				var normals = [];
				var uvs = [];
				var indices = [];
				for(var lat = 0; lat <= latitudeBands; lat++){
						var theta = lat * Math.PI / latitudeBands;
						var sinTheta = Math.sin(theta);
						var cosTheta = Math.cos(theta);
						for(var lon = 0; lon <= longitudeBands; lon++){
								var phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
								var sinPhi = Math.sin(phi);
								var cosPhi = Math.cos(phi);
								var x = cosPhi * sinTheta;
								var y = cosTheta;
								var z = sinPhi * sinTheta;
								var u = 1 - lon / longitudeBands;
								var v = 1 - lat / latitudeBands;
								positions.push(x * radius, y * radius, z * radius);
								normals.push(x, y, z);
								uvs.push(u, 1 - v);
						}
				}
				for(var lat1 = 0; lat1 < latitudeBands; ++lat1){
						for(var lon1 = 0; lon1 < longitudeBands; ++lon1){
								var first = lat1 * (longitudeBands + 1) + lon1;
								var second = first + longitudeBands + 1;
								indices.push(first + 1, second, first);
								indices.push(first + 1, second + 1, second);
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

export { SphereGeometry };
