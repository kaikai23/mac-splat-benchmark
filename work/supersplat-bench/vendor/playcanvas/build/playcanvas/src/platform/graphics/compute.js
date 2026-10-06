class ComputeParameter {
		constructor(){
				this.scopeId = null;
		}
}
class Compute {
		setParameter(name, value) {
				var param = this.parameters.get(name);
				if (!param) {
						param = new ComputeParameter();
						param.scopeId = this.device.scope.resolve(name);
						this.parameters.set(name, param);
				}
				param.value = value;
		}
		getParameter(name) {
				var _this_parameters_get;
				return (_this_parameters_get = this.parameters.get(name)) == null ? undefined : _this_parameters_get.value;
		}
		deleteParameter(name) {
				this.parameters.delete(name);
		}
		applyParameters() {
				for (var [, param] of this.parameters){
						param.scopeId.setValue(param.value);
				}
		}
		setupDispatch(x, y, z) {
				this.countX = x;
				this.countY = y;
				this.countZ = z;
		}
		constructor(graphicsDevice, shader, name = 'Unnamed'){
				this.shader = null;
				this.parameters = new Map();
				this.countX = 1;
				this.device = graphicsDevice;
				this.shader = shader;
				this.name = name;
				if (graphicsDevice.supportsCompute) {
						this.impl = graphicsDevice.createComputeImpl(this);
				}
		}
}

export { Compute };
