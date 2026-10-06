import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

class RenderPassDownsample extends RenderPassShaderQuad {
		setSourceTexture(value) {
				this._sourceTexture = value;
				this.options.resizeSource = value;
		}
		execute() {
				this.sourceTextureId.setValue(this.sourceTexture);
				if (this.premultiplyTexture) {
						this.premultiplyTextureId.setValue(this.premultiplyTexture);
				}
				this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
				this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
				this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);
				super.execute();
		}
		constructor(device, sourceTexture, options = {}){
				super(device);
				this.sourceTexture = sourceTexture;
				this.premultiplyTexture = options.premultiplyTexture;
				var _options_boxFilter;
				var boxFilter = (_options_boxFilter = options.boxFilter) != null ? _options_boxFilter : false;
				var _options_premultiplySrcChannel;
				var key = (boxFilter ? 'Box' : '') + "-" + (options.premultiplyTexture ? 'Premultiply' : '') + "-" + ((_options_premultiplySrcChannel = options.premultiplySrcChannel) != null ? _options_premultiplySrcChannel : '') + "}";
				this.shader = this.createQuadShader("DownSampleShader:" + key, "\n			" + (boxFilter ? '#define BOXFILTER' : '') + "\n			" + (options.premultiplyTexture ? '#define PREMULTIPLY' : '') + "\n			uniform sampler2D sourceTexture;\n			uniform vec2 sourceInvResolution;\n			varying vec2 uv0;\n			#ifdef PREMULTIPLY\n				uniform sampler2D premultiplyTexture;\n			#endif\n			void main()\n			{\n				vec3 e = texture2D (sourceTexture, vec2 (uv0.x, uv0.y)).rgb;\n				#ifdef BOXFILTER\n					vec3 value = e;\n					#ifdef PREMULTIPLY\n						float premultiply = texture2D(premultiplyTexture, vec2 (uv0.x, uv0.y))." + options.premultiplySrcChannel + ";\n						value *= vec3(premultiply);\n					#endif\n				#else\n					float x = sourceInvResolution.x;\n					float y = sourceInvResolution.y;\n					vec3 a = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y + 2.0 * y)).rgb;\n					vec3 b = texture2D(sourceTexture, vec2 (uv0.x,		   uv0.y + 2.0 * y)).rgb;\n					vec3 c = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y + 2.0 * y)).rgb;\n					vec3 d = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y)).rgb;\n					vec3 f = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y)).rgb;\n					vec3 g = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y - 2.0 * y)).rgb;\n					vec3 h = texture2D(sourceTexture, vec2 (uv0.x,		   uv0.y - 2.0 * y)).rgb;\n					vec3 i = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y - 2.0 * y)).rgb;\n					vec3 j = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;\n					vec3 k = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;\n					vec3 l = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;\n					vec3 m = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;\n					vec3 value = e * 0.125;\n					value += (a + c + g + i) * 0.03125;\n					value += (b + d + f + h) * 0.0625;\n					value += (j + k + l + m) * 0.125;\n				#endif\n				gl_FragColor = vec4(value, 1.0);\n			}");
				this.sourceTextureId = device.scope.resolve('sourceTexture');
				this.premultiplyTextureId = device.scope.resolve('premultiplyTexture');
				this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
				this.sourceInvResolutionValue = new Float32Array(2);
		}
}

export { RenderPassDownsample };
