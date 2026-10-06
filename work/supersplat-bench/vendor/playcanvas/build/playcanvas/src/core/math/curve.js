import { CURVE_SMOOTHSTEP } from './constants.js';
import { CurveEvaluator } from './curve-evaluator.js';

class Curve {
		get length() {
				return this.keys.length;
		}
		add(time, value) {
				var keys = this.keys;
				var len = keys.length;
				var i = 0;
				for(; i < len; i++){
						if (keys[i][0] > time) {
								break;
						}
				}
				var key = [
						time,
						value
				];
				this.keys.splice(i, 0, key);
				return key;
		}
		get(index) {
				return this.keys[index];
		}
		sort() {
				this.keys.sort((a, b)=>a[0] - b[0]);
		}
		value(time) {
				return this._eval.evaluate(time, true);
		}
		closest(time) {
				var keys = this.keys;
				var length = keys.length;
				var min = 2;
				var result = null;
				for(var i = 0; i < length; i++){
						var diff = Math.abs(time - keys[i][0]);
						if (min >= diff) {
								min = diff;
								result = keys[i];
						} else {
								break;
						}
				}
				return result;
		}
		clone() {
				var result = new this.constructor();
				result.keys = this.keys.map((key)=>[
								...key
						]);
				result.type = this.type;
				result.tension = this.tension;
				return result;
		}
		quantize(precision) {
				precision = Math.max(precision, 2);
				var values = new Float32Array(precision);
				var step = 1.0 / (precision - 1);
				values[0] = this._eval.evaluate(0, true);
				for(var i = 1; i < precision; i++){
						values[i] = this._eval.evaluate(step * i);
				}
				return values;
		}
		quantizeClamped(precision, min, max) {
				var result = this.quantize(precision);
				for(var i = 0; i < result.length; ++i){
						result[i] = Math.min(max, Math.max(min, result[i]));
				}
				return result;
		}
		constructor(data){
				this.keys = [];
				this.type = CURVE_SMOOTHSTEP;
				this.tension = 0.5;
				this._eval = new CurveEvaluator(this);
				if (data) {
						for(var i = 0; i < data.length - 1; i += 2){
								this.keys.push([
										data[i],
										data[i + 1]
								]);
						}
				}
				this.sort();
		}
}

export { Curve };
