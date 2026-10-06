import { AnimBlendTree } from './anim-blend-tree.js';

class AnimBlendTreeDirect extends AnimBlendTree {
		calculateWeights() {
				if (this.updateParameterValues()) return;
				var weightSum = 0.0;
				var weightedDurationSum = 0.0;
				for(var i = 0; i < this._children.length; i++){
						weightSum += Math.max(this._parameterValues[i], 0.0);
						if (this._syncAnimations) {
								var child = this._children[i];
								weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
						}
				}
				for(var i1 = 0; i1 < this._children.length; i1++){
						var child1 = this._children[i1];
						var weight = Math.max(this._parameterValues[i1], 0.0);
						if (weightSum) {
								child1.weight = weight / weightSum;
								if (this._syncAnimations) {
										child1.weightedSpeed = child1.animTrack.duration / child1.absoluteSpeed / weightedDurationSum;
								}
						} else {
								child1.weight = 0.0;
								if (this._syncAnimations) {
										child1.weightedSpeed = 0;
								}
						}
				}
		}
}

export { AnimBlendTreeDirect };
