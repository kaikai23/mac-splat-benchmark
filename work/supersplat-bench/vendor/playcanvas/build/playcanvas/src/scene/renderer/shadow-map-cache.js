import { LIGHTTYPE_OMNI } from '../constants.js';
import { ShadowMap } from './shadow-map.js';

class ShadowMapCache {
		destroy() {
				this.clear();
				this.cache = null;
		}
		clear() {
				this.cache.forEach((shadowMaps)=>{
						shadowMaps.forEach((shadowMap)=>{
								shadowMap.destroy();
						});
				});
				this.cache.clear();
		}
		getKey(light) {
				var isCubeMap = light._type === LIGHTTYPE_OMNI;
				var shadowType = light._shadowType;
				var resolution = light._shadowResolution;
				return isCubeMap + "-" + shadowType + "-" + resolution;
		}
		get(device, light) {
				var key = this.getKey(light);
				var shadowMaps = this.cache.get(key);
				if (shadowMaps && shadowMaps.length) {
						return shadowMaps.pop();
				}
				var shadowMap = ShadowMap.create(device, light);
				shadowMap.cached = true;
				return shadowMap;
		}
		add(light, shadowMap) {
				var key = this.getKey(light);
				var shadowMaps = this.cache.get(key);
				if (shadowMaps) {
						shadowMaps.push(shadowMap);
				} else {
						this.cache.set(key, [
								shadowMap
						]);
				}
		}
		constructor(){
				this.cache = new Map();
		}
}

export { ShadowMapCache };
