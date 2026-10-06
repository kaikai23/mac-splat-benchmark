import { RefCountedObject } from './ref-counted-object.js';

class Entry extends RefCountedObject {
		constructor(obj){
				super();
				this.object = obj;
				this.incRefCount();
		}
}
class RefCountedKeyCache {
		destroy() {
				this.cache.forEach((entry)=>{
						var _entry_object;
						(_entry_object = entry.object) == null ? undefined : _entry_object.destroy();
				});
				this.cache.clear();
		}
		clear() {
				this.cache.clear();
		}
		get(key) {
				var entry = this.cache.get(key);
				if (entry) {
						entry.incRefCount();
						return entry.object;
				}
				return null;
		}
		set(key, object) {
				this.cache.set(key, new Entry(object));
		}
		release(key) {
				var entry = this.cache.get(key);
				if (entry) {
						entry.decRefCount();
						if (entry.refCount === 0) {
								var _entry_object;
								this.cache.delete(key);
								(_entry_object = entry.object) == null ? undefined : _entry_object.destroy();
						}
				}
		}
		constructor(){
				this.cache = new Map();
		}
}

export { RefCountedKeyCache };
