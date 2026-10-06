import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

class RenderPassDepthAwareBlur extends RenderPassShaderQuad {
		execute() {
				this.filterSizeId.setValue(4);
				this.sourceTextureId.setValue(this.sourceTexture);
				var { width, height } = this.sourceTexture;
				this.sourceInvResolutionValue[0] = 1.0 / width;
				this.sourceInvResolutionValue[1] = 1.0 / height;
				this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);
				super.execute();
		}
		constructor(device, sourceTexture, cameraComponent, horizontal){
				super(device);
				this.sourceTexture = sourceTexture;
				var screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
				this.shader = this.createQuadShader("DepthAware" + (horizontal ? 'Horizontal' : 'Vertical') + "BlurShader", screenDepth + "\n			" + (horizontal ? '#define HORIZONTAL' : '') + "\n			varying vec2 uv0;\n			uniform sampler2D sourceTexture;\n			uniform vec2 sourceInvResolution;\n			uniform int filterSize;\n			float random(const highp vec2 w) {\n				const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);\n				return fract(m.z * fract(dot(w, m.xy)));\n			}\n			mediump float bilateralWeight(in mediump float depth, in mediump float sampleDepth) {\n				mediump float diff = (sampleDepth - depth);\n				return max(0.0, 1.0 - diff * diff);\n			}\n			void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {\n				mediump float color = texture2D(sourceTexture, position).r;\n				mediump float textureDepth = -getLinearScreenDepth(position);\n			\n				mediump float bilateral = bilateralWeight(depth, textureDepth);\n				bilateral *= weight;\n				sum += color * bilateral;\n				totalWeight += bilateral;\n			}\n			void main() {\n				mediump float depth = -getLinearScreenDepth(uv0);\n				mediump float totalWeight = 1.0;\n				mediump float color = texture2D(sourceTexture, uv0 ).r;\n				mediump float sum = color * totalWeight;\n				for (mediump int i = -filterSize; i <= filterSize; i++) {\n					mediump float weight = 1.0;\n					#ifdef HORIZONTAL\n						vec2 offset = vec2(i, 0) * sourceInvResolution;\n					#else\n						vec2 offset = vec2(0, i) * sourceInvResolution;\n					#endif\n					tap(sum, totalWeight, weight, depth, uv0 + offset);\n				}\n				mediump float ao = sum / totalWeight;\n				gl_FragColor.r = ao;\n			}\n		");
				var scope = this.device.scope;
				this.sourceTextureId = scope.resolve('sourceTexture');
				this.sourceInvResolutionId = scope.resolve('sourceInvResolution');
				this.sourceInvResolutionValue = new Float32Array(2);
				this.filterSizeId = scope.resolve('filterSize');
		}
}

export { RenderPassDepthAwareBlur };
