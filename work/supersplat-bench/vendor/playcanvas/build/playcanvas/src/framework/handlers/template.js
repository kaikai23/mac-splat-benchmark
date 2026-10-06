import { http } from '../../platform/net/http.js';
import { Template } from '../template.js';
import { ResourceHandler } from './handler.js';

class TemplateHandler extends ResourceHandler {
		load(url, callback) {
				if (typeof url === 'string') {
						url = {
								load: url,
								original: url
						};
				}
				var options = {
						retry: this.maxRetries > 0,
						maxRetries: this.maxRetries
				};
				http.get(url.load, options, (err, response)=>{
						if (err) {
								callback("Error requesting template: " + url.original);
						} else {
								callback(err, response);
						}
				});
		}
		open(url, data) {
				return new Template(this._app, data);
		}
		openBinary(data) {
				var _this_decoder;
				(_this_decoder = this.decoder) != null ? _this_decoder : this.decoder = new TextDecoder('utf-8');
				return new Template(this._app, JSON.parse(this.decoder.decode(data)));
		}
		constructor(app){
				super(app, 'template'), this.decoder = null;
		}
}

export { TemplateHandler };
