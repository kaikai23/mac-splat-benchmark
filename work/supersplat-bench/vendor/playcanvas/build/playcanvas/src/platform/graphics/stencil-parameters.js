import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';
import { StringIds } from '../../core/string-ids.js';

var stringIds = new StringIds();
class StencilParameters {
		set func(value) {
				this._func = value;
				this._dirty = true;
		}
		get func() {
				return this._func;
		}
		set ref(value) {
				this._ref = value;
				this._dirty = true;
		}
		get ref() {
				return this._ref;
		}
		set fail(value) {
				this._fail = value;
				this._dirty = true;
		}
		get fail() {
				return this._fail;
		}
		set zfail(value) {
				this._zfail = value;
				this._dirty = true;
		}
		get zfail() {
				return this._zfail;
		}
		set zpass(value) {
				this._zpass = value;
				this._dirty = true;
		}
		get zpass() {
				return this._zpass;
		}
		set readMask(value) {
				this._readMask = value;
				this._dirty = true;
		}
		get readMask() {
				return this._readMask;
		}
		set writeMask(value) {
				this._writeMask = value;
				this._dirty = true;
		}
		get writeMask() {
				return this._writeMask;
		}
		_evalKey() {
				var { _func, _ref, _fail, _zfail, _zpass, _readMask, _writeMask } = this;
				var key = _func + "," + _ref + "," + _fail + "," + _zfail + "," + _zpass + "," + _readMask + "," + _writeMask;
				this._key = stringIds.get(key);
				this._dirty = false;
		}
		get key() {
				if (this._dirty) {
						this._evalKey();
				}
				return this._key;
		}
		copy(rhs) {
				this._func = rhs._func;
				this._ref = rhs._ref;
				this._readMask = rhs._readMask;
				this._writeMask = rhs._writeMask;
				this._fail = rhs._fail;
				this._zfail = rhs._zfail;
				this._zpass = rhs._zpass;
				this._dirty = rhs._dirty;
				this._key = rhs._key;
				return this;
		}
		clone() {
				var clone = new this.constructor();
				return clone.copy(this);
		}
		constructor(options = {}){
				this._dirty = true;
				var _options_func;
				this._func = (_options_func = options.func) != null ? _options_func : FUNC_ALWAYS;
				var _options_ref;
				this._ref = (_options_ref = options.ref) != null ? _options_ref : 0;
				var _options_readMask;
				this._readMask = (_options_readMask = options.readMask) != null ? _options_readMask : 0xFF;
				var _options_writeMask;
				this._writeMask = (_options_writeMask = options.writeMask) != null ? _options_writeMask : 0xFF;
				var _options_fail;
				this._fail = (_options_fail = options.fail) != null ? _options_fail : STENCILOP_KEEP;
				var _options_zfail;
				this._zfail = (_options_zfail = options.zfail) != null ? _options_zfail : STENCILOP_KEEP;
				var _options_zpass;
				this._zpass = (_options_zpass = options.zpass) != null ? _options_zpass : STENCILOP_KEEP;
				this._evalKey();
		}
}
StencilParameters.DEFAULT = Object.freeze(new StencilParameters());

export { StencilParameters };
