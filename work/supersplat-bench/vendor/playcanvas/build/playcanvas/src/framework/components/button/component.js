import { now } from '../../../core/time.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Component } from '../component.js';
import { BUTTON_TRANSITION_MODE_SPRITE_CHANGE, BUTTON_TRANSITION_MODE_TINT } from './constants.js';
import { ELEMENTTYPE_GROUP } from '../element/constants.js';

var VisualState = {
		DEFAULT: 'DEFAULT',
		HOVER: 'HOVER',
		PRESSED: 'PRESSED',
		INACTIVE: 'INACTIVE'
};
var STATES_TO_TINT_NAMES = {};
STATES_TO_TINT_NAMES[VisualState.DEFAULT] = '_defaultTint';
STATES_TO_TINT_NAMES[VisualState.HOVER] = 'hoverTint';
STATES_TO_TINT_NAMES[VisualState.PRESSED] = 'pressedTint';
STATES_TO_TINT_NAMES[VisualState.INACTIVE] = 'inactiveTint';
var STATES_TO_SPRITE_ASSET_NAMES = {};
STATES_TO_SPRITE_ASSET_NAMES[VisualState.DEFAULT] = '_defaultSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.HOVER] = 'hoverSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.PRESSED] = 'pressedSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.INACTIVE] = 'inactiveSpriteAsset';
var STATES_TO_SPRITE_FRAME_NAMES = {};
STATES_TO_SPRITE_FRAME_NAMES[VisualState.DEFAULT] = '_defaultSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.HOVER] = 'hoverSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.PRESSED] = 'pressedSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.INACTIVE] = 'inactiveSpriteFrame';
class ButtonComponent extends Component {
		get data() {
				var record = this.system.store[this.entity.getGuid()];
				return record ? record.data : null;
		}
		set enabled(arg) {
				this._setValue('enabled', arg);
		}
		get enabled() {
				return this.data.enabled;
		}
		set active(arg) {
				this._setValue('active', arg);
		}
		get active() {
				return this.data.active;
		}
		set imageEntity(arg) {
				if (this._imageEntity !== arg) {
						var isString = typeof arg === 'string';
						if (this._imageEntity && isString && this._imageEntity.getGuid() === arg) {
								return;
						}
						if (this._imageEntity) {
								this._imageEntityUnsubscribe();
						}
						if (arg instanceof GraphNode) {
								this._imageEntity = arg;
						} else if (isString) {
								this._imageEntity = this.system.app.getEntityFromIndex(arg) || null;
						} else {
								this._imageEntity = null;
						}
						if (this._imageEntity) {
								this._imageEntitySubscribe();
						}
						if (this._imageEntity) {
								this.data.imageEntity = this._imageEntity.getGuid();
						} else if (isString && arg) {
								this.data.imageEntity = arg;
						}
				}
		}
		get imageEntity() {
				return this._imageEntity;
		}
		set hitPadding(arg) {
				this._setValue('hitPadding', arg);
		}
		get hitPadding() {
				return this.data.hitPadding;
		}
		set transitionMode(arg) {
				this._setValue('transitionMode', arg);
		}
		get transitionMode() {
				return this.data.transitionMode;
		}
		set hoverTint(arg) {
				this._setValue('hoverTint', arg);
		}
		get hoverTint() {
				return this.data.hoverTint;
		}
		set pressedTint(arg) {
				this._setValue('pressedTint', arg);
		}
		get pressedTint() {
				return this.data.pressedTint;
		}
		set inactiveTint(arg) {
				this._setValue('inactiveTint', arg);
		}
		get inactiveTint() {
				return this.data.inactiveTint;
		}
		set fadeDuration(arg) {
				this._setValue('fadeDuration', arg);
		}
		get fadeDuration() {
				return this.data.fadeDuration;
		}
		set hoverSpriteAsset(arg) {
				this._setValue('hoverSpriteAsset', arg);
		}
		get hoverSpriteAsset() {
				return this.data.hoverSpriteAsset;
		}
		set hoverSpriteFrame(arg) {
				this._setValue('hoverSpriteFrame', arg);
		}
		get hoverSpriteFrame() {
				return this.data.hoverSpriteFrame;
		}
		set pressedSpriteAsset(arg) {
				this._setValue('pressedSpriteAsset', arg);
		}
		get pressedSpriteAsset() {
				return this.data.pressedSpriteAsset;
		}
		set pressedSpriteFrame(arg) {
				this._setValue('pressedSpriteFrame', arg);
		}
		get pressedSpriteFrame() {
				return this.data.pressedSpriteFrame;
		}
		set inactiveSpriteAsset(arg) {
				this._setValue('inactiveSpriteAsset', arg);
		}
		get inactiveSpriteAsset() {
				return this.data.inactiveSpriteAsset;
		}
		set inactiveSpriteFrame(arg) {
				this._setValue('inactiveSpriteFrame', arg);
		}
		get inactiveSpriteFrame() {
				return this.data.inactiveSpriteFrame;
		}
		_setValue(name, value) {
				var data = this.data;
				var oldValue = data[name];
				data[name] = value;
				this.fire('set', name, oldValue, value);
		}
		_toggleLifecycleListeners(onOrOff, system) {
				this[onOrOff]('set_active', this._onSetActive, this);
				this[onOrOff]('set_transitionMode', this._onSetTransitionMode, this);
				this[onOrOff]('set_hoverTint', this._onSetTransitionValue, this);
				this[onOrOff]('set_pressedTint', this._onSetTransitionValue, this);
				this[onOrOff]('set_inactiveTint', this._onSetTransitionValue, this);
				this[onOrOff]('set_hoverSpriteAsset', this._onSetTransitionValue, this);
				this[onOrOff]('set_hoverSpriteFrame', this._onSetTransitionValue, this);
				this[onOrOff]('set_pressedSpriteAsset', this._onSetTransitionValue, this);
				this[onOrOff]('set_pressedSpriteFrame', this._onSetTransitionValue, this);
				this[onOrOff]('set_inactiveSpriteAsset', this._onSetTransitionValue, this);
				this[onOrOff]('set_inactiveSpriteFrame', this._onSetTransitionValue, this);
				if (onOrOff === 'on') {
						this._evtElementAdd = this.entity.on('element:add', this._onElementComponentAdd, this);
				} else {
						var _this__evtElementAdd;
						(_this__evtElementAdd = this._evtElementAdd) == null ? undefined : _this__evtElementAdd.off();
						this._evtElementAdd = null;
				}
		}
		_onSetActive(name, oldValue, newValue) {
				if (oldValue !== newValue) {
						this._updateVisualState();
				}
		}
		_onSetTransitionMode(name, oldValue, newValue) {
				if (oldValue !== newValue) {
						this._cancelTween();
						this._resetToDefaultVisualState(oldValue);
						this._forceReapplyVisualState();
				}
		}
		_onSetTransitionValue(name, oldValue, newValue) {
				if (oldValue !== newValue) {
						this._forceReapplyVisualState();
				}
		}
		_imageEntitySubscribe() {
				this._evtImageEntityElementAdd = this._imageEntity.on('element:add', this._onImageElementGain, this);
				if (this._imageEntity.element) {
						this._onImageElementGain();
				}
		}
		_imageEntityUnsubscribe() {
				var _this__evtImageEntityElementAdd, _this__imageEntity;
				(_this__evtImageEntityElementAdd = this._evtImageEntityElementAdd) == null ? undefined : _this__evtImageEntityElementAdd.off();
				this._evtImageEntityElementAdd = null;
				if ((_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element) {
						this._onImageElementLose();
				}
		}
		_imageEntityElementSubscribe() {
				var element = this._imageEntity.element;
				this._evtImageEntityElementRemove = element.once('beforeremove', this._onImageElementLose, this);
				this._evtImageEntityElementColor = element.on('set:color', this._onSetColor, this);
				this._evtImageEntityElementOpacity = element.on('set:opacity', this._onSetOpacity, this);
				this._evtImageEntityElementSpriteAsset = element.on('set:spriteAsset', this._onSetSpriteAsset, this);
				this._evtImageEntityElementSpriteFrame = element.on('set:spriteFrame', this._onSetSpriteFrame, this);
		}
		_imageEntityElementUnsubscribe() {
				var _this__evtImageEntityElementRemove, _this__evtImageEntityElementColor, _this__evtImageEntityElementOpacity, _this__evtImageEntityElementSpriteAsset, _this__evtImageEntityElementSpriteFrame;
				(_this__evtImageEntityElementRemove = this._evtImageEntityElementRemove) == null ? undefined : _this__evtImageEntityElementRemove.off();
				this._evtImageEntityElementRemove = null;
				(_this__evtImageEntityElementColor = this._evtImageEntityElementColor) == null ? undefined : _this__evtImageEntityElementColor.off();
				this._evtImageEntityElementColor = null;
				(_this__evtImageEntityElementOpacity = this._evtImageEntityElementOpacity) == null ? undefined : _this__evtImageEntityElementOpacity.off();
				this._evtImageEntityElementOpacity = null;
				(_this__evtImageEntityElementSpriteAsset = this._evtImageEntityElementSpriteAsset) == null ? undefined : _this__evtImageEntityElementSpriteAsset.off();
				this._evtImageEntityElementSpriteAsset = null;
				(_this__evtImageEntityElementSpriteFrame = this._evtImageEntityElementSpriteFrame) == null ? undefined : _this__evtImageEntityElementSpriteFrame.off();
				this._evtImageEntityElementSpriteFrame = null;
		}
		_onElementComponentRemove() {
				this._toggleHitElementListeners('off');
		}
		_onElementComponentAdd() {
				this._toggleHitElementListeners('on');
		}
		_onImageElementLose() {
				this._imageEntityElementUnsubscribe();
				this._cancelTween();
				this._resetToDefaultVisualState(this.transitionMode);
		}
		_onImageElementGain() {
				this._imageEntityElementSubscribe();
				this._storeDefaultVisualState();
				this._forceReapplyVisualState();
		}
		_toggleHitElementListeners(onOrOff) {
				if (this.entity.element) {
						var isAdding = onOrOff === 'on';
						if (isAdding && this._hasHitElementListeners) {
								return;
						}
						this.entity.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);
						this.entity.element[onOrOff]('mouseenter', this._onMouseEnter, this);
						this.entity.element[onOrOff]('mouseleave', this._onMouseLeave, this);
						this.entity.element[onOrOff]('mousedown', this._onMouseDown, this);
						this.entity.element[onOrOff]('mouseup', this._onMouseUp, this);
						this.entity.element[onOrOff]('touchstart', this._onTouchStart, this);
						this.entity.element[onOrOff]('touchend', this._onTouchEnd, this);
						this.entity.element[onOrOff]('touchleave', this._onTouchLeave, this);
						this.entity.element[onOrOff]('touchcancel', this._onTouchCancel, this);
						this.entity.element[onOrOff]('selectstart', this._onSelectStart, this);
						this.entity.element[onOrOff]('selectend', this._onSelectEnd, this);
						this.entity.element[onOrOff]('selectenter', this._onSelectEnter, this);
						this.entity.element[onOrOff]('selectleave', this._onSelectLeave, this);
						this.entity.element[onOrOff]('click', this._onClick, this);
						this._hasHitElementListeners = isAdding;
				}
		}
		_storeDefaultVisualState() {
				var _this__imageEntity;
				var element = (_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element;
				if (!element || element.type === ELEMENTTYPE_GROUP) {
						return;
				}
				this._storeDefaultColor(element.color);
				this._storeDefaultOpacity(element.opacity);
				this._storeDefaultSpriteAsset(element.spriteAsset);
				this._storeDefaultSpriteFrame(element.spriteFrame);
		}
		_storeDefaultColor(color) {
				this._defaultTint.r = color.r;
				this._defaultTint.g = color.g;
				this._defaultTint.b = color.b;
		}
		_storeDefaultOpacity(opacity) {
				this._defaultTint.a = opacity;
		}
		_storeDefaultSpriteAsset(spriteAsset) {
				this._defaultSpriteAsset = spriteAsset;
		}
		_storeDefaultSpriteFrame(spriteFrame) {
				this._defaultSpriteFrame = spriteFrame;
		}
		_onSetColor(color) {
				if (!this._isApplyingTint) {
						this._storeDefaultColor(color);
						this._forceReapplyVisualState();
				}
		}
		_onSetOpacity(opacity) {
				if (!this._isApplyingTint) {
						this._storeDefaultOpacity(opacity);
						this._forceReapplyVisualState();
				}
		}
		_onSetSpriteAsset(spriteAsset) {
				if (!this._isApplyingSprite) {
						this._storeDefaultSpriteAsset(spriteAsset);
						this._forceReapplyVisualState();
				}
		}
		_onSetSpriteFrame(spriteFrame) {
				if (!this._isApplyingSprite) {
						this._storeDefaultSpriteFrame(spriteFrame);
						this._forceReapplyVisualState();
				}
		}
		_onMouseEnter(event) {
				this._isHovering = true;
				this._updateVisualState();
				this._fireIfActive('mouseenter', event);
		}
		_onMouseLeave(event) {
				this._isHovering = false;
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('mouseleave', event);
		}
		_onMouseDown(event) {
				this._isPressed = true;
				this._updateVisualState();
				this._fireIfActive('mousedown', event);
		}
		_onMouseUp(event) {
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('mouseup', event);
		}
		_onTouchStart(event) {
				this._isPressed = true;
				this._updateVisualState();
				this._fireIfActive('touchstart', event);
		}
		_onTouchEnd(event) {
				event.event.preventDefault();
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('touchend', event);
		}
		_onTouchLeave(event) {
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('touchleave', event);
		}
		_onTouchCancel(event) {
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('touchcancel', event);
		}
		_onSelectStart(event) {
				this._isPressed = true;
				this._updateVisualState();
				this._fireIfActive('selectstart', event);
		}
		_onSelectEnd(event) {
				this._isPressed = false;
				this._updateVisualState();
				this._fireIfActive('selectend', event);
		}
		_onSelectEnter(event) {
				this._hoveringCounter++;
				if (this._hoveringCounter === 1) {
						this._isHovering = true;
						this._updateVisualState();
				}
				this._fireIfActive('selectenter', event);
		}
		_onSelectLeave(event) {
				this._hoveringCounter--;
				if (this._hoveringCounter === 0) {
						this._isHovering = false;
						this._isPressed = false;
						this._updateVisualState();
				}
				this._fireIfActive('selectleave', event);
		}
		_onClick(event) {
				this._fireIfActive('click', event);
		}
		_fireIfActive(name, event) {
				if (this.data.active) {
						this.fire(name, event);
				}
		}
		_updateVisualState(force) {
				var oldVisualState = this._visualState;
				var newVisualState = this._determineVisualState();
				if ((oldVisualState !== newVisualState || force) && this.enabled) {
						this._visualState = newVisualState;
						if (oldVisualState === VisualState.HOVER) {
								this._fireIfActive('hoverend');
						}
						if (oldVisualState === VisualState.PRESSED) {
								this._fireIfActive('pressedend');
						}
						if (newVisualState === VisualState.HOVER) {
								this._fireIfActive('hoverstart');
						}
						if (newVisualState === VisualState.PRESSED) {
								this._fireIfActive('pressedstart');
						}
						switch(this.transitionMode){
								case BUTTON_TRANSITION_MODE_TINT:
										{
												var tintName = STATES_TO_TINT_NAMES[this._visualState];
												var tintColor = this[tintName];
												this._applyTint(tintColor);
												break;
										}
								case BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
										{
												var spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
												var spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
												var spriteAsset = this[spriteAssetName];
												var spriteFrame = this[spriteFrameName];
												this._applySprite(spriteAsset, spriteFrame);
												break;
										}
						}
				}
		}
		_forceReapplyVisualState() {
				this._updateVisualState(true);
		}
		_resetToDefaultVisualState(transitionMode) {
				var _this__imageEntity;
				if (!((_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element)) {
						return;
				}
				switch(transitionMode){
						case BUTTON_TRANSITION_MODE_TINT:
								this._cancelTween();
								this._applyTintImmediately(this._defaultTint);
								break;
						case BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
								this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
								break;
				}
		}
		_determineVisualState() {
				if (!this.active) {
						return VisualState.INACTIVE;
				} else if (this._isPressed) {
						return VisualState.PRESSED;
				} else if (this._isHovering) {
						return VisualState.HOVER;
				}
				return VisualState.DEFAULT;
		}
		_applySprite(spriteAsset, spriteFrame) {
				var _this__imageEntity;
				var element = (_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element;
				if (!element) {
						return;
				}
				spriteFrame = spriteFrame || 0;
				this._isApplyingSprite = true;
				if (element.spriteAsset !== spriteAsset) {
						element.spriteAsset = spriteAsset;
				}
				if (element.spriteFrame !== spriteFrame) {
						element.spriteFrame = spriteFrame;
				}
				this._isApplyingSprite = false;
		}
		_applyTint(tintColor) {
				this._cancelTween();
				if (this.fadeDuration === 0) {
						this._applyTintImmediately(tintColor);
				} else {
						this._applyTintWithTween(tintColor);
				}
		}
		_applyTintImmediately(tintColor) {
				var _this__imageEntity;
				var element = (_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element;
				if (!tintColor || !element || element.type === ELEMENTTYPE_GROUP) {
						return;
				}
				var color3 = toColor3(tintColor);
				this._isApplyingTint = true;
				if (!color3.equals(element.color)) {
						element.color = color3;
				}
				if (element.opacity !== tintColor.a) {
						element.opacity = tintColor.a;
				}
				this._isApplyingTint = false;
		}
		_applyTintWithTween(tintColor) {
				var _this__imageEntity;
				var element = (_this__imageEntity = this._imageEntity) == null ? undefined : _this__imageEntity.element;
				if (!tintColor || !element || element.type === ELEMENTTYPE_GROUP) {
						return;
				}
				var color3 = toColor3(tintColor);
				var color = element.color;
				var opacity = element.opacity;
				if (color3.equals(color) && tintColor.a === opacity) return;
				this._tweenInfo = {
						startTime: now(),
						from: new Color(color.r, color.g, color.b, opacity),
						to: tintColor.clone(),
						lerpColor: new Color()
				};
		}
		_updateTintTween() {
				var elapsedTime = now() - this._tweenInfo.startTime;
				var elapsedProportion = this.fadeDuration === 0 ? 1 : elapsedTime / this.fadeDuration;
				elapsedProportion = math.clamp(elapsedProportion, 0, 1);
				if (Math.abs(elapsedProportion - 1) > 1e-5) {
						var lerpColor = this._tweenInfo.lerpColor;
						lerpColor.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
						this._applyTintImmediately(new Color(lerpColor.r, lerpColor.g, lerpColor.b, lerpColor.a));
				} else {
						this._applyTintImmediately(this._tweenInfo.to);
						this._cancelTween();
				}
		}
		_cancelTween() {
				delete this._tweenInfo;
		}
		onUpdate() {
				if (this._tweenInfo) {
						this._updateTintTween();
				}
		}
		onEnable() {
				this._isHovering = false;
				this._hoveringCounter = 0;
				this._isPressed = false;
				this._toggleHitElementListeners('on');
				this._forceReapplyVisualState();
		}
		onDisable() {
				this._toggleHitElementListeners('off');
				this._resetToDefaultVisualState(this.transitionMode);
		}
		onRemove() {
				this._imageEntityUnsubscribe();
				this._toggleLifecycleListeners('off', this.system);
				this.onDisable();
		}
		resolveDuplicatedEntityReferenceProperties(oldButton, duplicatedIdsMap) {
				if (oldButton.imageEntity) {
						this.imageEntity = duplicatedIdsMap[oldButton.imageEntity.getGuid()];
				}
		}
		constructor(system, entity){
				super(system, entity), this._visualState = VisualState.DEFAULT, this._isHovering = false, this._hoveringCounter = 0, this._isPressed = false, this._defaultTint = new Color(1, 1, 1, 1), this._defaultSpriteAsset = null, this._defaultSpriteFrame = 0, this._imageEntity = null, this._evtElementAdd = null, this._evtImageEntityElementAdd = null, this._evtImageEntityElementRemove = null, this._evtImageEntityElementColor = null, this._evtImageEntityElementOpacity = null, this._evtImageEntityElementSpriteAsset = null, this._evtImageEntityElementSpriteFrame = null;
				this._visualState = VisualState.DEFAULT;
				this._isHovering = false;
				this._hoveringCounter = 0;
				this._isPressed = false;
				this._defaultTint = new Color(1, 1, 1, 1);
				this._defaultSpriteAsset = null;
				this._defaultSpriteFrame = 0;
				this._toggleLifecycleListeners('on', system);
		}
}
ButtonComponent.EVENT_MOUSEDOWN = 'mousedown';
ButtonComponent.EVENT_MOUSEUP = 'mouseup';
ButtonComponent.EVENT_MOUSEENTER = 'mouseenter';
ButtonComponent.EVENT_MOUSELEAVE = 'mouseleave';
ButtonComponent.EVENT_CLICK = 'click';
ButtonComponent.EVENT_TOUCHSTART = 'touchstart';
ButtonComponent.EVENT_TOUCHEND = 'touchend';
ButtonComponent.EVENT_TOUCHCANCEL = 'touchcancel';
ButtonComponent.EVENT_TOUCHLEAVE = 'touchleave';
ButtonComponent.EVENT_SELECTSTART = 'selectstart';
ButtonComponent.EVENT_SELECTEND = 'selectend';
ButtonComponent.EVENT_SELECTENTER = 'selectenter';
ButtonComponent.EVENT_SELECTLEAVE = 'selectleave';
ButtonComponent.EVENT_HOVERSTART = 'hoverstart';
ButtonComponent.EVENT_HOVEREND = 'hoverend';
ButtonComponent.EVENT_PRESSEDSTART = 'pressedstart';
ButtonComponent.EVENT_PRESSEDEND = 'pressedend';
function toColor3(color4) {
		return new Color(color4.r, color4.g, color4.b);
}

export { ButtonComponent };
