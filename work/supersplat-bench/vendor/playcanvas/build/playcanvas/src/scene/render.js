import { EventHandler } from '../core/event-handler.js';

class Render extends EventHandler {
		set meshes(value) {
				this.decRefMeshes();
				this._meshes = value;
				this.incRefMeshes();
				this.fire('set:meshes', value);
		}
		get meshes() {
				return this._meshes;
		}
		destroy() {
				this.meshes = null;
		}
		decRefMeshes() {
				var _this__meshes;
				(_this__meshes = this._meshes) == null ? undefined : _this__meshes.forEach((mesh, index)=>{
						if (mesh) {
								mesh.decRefCount();
								if (mesh.refCount < 1) {
										mesh.destroy();
										this._meshes[index] = null;
								}
						}
				});
		}
		incRefMeshes() {
				var _this__meshes;
				(_this__meshes = this._meshes) == null ? undefined : _this__meshes.forEach((mesh)=>{
						mesh == null ? undefined : mesh.incRefCount();
				});
		}
		constructor(...args){
				super(...args), this._meshes = null;
		}
}
Render.EVENT_SETMESHES = 'set:meshes';

export { Render };
