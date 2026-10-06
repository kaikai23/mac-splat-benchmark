import { Entity } from '../entity.js';
import { GSplatInstance } from '../../scene/gsplat/gsplat-instance.js';
import { GSplat } from '../../scene/gsplat/gsplat.js';
import { GSplatCompressed } from '../../scene/gsplat/gsplat-compressed.js';

class GSplatResource {
		destroy() {
				var _this_splat;
				this.device = null;
				this.splatData = null;
				(_this_splat = this.splat) == null ? undefined : _this_splat.destroy();
				this.splat = null;
		}
		createSplat() {
				if (!this.splat) {
						this.splat = this.splatData.isCompressed ? new GSplatCompressed(this.device, this.splatData) : new GSplat(this.device, this.splatData);
				}
				return this.splat;
		}
		instantiate(options) {
				if (options === undefined) options = {};
				var splatInstance = this.createInstance(options);
				var entity = new Entity();
				var component = entity.addComponent('gsplat', {
						instance: splatInstance
				});
				entity.setLocalEulerAngles(0, 0, 180);
				component.customAabb = splatInstance.splat.aabb.clone();
				return entity;
		}
		createInstance(options) {
				if (options === undefined) options = {};
				var splat = this.createSplat();
				return new GSplatInstance(splat, options);
		}
		constructor(device, splatData, comments){
				this.splat = null;
				this.comments = null;
				this.device = device;
				this.splatData = splatData;
				this.comments = comments;
		}
}

export { GSplatResource };
