import { BINDGROUP_VIEW } from './constants.js';

class ShaderProcessorOptions {
		hasUniform(name) {
				for(var i = 0; i < this.uniformFormats.length; i++){
						var uniformFormat = this.uniformFormats[i];
						if (uniformFormat == null ? undefined : uniformFormat.get(name)) {
								return true;
						}
				}
				return false;
		}
		hasTexture(name) {
				for(var i = 0; i < this.bindGroupFormats.length; i++){
						var groupFormat = this.bindGroupFormats[i];
						if (groupFormat == null ? undefined : groupFormat.getTexture(name)) {
								return true;
						}
				}
				return false;
		}
		getVertexElement(semantic) {
				var _this_vertexFormat;
				return (_this_vertexFormat = this.vertexFormat) == null ? undefined : _this_vertexFormat.elements.find((element)=>element.name === semantic);
		}
		generateKey(device) {
				var key = JSON.stringify(this.uniformFormats) + JSON.stringify(this.bindGroupFormats);
				if (device.isWebGPU) {
						var _this_vertexFormat;
						key += (_this_vertexFormat = this.vertexFormat) == null ? undefined : _this_vertexFormat.shaderProcessingHashString;
				}
				return key;
		}
		constructor(viewUniformFormat, viewBindGroupFormat, vertexFormat){
				this.uniformFormats = [];
				this.bindGroupFormats = [];
				this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
				this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
				this.vertexFormat = vertexFormat;
		}
}

export { ShaderProcessorOptions };
