class Kernel {
		static concentric(numRings, numPoints) {
				var kernel = [];
				kernel.push(0, 0);
				var spacing = 2 * Math.PI / numRings / numPoints;
				for(var ring = 1; ring <= numRings; ring++){
						var radius = ring / numRings;
						var circumference = 2 * Math.PI * radius;
						var pointsPerRing = Math.max(1, Math.floor(circumference / spacing));
						var angleStep = 2 * Math.PI / pointsPerRing;
						for(var point = 0; point < pointsPerRing; point++){
								var angle = point * angleStep;
								var x = radius * Math.cos(angle);
								var y = radius * Math.sin(angle);
								kernel.push(x, y);
						}
				}
				return kernel;
		}
}

export { Kernel };
