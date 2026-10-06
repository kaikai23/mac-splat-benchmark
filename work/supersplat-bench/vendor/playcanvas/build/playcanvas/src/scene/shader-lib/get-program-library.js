import { DeviceCache } from '../../platform/graphics/device-cache.js';

var programLibraryDeviceCache = new DeviceCache();
function getProgramLibrary(device) {
		var library = programLibraryDeviceCache.get(device);
		return library;
}
function setProgramLibrary(device, library) {
		programLibraryDeviceCache.get(device, ()=>{
				return library;
		});
}

export { getProgramLibrary, setProgramLibrary };
