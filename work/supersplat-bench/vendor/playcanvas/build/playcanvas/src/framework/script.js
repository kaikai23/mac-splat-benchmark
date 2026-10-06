import { getApplication } from './globals.js';

var _createdLoadingScreen = false;
var script = {
		app: null,
		createLoadingScreen (callback) {
				if (_createdLoadingScreen) {
						return;
				}
				_createdLoadingScreen = true;
				var app = getApplication();
				callback(app);
		}
};

export { script };
