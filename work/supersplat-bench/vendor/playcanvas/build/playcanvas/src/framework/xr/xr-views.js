import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrView } from './xr-view.js';
import { XRDEPTHSENSINGUSAGE_GPU, XRTYPE_AR, XRDEPTHSENSINGFORMAT_L8A8, XRDEPTHSENSINGFORMAT_R16U, XRDEPTHSENSINGFORMAT_F32 } from './constants.js';
import { PIXELFORMAT_LA8, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F } from '../../platform/graphics/constants.js';

class XrViews extends EventHandler {
		get list() {
				return this._list;
		}
		get supportedColor() {
				return this._supportedColor;
		}
		get supportedDepth() {
				return this._supportedDepth;
		}
		get availableColor() {
				return this._availableColor;
		}
		get availableDepth() {
				return this._availableDepth;
		}
		get depthUsage() {
				return this._depthUsage;
		}
		get depthGpuOptimized() {
				return this._depthUsage === XRDEPTHSENSINGUSAGE_GPU;
		}
		get depthFormat() {
				return this._depthFormat;
		}
		get depthPixelFormat() {
				var _this__depthFormats_this__depthFormat;
				return (_this__depthFormats_this__depthFormat = this._depthFormats[this._depthFormat]) != null ? _this__depthFormats_this__depthFormat : null;
		}
		update(frame, xrViews) {
				for(var i = 0; i < xrViews.length; i++){
						this._indexTmp.set(xrViews[i].eye, xrViews[i]);
				}
				for (var [eye, xrView] of this._indexTmp){
						var view = this._index.get(eye);
						if (!view) {
								view = new XrView(this._manager, xrView, xrViews.length);
								this._index.set(eye, view);
								this._list.push(view);
								view.update(frame, xrView);
								this.fire('add', view);
						} else {
								view.update(frame, xrView);
						}
				}
				for (var [eye1, view1] of this._index){
						if (this._indexTmp.has(eye1)) {
								continue;
						}
						view1.destroy();
						this._index.delete(eye1);
						var ind = this._list.indexOf(view1);
						if (ind !== -1) this._list.splice(ind, 1);
						this.fire('remove', view1);
				}
				this._indexTmp.clear();
		}
		get(eye) {
				return this._index.get(eye) || null;
		}
		_onSessionStart() {
				if (this._manager.type !== XRTYPE_AR) {
						return;
				}
				if (!this._manager.session.enabledFeatures) {
						return;
				}
				this._availableColor = this._manager.session.enabledFeatures.indexOf('camera-access') !== -1;
				this._availableDepth = this._manager.session.enabledFeatures.indexOf('depth-sensing') !== -1;
				if (this._availableDepth) {
						var session = this._manager.session;
						this._depthUsage = session.depthUsage;
						this._depthFormat = session.depthDataFormat;
				}
		}
		_onSessionEnd() {
				for (var view of this._index.values()){
						view.destroy();
				}
				this._index.clear();
				this._availableColor = false;
				this._availableDepth = false;
				this._depthUsage = '';
				this._depthFormat = '';
				this._list.length = 0;
		}
		constructor(manager){
				super(), this._index = new Map(), this._indexTmp = new Map(), this._list = [], this._supportedColor = platform.browser && !!window.XRCamera && !!window.XRWebGLBinding, this._supportedDepth = platform.browser && !!window.XRDepthInformation, this._availableColor = false, this._availableDepth = false, this._depthUsage = '', this._depthFormat = '', this._depthFormats = {
						[XRDEPTHSENSINGFORMAT_L8A8]: PIXELFORMAT_LA8,
						[XRDEPTHSENSINGFORMAT_R16U]: PIXELFORMAT_DEPTH,
						[XRDEPTHSENSINGFORMAT_F32]: PIXELFORMAT_R32F
				};
				this._manager = manager;
				this._manager.on('start', this._onSessionStart, this);
				this._manager.on('end', this._onSessionEnd, this);
		}
}
XrViews.EVENT_ADD = 'add';
XrViews.EVENT_REMOVE = 'remove';

export { XrViews };
