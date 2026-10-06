import { EventHandler } from '../../core/event-handler.js';
import { TEXTURELOCK_READ } from '../../platform/graphics/constants.js';

function SortWorker() {
		var order;
		var centers;
		var mapping;
		var cameraPosition;
		var cameraDirection;
		var forceUpdate = false;
		var lastCameraPosition = {
				x: 0,
				y: 0,
				z: 0
		};
		var lastCameraDirection = {
				x: 0,
				y: 0,
				z: 0
		};
		var boundMin = {
				x: 0,
				y: 0,
				z: 0
		};
		var boundMax = {
				x: 0,
				y: 0,
				z: 0
		};
		var distances;
		var countBuffer;
		var binarySearch = (m, n, compare_fn)=>{
				while(m <= n){
						var k = n + m >> 1;
						var cmp = compare_fn(k);
						if (cmp > 0) {
								m = k + 1;
						} else if (cmp < 0) {
								n = k - 1;
						} else {
								return k;
						}
				}
				return ~m;
		};
		var update = ()=>{
				if (!order || !centers || centers.length === 0 || !cameraPosition || !cameraDirection) return;
				var px = cameraPosition.x;
				var py = cameraPosition.y;
				var pz = cameraPosition.z;
				var dx = cameraDirection.x;
				var dy = cameraDirection.y;
				var dz = cameraDirection.z;
				var epsilon = 0.001;
				if (!forceUpdate && Math.abs(px - lastCameraPosition.x) < epsilon && Math.abs(py - lastCameraPosition.y) < epsilon && Math.abs(pz - lastCameraPosition.z) < epsilon && Math.abs(dx - lastCameraDirection.x) < epsilon && Math.abs(dy - lastCameraDirection.y) < epsilon && Math.abs(dz - lastCameraDirection.z) < epsilon) {
						return;
				}
				forceUpdate = false;
				lastCameraPosition.x = px;
				lastCameraPosition.y = py;
				lastCameraPosition.z = pz;
				lastCameraDirection.x = dx;
				lastCameraDirection.y = dy;
				lastCameraDirection.z = dz;
				var minDist;
				var maxDist;
				for(var i = 0; i < 8; ++i){
						var x = (i & 1 ? boundMin.x : boundMax.x) - px;
						var y = (i & 2 ? boundMin.y : boundMax.y) - py;
						var z = (i & 4 ? boundMin.z : boundMax.z) - pz;
						var d = x * dx + y * dy + z * dz;
						if (i === 0) {
								minDist = maxDist = d;
						} else {
								minDist = Math.min(minDist, d);
								maxDist = Math.max(maxDist, d);
						}
				}
				var numVertices = centers.length / 3;
				var compareBits = Math.max(10, Math.min(20, Math.round(Math.log2(numVertices / 4))));
				var bucketCount = 2 ** compareBits + 1;
				if ((distances == null ? undefined : distances.length) !== numVertices) {
						distances = new Uint32Array(numVertices);
				}
				if (!countBuffer || countBuffer.length !== bucketCount) {
						countBuffer = new Uint32Array(bucketCount);
				} else {
						countBuffer.fill(0);
				}
				var range = maxDist - minDist;
				var divider = range < 1e-6 ? 0 : 1 / range * 2 ** compareBits;
				for(var i1 = 0; i1 < numVertices; ++i1){
						var istride = i1 * 3;
						var x1 = centers[istride + 0] - px;
						var y1 = centers[istride + 1] - py;
						var z1 = centers[istride + 2] - pz;
						var d1 = x1 * dx + y1 * dy + z1 * dz;
						if (isNaN(d1)) {
								continue;
						}
						var sortKey = Math.floor((d1 - minDist) * divider);
						distances[i1] = sortKey;
						countBuffer[sortKey]++;
				}
				for(var i2 = 1; i2 < bucketCount; i2++){
						countBuffer[i2] += countBuffer[i2 - 1];
				}
				for(var i3 = 0; i3 < numVertices; i3++){
						var distance = distances[i3];
						var destIndex = --countBuffer[distance];
						order[destIndex] = i3;
				}
				var dist = (i)=>distances[order[i]] / divider + minDist;
				var findZero = ()=>{
						var result = binarySearch(0, numVertices - 1, (i)=>-dist(i));
						return Math.min(numVertices, Math.abs(result));
				};
				var count = dist(numVertices - 1) >= 0 ? findZero() : numVertices;
				if (mapping) {
						for(var i4 = 0; i4 < numVertices; ++i4){
								order[i4] = mapping[order[i4]];
						}
				}
				self.postMessage({
						order: order.buffer,
						count
				}, [
						order.buffer
				]);
				order = null;
		};
		self.onmessage = (message)=>{
				if (message.data.order) {
						order = new Uint32Array(message.data.order);
				}
				if (message.data.centers) {
						centers = new Float32Array(message.data.centers);
						var initialized = false;
						var numVertices = centers.length / 3;
						for(var i = 0; i < numVertices; ++i){
								var x = centers[i * 3 + 0];
								var y = centers[i * 3 + 1];
								var z = centers[i * 3 + 2];
								if (isNaN(x) || isNaN(y) || isNaN(z)) {
										continue;
								}
								if (!initialized) {
										initialized = true;
										boundMin.x = boundMax.x = x;
										boundMin.y = boundMax.y = y;
										boundMin.z = boundMax.z = z;
								} else {
										boundMin.x = Math.min(boundMin.x, x);
										boundMax.x = Math.max(boundMax.x, x);
										boundMin.y = Math.min(boundMin.y, y);
										boundMax.y = Math.max(boundMax.y, y);
										boundMin.z = Math.min(boundMin.z, z);
										boundMax.z = Math.max(boundMax.z, z);
								}
						}
						if (!initialized) {
								boundMin.x = boundMax.x = boundMin.y = boundMax.y = boundMin.z = boundMax.z = 0;
						}
						forceUpdate = true;
				}
				if (message.data.hasOwnProperty('mapping')) {
						mapping = message.data.mapping ? new Uint32Array(message.data.mapping) : null;
						forceUpdate = true;
				}
				if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
				if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;
				update();
		};
}
class GSplatSorter extends EventHandler {
		destroy() {
				this.worker.terminate();
				this.worker = null;
		}
		init(orderTexture, centers) {
				this.orderTexture = orderTexture;
				this.centers = centers.slice();
				var orderBuffer = this.orderTexture.lock({
						mode: TEXTURELOCK_READ
				}).buffer.slice();
				for(var i = 0; i < orderBuffer.length; ++i){
						orderBuffer[i] = i;
				}
				this.orderTexture.unlock();
				this.worker.postMessage({
						order: orderBuffer,
						centers: centers.buffer
				}, [
						orderBuffer,
						centers.buffer
				]);
		}
		setMapping(mapping) {
				if (mapping) {
						var centers = new Float32Array(mapping.length * 3);
						for(var i = 0; i < mapping.length; ++i){
								var src = mapping[i] * 3;
								var dst = i * 3;
								centers[dst + 0] = this.centers[src + 0];
								centers[dst + 1] = this.centers[src + 1];
								centers[dst + 2] = this.centers[src + 2];
						}
						this.worker.postMessage({
								centers: centers.buffer,
								mapping: mapping.buffer
						}, [
								centers.buffer,
								mapping.buffer
						]);
				} else {
						var centers1 = this.centers.slice();
						this.worker.postMessage({
								centers: centers1.buffer,
								mapping: null
						}, [
								centers1.buffer
						]);
				}
		}
		setCamera(pos, dir) {
				this.worker.postMessage({
						cameraPosition: {
								x: pos.x,
								y: pos.y,
								z: pos.z
						},
						cameraDirection: {
								x: dir.x,
								y: dir.y,
								z: dir.z
						}
				});
		}
		constructor(){
				super();
				this.worker = new Worker(URL.createObjectURL(new Blob([
						"(" + SortWorker.toString() + ")()"
				], {
						type: "application/javascript"
				})));
				this.worker.onmessage = (message)=>{
						var newOrder = message.data.order;
						var oldOrder = this.orderTexture._levels[0].buffer;
						this.worker.postMessage({
								order: oldOrder
						}, [
								oldOrder
						]);
						this.orderTexture._levels[0] = new Uint32Array(newOrder);
						this.orderTexture.upload();
						this.fire('updated', message.data.count);
				};
		}
}

export { GSplatSorter };
