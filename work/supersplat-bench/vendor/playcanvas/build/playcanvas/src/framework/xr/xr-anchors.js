import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrAnchor } from './xr-anchor.js';

class XrAnchors extends EventHandler {
		_onSessionStart() {
				var available = this.manager.session.enabledFeatures.indexOf('anchors') !== -1;
				if (!available) return;
				this._available = available;
				this.fire('available');
		}
		_onSessionEnd() {
				if (!this._available) return;
				this._available = false;
				for(var i = 0; i < this._creationQueue.length; i++){
						if (!this._creationQueue[i].callback) {
								continue;
						}
						this._creationQueue[i].callback(new Error('session ended'), null);
				}
				this._creationQueue.length = 0;
				this._index.clear();
				this._indexByUuid.clear();
				var i1 = this._list.length;
				while(i1--){
						this._list[i1].destroy();
				}
				this._list.length = 0;
				this.fire('unavailable');
		}
		_createAnchor(xrAnchor, uuid) {
				if (uuid === undefined) uuid = null;
				var anchor = new XrAnchor(this, xrAnchor, uuid);
				this._index.set(xrAnchor, anchor);
				if (uuid) this._indexByUuid.set(uuid, anchor);
				this._list.push(anchor);
				anchor.once('destroy', this._onAnchorDestroy, this);
				return anchor;
		}
		_onAnchorDestroy(xrAnchor, anchor) {
				this._index.delete(xrAnchor);
				if (anchor.uuid) this._indexByUuid.delete(anchor.uuid);
				var ind = this._list.indexOf(anchor);
				if (ind !== -1) this._list.splice(ind, 1);
				this.fire('destroy', anchor);
		}
		create(position, rotation, callback) {
				if (!this._available) {
						callback == null ? undefined : callback(new Error('Anchors API is not available'), null);
						return;
				}
				if (window.XRHitTestResult && position instanceof XRHitTestResult) {
						var hitResult = position;
						callback = rotation;
						if (!this._supported) {
								callback == null ? undefined : callback(new Error('Anchors API is not supported'), null);
								return;
						}
						if (!hitResult.createAnchor) {
								callback == null ? undefined : callback(new Error('Creating Anchor from Hit Test is not supported'), null);
								return;
						}
						hitResult.createAnchor().then((xrAnchor)=>{
								var anchor = this._createAnchor(xrAnchor);
								callback == null ? undefined : callback(null, anchor);
								this.fire('add', anchor);
						}).catch((ex)=>{
								callback == null ? undefined : callback(ex, null);
								this.fire('error', ex);
						});
				} else {
						this._creationQueue.push({
								transform: new XRRigidTransform(position, rotation),
								callback: callback
						});
				}
		}
		restore(uuid, callback) {
				if (!this._available) {
						callback == null ? undefined : callback(new Error('Anchors API is not available'), null);
						return;
				}
				if (!this._persistence) {
						callback == null ? undefined : callback(new Error('Anchor Persistence is not supported'), null);
						return;
				}
				if (!this.manager.active) {
						callback == null ? undefined : callback(new Error('WebXR session is not active'), null);
						return;
				}
				this.manager.session.restorePersistentAnchor(uuid).then((xrAnchor)=>{
						var anchor = this._createAnchor(xrAnchor, uuid);
						callback == null ? undefined : callback(null, anchor);
						this.fire('add', anchor);
				}).catch((ex)=>{
						callback == null ? undefined : callback(ex, null);
						this.fire('error', ex);
				});
		}
		forget(uuid, callback) {
				if (!this._available) {
						callback == null ? undefined : callback(new Error('Anchors API is not available'));
						return;
				}
				if (!this._persistence) {
						callback == null ? undefined : callback(new Error('Anchor Persistence is not supported'));
						return;
				}
				if (!this.manager.active) {
						callback == null ? undefined : callback(new Error('WebXR session is not active'));
						return;
				}
				this.manager.session.deletePersistentAnchor(uuid).then(()=>{
						callback == null ? undefined : callback(null);
				}).catch((ex)=>{
						callback == null ? undefined : callback(ex);
						this.fire('error', ex);
				});
		}
		update(frame) {
				if (!this._available) {
						if (!this.manager.session.enabledFeatures && !this._checkingAvailability) {
								this._checkingAvailability = true;
								frame.createAnchor(new XRRigidTransform(), this.manager._referenceSpace).then((xrAnchor)=>{
										xrAnchor.delete();
										if (this.manager.active) {
												this._available = true;
												this.fire('available');
										}
								}).catch(()=>{});
						}
						return;
				}
				if (this._creationQueue.length) {
						var _this, _loop = function(i) {
								var request = _this._creationQueue[i];
								frame.createAnchor(request.transform, _this.manager._referenceSpace).then((xrAnchor)=>{
										if (request.callback) {
												_this._callbacksAnchors.set(xrAnchor, request.callback);
										}
								}).catch((ex)=>{
										if (request.callback) {
												request.callback(ex, null);
										}
										_this.fire('error', ex);
								});
						};
						for(var i = 0; i < this._creationQueue.length; i++)_this = this, _loop(i);
						this._creationQueue.length = 0;
				}
				for (var [xrAnchor, anchor] of this._index){
						if (frame.trackedAnchors.has(xrAnchor)) {
								continue;
						}
						this._index.delete(xrAnchor);
						anchor.destroy();
				}
				for(var i1 = 0; i1 < this._list.length; i1++){
						this._list[i1].update(frame);
				}
				for (var xrAnchor1 of frame.trackedAnchors){
						if (this._index.has(xrAnchor1)) {
								continue;
						}
						try {
								var tmp = xrAnchor1.anchorSpace;
						} catch (ex) {
								continue;
						}
						var anchor1 = this._createAnchor(xrAnchor1);
						anchor1.update(frame);
						var callback = this._callbacksAnchors.get(xrAnchor1);
						if (callback) {
								this._callbacksAnchors.delete(xrAnchor1);
								callback(null, anchor1);
						}
						this.fire('add', anchor1);
				}
		}
		get supported() {
				return this._supported;
		}
		get available() {
				return this._available;
		}
		get persistence() {
				return this._persistence;
		}
		get uuids() {
				if (!this._available) {
						return null;
				}
				if (!this._persistence) {
						return null;
				}
				if (!this.manager.active) {
						return null;
				}
				return this.manager.session.persistentAnchors;
		}
		get list() {
				return this._list;
		}
		constructor(manager){
				var _window_XRSession, _window;
				super(), this._supported = platform.browser && !!window.XRAnchor, this._available = false, this._checkingAvailability = false, this._persistence = platform.browser && !!((_window = window) == null ? undefined : (_window_XRSession = _window.XRSession) == null ? undefined : _window_XRSession.prototype.restorePersistentAnchor), this._creationQueue = [], this._index = new Map(), this._indexByUuid = new Map(), this._list = [], this._callbacksAnchors = new Map();
				this.manager = manager;
				if (this._supported) {
						this.manager.on('start', this._onSessionStart, this);
						this.manager.on('end', this._onSessionEnd, this);
				}
		}
}
XrAnchors.EVENT_AVAILABLE = 'available';
XrAnchors.EVENT_UNAVAILABLE = 'unavailable';
XrAnchors.EVENT_ERROR = 'error';
XrAnchors.EVENT_ADD = 'add';
XrAnchors.EVENT_DESTROY = 'destroy';

export { XrAnchors };
