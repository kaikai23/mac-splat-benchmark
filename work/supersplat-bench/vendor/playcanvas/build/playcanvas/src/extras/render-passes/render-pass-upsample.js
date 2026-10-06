import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

class RenderPassUpsample extends RenderPassShaderQuad {
		execute() {
				this.sourceTextureId.setValue(this.sourceTexture);
				this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
				this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
				this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);
				super.execute();
		}
		constructor(device, sourceTexture){
				super(device);
				this.sourceTexture = sourceTexture;
				this.shader = this.createQuadShader('UpSampleShader', "\n			uniform sampler2D sourceTexture;\n			uniform vec2 sourceInvResolution;\n			varying vec2 uv0;\n			void main()\n			{\n				float x = sourceInvResolution.x;\n				float y = sourceInvResolution.y;\n				vec3 a = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;\n				vec3 b = texture2D (sourceTexture, vec2 (uv0.x,	 uv0.y + y)).rgb;\n				vec3 c = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;\n				vec3 d = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y)).rgb;\n				vec3 e = texture2D (sourceTexture, vec2 (uv0.x,	 uv0.y)).rgb;\n				vec3 f = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y)).rgb;\n				vec3 g = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;\n				vec3 h = texture2D (sourceTexture, vec2 (uv0.x,	 uv0.y - y)).rgb;\n				vec3 i = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;\n				vec3 value = e * 4.0;\n				value += (b + d + f + h) * 2.0;\n				value += (a + c + g + i);\n				value *= 1.0 / 16.0;\n				gl_FragColor = vec4(value, 1.0);\n			}");
				this.sourceTextureId = device.scope.resolve('sourceTexture');
				this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
				this.sourceInvResolutionValue = new Float32Array(2);
		}
}

export { RenderPassUpsample };
