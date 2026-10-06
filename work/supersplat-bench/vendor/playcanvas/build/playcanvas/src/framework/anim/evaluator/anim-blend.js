class AnimBlend {
		static dot(a, b) {
				var len = a.length;
				var result = 0;
				for(var i = 0; i < len; ++i){
						result += a[i] * b[i];
				}
				return result;
		}
		static normalize(a) {
				var l = AnimBlend.dot(a, a);
				if (l > 0) {
						l = 1.0 / Math.sqrt(l);
						var len = a.length;
						for(var i = 0; i < len; ++i){
								a[i] *= l;
						}
				}
		}
		static set(a, b, type) {
				var len = a.length;
				if (type === 'quaternion') {
						var l = AnimBlend.dot(b, b);
						if (l > 0) {
								l = 1.0 / Math.sqrt(l);
						}
						for(var i = 0; i < len; ++i){
								a[i] = b[i] * l;
						}
				} else {
						for(var i1 = 0; i1 < len; ++i1){
								a[i1] = b[i1];
						}
				}
		}
		static blendVec(a, b, t, additive) {
				var it = additive ? 1.0 : 1.0 - t;
				var len = a.length;
				for(var i = 0; i < len; ++i){
						a[i] = a[i] * it + b[i] * t;
				}
		}
		static blendQuat(a, b, t, additive) {
				var len = a.length;
				var it = additive ? 1.0 : 1.0 - t;
				if (AnimBlend.dot(a, b) < 0) {
						t = -t;
				}
				for(var i = 0; i < len; ++i){
						a[i] = a[i] * it + b[i] * t;
				}
				if (!additive) {
						AnimBlend.normalize(a);
				}
		}
		static blend(a, b, t, type, additive) {
				if (type === 'quaternion') {
						AnimBlend.blendQuat(a, b, t, additive);
				} else {
						AnimBlend.blendVec(a, b, t, additive);
				}
		}
		static stableSort(a, lessFunc) {
				var len = a.length;
				for(var i = 0; i < len - 1; ++i){
						for(var j = i + 1; j < len; ++j){
								if (lessFunc(a[j], a[i])) {
										var tmp = a[i];
										a[i] = a[j];
										a[j] = tmp;
								}
						}
				}
		}
}

export { AnimBlend };
