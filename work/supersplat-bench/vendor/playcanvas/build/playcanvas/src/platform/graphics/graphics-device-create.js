import { platform } from '../../core/platform.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_NULL, DEVICETYPE_WEBGPU } from './constants.js';
import { WebgpuGraphicsDevice } from './webgpu/webgpu-graphics-device.js';
import { WebglGraphicsDevice } from './webgl/webgl-graphics-device.js';
import { NullGraphicsDevice } from './null/null-graphics-device.js';

function createGraphicsDevice(canvas, options) {
		if (options === undefined) options = {};
		var _options_deviceTypes;
		var deviceTypes = (_options_deviceTypes = options.deviceTypes) != null ? _options_deviceTypes : [];
		if (!deviceTypes.includes(DEVICETYPE_WEBGL2)) {
				deviceTypes.push(DEVICETYPE_WEBGL2);
		}
		if (!deviceTypes.includes(DEVICETYPE_NULL)) {
				deviceTypes.push(DEVICETYPE_NULL);
		}
		if (platform.browser && !!navigator.xr) {
				var _options;
				var _xrCompatible;
				(_xrCompatible = (_options = options).xrCompatible) != null ? _xrCompatible : _options.xrCompatible = true;
		}
		var deviceCreateFuncs = [];
		for(var i = 0; i < deviceTypes.length; i++){
				var _window_navigator, _window;
				var deviceType = deviceTypes[i];
				if (deviceType === DEVICETYPE_WEBGPU && ((_window = window) == null ? undefined : (_window_navigator = _window.navigator) == null ? undefined : _window_navigator.gpu)) {
						deviceCreateFuncs.push(()=>{
								var device = new WebgpuGraphicsDevice(canvas, options);
								return device.initWebGpu(options.glslangUrl, options.twgslUrl);
						});
				}
				if (deviceType === DEVICETYPE_WEBGL2) {
						deviceCreateFuncs.push(()=>{
								return new WebglGraphicsDevice(canvas, options);
						});
				}
				if (deviceType === DEVICETYPE_NULL) {
						deviceCreateFuncs.push(()=>{
								return new NullGraphicsDevice(canvas, options);
						});
				}
		}
		return new Promise((resolve, reject)=>{
				var attempt = 0;
				var next = ()=>{
						if (attempt >= deviceCreateFuncs.length) {
								reject(new Error('Failed to create a graphics device'));
						} else {
								Promise.resolve(deviceCreateFuncs[attempt++]()).then((device)=>{
										if (device) {
												resolve(device);
										} else {
												next();
										}
								}).catch((err)=>{
										console.log(err);
										next();
								});
						}
				};
				next();
		});
}

export { createGraphicsDevice };
