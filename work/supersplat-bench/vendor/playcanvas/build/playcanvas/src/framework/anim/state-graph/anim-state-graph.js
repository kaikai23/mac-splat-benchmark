class AnimStateGraph {
		get parameters() {
				return Object.assign({}, this._parameters);
		}
		get layers() {
				return this._layers;
		}
		constructor(data){
				this._layers = [];
				this._parameters = {};
				if (!Array.isArray(data.layers)) {
						for(var layerId in data.layers){
								var dataLayer = data.layers[layerId];
								var layer = {
										name: dataLayer.name,
										blendType: dataLayer.blendType,
										weight: dataLayer.weight,
										states: [],
										transitions: []
								};
								for(var i = 0; i < dataLayer.states.length; i++){
										layer.states.push(data.states[dataLayer.states[i]]);
								}
								for(var i1 = 0; i1 < dataLayer.transitions.length; i1++){
										var dataLayerTransition = data.transitions[dataLayer.transitions[i1]];
										if (dataLayerTransition.conditions && !Array.isArray(dataLayerTransition.conditions)) {
												var conditionKeys = Object.keys(dataLayerTransition.conditions);
												var conditions = [];
												for(var j = 0; j < conditionKeys.length; j++){
														var condition = dataLayerTransition.conditions[conditionKeys[j]];
														if (condition.parameterName) {
																conditions.push(condition);
														}
												}
												dataLayerTransition.conditions = conditions;
										}
										if (Number.isInteger(dataLayerTransition.from)) {
												dataLayerTransition.from = data.states[dataLayerTransition.from].name;
										}
										if (Number.isInteger(dataLayerTransition.to)) {
												dataLayerTransition.to = data.states[dataLayerTransition.to].name;
										}
										layer.transitions.push(dataLayerTransition);
								}
								this._layers.push(layer);
						}
				} else {
						this._layers = data.layers;
				}
				for(var paramId in data.parameters){
						var param = data.parameters[paramId];
						this._parameters[param.name] = {
								type: param.type,
								value: param.value
						};
				}
		}
}

export { AnimStateGraph };
