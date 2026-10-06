import { SceneParser } from './parsers/scene.js';

class Template {
		instantiate() {
				if (!this._templateRoot) {
						this._parseTemplate();
				}
				return this._templateRoot.clone();
		}
		_parseTemplate() {
				var parser = new SceneParser(this._app, true);
				this._templateRoot = parser.parse(this._data);
		}
		constructor(app, data){
				this._templateRoot = null;
				this._app = app;
				this._data = data;
		}
}

export { Template };
