class StatsTimer {
		get timings() {
				return this.values;
		}
		constructor(app, statNames, decimalPlaces, unitsName, multiplier){
				this.app = app;
				this.values = [];
				this.statNames = statNames;
				if (this.statNames.length > 3) {
						this.statNames.length = 3;
				}
				this.unitsName = unitsName;
				this.decimalPlaces = decimalPlaces;
				this.multiplier = multiplier || 1;
				var resolve = (path, obj)=>{
						return path.split('.').reduce((prev, curr)=>{
								return prev ? prev[curr] : null;
						}, obj || this);
				};
				app.on('frameupdate', (ms)=>{
						for(var i = 0; i < this.statNames.length; i++){
								this.values[i] = resolve(this.statNames[i], this.app.stats) * this.multiplier;
						}
				});
		}
}

export { StatsTimer };
