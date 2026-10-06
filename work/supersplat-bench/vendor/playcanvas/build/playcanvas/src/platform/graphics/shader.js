import { platform } from '../../core/platform.js';
import { Preprocessor } from '../../core/preprocessor.js';
import { SHADERLANGUAGE_GLSL } from './constants.js';
import { ShaderUtils } from './shader-utils.js';

var id = 0;
class Shader {
		init() {
				this.ready = false;
				this.failed = false;
		}
		get label() {
				return "Shader Id " + this.id + " " + this.name;
		}
		destroy() {
				this.device.onDestroyShader(this);
				this.impl.destroy(this);
		}
		loseContext() {
				this.init();
				this.impl.loseContext();
		}
		restoreContext() {
				this.impl.restoreContext(this.device, this);
		}
		constructor(graphicsDevice, definition){
				this.id = id++;
				this.device = graphicsDevice;
				this.definition = definition;
				this.name = definition.name || 'Untitled';
				this.init();
				if (definition.cshader) ; else {
						definition.vshader = Preprocessor.run(definition.vshader, definition.vincludes, {
								sourceName: "vertex shader for " + this.label
						});
						if (definition.shaderLanguage === SHADERLANGUAGE_GLSL) {
								var _definition;
								var _attributes;
								(_attributes = (_definition = definition).attributes) != null ? _attributes : _definition.attributes = ShaderUtils.collectAttributes(definition.vshader);
						}
						var stripUnusedColorAttachments = graphicsDevice.isWebGL2 && (platform.name === 'osx' || platform.name === 'ios');
						definition.fshader = Preprocessor.run(definition.fshader, definition.fincludes, {
								stripUnusedColorAttachments,
								sourceName: "fragment shader for " + this.label
						});
				}
				this.impl = graphicsDevice.createShaderImpl(this);
		}
}

export { Shader };
