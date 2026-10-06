import { math } from '../../../core/math/math.js';
import { INTERPOLATION_STEP, INTERPOLATION_CUBIC, INTERPOLATION_LINEAR } from '../constants.js';

class AnimCache {
		update(time, input) {
				if (time < this._left || time >= this._right) {
						var len = input.length;
						if (!len) {
								this._left = -Infinity;
								this._right = Infinity;
								this._len = 0;
								this._recip = 0;
								this._p0 = this._p1 = 0;
						} else {
								if (time < input[0]) {
										this._left = -Infinity;
										this._right = input[0];
										this._len = 0;
										this._recip = 0;
										this._p0 = this._p1 = 0;
								} else if (time >= input[len - 1]) {
										this._left = input[len - 1];
										this._right = Infinity;
										this._len = 0;
										this._recip = 0;
										this._p0 = this._p1 = len - 1;
								} else {
										var index = this._findKey(time, input);
										this._left = input[index];
										this._right = input[index + 1];
										this._len = this._right - this._left;
										var diff = 1.0 / this._len;
										this._recip = isFinite(diff) ? diff : 0;
										this._p0 = index;
										this._p1 = index + 1;
								}
						}
				}
				this._t = this._recip === 0 ? 0 : (time - this._left) * this._recip;
				this._hermite.valid = false;
		}
		_findKey(time, input) {
				var index = 0;
				while(time >= input[index + 1]){
						index++;
				}
				return index;
		}
		eval(result, interpolation, output) {
				var data = output._data;
				var comp = output._components;
				var idx0 = this._p0 * comp;
				if (interpolation === INTERPOLATION_STEP) {
						for(var i = 0; i < comp; ++i){
								result[i] = data[idx0 + i];
						}
				} else {
						var t = this._t;
						var idx1 = this._p1 * comp;
						switch(interpolation){
								case INTERPOLATION_LINEAR:
										for(var i1 = 0; i1 < comp; ++i1){
												result[i1] = math.lerp(data[idx0 + i1], data[idx1 + i1], t);
										}
										break;
								case INTERPOLATION_CUBIC:
										{
												var hermite = this._hermite;
												if (!hermite.valid) {
														var t2 = t * t;
														var twot = t + t;
														var omt = 1 - t;
														var omt2 = omt * omt;
														hermite.valid = true;
														hermite.p0 = (1 + twot) * omt2;
														hermite.m0 = t * omt2;
														hermite.p1 = t2 * (3 - twot);
														hermite.m1 = t2 * (t - 1);
												}
												var p0 = (this._p0 * 3 + 1) * comp;
												var m0 = (this._p0 * 3 + 2) * comp;
												var p1 = (this._p1 * 3 + 1) * comp;
												var m1 = (this._p1 * 3 + 0) * comp;
												for(var i2 = 0; i2 < comp; ++i2){
														result[i2] = hermite.p0 * data[p0 + i2] + hermite.m0 * data[m0 + i2] * this._len + hermite.p1 * data[p1 + i2] + hermite.m1 * data[m1 + i2] * this._len;
												}
												break;
										}
						}
				}
		}
		constructor(){
				this._left = Infinity;
				this._right = -Infinity;
				this._len = 0;
				this._recip = 0;
				this._p0 = 0;
				this._p1 = 0;
				this._t = 0;
				this._hermite = {
						valid: false,
						p0: 0,
						m0: 0,
						p1: 0,
						m1: 0
				};
		}
}

export { AnimCache };
