import { WasmModule } from '../../core/wasm-module.js';
import { DracoWorker } from './draco-worker.js';
import { http } from '../../platform/net/http.js';

var downloadMaxRetries = 3;
class JobQueue {
		init(workers) {
				workers.forEach((worker)=>{
						worker.addEventListener('message', (message)=>{
								var data = message.data;
								var callback = this.jobCallbacks.get(data.jobId);
								if (callback) {
										callback(data.error, {
												indices: data.indices,
												vertices: data.vertices,
												attributes: data.attributes
										});
								}
								this.jobCallbacks.delete(data.jobId);
								if (this.jobQueue.length > 0) {
										var job = this.jobQueue.shift();
										this.run(worker, job);
								} else {
										var index2 = this.workers[2].indexOf(worker);
										if (index2 !== -1) {
												this.workers[2].splice(index2, 1);
												this.workers[1].push(worker);
										} else {
												var index1 = this.workers[1].indexOf(worker);
												if (index1 !== -1) {
														this.workers[1].splice(index1, 1);
														this.workers[0].push(worker);
												}
										}
								}
						});
				});
				this.workers[0] = workers;
				while(this.jobQueue.length && (this.workers[0].length || this.workers[1].length)){
						var job = this.jobQueue.shift();
						if (this.workers[0].length > 0) {
								var worker = this.workers[0].shift();
								this.workers[1].push(worker);
								this.run(worker, job);
						} else {
								var worker1 = this.workers[1].shift();
								this.workers[2].push(worker1);
								this.run(worker1, job);
						}
				}
		}
		enqueueJob(buffer, callback) {
				var job = {
						jobId: this.jobId++,
						buffer: buffer
				};
				this.jobCallbacks.set(job.jobId, callback);
				if (this.workers[0].length > 0) {
						var worker = this.workers[0].shift();
						this.workers[1].push(worker);
						this.run(worker, job);
				} else if (this.workers[1].length > 0) {
						var worker1 = this.workers[1].shift();
						this.workers[2].push(worker1);
						this.run(worker1, job);
				} else {
						this.jobQueue.push(job);
				}
		}
		constructor(){
				this.workers = [
						[],
						[],
						[]
				];
				this.jobId = 0;
				this.jobQueue = [];
				this.jobCallbacks = new Map();
				this.run = (worker, job)=>{
						worker.postMessage({
								type: 'decodeMesh',
								jobId: job.jobId,
								buffer: job.buffer
						}, [
								job.buffer
						]);
				};
		}
}
var downloadScript = (url)=>{
		return new Promise((resolve, reject)=>{
				var options = {
						cache: true,
						responseType: 'text',
						retry: downloadMaxRetries > 0,
						maxRetries: downloadMaxRetries
				};
				http.get(url, options, (err, response)=>{
						if (err) {
								reject(err);
						} else {
								resolve(response);
						}
				});
		});
};
var compileModule = (url)=>{
		var compileManual = ()=>{
				return fetch(url).then((result)=>result.arrayBuffer()).then((buffer)=>WebAssembly.compile(buffer));
		};
		var compileStreaming = ()=>{
				return WebAssembly.compileStreaming(fetch(url)).catch((err)=>{
						return compileManual();
				});
		};
		return WebAssembly.compileStreaming ? compileStreaming() : compileManual();
};
var defaultNumWorkers = 1;
var jobQueue;
var lazyConfig;
var initializeWorkers = (config)=>{
		if (jobQueue) {
				return true;
		}
		if (!config) {
				if (lazyConfig) {
						config = lazyConfig;
				} else {
						var moduleConfig = WasmModule.getConfig('DracoDecoderModule');
						if (moduleConfig) {
								config = {
										jsUrl: moduleConfig.glueUrl,
										wasmUrl: moduleConfig.wasmUrl,
										numWorkers: moduleConfig.numWorkers
								};
						} else {
								config = {
										jsUrl: 'draco.wasm.js',
										wasmUrl: 'draco.wasm.wasm',
										numWorkers: defaultNumWorkers
								};
						}
				}
		}
		if (!config.jsUrl || !config.wasmUrl) {
				return false;
		}
		jobQueue = new JobQueue();
		Promise.all([
				downloadScript(config.jsUrl),
				compileModule(config.wasmUrl)
		]).then((param)=>{
				var [dracoSource, dracoModule] = param;
				var code = [
						'/* draco */',
						dracoSource,
						'/* worker */',
						"(\n" + DracoWorker.toString() + "\n)()\n\n"
				].join('\n');
				var blob = new Blob([
						code
				], {
						type: "application/javascript"
				});
				var workerUrl = URL.createObjectURL(blob);
				var numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
				var workers = [];
				for(var i = 0; i < numWorkers; ++i){
						var worker = new Worker(workerUrl);
						worker.postMessage({
								type: 'init',
								module: dracoModule
						});
						workers.push(worker);
				}
				jobQueue.init(workers);
		});
		return true;
};
var dracoInitialize = (config)=>{
		if (config == null ? undefined : config.lazyInit) {
				lazyConfig = config;
		} else {
				initializeWorkers(config);
		}
};
var dracoDecode = (buffer, callback)=>{
		if (!initializeWorkers()) {
				return false;
		}
		jobQueue.enqueueJob(buffer, callback);
		return true;
};

export { dracoDecode, dracoInitialize };
