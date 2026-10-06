var detectPassiveEvents = ()=>{
		var result = false;
		try {
				var opts = Object.defineProperty({}, 'passive', {
						get: function get() {
								result = true;
								return false;
						}
				});
				window.addEventListener('testpassive', null, opts);
				window.removeEventListener('testpassive', null, opts);
		} catch (e) {}
		return result;
};
var ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
var environment = typeof window !== 'undefined' ? 'browser' : typeof global !== 'undefined' ? 'node' : 'worker';
var platformName = /android/i.test(ua) ? 'android' : /ip(?:[ao]d|hone)/i.test(ua) ? 'ios' : /windows/i.test(ua) ? 'windows' : /mac os/i.test(ua) ? 'osx' : /linux/i.test(ua) ? 'linux' : /cros/i.test(ua) ? 'cros' : null;
var browserName = environment !== 'browser' ? null : /Chrome\/|Chromium\/|Edg.*\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : /Firefox\//.test(ua) ? 'firefox' : 'other';
var xbox = /xbox/i.test(ua);
var touch = environment === 'browser' && ('ontouchstart' in window || 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
var gamepads = environment === 'browser' && (!!navigator.getGamepads || !!navigator.webkitGetGamepads);
var workers = typeof Worker !== 'undefined';
var passiveEvents = detectPassiveEvents();
var _ref, _ref1, _ref2;
var platform = {
		name: platformName,
		environment: environment,
		global: (_ref2 = (_ref1 = (_ref = typeof globalThis !== 'undefined' && globalThis) != null ? _ref : environment === 'browser' && window) != null ? _ref1 : environment === 'node' && global) != null ? _ref2 : environment === 'worker' && self,
		browser: environment === 'browser',
		worker: environment === 'worker',
		desktop: [
				'windows',
				'osx',
				'linux',
				'cros'
		].includes(platformName),
		mobile: [
				'android',
				'ios'
		].includes(platformName),
		ios: platformName === 'ios',
		android: platformName === 'android',
		xbox: xbox,
		gamepads: gamepads,
		touch: touch,
		workers: workers,
		passiveEvents: passiveEvents,
		browserName: browserName
};

export { platform };
