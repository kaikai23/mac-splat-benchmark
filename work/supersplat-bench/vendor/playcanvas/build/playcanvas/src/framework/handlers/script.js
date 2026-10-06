import { platform } from '../../core/platform.js';
import { script } from '../script.js';
import { ScriptTypes } from '../script/script-types.js';
import { registerScript } from '../script/script-create.js';
import { ResourceLoader } from './loader.js';
import { ResourceHandler } from './handler.js';
import { Script } from '../script/script.js';

var toLowerCamelCase = (str)=>str[0].toLowerCase() + str.substring(1);
class ScriptHandler extends ResourceHandler {
		clearCache() {
				for(var key in this._cache){
						var element = this._cache[key];
						var parent = element.parentNode;
						if (parent) {
								parent.removeChild(element);
						}
				}
				this._cache = {};
		}
		load(url, callback) {
				if (typeof url === 'string') {
						url = {
								load: url,
								original: url
						};
				}
				var self = this;
				script.app = this._app;
				var onScriptLoad = (url.load, (err, url, extra)=>{
						if (!err) {
								var obj = {};
								for(var i = 0; i < ScriptTypes._types.length; i++){
										obj[ScriptTypes._types[i].name] = ScriptTypes._types[i];
								}
								ScriptTypes._types.length = 0;
								callback(null, obj, extra);
								var urlWithoutEndHash = url.split('&hash=')[0];
								delete self._loader._cache[ResourceLoader.makeKey(urlWithoutEndHash, "script")];
						} else {
								callback(err);
						}
				});
				var [basePath] = url.load.split('?');
				var isEsmScript = basePath.endsWith('.mjs');
				if (isEsmScript) {
						this._loadModule(basePath, onScriptLoad);
				} else {
						this._loadScript(url.load, onScriptLoad);
				}
		}
		open(url, data) {
				return data;
		}
		patch(asset, assets) {}
		_loadScript(url, callback) {
				var head = document.head;
				var element = document.createElement("script");
				this._cache[url] = element;
				element.async = false;
				element.addEventListener('error', (e)=>{
						callback("Script: " + e.target.src + " failed to load");
				}, false);
				var done = false;
				element.onload = element.onreadystatechange = function() {
						if (!done && (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete')) {
								done = true;
								callback(null, url, element);
						}
				};
				element.src = url;
				head.appendChild(element);
		}
		_loadModule(url, callback) {
				var baseUrl = platform.browser ? window.location.origin + window.location.pathname : import.meta.url;
				var importUrl = new URL(url, baseUrl);
				import(/* @vite-ignore */ /* webpackIgnore: true */ importUrl.toString()).then((module)=>{
						var _this__app_assets_find_data, _this__app_assets_find;
						var filename = importUrl.pathname.split('/').pop();
						var scriptSchema = (_this__app_assets_find = this._app.assets.find(filename, "script")) == null ? undefined : (_this__app_assets_find_data = _this__app_assets_find.data) == null ? undefined : _this__app_assets_find_data.scripts;
						for(var key in module){
								var scriptClass = module[key];
								var extendsScriptType = scriptClass.prototype instanceof Script;
								if (extendsScriptType) {
										var scriptName = toLowerCamelCase(scriptClass.name);
										registerScript(scriptClass, scriptName);
										if (scriptSchema) this._app.scripts.addSchema(scriptName, scriptSchema[scriptName]);
								}
						}
						callback(null, url, null);
				}).catch((err)=>{
						callback(err);
				});
		}
		constructor(app){
				super(app, "script");
				this._scripts = {};
				this._cache = {};
		}
}

export { ScriptHandler };
