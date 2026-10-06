import { Kernel } from '../../core/math/kernel.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

class RenderPassDofBlur extends RenderPassShaderQuad {
		set blurRings(value) {
				if (this._blurRings !== value) {
						this._blurRings = value;
						this.shader = null;
				}
		}
		get blurRings() {
				return this._blurRings;
		}
		set blurRingPoints(value) {
				if (this._blurRingPoints !== value) {
						this._blurRingPoints = value;
						this.shader = null;
				}
		}
		get blurRingPoints() {
				return this._blurRingPoints;
		}
		createShader() {
				this.kernel = new Float32Array(Kernel.concentric(this.blurRings, this.blurRingPoints));
				var kernelCount = this.kernel.length >> 1;
				var nearBlur = this.nearTexture !== null;
				var shaderName = "DofBlurShader-" + kernelCount + "-" + (nearBlur ? 'nearBlur' : 'noNearBlur');
				this.shader = this.createQuadShader(shaderName, "\n			" + (nearBlur ? '#define NEAR_BLUR' : '') + "\n			#if defined(NEAR_BLUR)\n				uniform sampler2D nearTexture;\n			#endif\n			uniform sampler2D farTexture;\n			uniform sampler2D cocTexture;\n			uniform float blurRadiusNear;\n			uniform float blurRadiusFar;\n			uniform vec2 kernel[" + kernelCount + "];\n			varying vec2 uv0;\n			void main()\n			{\n				vec2 coc = texture2D(cocTexture, uv0).rg;\n				float cocFar = coc.r;\n				vec3 sum = vec3(0.0, 0.0, 0.0);\n				#if defined(NEAR_BLUR)\n					float cocNear = coc.g;\n					if (cocNear > 0.0001) {\n						ivec2 nearTextureSize = textureSize(nearTexture, 0);\n						vec2 step = cocNear * blurRadiusNear / vec2(nearTextureSize);\n						for (int i = 0; i < " + kernelCount + "; i++) {\n							vec2 uv = uv0 + step * kernel[i];\n							vec3 tap = texture2DLod(nearTexture, uv, 0.0).rgb;\n							sum += tap.rgb;\n						}\n						sum *= " + 1.0 / kernelCount + ";\n					} else\n				#endif\n					\n					if (cocFar > 0.0001) {\n					ivec2 farTextureSize = textureSize(farTexture, 0);\n					vec2 step = cocFar * blurRadiusFar / vec2(farTextureSize);\n					float sumCoC = 0.0; \n					for (int i = 0; i < " + kernelCount + "; i++) {\n						vec2 uv = uv0 + step * kernel[i];\n						vec3 tap = texture2DLod(farTexture, uv, 0.0).rgb;\n						float cocThis = texture2DLod(cocTexture, uv, 0.0).r;\n						tap *= cocThis;\n						sumCoC += cocThis;\n						sum += tap.rgb;\n					}\n					if (sumCoC > 0.0)\n						sum /= sumCoC;\n					sum /= cocFar;\n				}\n				pcFragColor0 = vec4(sum, 1.0);\n			}");
		}
		execute() {
				if (!this.shader) {
						this.createShader();
				}
				this.nearTextureId.setValue(this.nearTexture);
				this.farTextureId.setValue(this.farTexture);
				this.cocTextureId.setValue(this.cocTexture);
				this.kernelId.setValue(this.kernel);
				this.kernelCountId.setValue(this.kernel.length >> 1);
				this.blurRadiusNearId.setValue(this.blurRadiusNear);
				this.blurRadiusFarId.setValue(this.blurRadiusFar);
				super.execute();
		}
		constructor(device, nearTexture, farTexture, cocTexture){
				super(device), this.blurRadiusNear = 1, this.blurRadiusFar = 1, this._blurRings = 3, this._blurRingPoints = 3;
				this.nearTexture = nearTexture;
				this.farTexture = farTexture;
				this.cocTexture = cocTexture;
				var { scope } = device;
				this.kernelId = scope.resolve('kernel[0]');
				this.kernelCountId = scope.resolve('kernelCount');
				this.blurRadiusNearId = scope.resolve('blurRadiusNear');
				this.blurRadiusFarId = scope.resolve('blurRadiusFar');
				this.nearTextureId = scope.resolve('nearTexture');
				this.farTextureId = scope.resolve('farTexture');
				this.cocTextureId = scope.resolve('cocTexture');
		}
}

export { RenderPassDofBlur };
