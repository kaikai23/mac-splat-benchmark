import { DeviceCache } from '../../platform/graphics/device-cache.js';

var defaultMaterialDeviceCache = new DeviceCache();
function getDefaultMaterial(device) {
		var material = defaultMaterialDeviceCache.get(device);
		return material;
}
function setDefaultMaterial(device, material) {
		defaultMaterialDeviceCache.get(device, ()=>{
				return material;
		});
}

export { getDefaultMaterial, setDefaultMaterial };
