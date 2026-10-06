import { EventHandler } from '../../core/event-handler.js';
import { EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_L_SHOULDER_1, PAD_R_SHOULDER_1, PAD_L_SHOULDER_2, PAD_R_SHOULDER_2, PAD_SELECT, PAD_START, PAD_L_STICK_BUTTON, PAD_R_STICK_BUTTON, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_VENDOR, XRPAD_TRIGGER, XRPAD_SQUEEZE, XRPAD_TOUCHPAD_BUTTON, XRPAD_STICK_BUTTON, XRPAD_A, XRPAD_B, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_R_STICK_X, PAD_R_STICK_Y, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_STICK_X, XRPAD_STICK_Y } from './constants.js';
import { math } from '../../core/math/math.js';
import { platform } from '../../core/platform.js';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
		try {
				var info = gen[key](arg);
				var value = info.value;
		} catch (error) {
				reject(error);
				return;
		}
		if (info.done) {
				resolve(value);
		} else {
				Promise.resolve(value).then(_next, _throw);
		}
}
function _async_to_generator(fn) {
		return function() {
				var self = this, args = arguments;
				return new Promise(function(resolve, reject) {
						var gen = fn.apply(self, args);
						function _next(value) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
						}
						function _throw(err) {
								asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
						}
						_next(undefined);
				});
		};
}
var dummyArray = Object.freeze([]);
var getGamepads = function getGamepads() {
		return dummyArray;
};
if (typeof navigator !== 'undefined') {
		getGamepads = (navigator.getGamepads || navigator.webkitGetGamepads || getGamepads).bind(navigator);
}
var MAPS_INDEXES = {
		buttons: {
				PAD_FACE_1,
				PAD_FACE_2,
				PAD_FACE_3,
				PAD_FACE_4,
				PAD_L_SHOULDER_1,
				PAD_R_SHOULDER_1,
				PAD_L_SHOULDER_2,
				PAD_R_SHOULDER_2,
				PAD_SELECT,
				PAD_START,
				PAD_L_STICK_BUTTON,
				PAD_R_STICK_BUTTON,
				PAD_UP,
				PAD_DOWN,
				PAD_LEFT,
				PAD_RIGHT,
				PAD_VENDOR,
				XRPAD_TRIGGER,
				XRPAD_SQUEEZE,
				XRPAD_TOUCHPAD_BUTTON,
				XRPAD_STICK_BUTTON,
				XRPAD_A,
				XRPAD_B
		},
		axes: {
				PAD_L_STICK_X,
				PAD_L_STICK_Y,
				PAD_R_STICK_X,
				PAD_R_STICK_Y,
				XRPAD_TOUCHPAD_X,
				XRPAD_TOUCHPAD_Y,
				XRPAD_STICK_X,
				XRPAD_STICK_Y
		}
};
var MAPS = {
		DEFAULT: {
				buttons: [
						'PAD_FACE_1',
						'PAD_FACE_2',
						'PAD_FACE_3',
						'PAD_FACE_4',
						'PAD_L_SHOULDER_1',
						'PAD_R_SHOULDER_1',
						'PAD_L_SHOULDER_2',
						'PAD_R_SHOULDER_2',
						'PAD_SELECT',
						'PAD_START',
						'PAD_L_STICK_BUTTON',
						'PAD_R_STICK_BUTTON',
						'PAD_UP',
						'PAD_DOWN',
						'PAD_LEFT',
						'PAD_RIGHT',
						'PAD_VENDOR'
				],
				axes: [
						'PAD_L_STICK_X',
						'PAD_L_STICK_Y',
						'PAD_R_STICK_X',
						'PAD_R_STICK_Y'
				]
		},
		DEFAULT_DUAL: {
				buttons: [
						'PAD_FACE_1',
						'PAD_FACE_2',
						'PAD_FACE_3',
						'PAD_FACE_4',
						'PAD_L_SHOULDER_1',
						'PAD_R_SHOULDER_1',
						'PAD_L_SHOULDER_2',
						'PAD_R_SHOULDER_2',
						'PAD_SELECT',
						'PAD_START',
						'PAD_L_STICK_BUTTON',
						'PAD_R_STICK_BUTTON',
						'PAD_VENDOR'
				],
				axes: [
						'PAD_L_STICK_X',
						'PAD_L_STICK_Y',
						'PAD_R_STICK_X',
						'PAD_R_STICK_Y'
				],
				synthesizedButtons: {
						PAD_UP: {
								axis: 0,
								min: 0,
								max: 1
						},
						PAD_DOWN: {
								axis: 0,
								min: -1,
								max: 0
						},
						PAD_LEFT: {
								axis: 0,
								min: -1,
								max: 0
						},
						PAD_RIGHT: {
								axis: 0,
								min: 0,
								max: 1
						}
				}
		},
		PS3: {
				buttons: [
						'PAD_FACE_1',
						'PAD_FACE_2',
						'PAD_FACE_4',
						'PAD_FACE_3',
						'PAD_L_SHOULDER_1',
						'PAD_R_SHOULDER_1',
						'PAD_L_SHOULDER_2',
						'PAD_R_SHOULDER_2',
						'PAD_SELECT',
						'PAD_START',
						'PAD_L_STICK_BUTTON',
						'PAD_R_STICK_BUTTON',
						'PAD_UP',
						'PAD_DOWN',
						'PAD_LEFT',
						'PAD_RIGHT',
						'PAD_VENDOR'
				],
				axes: [
						'PAD_L_STICK_X',
						'PAD_L_STICK_Y',
						'PAD_R_STICK_X',
						'PAD_R_STICK_Y'
				],
				mapping: 'standard'
		},
		DEFAULT_XR: {
				buttons: [
						'XRPAD_TRIGGER',
						'XRPAD_SQUEEZE',
						'XRPAD_TOUCHPAD_BUTTON',
						'XRPAD_STICK_BUTTON',
						'XRPAD_A',
						'XRPAD_B'
				],
				axes: [
						'XRPAD_TOUCHPAD_X',
						'XRPAD_TOUCHPAD_Y',
						'XRPAD_STICK_X',
						'XRPAD_STICK_Y'
				],
				mapping: 'xr-standard'
		}
};
var PRODUCT_CODES = {
		'Product: 0268': 'PS3'
};
var custom_maps = {};
function getMap(pad) {
		var custom = custom_maps[pad.id];
		if (custom) {
				return custom;
		}
		for(var code in PRODUCT_CODES){
				if (pad.id.indexOf(code) !== -1) {
						var product = PRODUCT_CODES[code];
						if (!pad.mapping) {
								var raw = MAPS["RAW_" + product];
								if (raw) {
										return raw;
								}
						}
						return MAPS[product];
				}
		}
		if (pad.mapping === 'xr-standard') {
				return MAPS.DEFAULT_XR;
		}
		var defaultmap = MAPS.DEFAULT;
		var map = pad.buttons.length < defaultmap.buttons.length ? MAPS.DEFAULT_DUAL : defaultmap;
		map.mapping = pad.mapping;
		return map;
}
var deadZone = 0.25;
function sleep(ms) {
		return new Promise((resolve)=>{
				setTimeout(resolve, ms);
		});
}
class GamePadButton {
		update(button) {
				var { value, pressed } = button;
				var _button_touched;
				var touched = (_button_touched = button.touched) != null ? _button_touched : value > 0;
				this.wasPressed = !this.pressed && pressed;
				this.wasReleased = this.pressed && !pressed;
				this.wasTouched = !this.touched && touched;
				this.value = value;
				this.pressed = pressed;
				this.touched = touched;
		}
		constructor(current, previous){
				this.value = 0;
				this.pressed = false;
				this.touched = false;
				this.wasPressed = false;
				this.wasReleased = false;
				this.wasTouched = false;
				if (typeof current === 'number') {
						this.value = current;
						this.pressed = current === 1;
						this.touched = current > 0;
				} else {
						this.value = current.value;
						this.pressed = current.pressed;
						var _current_touched;
						this.touched = (_current_touched = current.touched) != null ? _current_touched : current.value > 0;
				}
				if (previous) {
						if (typeof previous === 'number') {
								this.wasPressed = previous !== 1 && this.pressed;
								this.wasReleased = previous === 1 && !this.pressed;
								this.wasTouched = previous === 0 && this.touched;
						} else {
								this.wasPressed = !previous.pressed && this.pressed;
								this.wasReleased = previous.pressed && !this.pressed;
								var _previous_touched;
								this.wasTouched = !((_previous_touched = previous.touched) != null ? _previous_touched : previous.value > 0) && this.touched;
						}
				}
		}
}
var dummyButton = Object.freeze(new GamePadButton(0));
class GamePad {
		get connected() {
				return this.pad.connected;
		}
		_compileMapping() {
				var { axes, buttons } = this._compiledMapping;
				var axesIndexes = MAPS_INDEXES.axes;
				var buttonsIndexes = MAPS_INDEXES.buttons;
				axes.length = 0;
				buttons.length = 0;
				var axesMap = this.map.axes;
				if (axesMap) {
						this.map.axes.forEach((axis, i)=>{
								axes[axesIndexes[axis]] = ()=>this.pad.axes[i] || 0;
						});
				}
				for(var i = 0, l = axes.length; i < l; i++){
						if (!axes[i]) {
								axes[i] = ()=>0;
						}
				}
				var buttonsMap = this.map.buttons;
				if (buttonsMap) {
						buttonsMap.forEach((button, i)=>{
								buttons[buttonsIndexes[button]] = ()=>this._buttons[i] || dummyButton;
						});
				}
				var synthesizedButtonsMap = this.map.synthesizedButtons;
				if (synthesizedButtonsMap) {
						Object.entries(synthesizedButtonsMap).forEach((button)=>{
								var { axis, max, min } = button[1];
								buttons[buttonsIndexes[button[0]]] = ()=>{
										var _this__axes_axis, _this__previousAxes_axis;
										return new GamePadButton(Math.abs(math.clamp((_this__axes_axis = this._axes[axis]) != null ? _this__axes_axis : 0, min, max)), Math.abs(math.clamp((_this__previousAxes_axis = this._previousAxes[axis]) != null ? _this__previousAxes_axis : 0, min, max)));
								};
						});
				}
				for(var i1 = 0, l1 = buttons.length; i1 < l1; i1++){
						if (!buttons[i1]) {
								buttons[i1] = ()=>dummyButton;
						}
				}
		}
		update(gamepad) {
				this.pad = gamepad;
				var previousAxes = this._previousAxes;
				var axes = this._axes;
				previousAxes.length = 0;
				previousAxes.push(...axes);
				axes.length = 0;
				axes.push(...gamepad.axes);
				var buttons = this._buttons;
				for(var i = 0, l = buttons.length; i < l; i++){
						buttons[i].update(gamepad.buttons[i]);
				}
				return this;
		}
		updateMap(map) {
				map.mapping = 'custom';
				custom_maps[this.id] = map;
				this.map = map;
				this.mapping = 'custom';
				this._compileMapping();
		}
		resetMap() {
				if (custom_maps[this.id]) {
						delete custom_maps[this.id];
						var map = getMap(this.pad);
						this.map = map;
						this.mapping = map.mapping;
						this._compileMapping();
				}
		}
		get axes() {
				return this._compiledMapping.axes.map((a)=>a());
		}
		get buttons() {
				return this._compiledMapping.buttons.map((b)=>b());
		}
		pulse(intensity, duration, options) {
				var _this = this;
				return _async_to_generator(function*() {
						var actuators = _this.pad.vibrationActuator ? [
								_this.pad.vibrationActuator
						] : _this.pad.hapticActuators || dummyArray;
						if (actuators.length) {
								var _options_startDelay;
								var startDelay = (_options_startDelay = options == null ? undefined : options.startDelay) != null ? _options_startDelay : 0;
								var _options_strongMagnitude;
								var strongMagnitude = (_options_strongMagnitude = options == null ? undefined : options.strongMagnitude) != null ? _options_strongMagnitude : intensity;
								var _options_weakMagnitude;
								var weakMagnitude = (_options_weakMagnitude = options == null ? undefined : options.weakMagnitude) != null ? _options_weakMagnitude : intensity;
								var results = yield Promise.all(actuators.map(/*#__PURE__*/ _async_to_generator(function*(actuator) {
										if (!actuator) {
												return true;
										}
										if (actuator.playEffect) {
												return actuator.playEffect(actuator.type, {
														duration,
														startDelay,
														strongMagnitude,
														weakMagnitude
												});
										} else if (actuator.pulse) {
												yield sleep(startDelay);
												return actuator.pulse(intensity, duration);
										}
										return false;
								})));
								return results.some((r)=>r === true || r === 'complete');
						}
						return false;
				})();
		}
		getButton(index) {
				var button = this._compiledMapping.buttons[index];
				return button ? button() : dummyButton;
		}
		isPressed(button) {
				return this.getButton(button).pressed;
		}
		wasPressed(button) {
				return this.getButton(button).wasPressed;
		}
		wasReleased(button) {
				return this.getButton(button).wasReleased;
		}
		isTouched(button) {
				return this.getButton(button).touched;
		}
		wasTouched(button) {
				return this.getButton(button).wasTouched;
		}
		getValue(button) {
				return this.getButton(button).value;
		}
		getAxis(axis) {
				var a = this.axes[axis];
				return a && Math.abs(a) > deadZone ? a : 0;
		}
		constructor(gamepad, map){
				this._compiledMapping = {
						buttons: [],
						axes: []
				};
				this.id = gamepad.id;
				this.index = gamepad.index;
				this._buttons = gamepad.buttons.map((b)=>new GamePadButton(b));
				this._axes = [
						...gamepad.axes
				];
				this._previousAxes = [
						...gamepad.axes
				];
				this.mapping = map.mapping;
				this.map = map;
				this.hand = gamepad.hand || 'none';
				this.pad = gamepad;
				this._compileMapping();
		}
}
class GamePads extends EventHandler {
		set deadZone(value) {
				deadZone = value;
		}
		get deadZone() {
				return deadZone;
		}
		get previous() {
				var current = this.current;
				for(var i = 0, l = current.length; i < l; i++){
						var buttons = current[i]._buttons;
						if (!this._previous[i]) {
								this._previous[i] = [];
						}
						for(var j = 0, m = buttons.length; j < m; j++){
								var button = buttons[i];
								this.previous[i][j] = button ? !button.wasPressed && button.pressed || button.wasReleased : false;
						}
				}
				this._previous.length = this.current.length;
				return this._previous;
		}
		_ongamepadconnected(event) {
				var pad = new GamePad(event.gamepad, this.getMap(event.gamepad));
				var current = this.current;
				var padIndex = current.findIndex((gp)=>gp.index === pad.index);
				while(padIndex !== -1){
						current.splice(padIndex, 1);
						padIndex = current.findIndex((gp)=>gp.index === pad.index);
				}
				current.push(pad);
				this.fire(EVENT_GAMEPADCONNECTED, pad);
		}
		_ongamepaddisconnected(event) {
				var current = this.current;
				var padIndex = current.findIndex((gp)=>gp.index === event.gamepad.index);
				if (padIndex !== -1) {
						this.fire(EVENT_GAMEPADDISCONNECTED, current[padIndex]);
						current.splice(padIndex, 1);
				}
		}
		update() {
				this.poll();
		}
		poll(pads) {
				if (pads === undefined) pads = [];
				if (pads.length > 0) {
						pads.length = 0;
				}
				var padDevices = getGamepads();
				for(var i = 0, len = padDevices.length; i < len; i++){
						if (padDevices[i]) {
								var pad = this.findByIndex(padDevices[i].index);
								if (pad) {
										pads.push(pad.update(padDevices[i]));
								} else {
										var nPad = new GamePad(padDevices[i], this.getMap(padDevices[i]));
										this.current.push(nPad);
										pads.push(nPad);
								}
						}
				}
				return pads;
		}
		destroy() {
				window.removeEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
				window.removeEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
		}
		getMap(pad) {
				return getMap(pad);
		}
		isPressed(orderIndex, button) {
				var _this_current_orderIndex;
				return ((_this_current_orderIndex = this.current[orderIndex]) == null ? undefined : _this_current_orderIndex.isPressed(button)) || false;
		}
		wasPressed(orderIndex, button) {
				var _this_current_orderIndex;
				return ((_this_current_orderIndex = this.current[orderIndex]) == null ? undefined : _this_current_orderIndex.wasPressed(button)) || false;
		}
		wasReleased(orderIndex, button) {
				var _this_current_orderIndex;
				return ((_this_current_orderIndex = this.current[orderIndex]) == null ? undefined : _this_current_orderIndex.wasReleased(button)) || false;
		}
		getAxis(orderIndex, axis) {
				var _this_current_orderIndex;
				return ((_this_current_orderIndex = this.current[orderIndex]) == null ? undefined : _this_current_orderIndex.getAxis(axis)) || 0;
		}
		pulse(orderIndex, intensity, duration, options) {
				var pad = this.current[orderIndex];
				return pad ? pad.pulse(intensity, duration, options) : Promise.resolve(false);
		}
		pulseAll(intensity, duration, options) {
				return Promise.all(this.current.map((pad)=>pad.pulse(intensity, duration, options)));
		}
		findById(id) {
				return this.current.find((gp)=>gp && gp.id === id) || null;
		}
		findByIndex(index) {
				return this.current.find((gp)=>gp && gp.index === index) || null;
		}
		constructor(){
				super();
				this.gamepadsSupported = platform.gamepads;
				this.current = [];
				this._previous = [];
				this._ongamepadconnectedHandler = this._ongamepadconnected.bind(this);
				this._ongamepaddisconnectedHandler = this._ongamepaddisconnected.bind(this);
				window.addEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
				window.addEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
				this.poll();
		}
}
GamePads.EVENT_GAMEPADCONNECTED = 'gamepadconnected';
GamePads.EVENT_GAMEPADDISCONNECTED = 'gamepaddisconnected';

export { GamePad, GamePadButton, GamePads };
