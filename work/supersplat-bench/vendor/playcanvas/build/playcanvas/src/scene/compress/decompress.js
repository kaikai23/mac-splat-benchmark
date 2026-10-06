import { CompressUtils } from './compress-utils.js';

class Decompress {
		run() {
				var type = Object.prototype.toString.call(this._node);
				if (type === '[object Object]') {
						this._handleMap();
				} else if (type === '[object Array]') {
						this._handleArray();
				} else {
						this._result = this._node;
				}
				return this._result;
		}
		_handleMap() {
				this._result = {};
				var a = Object.keys(this._node);
				a.forEach(this._handleKey, this);
		}
		_handleKey(origKey) {
				var newKey = origKey;
				var len = origKey.length;
				if (len === 1) {
						newKey = CompressUtils.oneCharToKey(origKey, this._data);
				} else if (len === 2) {
						newKey = CompressUtils.multCharToKey(origKey, this._data);
				}
				this._result[newKey] = new Decompress(this._node[origKey], this._data).run();
		}
		_handleArray() {
				this._result = [];
				this._node.forEach(this._handleArElt, this);
		}
		_handleArElt(elt) {
				var v = new Decompress(elt, this._data).run();
				this._result.push(v);
		}
		constructor(node, data){
				this._node = node;
				this._data = data;
		}
}

export { Decompress };
