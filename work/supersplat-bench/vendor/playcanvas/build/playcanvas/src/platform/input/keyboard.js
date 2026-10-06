import { EventHandler } from '../../core/event-handler.js';
import { KeyboardEvent } from './keyboard-event.js';

var _keyboardEvent = new KeyboardEvent();
function makeKeyboardEvent(event) {
		_keyboardEvent.key = event.keyCode;
		_keyboardEvent.element = event.target;
		_keyboardEvent.event = event;
		return _keyboardEvent;
}
function toKeyCode(s) {
		if (typeof s === 'string') {
				return s.toUpperCase().charCodeAt(0);
		}
		return s;
}
var _keyCodeToKeyIdentifier = {
		'9': 'Tab',
		'13': 'Enter',
		'16': 'Shift',
		'17': 'Control',
		'18': 'Alt',
		'27': 'Escape',
		'37': 'Left',
		'38': 'Up',
		'39': 'Right',
		'40': 'Down',
		'46': 'Delete',
		'91': 'Win'
};
class Keyboard extends EventHandler {
		attach(element) {
				if (this._element) {
						this.detach();
				}
				this._element = element;
				this._element.addEventListener('keydown', this._keyDownHandler, false);
				this._element.addEventListener('keypress', this._keyPressHandler, false);
				this._element.addEventListener('keyup', this._keyUpHandler, false);
				document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
				window.addEventListener('blur', this._windowBlurHandler, false);
		}
		detach() {
				if (!this._element) {
						return;
				}
				this._element.removeEventListener('keydown', this._keyDownHandler);
				this._element.removeEventListener('keypress', this._keyPressHandler);
				this._element.removeEventListener('keyup', this._keyUpHandler);
				this._element = null;
				document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
				window.removeEventListener('blur', this._windowBlurHandler, false);
		}
		toKeyIdentifier(keyCode) {
				keyCode = toKeyCode(keyCode);
				var id = _keyCodeToKeyIdentifier[keyCode.toString()];
				if (id) {
						return id;
				}
				var hex = keyCode.toString(16).toUpperCase();
				var length = hex.length;
				for(var count = 0; count < 4 - length; count++){
						hex = "0" + hex;
				}
				return "U+" + hex;
		}
		_handleKeyDown(event) {
				var code = event.keyCode || event.charCode;
				if (code === undefined) return;
				var id = this.toKeyIdentifier(code);
				this._keymap[id] = true;
				this.fire('keydown', makeKeyboardEvent(event));
				if (this.preventDefault) {
						event.preventDefault();
				}
				if (this.stopPropagation) {
						event.stopPropagation();
				}
		}
		_handleKeyUp(event) {
				var code = event.keyCode || event.charCode;
				if (code === undefined) return;
				var id = this.toKeyIdentifier(code);
				delete this._keymap[id];
				this.fire('keyup', makeKeyboardEvent(event));
				if (this.preventDefault) {
						event.preventDefault();
				}
				if (this.stopPropagation) {
						event.stopPropagation();
				}
		}
		_handleKeyPress(event) {
				this.fire('keypress', makeKeyboardEvent(event));
				if (this.preventDefault) {
						event.preventDefault();
				}
				if (this.stopPropagation) {
						event.stopPropagation();
				}
		}
		_handleVisibilityChange() {
				if (document.visibilityState === 'hidden') {
						this._handleWindowBlur();
				}
		}
		_handleWindowBlur() {
				this._keymap = {};
				this._lastmap = {};
		}
		update() {
				for(var prop in this._lastmap){
						delete this._lastmap[prop];
				}
				for(var prop1 in this._keymap){
						if (this._keymap.hasOwnProperty(prop1)) {
								this._lastmap[prop1] = this._keymap[prop1];
						}
				}
		}
		isPressed(key) {
				var keyCode = toKeyCode(key);
				var id = this.toKeyIdentifier(keyCode);
				return !!this._keymap[id];
		}
		wasPressed(key) {
				var keyCode = toKeyCode(key);
				var id = this.toKeyIdentifier(keyCode);
				return !!this._keymap[id] && !!!this._lastmap[id];
		}
		wasReleased(key) {
				var keyCode = toKeyCode(key);
				var id = this.toKeyIdentifier(keyCode);
				return !!!this._keymap[id] && !!this._lastmap[id];
		}
		constructor(element, options = {}){
				super(), this._element = null, this._keymap = {}, this._lastmap = {};
				this._keyDownHandler = this._handleKeyDown.bind(this);
				this._keyUpHandler = this._handleKeyUp.bind(this);
				this._keyPressHandler = this._handleKeyPress.bind(this);
				this._visibilityChangeHandler = this._handleVisibilityChange.bind(this);
				this._windowBlurHandler = this._handleWindowBlur.bind(this);
				if (element) {
						this.attach(element);
				}
				this.preventDefault = options.preventDefault || false;
				this.stopPropagation = options.stopPropagation || false;
		}
}
Keyboard.EVENT_KEYDOWN = 'keydown';
Keyboard.EVENT_KEYUP = 'keyup';

export { Keyboard };
