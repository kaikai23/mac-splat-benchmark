import { Vec3 } from '../../core/math/vec3.js';
import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';

var lightCubeDir = [
		new Vec3(-1, 0, 0),
		new Vec3(1, 0, 0),
		new Vec3(0, -1, 0),
		new Vec3(0, 1, 0),
		new Vec3(0, 0, -1),
		new Vec3(0, 0, 1)
];
class LightCube {
		update(ambientLight, lights) {
				var colors = this.colors;
				var { r, g, b } = ambientLight;
				for(var j = 0; j < 6; j++){
						colors[j * 3] = r;
						colors[j * 3 + 1] = g;
						colors[j * 3 + 2] = b;
				}
				for(var j1 = 0; j1 < lights.length; j1++){
						var light = lights[j1];
						if (light._type === LIGHTTYPE_DIRECTIONAL) {
								for(var c = 0; c < 6; c++){
										var weight = Math.max(lightCubeDir[c].dot(light._direction), 0) * light._intensity;
										var lightColor = light._color;
										colors[c * 3] += lightColor.r * weight;
										colors[c * 3 + 1] += lightColor.g * weight;
										colors[c * 3 + 2] += lightColor.b * weight;
								}
						}
				}
		}
		constructor(){
				this.colors = new Float32Array(6 * 3);
		}
}

export { LightCube };
