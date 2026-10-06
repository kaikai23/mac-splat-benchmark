import { Http, http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class JsonHandler extends ResourceHandler {
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
				if (url.load.startsWith('blob:')) {
						options.responseType = Http.ResponseType.JSON;
				}
				http.get(url.load, options, (err, response)=>{
						if (!err) {
								callback(null, response);
						} else {
								callback("Error loading JSON resource: " + url.original + " [" + err + "]");
						}
				});
		}
		openBinary(data) {
				var _this_decoder;
				(_this_decoder = this.decoder) != null ? _this_decoder : this.decoder = new TextDecoder('utf-8');
				return JSON.parse(this.decoder.decode(data));
		}
		constructor(app){
				super(app, 'json'), this.decoder = null;
		}
}

export { JsonHandler };
