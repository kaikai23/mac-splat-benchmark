class EventHandle {
		off() {
				if (this._removed) return;
				this.handler.offByHandle(this);
		}
		on(name, callback, scope) {
				if (scope === undefined) scope = this;
				return this.handler._addCallback(name, callback, scope, false);
		}
		once(name, callback, scope) {
				if (scope === undefined) scope = this;
				return this.handler._addCallback(name, callback, scope, true);
		}
		set removed(value) {
				if (!value) return;
				this._removed = true;
		}
		get removed() {
				return this._removed;
		}
		constructor(handler, name, callback, scope, once = false){
				this._removed = false;
				this.handler = handler;
				this.name = name;
				this.callback = callback;
				this.scope = scope;
				this._once = once;
		}
}

export { EventHandle };
