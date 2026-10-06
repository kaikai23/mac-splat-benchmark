import { now } from '../../core/time.js';

class CpuTimer {
		begin(name) {
				if (!this.enabled) {
						return;
				}
				if (this._frameIndex < this._frameTimings.length) {
						this._frameTimings.splice(this._frameIndex);
				}
				var tmp = this._prevTimings;
				this._prevTimings = this._timings;
				this._timings = this._frameTimings;
				this._frameTimings = tmp;
				this._frameIndex = 0;
				this.mark(name);
		}
		mark(name) {
				if (!this.enabled) {
						return;
				}
				var timestamp = now();
				if (this._frameIndex > 0) {
						var prev = this._frameTimings[this._frameIndex - 1];
						prev[1] = timestamp - prev[1];
				} else if (this._timings.length > 0) {
						var prev1 = this._timings[this._timings.length - 1];
						prev1[1] = timestamp - prev1[1];
				}
				if (this._frameIndex >= this._frameTimings.length) {
						this._frameTimings.push([
								name,
								timestamp
						]);
				} else {
						var timing = this._frameTimings[this._frameIndex];
						timing[0] = name;
						timing[1] = timestamp;
				}
				this._frameIndex++;
		}
		get timings() {
				return this._timings.slice(0, -1).map((v)=>v[1]);
		}
		constructor(app){
				this._frameIndex = 0;
				this._frameTimings = [];
				this._timings = [];
				this._prevTimings = [];
				this.unitsName = 'ms';
				this.decimalPlaces = 1;
				this.enabled = true;
				app.on('frameupdate', this.begin.bind(this, 'update'));
				app.on('framerender', this.mark.bind(this, 'render'));
				app.on('frameend', this.mark.bind(this, 'other'));
		}
}

export { CpuTimer };
