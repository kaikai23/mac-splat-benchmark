import { DEFAULT_LOCALE_FALLBACKS, DEFAULT_LOCALE } from './constants.js';

var PLURALS = {};
function definePluralFn(locales, fn) {
		for(var i = 0, len = locales.length; i < len; i++){
				PLURALS[locales[i]] = fn;
		}
}
function getLang(locale) {
		var idx = locale.indexOf('-');
		if (idx !== -1) {
				return locale.substring(0, idx);
		}
		return locale;
}
function replaceLang(locale, desiredLang) {
		var idx = locale.indexOf('-');
		if (idx !== -1) {
				return desiredLang + locale.substring(idx);
		}
		return desiredLang;
}
function findAvailableLocale(desiredLocale, availableLocales) {
		if (availableLocales[desiredLocale]) {
				return desiredLocale;
		}
		var fallback = DEFAULT_LOCALE_FALLBACKS[desiredLocale];
		if (fallback && availableLocales[fallback]) {
				return fallback;
		}
		var lang = getLang(desiredLocale);
		fallback = DEFAULT_LOCALE_FALLBACKS[lang];
		if (availableLocales[fallback]) {
				return fallback;
		}
		if (availableLocales[lang]) {
				return lang;
		}
		return DEFAULT_LOCALE;
}
definePluralFn([
		'ja',
		'ko',
		'th',
		'vi',
		'zh',
		'id'
], (n)=>{
		return 0;
});
definePluralFn([
		'fa',
		'hi'
], (n)=>{
		if (n >= 0 && n <= 1) {
				return 0;
		}
		return 1;
});
definePluralFn([
		'fr',
		'pt'
], (n)=>{
		if (n >= 0 && n < 2) {
				return 0;
		}
		return 1;
});
definePluralFn([
		'da'
], (n)=>{
		if (n === 1 || !Number.isInteger(n) && n >= 0 && n <= 1) {
				return 0;
		}
		return 1;
});
definePluralFn([
		'de',
		'en',
		'it',
		'el',
		'es',
		'tr',
		'fi',
		'sv',
		'nb',
		'no',
		'ur'
], (n)=>{
		if (n === 1) {
				return 0;
		}
		return 1;
});
definePluralFn([
		'ru',
		'uk'
], (n)=>{
		if (Number.isInteger(n)) {
				var mod10 = n % 10;
				var mod100 = n % 100;
				if (mod10 === 1 && mod100 !== 11) {
						return 0;
				} else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
						return 1;
				} else if (mod10 === 0 || mod10 >= 5 && mod10 <= 9 || mod100 >= 11 && mod100 <= 14) {
						return 2;
				}
		}
		return 3;
});
definePluralFn([
		'pl'
], (n)=>{
		if (Number.isInteger(n)) {
				if (n === 1) {
						return 0;
				}
				var mod10 = n % 10;
				var mod100 = n % 100;
				if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
						return 1;
				} else if (mod10 >= 0 && mod10 <= 1 || mod10 >= 5 && mod10 <= 9 || mod100 >= 12 && mod100 <= 14) {
						return 2;
				}
		}
		return 3;
});
definePluralFn([
		'ar'
], (n)=>{
		if (n === 0) {
				return 0;
		} else if (n === 1) {
				return 1;
		} else if (n === 2) {
				return 2;
		}
		if (Number.isInteger(n)) {
				var mod100 = n % 100;
				if (mod100 >= 3 && mod100 <= 10) {
						return 3;
				} else if (mod100 >= 11 && mod100 <= 99) {
						return 4;
				}
		}
		return 5;
});
var DEFAULT_PLURAL_FN = PLURALS[getLang(DEFAULT_LOCALE)];
function getPluralFn(lang) {
		return PLURALS[lang] || DEFAULT_PLURAL_FN;
}

export { findAvailableLocale, getLang, getPluralFn, replaceLang };
