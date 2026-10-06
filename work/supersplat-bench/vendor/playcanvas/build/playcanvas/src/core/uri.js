function createURI(options) {
		var s = '';
		if ((options.authority || options.scheme) && (options.host || options.hostpath)) {
				throw new Error('Can\'t have \'scheme\' or \'authority\' and \'host\' or \'hostpath\' option');
		}
		if (options.host && options.hostpath) {
				throw new Error('Can\'t have \'host\' and \'hostpath\' option');
		}
		if (options.path && options.hostpath) {
				throw new Error('Can\'t have \'path\' and \'hostpath\' option');
		}
		if (options.scheme) {
				s += "" + options.scheme + ":";
		}
		if (options.authority) {
				s += "//" + options.authority;
		}
		if (options.host) {
				s += options.host;
		}
		if (options.path) {
				s += options.path;
		}
		if (options.hostpath) {
				s += options.hostpath;
		}
		if (options.query) {
				s += "?" + options.query;
		}
		if (options.fragment) {
				s += "#" + options.fragment;
		}
		return s;
}
var re = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
class URI {
		toString() {
				var s = '';
				if (this.scheme) {
						s += "" + this.scheme + ":";
				}
				if (this.authority) {
						s += "//" + this.authority;
				}
				s += this.path;
				if (this.query) {
						s += "?" + this.query;
				}
				if (this.fragment) {
						s += "#" + this.fragment;
				}
				return s;
		}
		getQuery() {
				var result = {};
				if (this.query) {
						var queryParams = decodeURIComponent(this.query).split('&');
						for (var queryParam of queryParams){
								var pair = queryParam.split('=');
								result[pair[0]] = pair[1];
						}
				}
				return result;
		}
		setQuery(params) {
				var q = '';
				for(var key in params){
						if (params.hasOwnProperty(key)) {
								if (q !== '') {
										q += '&';
								}
								q += encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
						}
				}
				this.query = q;
		}
		constructor(uri){
				var result = uri.match(re);
				this.scheme = result[2];
				this.authority = result[4];
				this.path = result[5];
				this.query = result[7];
				this.fragment = result[9];
		}
}

export { URI, createURI };
