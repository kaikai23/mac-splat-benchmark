import { SceneUtils } from './scene-utils.js';
import { SceneParser } from '../parsers/scene.js';
import { ResourceHandler } from './handler.js';

class SceneHandler extends ResourceHandler {
		load(url, callback) {
				SceneUtils.load(url, this.maxRetries, callback);
		}
		open(url, data) {
				this._app.systems.script.preloading = true;
				var parser = new SceneParser(this._app, false);
				var parent = parser.parse(data);
				var scene = this._app.scene;
				scene.root = parent;
				this._app.applySceneSettings(data.settings);
				this._app.systems.script.preloading = false;
				return scene;
		}
		constructor(app){
				super(app, 'scene');
		}
}

export { SceneHandler };
