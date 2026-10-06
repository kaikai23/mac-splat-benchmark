import { SphereGeometry } from './sphere-geometry.js';

class DomeGeometry extends SphereGeometry {
		constructor(opts = {}){
				var radius = 0.5;
				var _opts_latitudeBands;
				var latitudeBands = (_opts_latitudeBands = opts.latitudeBands) != null ? _opts_latitudeBands : 16;
				var _opts_longitudeBands;
				var longitudeBands = (_opts_longitudeBands = opts.longitudeBands) != null ? _opts_longitudeBands : 16;
				super({
						radius,
						latitudeBands,
						longitudeBands
				});
				var bottomLimit = 0.1;
				var curvatureRadius = 0.95;
				var curvatureRadiusSq = curvatureRadius * curvatureRadius;
				var positions = this.positions;
				for(var i = 0; i < positions.length; i += 3){
						var x = positions[i] / radius;
						var y = positions[i + 1] / radius;
						var z = positions[i + 2] / radius;
						if (y < 0) {
								y *= 0.3;
								if (x * x + z * z < curvatureRadiusSq) {
										y = -0.1;
								}
						}
						y += bottomLimit;
						y *= radius;
						positions[i + 1] = y;
				}
		}
}

export { DomeGeometry };
