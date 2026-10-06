import { Vec2 } from '../../../core/math/vec2.js';
import { math } from '../../../core/math/math.js';
import { AnimBlendTree } from './anim-blend-tree.js';

class AnimBlendTreeDirectional2D extends AnimBlendTree {
		pointCache(i, j) {
				var pointKey = "" + i + j;
				if (!this._pointCache[pointKey]) {
						this._pointCache[pointKey] = new Vec2((this._children[j].pointLength - this._children[i].pointLength) / ((this._children[j].pointLength + this._children[i].pointLength) / 2), Vec2.angleRad(this._children[i].point, this._children[j].point) * 2.0);
				}
				return this._pointCache[pointKey];
		}
		calculateWeights() {
				if (this.updateParameterValues()) return;
				var weightSum, weightedDurationSum;
				AnimBlendTreeDirectional2D._p.set(...this._parameterValues);
				var pLength = AnimBlendTreeDirectional2D._p.length();
				weightSum = 0.0;
				weightedDurationSum = 0.0;
				for(var i = 0; i < this._children.length; i++){
						var child = this._children[i];
						var pi = child.point;
						var piLength = child.pointLength;
						var minj = Number.MAX_VALUE;
						for(var j = 0; j < this._children.length; j++){
								if (i === j) continue;
								var pipj = this.pointCache(i, j);
								var pjLength = this._children[j].pointLength;
								AnimBlendTreeDirectional2D._pip.set((pLength - piLength) / ((pjLength + piLength) / 2), Vec2.angleRad(pi, AnimBlendTreeDirectional2D._p) * 2.0);
								var result = math.clamp(1.0 - Math.abs(AnimBlendTreeDirectional2D._pip.dot(pipj) / pipj.lengthSq()), 0.0, 1.0);
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
								var weightedChildDuration = child1.animTrack.duration / weightedDurationSum * weightSum;
								child1.weightedSpeed = child1.absoluteSpeed * weightedChildDuration;
						}
				}
		}
}
AnimBlendTreeDirectional2D._p = new Vec2();
AnimBlendTreeDirectional2D._pip = new Vec2();

export { AnimBlendTreeDirectional2D };
