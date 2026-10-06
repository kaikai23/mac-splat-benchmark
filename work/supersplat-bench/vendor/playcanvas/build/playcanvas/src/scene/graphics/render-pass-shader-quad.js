import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { SEMANTIC_POSITION, CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { createShaderFromCode } from '../shader-lib/utils.js';

class RenderPassShaderQuad extends RenderPass {
		set shader(shader) {
				var _this_quadRender;
				(_this_quadRender = this.quadRender) == null ? undefined : _this_quadRender.destroy();
				this.quadRender = null;
				this._shader = shader;
				if (shader) {
						this.quadRender = new QuadRender(shader);
				}
		}
		get shader() {
				return this._shader;
		}
		createQuadShader(name, fs, shaderDefinitionOptions) {
				if (shaderDefinitionOptions === undefined) shaderDefinitionOptions = {};
				return createShaderFromCode(this.device, RenderPassShaderQuad.quadVertexShader, fs, name, {
						aPosition: SEMANTIC_POSITION
				}, shaderDefinitionOptions);
		}
		execute() {
				var device = this.device;
				device.setBlendState(this.blendState);
				device.setCullMode(this.cullMode);
				device.setDepthState(this.depthState);
				device.setStencilState(this.stencilFront, this.stencilBack);
				this.quadRender.render();
		}
		constructor(...args){
				super(...args), this._shader = null, this.quadRender = null, this.cullMode = CULLFACE_NONE, this.blendState = BlendState.NOBLEND, this.depthState = DepthState.NODEPTH, this.stencilFront = null, this.stencilBack = null;
		}
}
RenderPassShaderQuad.quadVertexShader = "\n        attribute vec2 aPosition;\n        varying vec2 uv0;\n        void main(void)\n        {\n            gl_Position = vec4(aPosition, 0.0, 1.0);\n            uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);\n        }\n    ";

export { RenderPassShaderQuad };
