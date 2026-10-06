import { WasmModule } from '../../core/wasm-module.js';
import { PIXELFORMAT_RGB565, PIXELFORMAT_RGBA4 } from '../../platform/graphics/constants.js';
import { BasisWorker } from './basis-worker.js';
import { http } from '../../platform/net/http.js';

var getCompressionFormats = (device)=>{
		return {
				astc: !!device.extCompressedTextureASTC,
				atc: !!device.extCompressedTextureATC,
				dxt: !!device.extCompressedTextureS3TC,
				etc1: !!device.extCompressedTextureETC1,
				etc2: !!device.extCompressedTextureETC,
				pvr: !!device.extCompressedTexturePVRTC
		};
};
var prepareWorkerModules = (config, callback)=>{
		var getWorkerBlob = (basisCode)=>{
				var code = [
						'/* basis */',
						basisCode,
						'',
						"(" + BasisWorker.toString() + ")()\n\n"
				].join('\n');
				return new Blob([
						code
				], {
						type: "application/javascript"
				});
		};
		var wasmSupported = ()=>{
				try {
						if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
								var module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
								if (module instanceof WebAssembly.Module) {
										return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
								}
						}
				} catch (e) {}
				return false;
		};
		var sendResponse = (basisCode, module)=>{
				callback(null, {
						workerUrl: URL.createObjectURL(getWorkerBlob(basisCode)),
						module: module,
						rgbPriority: config.rgbPriority,
						rgbaPriority: config.rgbaPriority
				});
		};
		var options = {
				cache: true,
				responseType: 'text',
				retry: config.maxRetries > 0,
				maxRetries: config.maxRetries
		};
		if (config.glueUrl && config.wasmUrl && wasmSupported()) {
				var basisCode = null;
				var module = null;
				http.get(config.glueUrl, options, (err, response)=>{
						if (err) {
								callback(err);
						} else {
								if (module) {
										sendResponse(response, module);
								} else {
										basisCode = response;
								}
						}
				});
				var fetchPromise = fetch(config.wasmUrl);
				var compileManual = ()=>{
						fetchPromise.then((result)=>result.arrayBuffer()).then((buffer)=>WebAssembly.compile(buffer)).then((module_)=>{
								if (basisCode) {
										sendResponse(basisCode, module_);
								} else {
										module = module_;
								}
						}).catch((err)=>{
								callback(err, null);
						});
				};
				if (WebAssembly.compileStreaming) {
						WebAssembly.compileStreaming(fetchPromise).then((module_)=>{
								if (basisCode) {
										sendResponse(basisCode, module_);
								} else {
										module = module_;
								}
						}).catch((err)=>{
								compileManual();
						});
				} else {
						compileManual();
				}
		} else {
				http.get(config.fallbackUrl, options, (err, response)=>{
						if (err) {
								callback(err, null);
						} else {
								sendResponse(response, null);
						}
				});
		}
};
class BasisQueue {
		enqueueJob(url, data, callback, options) {
				if (this.callbacks.hasOwnProperty(url)) {
						this.callbacks[url].push(callback);
				} else {
						this.callbacks[url] = [
								callback
						];
						var job = {
								url: url,
								data: data,
								options: options
						};
						if (this.clients.length > 0) {
								this.clients.shift().run(job);
						} else {
								this.queue.push(job);
						}
				}
		}
		enqueueClient(client) {
				if (this.queue.length > 0) {
						client.run(this.queue.shift());
				} else {
						this.clients.push(client);
				}
		}
		handleResponse(url, err, data) {
				var callback = this.callbacks[url];
				if (err) {
						for(var i = 0; i < callback.length; ++i){
								callback[i](err);
						}
				} else {
						if (data.format === PIXELFORMAT_RGB565 || data.format === PIXELFORMAT_RGBA4) {
								data.levels = data.levels.map((v)=>{
										return new Uint16Array(v);
								});
						} else {
								data.levels = data.levels.map((v)=>{
										return new Uint8Array(v);
								});
						}
						for(var i1 = 0; i1 < callback.length; ++i1){
								callback[i1](null, data);
						}
				}
				delete this.callbacks[url];
		}
		constructor(){
				this.callbacks = {};
				this.queue = [];
				this.clients = [];
		}
}
class BasisClient {
		run(job) {
				var transfer = [];
				if (job.data instanceof ArrayBuffer) {
						transfer.push(job.data);
				}
				this.worker.postMessage({
						type: 'transcode',
						url: job.url,
						format: job.format,
						data: job.data,
						options: job.options
				}, transfer);
				if (this.eager) {
						this.queue.enqueueClient(this);
				}
		}
		constructor(queue, config, eager){
				this.queue = queue;
				this.worker = new Worker(config.workerUrl);
				this.worker.addEventListener('message', (message)=>{
						var data = message.data;
						this.queue.handleResponse(data.url, data.err, data.data);
						if (!this.eager) {
								this.queue.enqueueClient(this);
						}
				});
				this.worker.postMessage({
						type: 'init',
						config: config
				});
				this.eager = eager;
		}
}
var defaultNumWorkers = 1;
var defaultRgbPriority = [
		'etc2',
		'etc1',
		'astc',
		'dxt',
		'pvr',
		'atc'
];
var defaultRgbaPriority = [
		'astc',
		'dxt',
		'etc2',
		'pvr',
		'atc'
];
var defaultMaxRetries = 5;
var queue = new BasisQueue();
var lazyConfig = null;
var initializing = false;
function basisInitialize(config) {
		if (initializing) {
				return;
		}
		if (!config) {
				config = lazyConfig || {};
		} else if (config.lazyInit) {
				lazyConfig = config;
				return;
		}
		if (!config.glueUrl || !config.wasmUrl || !config.fallbackUrl) {
				var moduleConfig = WasmModule.getConfig('BASIS');
				if (moduleConfig) {
						config = {
								glueUrl: moduleConfig.glueUrl,
								wasmUrl: moduleConfig.wasmUrl,
								fallbackUrl: moduleConfig.fallbackUrl,
								numWorkers: moduleConfig.numWorkers
						};
				}
		}
		if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
				initializing = true;
				var numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
				var eagerWorkers = config.numWorkers === 1 || (config.hasOwnProperty('eagerWorkers') ? config.eagerWorkers : true);
				config.rgbPriority = config.rgbPriority || defaultRgbPriority;
				config.rgbaPriority = config.rgbaPriority || defaultRgbaPriority;
				config.maxRetries = config.hasOwnProperty('maxRetries') ? config.maxRetries : defaultMaxRetries;
				prepareWorkerModules(config, (err, clientConfig)=>{
						if (err) {
								console.error("failed to initialize basis worker: " + err);
						} else {
								for(var i = 0; i < numWorkers; ++i){
										queue.enqueueClient(new BasisClient(queue, clientConfig, eagerWorkers));
								}
						}
				});
		}
}
var deviceDetails = null;
function basisTranscode(device, url, data, callback, options) {
		basisInitialize();
		if (!deviceDetails) {
				deviceDetails = {
						formats: getCompressionFormats(device)
				};
		}
		queue.enqueueJob(url, data, callback, {
				deviceDetails: deviceDetails,
				isGGGR: !!(options == null ? undefined : options.isGGGR),
				isKTX2: !!(options == null ? undefined : options.isKTX2)
		});
		return initializing;
}

export { basisInitialize, basisTranscode };
