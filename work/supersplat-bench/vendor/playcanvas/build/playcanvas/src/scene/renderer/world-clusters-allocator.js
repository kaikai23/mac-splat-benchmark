import { WorldClusters } from '../lighting/world-clusters.js';

var tempClusterArray = [];
class WorldClustersAllocator {
		destroy() {
				if (this._empty) {
						this._empty.destroy();
						this._empty = null;
				}
				this._allocated.forEach((cluster)=>{
						cluster.destroy();
				});
				this._allocated.length = 0;
		}
		get count() {
				return this._allocated.length;
		}
		get empty() {
				if (!this._empty) {
						var empty = new WorldClusters(this.device);
						empty.name = 'ClusterEmpty';
						empty.update([]);
						this._empty = empty;
				}
				return this._empty;
		}
		assign(renderPasses) {
				var empty = this.empty;
				tempClusterArray.push(...this._allocated);
				this._allocated.length = 0;
				this._clusters.clear();
				var passCount = renderPasses.length;
				for(var p = 0; p < passCount; p++){
						var renderPass = renderPasses[p];
						var renderActions = renderPass.renderActions;
						if (renderActions) {
								var count = renderActions.length;
								for(var i = 0; i < count; i++){
										var ra = renderActions[i];
										ra.lightClusters = null;
										var layer = ra.layer;
										if (layer.hasClusteredLights && layer.meshInstances.length) {
												var hash = layer.getLightIdHash();
												var existingRenderAction = this._clusters.get(hash);
												var clusters = existingRenderAction == null ? undefined : existingRenderAction.lightClusters;
												if (!clusters) {
														var _tempClusterArray_pop;
														clusters = (_tempClusterArray_pop = tempClusterArray.pop()) != null ? _tempClusterArray_pop : new WorldClusters(this.device);
														this._allocated.push(clusters);
														this._clusters.set(hash, ra);
												}
												ra.lightClusters = clusters;
										}
										if (!ra.lightClusters) {
												ra.lightClusters = empty;
										}
								}
						}
				}
				tempClusterArray.forEach((item)=>item.destroy());
				tempClusterArray.length = 0;
		}
		update(renderPasses, lighting) {
				this.assign(renderPasses);
				this._clusters.forEach((renderAction)=>{
						var layer = renderAction.layer;
						var cluster = renderAction.lightClusters;
						cluster.update(layer.clusteredLightsSet, lighting);
				});
		}
		constructor(graphicsDevice){
				this._empty = null;
				this._allocated = [];
				this._clusters = new Map();
				this.device = graphicsDevice;
		}
}

export { WorldClustersAllocator };
