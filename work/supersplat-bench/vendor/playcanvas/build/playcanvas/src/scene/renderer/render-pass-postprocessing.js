import { RenderPass } from '../../platform/graphics/render-pass.js';

class RenderPassPostprocessing extends RenderPass {
		execute() {
				var renderAction = this.renderAction;
				var camera = renderAction.camera;
				camera.onPostprocessing();
		}
		constructor(device, renderer, renderAction){
				super(device);
				this.renderer = renderer;
				this.renderAction = renderAction;
				this.requiresCubemaps = false;
		}
}

export { RenderPassPostprocessing };
