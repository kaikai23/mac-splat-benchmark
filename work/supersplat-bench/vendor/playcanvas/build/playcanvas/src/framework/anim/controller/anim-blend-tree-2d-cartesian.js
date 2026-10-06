import { Vec2 } from '../../../core/math/vec2.js';
import { math } from '../../../core/math/math.js';
import { AnimBlendTree } from './anim-blend-tree.js';

class AnimBlendTreeCartesian2D extends AnimBlendTree {
		pointDistanceCache(i, j) {
				var pointKey = "" + i + j;
				if (!this._pointCache[pointKey]) {
						this._pointCache[pointKey] = this._children[j].point.clone().sub(this._children[i].point);
				}
				return this._pointCache[pointKey];
		}
		calculateWeights() {
				if (this.updateParameterValues()) return;
				var weightSum, weightedDurationSum;
				AnimBlendTreeCartesian2D._p.set(...this._parameterValues);
				weightSum = 0.0;
				weightedDurationSum = 0.0;
				for(var i = 0; i < this._children.length; i++){
						var child = this._children[i];
						var pi = child.point;
						AnimBlendTreeCartesian2D._pip.set(AnimBlendTreeCartesian2D._p.x, AnimBlendTreeCartesian2D._p.y).sub(pi);
						var minj = Number.MAX_VALUE;
						for(var j = 0; j < this._children.length; j++){
								if (i === j) continue;
								var pipj = this.pointDistanceCache(i, j);
								var result = math.clamp(1.0 - AnimBlendTreeCartesian2D._pip.dot(pipj) / pipj.lengthSq(), 0.0, 1.0);
								if (result < minj) minj = result;
						}
						child.weight = minj;
						weightSum += minj;
						if (this._syncAnimations) {
								weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
						}
				}
				for(var i1 = 0; i1 < this._children.length; i1++){
						var child1 = this._children[i1];
						child1.weight = child1._weight / weightSum;
						if (this._syncAnimations) {
								child1.weightedSpeed = child1.animTrack.duration / child1.absoluteSpeed / weightedDurationSum;
						}
				}
		}
}
AnimBlendTreeCartesian2D._p = new Vec2();
AnimBlendTreeCartesian2D._pip = new Vec2();

export { AnimBlendTreeCartesian2D };
