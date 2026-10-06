import { EventHandler } from '../../core/event-handler.js';
import { Asset } from '../asset/asset.js';
import { DEFAULT_LOCALE_FALLBACKS, DEFAULT_LOCALE } from './constants.js';
import { getLang, replaceLang, getPluralFn, findAvailableLocale } from './utils.js';
import { I18nParser } from './i18n-parser.js';

class I18n extends EventHandler {
		set assets(value) {
				var index = {};
				for(var i = 0, len = value.length; i < len; i++){
						var id = value[i] instanceof Asset ? value[i].id : value[i];
						index[id] = true;
				}
				var i1 = this._assets.length;
				while(i1--){
						var id1 = this._assets[i1];
						if (!index[id1]) {
								this._app.assets.off("add:" + id1, this._onAssetAdd, this);
								var asset = this._app.assets.get(id1);
								if (asset) {
										this._onAssetRemove(asset);
								}
								this._assets.splice(i1, 1);
						}
				}
				for(var id2 in index){
						var idNum = parseInt(id2, 10);
						if (this._assets.indexOf(idNum) !== -1) continue;
						this._assets.push(idNum);
						var asset1 = this._app.assets.get(idNum);
						if (!asset1) {
								this._app.assets.once("add:" + idNum, this._onAssetAdd, this);
						} else {
								this._onAssetAdd(asset1);
						}
				}
		}
		get assets() {
				return this._assets;
		}
		set locale(value) {
				if (this._locale === value) {
						return;
				}
				var lang = getLang(value);
				if (lang === 'in') {
						lang = 'id';
						value = replaceLang(value, lang);
						if (this._locale === value) {
								return;
						}
				}
				var old = this._locale;
				this._locale = value;
				this._lang = lang;
				this._pluralFn = getPluralFn(this._lang);
				this.fire('set:locale', value, old);
		}
		get locale() {
				return this._locale;
		}
		static findAvailableLocale(desiredLocale, availableLocales) {
				return findAvailableLocale(desiredLocale, availableLocales);
		}
		findAvailableLocale(desiredLocale) {
				if (this._translations[desiredLocale]) {
						return desiredLocale;
				}
				var lang = getLang(desiredLocale);
				return this._findFallbackLocale(desiredLocale, lang);
		}
		getText(key, locale) {
				var result = key;
				var lang;
				if (!locale) {
						locale = this._locale;
						lang = this._lang;
				}
				var translations = this._translations[locale];
				if (!translations) {
						if (!lang) {
								lang = getLang(locale);
						}
						locale = this._findFallbackLocale(locale, lang);
						translations = this._translations[locale];
				}
				if (translations && translations.hasOwnProperty(key)) {
						result = translations[key];
						if (Array.isArray(result)) {
								result = result[0];
						}
						if (result === null || result === undefined) {
								result = key;
						}
				}
				return result;
		}
		getPluralText(key, n, locale) {
				var result = key;
				var lang;
				var pluralFn;
				if (!locale) {
						locale = this._locale;
						lang = this._lang;
						pluralFn = this._pluralFn;
				} else {
						lang = getLang(locale);
						pluralFn = getPluralFn(lang);
				}
				var translations = this._translations[locale];
				if (!translations) {
						locale = this._findFallbackLocale(locale, lang);
						lang = getLang(locale);
						pluralFn = getPluralFn(lang);
						translations = this._translations[locale];
				}
				if (translations && translations[key] && pluralFn) {
						var index = pluralFn(n);
						result = translations[key][index];
						if (result === null || result === undefined) {
								result = key;
						}
				}
				return result;
		}
		addData(data) {
				var parsed;
				try {
						parsed = this._parser.parse(data);
				} catch (err) {
						console.error(err);
						return;
				}
				for(var i = 0, len = parsed.length; i < len; i++){
						var entry = parsed[i];
						var locale = entry.info.locale;
						var messages = entry.messages;
						if (!this._translations[locale]) {
								this._translations[locale] = {};
								var lang = getLang(locale);
								if (!this._availableLangs[lang]) {
										this._availableLangs[lang] = locale;
								}
						}
						Object.assign(this._translations[locale], messages);
						this.fire('data:add', locale, messages);
				}
		}
		removeData(data) {
				var parsed;
				try {
						parsed = this._parser.parse(data);
				} catch (err) {
						console.error(err);
						return;
				}
				for(var i = 0, len = parsed.length; i < len; i++){
						var entry = parsed[i];
						var locale = entry.info.locale;
						var translations = this._translations[locale];
						if (!translations) continue;
						var messages = entry.messages;
						for(var key in messages){
								delete translations[key];
						}
						if (Object.keys(translations).length === 0) {
								delete this._translations[locale];
								delete this._availableLangs[getLang(locale)];
						}
						this.fire('data:remove', locale, messages);
				}
		}
		destroy() {
				this._translations = null;
				this._availableLangs = null;
				this._assets = null;
				this._parser = null;
				this.off();
		}
		_findFallbackLocale(locale, lang) {
				var result = DEFAULT_LOCALE_FALLBACKS[locale];
				if (result && this._translations[result]) {
						return result;
				}
				result = DEFAULT_LOCALE_FALLBACKS[lang];
				if (result && this._translations[result]) {
						return result;
				}
				result = this._availableLangs[lang];
				if (result && this._translations[result]) {
						return result;
				}
				return DEFAULT_LOCALE;
		}
		_onAssetAdd(asset) {
				asset.on('load', this._onAssetLoad, this);
				asset.on('change', this._onAssetChange, this);
				asset.on('remove', this._onAssetRemove, this);
				asset.on('unload', this._onAssetUnload, this);
				if (asset.resource) {
						this._onAssetLoad(asset);
				}
		}
		_onAssetLoad(asset) {
				this.addData(asset.resource);
		}
		_onAssetChange(asset) {
				if (asset.resource) {
						this.addData(asset.resource);
				}
		}
		_onAssetRemove(asset) {
				asset.off('load', this._onAssetLoad, this);
				asset.off('change', this._onAssetChange, this);
				asset.off('remove', this._onAssetRemove, this);
				asset.off('unload', this._onAssetUnload, this);
				if (asset.resource) {
						this.removeData(asset.resource);
				}
				this._app.assets.once("add:" + asset.id, this._onAssetAdd, this);
		}
		_onAssetUnload(asset) {
				if (asset.resource) {
						this.removeData(asset.resource);
				}
		}
		constructor(app){
				super();
				this.locale = DEFAULT_LOCALE;
				this._translations = {};
				this._availableLangs = {};
				this._app = app;
				this._assets = [];
				this._parser = new I18nParser();
		}
}

export { I18n };
