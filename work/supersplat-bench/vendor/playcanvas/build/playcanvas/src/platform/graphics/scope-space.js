import { ScopeId } from './scope-id.js';

class ScopeSpace {
		resolve(name) {
				if (!this.variables.has(name)) {
						this.variables.set(name, new ScopeId(name));
				}
				return this.variables.get(name);
		}
		removeValue(value) {
				for(var uniformName in this.variables){
						var uniform = this.variables[uniformName];
						if (uniform.value === value) {
								uniform.value = null;
						}
				}
		}
		constructor(name){
				this.name = name;
				this.variables = new Map();
		}
}

export { ScopeSpace };
