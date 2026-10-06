class Tracing {
		static set(channel, enabled) {
		}
		static get(channel) {
				return Tracing._traceChannels.has(channel);
		}
}
Tracing._traceChannels = new Set();
Tracing.stack = false;

export { Tracing };
