import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

class RenderPassCoC extends RenderPassShaderQuad {
		execute() {
				var { paramsValue, focusRange } = this;
				paramsValue[0] = this.focusDistance + 0.001;
				paramsValue[1] = focusRange;
				paramsValue[2] = 1 / focusRange;
				this.paramsId.setValue(paramsValue);
				var camera = this.cameraComponent.camera;
				var f = camera._farClip;
				this.cameraParams[0] = 1 / f;
				this.cameraParams[1] = f;
				this.cameraParams[2] = camera._nearClip;
				this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
				this.cameraParamsId.setValue(this.cameraParams);
				super.execute();
		}
		constructor(device, cameraComponent, nearBlur){
				super(device);
				this.cameraComponent = cameraComponent;
				var screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
				this.shader = this.createQuadShader("CocShader-" + nearBlur, "\n			" + (nearBlur ? '#define NEAR_BLUR' : '') + "\n			" + screenDepth + "\n			varying vec2 uv0;\n			uniform vec3 params;\n			void main()\n			{\n				float depth = getLinearScreenDepth(uv0);\n				float focusDistance = params.x;\n				float focusRange = params.y;\n				float invRange = params.z;\n				float farRange = focusDistance + focusRange * 0.5;\n				\n				float cocFar = min((depth - farRange) * invRange, 1.0);\n				#ifdef NEAR_BLUR\n					float nearRange = focusDistance - focusRange * 0.5;\n					float cocNear = min((nearRange - depth) * invRange, 1.0);\n				#else\n					float cocNear = 0.0;\n				#endif\n				gl_FragColor = vec4(cocFar, cocNear, 0.0, 0.0);\n			}");
				this.paramsId = device.scope.resolve('params');
				this.paramsValue = new Float32Array(3);
				this.cameraParams = new Float32Array(4);
				this.cameraParamsId = device.scope.resolve('camera_params');
		}
}

export { RenderPassCoC };
