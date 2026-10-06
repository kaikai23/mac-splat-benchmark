import { EventHandler } from '../../core/event-handler.js';
import { sortPriority } from '../../core/sort.js';
import { LAYERID_DEPTH } from '../constants.js';
import { RenderAction } from './render-action.js';

class LayerComposition extends EventHandler {
		destroy() {
				this.destroyRenderActions();
		}
		destroyRenderActions() {
				this._renderActions.forEach((ra)=>ra.destroy());
				this._renderActions.length = 0;
		}
		_update() {
				var len = this.layerList.length;
				if (!this._dirty) {
						for(var i = 0; i < len; i++){
								if (this.layerList[i]._dirtyComposition) {
										this._dirty = true;
										break;
								}
						}
				}
				if (this._dirty) {
						this._dirty = false;
						this.cameras.length = 0;
						for(var i1 = 0; i1 < len; i1++){
								var layer = this.layerList[i1];
								layer._dirtyComposition = false;
								for(var j = 0; j < layer.cameras.length; j++){
										var camera = layer.cameras[j];
										var index = this.cameras.indexOf(camera);
										if (index < 0) {
												this.cameras.push(camera);
										}
								}
						}
						if (this.cameras.length > 1) {
								sortPriority(this.cameras);
						}
						var cameraLayers = [];
						var renderActionCount = 0;
						this.destroyRenderActions();
						for(var i2 = 0; i2 < this.cameras.length; i2++){
								var camera1 = this.cameras[i2];
								cameraLayers.length = 0;
								if (camera1.camera.renderPasses.length > 0) {
										this.addDummyRenderAction(renderActionCount, camera1);
										renderActionCount++;
										continue;
								}
								var cameraFirstRenderAction = true;
								var cameraFirstRenderActionIndex = renderActionCount;
								var lastRenderAction = null;
								var postProcessMarked = false;
								for(var j1 = 0; j1 < len; j1++){
										var layer1 = this.layerList[j1];
										var isLayerEnabled = layer1.enabled && this.subLayerEnabled[j1];
										if (isLayerEnabled) {
												if (layer1.cameras.length > 0) {
														if (camera1.layers.indexOf(layer1.id) >= 0) {
																cameraLayers.push(layer1);
																if (!postProcessMarked && layer1.id === camera1.disablePostEffectsLayer) {
																		postProcessMarked = true;
																		if (lastRenderAction) {
																				lastRenderAction.triggerPostprocess = true;
																		}
																}
																var isTransparent = this.subLayerList[j1];
																lastRenderAction = this.addRenderAction(renderActionCount, layer1, isTransparent, camera1, cameraFirstRenderAction, postProcessMarked);
																renderActionCount++;
																cameraFirstRenderAction = false;
														}
												}
										}
								}
								if (cameraFirstRenderActionIndex < renderActionCount) {
										lastRenderAction.lastCameraUse = true;
								}
								if (!postProcessMarked && lastRenderAction) {
										lastRenderAction.triggerPostprocess = true;
								}
								if (camera1.renderTarget && camera1.postEffectsEnabled) {
										this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera1);
								}
						}
						this._logRenderActions();
				}
		}
		getNextRenderAction(renderActionIndex) {
				var renderAction = new RenderAction();
				this._renderActions.push(renderAction);
				return renderAction;
		}
		addDummyRenderAction(renderActionIndex, camera) {
				var renderAction = this.getNextRenderAction(renderActionIndex);
				renderAction.camera = camera;
				renderAction.useCameraPasses = true;
		}
		addRenderAction(renderActionIndex, layer, isTransparent, camera, cameraFirstRenderAction, postProcessMarked) {
				var rt = layer.id !== LAYERID_DEPTH ? camera.renderTarget : null;
				var used = false;
				var renderActions = this._renderActions;
				for(var i = renderActionIndex - 1; i >= 0; i--){
						if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
								used = true;
								break;
						}
				}
				if (postProcessMarked && camera.postEffectsEnabled) {
						rt = null;
				}
				var renderAction = this.getNextRenderAction(renderActionIndex);
				renderAction.triggerPostprocess = false;
				renderAction.layer = layer;
				renderAction.transparent = isTransparent;
				renderAction.camera = camera;
				renderAction.renderTarget = rt;
				renderAction.firstCameraUse = cameraFirstRenderAction;
				renderAction.lastCameraUse = false;
				var needsCameraClear = cameraFirstRenderAction || !used;
				var needsLayerClear = layer.clearColorBuffer || layer.clearDepthBuffer || layer.clearStencilBuffer;
				if (needsCameraClear || needsLayerClear) {
						renderAction.setupClears(needsCameraClear ? camera : undefined, layer);
				}
				return renderAction;
		}
		propagateRenderTarget(startIndex, fromCamera) {
				for(var a = startIndex; a >= 0; a--){
						var ra = this._renderActions[a];
						var layer = ra.layer;
						if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
								break;
						}
						if (layer.id === LAYERID_DEPTH) {
								continue;
						}
						if (ra.useCameraPasses) {
								break;
						}
						var thisCamera = ra == null ? undefined : ra.camera.camera;
						if (thisCamera) {
								if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
										break;
								}
						}
						ra.renderTarget = fromCamera.renderTarget;
				}
		}
		_logRenderActions() {}
		_isLayerAdded(layer) {
				var found = this.layerIdMap.get(layer.id) === layer;
				return found;
		}
		_isSublayerAdded(layer, transparent) {
				var map = transparent ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
				if (map.get(layer) !== undefined) {
						return true;
				}
				return false;
		}
		push(layer) {
				if (this._isLayerAdded(layer)) return;
				this.layerList.push(layer);
				this.layerList.push(layer);
				this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
				this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
				this.subLayerEnabled.push(true);
				this.subLayerEnabled.push(true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		insert(layer, index) {
				if (this._isLayerAdded(layer)) return;
				this.layerList.splice(index, 0, layer, layer);
				this.subLayerList.splice(index, 0, false, true);
				var count = this.layerList.length;
				this._updateOpaqueOrder(index, count - 1);
				this._updateTransparentOrder(index, count - 1);
				this.subLayerEnabled.splice(index, 0, true, true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		remove(layer) {
				var id = this.layerList.indexOf(layer);
				delete this._opaqueOrder[id];
				delete this._transparentOrder[id];
				while(id >= 0){
						this.layerList.splice(id, 1);
						this.subLayerList.splice(id, 1);
						this.subLayerEnabled.splice(id, 1);
						id = this.layerList.indexOf(layer);
						this._dirty = true;
						this.fire('remove', layer);
				}
				var count = this.layerList.length;
				this._updateOpaqueOrder(0, count - 1);
				this._updateTransparentOrder(0, count - 1);
				this._updateLayerMaps();
		}
		pushOpaque(layer) {
				if (this._isSublayerAdded(layer, false)) return;
				this.layerList.push(layer);
				this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
				this.subLayerEnabled.push(true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		insertOpaque(layer, index) {
				if (this._isSublayerAdded(layer, false)) return;
				this.layerList.splice(index, 0, layer);
				this.subLayerList.splice(index, 0, false);
				var count = this.subLayerList.length;
				this._updateOpaqueOrder(index, count - 1);
				this.subLayerEnabled.splice(index, 0, true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		removeOpaque(layer) {
				for(var i = 0, len = this.layerList.length; i < len; i++){
						if (this.layerList[i] === layer && !this.subLayerList[i]) {
								this.layerList.splice(i, 1);
								this.subLayerList.splice(i, 1);
								len--;
								this._updateOpaqueOrder(i, len - 1);
								this.subLayerEnabled.splice(i, 1);
								this._dirty = true;
								if (this.layerList.indexOf(layer) < 0) {
										this.fire('remove', layer);
								}
								break;
						}
				}
				this._updateLayerMaps();
		}
		pushTransparent(layer) {
				if (this._isSublayerAdded(layer, true)) return;
				this.layerList.push(layer);
				this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
				this.subLayerEnabled.push(true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		insertTransparent(layer, index) {
				if (this._isSublayerAdded(layer, true)) return;
				this.layerList.splice(index, 0, layer);
				this.subLayerList.splice(index, 0, true);
				var count = this.subLayerList.length;
				this._updateTransparentOrder(index, count - 1);
				this.subLayerEnabled.splice(index, 0, true);
				this._updateLayerMaps();
				this._dirty = true;
				this.fire('add', layer);
		}
		removeTransparent(layer) {
				for(var i = 0, len = this.layerList.length; i < len; i++){
						if (this.layerList[i] === layer && this.subLayerList[i]) {
								this.layerList.splice(i, 1);
								this.subLayerList.splice(i, 1);
								len--;
								this._updateTransparentOrder(i, len - 1);
								this.subLayerEnabled.splice(i, 1);
								this._dirty = true;
								if (this.layerList.indexOf(layer) < 0) {
										this.fire('remove', layer);
								}
								break;
						}
				}
				this._updateLayerMaps();
		}
		getOpaqueIndex(layer) {
				var _this_layerOpaqueIndexMap_get;
				return (_this_layerOpaqueIndexMap_get = this.layerOpaqueIndexMap.get(layer)) != null ? _this_layerOpaqueIndexMap_get : -1;
		}
		getTransparentIndex(layer) {
				var _this_layerTransparentIndexMap_get;
				return (_this_layerTransparentIndexMap_get = this.layerTransparentIndexMap.get(layer)) != null ? _this_layerTransparentIndexMap_get : -1;
		}
		isEnabled(layer, transparent) {
				if (layer.enabled) {
						var index = transparent ? this.getTransparentIndex(layer) : this.getOpaqueIndex(layer);
						if (index >= 0) {
								return this.subLayerEnabled[index];
						}
				}
				return false;
		}
		_updateLayerMaps() {
				this.layerIdMap.clear();
				this.layerNameMap.clear();
				this.layerOpaqueIndexMap.clear();
				this.layerTransparentIndexMap.clear();
				for(var i = 0; i < this.layerList.length; i++){
						var layer = this.layerList[i];
						this.layerIdMap.set(layer.id, layer);
						this.layerNameMap.set(layer.name, layer);
						var subLayerIndexMap = this.subLayerList[i] ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
						subLayerIndexMap.set(layer, i);
				}
		}
		getLayerById(id) {
				var _this_layerIdMap_get;
				return (_this_layerIdMap_get = this.layerIdMap.get(id)) != null ? _this_layerIdMap_get : null;
		}
		getLayerByName(name) {
				var _this_layerNameMap_get;
				return (_this_layerNameMap_get = this.layerNameMap.get(name)) != null ? _this_layerNameMap_get : null;
		}
		_updateOpaqueOrder(startIndex, endIndex) {
				for(var i = startIndex; i <= endIndex; i++){
						if (this.subLayerList[i] === false) {
								this._opaqueOrder[this.layerList[i].id] = i;
						}
				}
		}
		_updateTransparentOrder(startIndex, endIndex) {
				for(var i = startIndex; i <= endIndex; i++){
						if (this.subLayerList[i] === true) {
								this._transparentOrder[this.layerList[i].id] = i;
						}
				}
		}
		_sortLayersDescending(layersA, layersB, order) {
				var topLayerA = -1;
				var topLayerB = -1;
				for(var i = 0, len = layersA.length; i < len; i++){
						var id = layersA[i];
						if (order.hasOwnProperty(id)) {
								topLayerA = Math.max(topLayerA, order[id]);
						}
				}
				for(var i1 = 0, len1 = layersB.length; i1 < len1; i1++){
						var id1 = layersB[i1];
						if (order.hasOwnProperty(id1)) {
								topLayerB = Math.max(topLayerB, order[id1]);
						}
				}
				if (topLayerA === -1 && topLayerB !== -1) {
						return 1;
				} else if (topLayerB === -1 && topLayerA !== -1) {
						return -1;
				}
				return topLayerB - topLayerA;
		}
		sortTransparentLayers(layersA, layersB) {
				return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
		}
		sortOpaqueLayers(layersA, layersB) {
				return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
		}
		constructor(name = 'Untitled'){
				super(), this.layerList = [], this.layerIdMap = new Map(), this.layerNameMap = new Map(), this.layerOpaqueIndexMap = new Map(), this.layerTransparentIndexMap = new Map(), this.subLayerList = [], this.subLayerEnabled = [], this.cameras = [], this._renderActions = [], this._dirty = false;
				this.name = name;
				this._opaqueOrder = {};
				this._transparentOrder = {};
		}
}

export { LayerComposition };
