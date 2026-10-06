import { AnimEvents } from './anim-events.js';

class AnimTrack {
		get name() {
				return this._name;
		}
		get duration() {
				return this._duration;
		}
		get inputs() {
				return this._inputs;
		}
		get outputs() {
				return this._outputs;
		}
		get curves() {
				return this._curves;
		}
		set events(animEvents) {
				this._animEvents = animEvents;
		}
		get events() {
				return this._animEvents.events;
		}
		eval(time, snapshot) {
				snapshot._time = time;
				var inputs = this._inputs;
				var outputs = this._outputs;
				var curves = this._curves;
				var cache = snapshot._cache;
				var results = snapshot._results;
				for(var i = 0; i < inputs.length; ++i){
						cache[i].update(time, inputs[i]._data);
				}
				for(var i1 = 0; i1 < curves.length; ++i1){
						var curve = curves[i1];
						var output = outputs[curve._output];
						var result = results[i1];
						cache[curve._input].eval(result, curve._interpolation, output);
				}
		}
		constructor(name, duration, inputs, outputs, curves, animEvents = new AnimEvents([])){
				this._name = name;
				this._duration = duration;
				this._inputs = inputs;
				this._outputs = outputs;
				this._curves = curves;
				this._animEvents = animEvents;
		}
}
AnimTrack.EMPTY = Object.freeze(new AnimTrack('empty', Number.MAX_VALUE, [], [], []));

export { AnimTrack };
