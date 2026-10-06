import { DeviceCache } from '../platform/graphics/device-cache.js';
import { SHADER_DEPTH, SHADER_PICK, SHADER_FORWARD } from './constants.js';

var shaderPassDeviceCache = new DeviceCache();
class ShaderPassInfo {
		buildShaderDefines() {
				var keyword;
				if (this.isShadow) {
						keyword = 'SHADOW';
				} else if (this.isForward) {
						keyword = 'FORWARD';
				} else if (this.index === SHADER_DEPTH) {
						keyword = 'DEPTH';
				} else if (this.index === SHADER_PICK) {
						keyword = 'PICK';
				}
				this.defines.set("" + keyword + "_PASS", '');
				this.defines.set("" + this.name.toUpperCase() + "_PASS", '');
		}
		constructor(name, index, options = {}){
				this.defines = new Map();
				this.name = name;
				this.index = index;
				Object.assign(this, options);
				this.buildShaderDefines();
		}
}
class ShaderPass {
		static get(device) {
				return shaderPassDeviceCache.get(device, ()=>{
						return new ShaderPass();
				});
		}
		allocate(name, options) {
				var info = this.passesNamed.get(name);
				if (info === undefined) {
						info = new ShaderPassInfo(name, this.nextIndex, options);
						this.passesNamed.set(info.name, info);
						this.passesIndexed[info.index] = info;
						this.nextIndex++;
				}
				return info;
		}
		getByIndex(index) {
				var info = this.passesIndexed[index];
				return info;
		}
		getByName(name) {
				return this.passesNamed.get(name);
		}
		constructor(){
				this.passesNamed = new Map();
				this.passesIndexed = [];
				this.nextIndex = 0;
				var add = (name, index, options)=>{
						this.allocate(name, options);
				};
				add('forward', SHADER_FORWARD, {
						isForward: true
				});
				add('prepass');
				add('depth');
				add('pick');
				add('shadow');
		}
}

export { ShaderPass, ShaderPassInfo };
