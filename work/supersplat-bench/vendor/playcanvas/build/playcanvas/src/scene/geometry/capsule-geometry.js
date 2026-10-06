import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class CapsuleGeometry extends ConeBaseGeometry {
		constructor(opts = {}){
				var _opts_radius;
				var radius = (_opts_radius = opts.radius) != null ? _opts_radius : 0.3;
				var _opts_height;
				var height = (_opts_height = opts.height) != null ? _opts_height : 1;
				var _opts_heightSegments;
				var heightSegments = (_opts_heightSegments = opts.heightSegments) != null ? _opts_heightSegments : 1;
				var _opts_sides;
				var sides = (_opts_sides = opts.sides) != null ? _opts_sides : 20;
				super(radius, radius, height - 2 * radius, heightSegments, sides, true);
				if (opts.calculateTangents) {
						this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
				}
		}
}

export { CapsuleGeometry };
