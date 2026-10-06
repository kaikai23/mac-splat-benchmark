import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class ConeGeometry extends ConeBaseGeometry {
		constructor(opts = {}){
				var _opts_baseRadius;
				var baseRadius = (_opts_baseRadius = opts.baseRadius) != null ? _opts_baseRadius : 0.5;
				var _opts_peakRadius;
				var peakRadius = (_opts_peakRadius = opts.peakRadius) != null ? _opts_peakRadius : 0;
				var _opts_height;
				var height = (_opts_height = opts.height) != null ? _opts_height : 1;
				var _opts_heightSegments;
				var heightSegments = (_opts_heightSegments = opts.heightSegments) != null ? _opts_heightSegments : 5;
				var _opts_capSegments;
				var capSegments = (_opts_capSegments = opts.capSegments) != null ? _opts_capSegments : 18;
				super(baseRadius, peakRadius, height, heightSegments, capSegments, false);
				if (opts.calculateTangents) {
						this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
				}
		}
}

export { ConeGeometry };
