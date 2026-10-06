import { CURVE_SMOOTHSTEP } from './constants.js';
import { Curve } from './curve.js';
import { CurveEvaluator } from './curve-evaluator.js';

class CurveSet {
		get length() {
				return this.curves.length;
		}
		set type(value) {
				this._type = value;
				for(var i = 0; i < this.curves.length; i++){
						this.curves[i].type = value;
				}
		}
		get type() {
				return this._type;
		}
		get(index) {
				return this.curves[index];
		}
		value(time, result) {
				if (result === undefined) result = [];
				var length = this.curves.length;
				result.length = length;
				for(var i = 0; i < length; i++){
						result[i] = this.curves[i].value(time);
				}
				return result;
		}
		clone() {
				var result = new this.constructor();
				result.curves = [];
				for(var i = 0; i < this.curves.length; i++){
						result.curves.push(this.curves[i].clone());
				}
				result._type = this._type;
				return result;
		}
		quantize(precision) {
				precision = Math.max(precision, 2);
				var numCurves = this.curves.length;
				var values = new Float32Array(precision * numCurves);
				var step = 1.0 / (precision - 1);
				for(var c = 0; c < numCurves; c++){
						var ev = new CurveEvaluator(this.curves[c]);
						for(var i = 0; i < precision; i++){
								values[i * numCurves + c] = ev.evaluate(step * i);
						}
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
		constructor(){
				this.curves = [];
				this._type = CURVE_SMOOTHSTEP;
				if (arguments.length > 1) {
						for(var i = 0; i < arguments.length; i++){
								this.curves.push(new Curve(arguments[i]));
						}
				} else {
						if (arguments.length === 0) {
								this.curves.push(new Curve());
						} else {
								var arg = arguments[0];
								if (typeof arg === 'number') {
										for(var i1 = 0; i1 < arg; i1++){
												this.curves.push(new Curve());
										}
								} else {
										for(var i2 = 0; i2 < arg.length; i2++){
												this.curves.push(new Curve(arg[i2]));
										}
								}
						}
				}
		}
}

export { CurveSet };
