function hashCode(str) {
		if (str === null || str === undefined) {
				return 0;
		}
		var hash = 0;
		for(var i = 0, len = str.length; i < len; i++){
				hash = (hash << 5) - hash + str.charCodeAt(i);
				hash |= 0;
		}
		return hash;
}
function hash32Fnv1a(array) {
		var prime = 16777619;
		var hash = 2166136261;
		for(var i = 0; i < array.length; i++){
				hash ^= array[i];
				hash *= prime;
		}
		return hash >>> 0;
}

export { hash32Fnv1a, hashCode };
