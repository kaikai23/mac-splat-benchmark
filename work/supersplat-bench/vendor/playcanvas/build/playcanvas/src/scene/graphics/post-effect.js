import { Vec4 } from '../../core/math/vec4.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from './quad-render-utils.js';

var _viewport = new Vec4();
class PostEffect {
		render(inputTarget, outputTarget, rect) {}
		drawQuad(target, shader, rect) {
				var viewport;
				if (rect) {
						var w = target ? target.width : this.device.width;
						var h = target ? target.height : this.device.height;
						viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
				}
				this.device.setBlendState(BlendState.NOBLEND);
				drawQuadWithShader(this.device, target, shader, viewport);
		}
		constructor(graphicsDevice){
				this.device = graphicsDevice;
				this.needsDepthBuffer = false;
		}
}
PostEffect.quadVertexShader = "\n        attribute vec2 aPosition;\n        varying vec2 vUv0;\n        void main(void)\n        {\n            gl_Position = vec4(aPosition, 0.0, 1.0);\n            vUv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);\n        }\n    ";

export { PostEffect };
