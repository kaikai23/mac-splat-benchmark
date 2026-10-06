class FrameGraph {
		addRenderPass(renderPass) {
				renderPass.frameUpdate();
				var beforePasses = renderPass.beforePasses;
				for(var i = 0; i < beforePasses.length; i++){
						var pass = beforePasses[i];
						if (pass.enabled) {
								this.addRenderPass(pass);
						}
				}
				if (renderPass.enabled) {
						this.renderPasses.push(renderPass);
				}
				var afterPasses = renderPass.afterPasses;
				for(var i1 = 0; i1 < afterPasses.length; i1++){
						var pass1 = afterPasses[i1];
						if (pass1.enabled) {
								this.addRenderPass(pass1);
						}
				}
		}
		reset() {
				this.renderPasses.length = 0;
		}
		compile() {
				var renderTargetMap = this.renderTargetMap;
				var renderPasses = this.renderPasses;
				for(var i = 0; i < renderPasses.length; i++){
						var renderPass = renderPasses[i];
						var renderTarget = renderPass.renderTarget;
						if (renderTarget !== undefined) {
								var prevPass = renderTargetMap.get(renderTarget);
								if (prevPass) {
										var count = renderPass.colorArrayOps.length;
										for(var j = 0; j < count; j++){
												var colorOps = renderPass.colorArrayOps[j];
												if (!colorOps.clear) {
														prevPass.colorArrayOps[j].store = true;
												}
										}
										if (!renderPass.depthStencilOps.clearDepth) {
												prevPass.depthStencilOps.storeDepth = true;
										}
										if (!renderPass.depthStencilOps.clearStencil) {
												prevPass.depthStencilOps.storeStencil = true;
										}
								}
								renderTargetMap.set(renderTarget, renderPass);
						}
				}
				for(var i1 = 0; i1 < renderPasses.length - 1; i1++){
						var firstPass = renderPasses[i1];
						var firstRT = firstPass.renderTarget;
						var secondPass = renderPasses[i1 + 1];
						var secondRT = secondPass.renderTarget;
						if (firstRT !== secondRT || firstRT === undefined) {
								continue;
						}
						if (secondPass.depthStencilOps.clearDepth || secondPass.depthStencilOps.clearStencil || secondPass.colorArrayOps.some((colorOps)=>colorOps.clear)) {
								continue;
						}
						if (firstPass.afterPasses.length > 0) {
								continue;
						}
						if (secondPass.beforePasses.length > 0) {
								continue;
						}
						firstPass._skipEnd = true;
						secondPass._skipStart = true;
				}
				var lastCubeTexture = null;
				var lastCubeRenderPass = null;
				for(var i2 = 0; i2 < renderPasses.length; i2++){
						var renderPass1 = renderPasses[i2];
						var renderTarget1 = renderPass1.renderTarget;
						var thisTexture = renderTarget1 == null ? undefined : renderTarget1.colorBuffer;
						if (thisTexture == null ? undefined : thisTexture.cubemap) {
								if (lastCubeTexture === thisTexture) {
										var count1 = lastCubeRenderPass.colorArrayOps.length;
										for(var j1 = 0; j1 < count1; j1++){
												lastCubeRenderPass.colorArrayOps[j1].mipmaps = false;
										}
								}
								lastCubeTexture = renderTarget1.colorBuffer;
								lastCubeRenderPass = renderPass1;
						} else if (renderPass1.requiresCubemaps) {
								lastCubeTexture = null;
								lastCubeRenderPass = null;
						}
				}
				renderTargetMap.clear();
		}
		render(device) {
				this.compile();
				var renderPasses = this.renderPasses;
				for(var i = 0; i < renderPasses.length; i++){
						renderPasses[i].render();
				}
		}
		constructor(){
				this.renderPasses = [];
				this.renderTargetMap = new Map();
		}
}

export { FrameGraph };
