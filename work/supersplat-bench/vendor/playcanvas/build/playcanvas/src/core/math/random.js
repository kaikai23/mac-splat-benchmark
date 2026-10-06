import { math } from './math.js';

var _goldenAngle = 2.399963229728653;
var random = {
		circlePoint (point) {
				var r = Math.sqrt(Math.random());
				var theta = Math.random() * 2 * Math.PI;
				point.x = r * Math.cos(theta);
				point.y = r * Math.sin(theta);
		},
		circlePointDeterministic (point, index, numPoints) {
				var theta = index * _goldenAngle;
				var r = Math.sqrt(index) / Math.sqrt(numPoints);
				point.x = r * Math.cos(theta);
				point.y = r * Math.sin(theta);
		},
		spherePointDeterministic (point, index, numPoints, start, end) {
				if (start === undefined) start = 0;
				if (end === undefined) end = 1;
				start = 1 - 2 * start;
				end = 1 - 2 * end;
				var y = math.lerp(start, end, index / numPoints);
				var radius = Math.sqrt(1 - y * y);
				var theta = _goldenAngle * index;
				point.x = Math.cos(theta) * radius;
				point.y = y;
				point.z = Math.sin(theta) * radius;
		},
		radicalInverse (i) {
				var bits = (i << 16 | i >>> 16) >>> 0;
				bits = ((bits & 0x55555555) << 1 | (bits & 0xAAAAAAAA) >>> 1) >>> 0;
				bits = ((bits & 0x33333333) << 2 | (bits & 0xCCCCCCCC) >>> 2) >>> 0;
				bits = ((bits & 0x0F0F0F0F) << 4 | (bits & 0xF0F0F0F0) >>> 4) >>> 0;
				bits = ((bits & 0x00FF00FF) << 8 | (bits & 0xFF00FF00) >>> 8) >>> 0;
				return bits * 2.3283064365386963e-10;
		}
};

export { random };
