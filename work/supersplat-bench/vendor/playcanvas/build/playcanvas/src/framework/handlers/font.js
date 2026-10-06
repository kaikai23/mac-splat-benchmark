import { path } from '../../core/path.js';
import { string } from '../../core/string.js';
import { http } from '../../platform/net/http.js';
import { Font } from '../font/font.js';
import { ResourceHandler } from './handler.js';

function upgradeDataSchema(data) {
		if (data.version < 3) {
				if (data.version < 2) {
						data.info.maps = data.info.maps || [
								{
										width: data.info.width,
										height: data.info.height
								}
						];
				}
				data.chars = Object.keys(data.chars || {}).reduce((newChars, key)=>{
						var existing = data.chars[key];
						var newKey = existing.letter !== undefined ? existing.letter : string.fromCodePoint(key);
						if (data.version < 2) {
								existing.map = existing.map || 0;
						}
						newChars[newKey] = existing;
						return newChars;
				}, {});
				data.version = 3;
		}
		return data;
}
class FontHandler extends ResourceHandler {
		load(url, callback, asset) {
				if (typeof url === 'string') {
						url = {
								load: url,
								original: url
						};
				}
				var self = this;
				if (path.getExtension(url.original) === '.json') {
						http.get(url.load, {
								retry: this.maxRetries > 0,
								maxRetries: this.maxRetries
						}, (err, response)=>{
								if (!err) {
										var data = upgradeDataSchema(response);
										self._loadTextures(url.load.replace('.json', '.png'), data, (err, textures)=>{
												if (err) {
														callback(err);
												} else {
														callback(null, {
																data: data,
																textures: textures
														});
												}
										});
								} else {
										callback("Error loading font resource: " + url.original + " [" + err + "]");
								}
						});
				} else {
						if (asset && asset.data) {
								asset.data = upgradeDataSchema(asset.data);
						}
						this._loadTextures(url.load, asset && asset.data, callback);
				}
		}
		_loadTextures(url, data, callback) {
				var numTextures = data.info.maps.length;
				var numLoaded = 0;
				var error = null;
				var textures = new Array(numTextures);
				var loader = this._loader;
				var loadTexture = function loadTexture(index) {
						var onLoaded = function onLoaded(err, texture) {
								if (error) return;
								if (err) {
										error = err;
										callback(err);
										return;
								}
								texture.upload();
								textures[index] = texture;
								numLoaded++;
								if (numLoaded === numTextures) {
										callback(null, textures);
								}
						};
						if (index === 0) {
								loader.load(url, 'texture', onLoaded);
						} else {
								loader.load(url.replace('.png', "" + index + ".png"), 'texture', onLoaded);
						}
				};
				for(var i = 0; i < numTextures; i++){
						loadTexture(i);
				}
		}
		open(url, data, asset) {
				var font;
				if (data.textures) {
						font = new Font(data.textures, data.data);
				} else {
						font = new Font(data, null);
				}
				return font;
		}
		patch(asset, assets) {
				var font = asset.resource;
				if (!font.data && asset.data) {
						font.data = asset.data;
				} else if (!asset.data && font.data) {
						asset.data = font.data;
				}
				if (asset.data) {
						asset.data = upgradeDataSchema(asset.data);
				}
		}
		constructor(app){
				super(app, 'font');
				this._loader = app.loader;
				this.maxRetries = 0;
		}
}

export { FontHandler };
