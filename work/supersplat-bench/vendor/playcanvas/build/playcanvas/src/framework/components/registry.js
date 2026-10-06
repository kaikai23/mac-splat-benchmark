import { EventHandler } from '../../core/event-handler.js';

class ComponentSystemRegistry extends EventHandler {
		add(system) {
				var id = system.id;
				if (this[id]) {
						throw new Error("ComponentSystem name '" + id + "' already registered or not allowed");
				}
				this[id] = system;
				this.list.push(system);
		}
		remove(system) {
				var id = system.id;
				if (!this[id]) {
						throw new Error("No ComponentSystem named '" + id + "' registered");
				}
				delete this[id];
				var index = this.list.indexOf(this[id]);
				if (index !== -1) {
						this.list.splice(index, 1);
				}
		}
		destroy() {
				this.off();
				for(var i = 0; i < this.list.length; i++){
						this.list[i].destroy();
				}
		}
		constructor(){
				super();
				this.list = [];
		}
}

export { ComponentSystemRegistry };
