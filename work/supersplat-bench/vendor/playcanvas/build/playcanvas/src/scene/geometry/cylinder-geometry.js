import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class CylinderGeometry extends ConeBaseGeometry {
		constructor(opts = {}){
				var _opts_radius;
				var radius = (_opts_radius = opts.radius) != null ? _opts_radius : 0.5;
				var _opts_height;
				var height = (_opts_height = opts.height) != null ? _opts_height : 1;
				var _opts_heightSegments;
				var heightSegments = (_opts_heightSegments = opts.heightSegments) != null ? _opts_heightSegments : 5;
				var _opts_capSegments;
				var capSegments = (_opts_capSegments = opts.capSegments) != null ? _opts_capSegments : 20;
				super(radius, radius, height, heightSegments, capSegments, false);
				if (opts.calculateTangents) {
						this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
				}
		}
}

export { CylinderGeometry };
