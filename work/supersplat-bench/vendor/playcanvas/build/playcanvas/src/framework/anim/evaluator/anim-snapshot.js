import { AnimCache } from './anim-cache.js';

class AnimSnapshot {
		constructor(animTrack){
				this._name = "" + animTrack.name + "Snapshot";
				this._time = -1;
				this._cache = [];
				this._results = [];
				for(var i = 0; i < animTrack._inputs.length; ++i){
						this._cache[i] = new AnimCache();
				}
				var curves = animTrack._curves;
				var outputs = animTrack._outputs;
				for(var i1 = 0; i1 < curves.length; ++i1){
						var curve = curves[i1];
						var output = outputs[curve._output];
						var storage = [];
						for(var j = 0; j < output._components; ++j){
								storage[j] = 0;
						}
						this._results[i1] = storage;
				}
		}
}

export { AnimSnapshot };
