var path = {
		delimiter: '/',
		join () {
				for(var _len = arguments.length, sections = new Array(_len), _key = 0; _key < _len; _key++){
						sections[_key] = arguments[_key];
				}
				var result = sections[0];
				for(var i = 0; i < sections.length - 1; i++){
						var one = sections[i];
						var two = sections[i + 1];
						if (two[0] === path.delimiter) {
								result = two;
								continue;
						}
						if (one && two && one[one.length - 1] !== path.delimiter && two[0] !== path.delimiter) {
								result += path.delimiter + two;
						} else {
								result += two;
						}
				}
				return result;
		},
		normalize (pathname) {
				var lead = pathname.startsWith(path.delimiter);
				var trail = pathname.endsWith(path.delimiter);
				var parts = pathname.split('/');
				var result = '';
				var cleaned = [];
				for(var i = 0; i < parts.length; i++){
						if (parts[i] === '') continue;
						if (parts[i] === '.') continue;
						if (parts[i] === '..' && cleaned.length > 0) {
								cleaned = cleaned.slice(0, cleaned.length - 2);
								continue;
						}
						if (i > 0) cleaned.push(path.delimiter);
						cleaned.push(parts[i]);
				}
				result = cleaned.join('');
				if (!lead && result[0] === path.delimiter) {
						result = result.slice(1);
				}
				if (trail && result[result.length - 1] !== path.delimiter) {
						result += path.delimiter;
				}
				return result;
		},
		split (pathname) {
				var lastDelimiterIndex = pathname.lastIndexOf(path.delimiter);
				if (lastDelimiterIndex !== -1) {
						return [
								pathname.substring(0, lastDelimiterIndex),
								pathname.substring(lastDelimiterIndex + 1)
						];
				}
				return [
						'',
						pathname
				];
		},
		getBasename (pathname) {
				return path.split(pathname)[1];
		},
		getDirectory (pathname) {
				return path.split(pathname)[0];
		},
		getExtension (pathname) {
				var ext = pathname.split('?')[0].split('.').pop();
				if (ext !== pathname) {
						return "." + ext;
				}
				return '';
		},
		isRelativePath (pathname) {
				return pathname.charAt(0) !== '/' && pathname.match(/:\/\//) === null;
		},
		extractPath (pathname) {
				var result = '';
				var parts = pathname.split('/');
				var i = 0;
				if (parts.length > 1) {
						if (path.isRelativePath(pathname)) {
								if (parts[0] === '.') {
										for(i = 0; i < parts.length - 1; ++i){
												result += i === 0 ? parts[i] : "/" + parts[i];
										}
								} else if (parts[0] === '..') {
										for(i = 0; i < parts.length - 1; ++i){
												result += i === 0 ? parts[i] : "/" + parts[i];
										}
								} else {
										result = '.';
										for(i = 0; i < parts.length - 1; ++i){
												result += "/" + parts[i];
										}
								}
						} else {
								for(i = 0; i < parts.length - 1; ++i){
										result += i === 0 ? parts[i] : "/" + parts[i];
								}
						}
				}
				return result;
		}
};

export { path };
