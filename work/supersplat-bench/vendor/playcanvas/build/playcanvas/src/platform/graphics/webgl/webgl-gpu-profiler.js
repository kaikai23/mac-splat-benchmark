import { GpuProfiler } from '../gpu-profiler.js';

class FrameQueriesInfo {
		destroy(gl) {
				this.queries.forEach((query)=>gl.deleteQuery(query));
				this.queries = null;
		}
		constructor(){
				this.queries = [];
		}
}
class WebglGpuProfiler extends GpuProfiler {
		destroy() {
				this.freeQueries.forEach((query)=>this.device.gl.deleteQuery(query));
				this.frameQueries.forEach((query)=>this.device.gl.deleteQuery(query));
				this.previousFrameQueries.forEach((frameQueriesInfo)=>frameQueriesInfo.destroy(this.device.gl));
				this.freeQueries = null;
				this.frameQueries = null;
				this.previousFrameQueries = null;
		}
		loseContext() {
				super.loseContext();
				this.freeQueries = [];
				this.frameQueries = [];
				this.previousFrameQueries = [];
		}
		restoreContext() {
				this.ext = this.device.extDisjointTimerQuery;
		}
		getQuery() {
				var _this_freeQueries_pop;
				return (_this_freeQueries_pop = this.freeQueries.pop()) != null ? _this_freeQueries_pop : this.device.gl.createQuery();
		}
		start(name) {
				if (this.ext) {
						var slot = this.getSlot(name);
						var query = this.getQuery();
						this.frameQueries[slot] = query;
						this.device.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
						return slot;
				}
				return undefined;
		}
		end(slot) {
				if (slot !== undefined) {
						this.device.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
				}
		}
		frameStart() {
				this.processEnableRequest();
				if (this._enabled) {
						this.frameGPUMarkerSlot = this.start('GpuFrame');
				}
		}
		frameEnd() {
				if (this._enabled) {
						this.end(this.frameGPUMarkerSlot);
				}
		}
		request() {
				if (this._enabled) {
						var ext = this.ext;
						var gl = this.device.gl;
						var renderVersion = this.device.renderVersion;
						var frameQueries = this.frameQueries;
						if (frameQueries.length > 0) {
								this.frameQueries = [];
								var frameQueriesInfo = new FrameQueriesInfo();
								frameQueriesInfo.queries = frameQueries;
								frameQueriesInfo.renderVersion = renderVersion;
								this.previousFrameQueries.push(frameQueriesInfo);
						}
						if (this.previousFrameQueries.length > 0) {
								var previousQueriesInfo = this.previousFrameQueries[0];
								var previousQueries = previousQueriesInfo.queries;
								var lastQuery = previousQueries[previousQueries.length - 1];
								var available = gl.getQueryParameter(lastQuery, gl.QUERY_RESULT_AVAILABLE);
								var disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
								if (available && !disjoint) {
										this.previousFrameQueries.shift();
										var timings = this.timings;
										timings.length = 0;
										for(var i = 0; i < previousQueries.length; i++){
												var query = previousQueries[i];
												var duration = gl.getQueryParameter(query, gl.QUERY_RESULT);
												timings[i] = duration * 0.000001;
												this.freeQueries.push(query);
										}
										this.report(previousQueriesInfo.renderVersion, timings);
								}
								if (disjoint) {
										this.previousFrameQueries.forEach((frameQueriesInfo)=>{
												this.report(frameQueriesInfo.renderVersion, null);
												frameQueriesInfo.destroy(gl);
										});
										this.previousFrameQueries.length = 0;
								}
						}
						super.request(renderVersion);
				}
		}
		constructor(device){
				super(), this.freeQueries = [], this.frameQueries = [], this.previousFrameQueries = [], this.timings = [];
				this.device = device;
				this.ext = device.extDisjointTimerQuery;
		}
}

export { WebglGpuProfiler };
