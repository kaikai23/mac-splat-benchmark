import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrInputSource } from './xr-input-source.js';

class XrInput extends EventHandler {
		_onSessionStart() {
				var session = this.manager.session;
				session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
				session.addEventListener('select', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource.fire('select', evt);
						this.fire('select', inputSource, evt);
				});
				session.addEventListener('selectstart', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource._selecting = true;
						inputSource.fire('selectstart', evt);
						this.fire('selectstart', inputSource, evt);
				});
				session.addEventListener('selectend', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource._selecting = false;
						inputSource.fire('selectend', evt);
						this.fire('selectend', inputSource, evt);
				});
				session.addEventListener('squeeze', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource.fire('squeeze', evt);
						this.fire('squeeze', inputSource, evt);
				});
				session.addEventListener('squeezestart', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource._squeezing = true;
						inputSource.fire('squeezestart', evt);
						this.fire('squeezestart', inputSource, evt);
				});
				session.addEventListener('squeezeend', (evt)=>{
						var inputSource = this._getByInputSource(evt.inputSource);
						inputSource.update(evt.frame);
						inputSource._squeezing = false;
						inputSource.fire('squeezeend', evt);
						this.fire('squeezeend', inputSource, evt);
				});
				var inputSources = session.inputSources;
				for(var i = 0; i < inputSources.length; i++){
						this._addInputSource(inputSources[i]);
				}
		}
		_onSessionEnd() {
				var i = this._inputSources.length;
				while(i--){
						var inputSource = this._inputSources[i];
						this._inputSources.splice(i, 1);
						inputSource.fire('remove');
						this.fire('remove', inputSource);
				}
				var session = this.manager.session;
				session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
		}
		_onInputSourcesChange(evt) {
				for(var i = 0; i < evt.removed.length; i++){
						this._removeInputSource(evt.removed[i]);
				}
				for(var i1 = 0; i1 < evt.added.length; i1++){
						this._addInputSource(evt.added[i1]);
				}
		}
		_getByInputSource(xrInputSource) {
				for(var i = 0; i < this._inputSources.length; i++){
						if (this._inputSources[i].inputSource === xrInputSource) {
								return this._inputSources[i];
						}
				}
				return null;
		}
		_addInputSource(xrInputSource) {
				if (this._getByInputSource(xrInputSource)) {
						return;
				}
				var inputSource = new XrInputSource(this.manager, xrInputSource);
				this._inputSources.push(inputSource);
				this.fire('add', inputSource);
		}
		_removeInputSource(xrInputSource) {
				for(var i = 0; i < this._inputSources.length; i++){
						if (this._inputSources[i].inputSource !== xrInputSource) {
								continue;
						}
						var inputSource = this._inputSources[i];
						this._inputSources.splice(i, 1);
						var h = inputSource.hitTestSources.length;
						while(h--){
								inputSource.hitTestSources[h].remove();
						}
						inputSource.fire('remove');
						this.fire('remove', inputSource);
						return;
				}
		}
		update(frame) {
				for(var i = 0; i < this._inputSources.length; i++){
						this._inputSources[i].update(frame);
				}
		}
		get inputSources() {
				return this._inputSources;
		}
		constructor(manager){
				var _window_XRPose_prototype, _window_XRPose;
				super(), this._inputSources = [], this.velocitiesSupported = false;
				this.manager = manager;
				this.velocitiesSupported = !!(platform.browser && ((_window_XRPose = window.XRPose) == null ? undefined : (_window_XRPose_prototype = _window_XRPose.prototype) == null ? undefined : _window_XRPose_prototype.hasOwnProperty('linearVelocity')));
				this._onInputSourcesChangeEvt = (evt)=>{
						this._onInputSourcesChange(evt);
				};
				this.manager.on('start', this._onSessionStart, this);
				this.manager.on('end', this._onSessionEnd, this);
		}
}
XrInput.EVENT_ADD = 'add';
XrInput.EVENT_REMOVE = 'remove';
XrInput.EVENT_SELECT = 'select';
XrInput.EVENT_SELECTSTART = 'selectstart';
XrInput.EVENT_SELECTEND = 'selectend';
XrInput.EVENT_SQUEEZE = 'squeeze';
XrInput.EVENT_SQUEEZESTART = 'squeezestart';
XrInput.EVENT_SQUEEZEEND = 'squeezeend';

export { XrInput };
