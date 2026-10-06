var version = '2.5.1';
var revision = '362a874';
function extend(target, ex) {
		for(var prop in ex){
				var copy = ex[prop];
				if (Array.isArray(copy)) {
						target[prop] = extend([], copy);
				} else if (copy && typeof copy === 'object') {
						target[prop] = extend({}, copy);
				} else {
						target[prop] = copy;
				}
		}
		return target;
}

export { extend, revision, version };
