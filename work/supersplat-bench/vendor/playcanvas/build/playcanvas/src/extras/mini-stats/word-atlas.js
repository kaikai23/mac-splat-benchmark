import { math } from '../../core/math/math.js';
import { Texture } from '../../platform/graphics/texture.js';
import { FILTER_NEAREST } from '../../platform/graphics/constants.js';

class WordAtlas {
		destroy() {
				this.texture.destroy();
				this.texture = null;
		}
		render(render2d, word, x, y) {
				var p = this.placements.get(word);
				if (p) {
						var padding = 1;
						render2d.quad(x + p.l - padding, y - p.d + padding, p.w + padding * 2, p.h + padding * 2, p.x - padding, this.texture.height - p.y - p.h - padding, undefined, undefined, this.texture, 1);
						return p.w;
				}
				return 0;
		}
		constructor(device, words){
				var initContext = (context)=>{
						context.font = '10px "Lucida Console", Monaco, monospace';
						context.textAlign = 'left';
						context.textBaseline = 'alphabetic';
				};
				var isNumber = (word)=>{
						return word === '.' || word.length === 1 && word.charCodeAt(0) >= 48 && word.charCodeAt(0) <= 57;
				};
				var canvas = document.createElement('canvas');
				var context = canvas.getContext('2d', {
						alpha: true
				});
				initContext(context);
				var placements = new Map();
				var padding = 5;
				var width = 512;
				var x = padding;
				var y = padding;
				words.forEach((word)=>{
						var measurement = context.measureText(word);
						var l = Math.ceil(-measurement.actualBoundingBoxLeft);
						var r = Math.ceil(measurement.actualBoundingBoxRight);
						var a = Math.ceil(measurement.actualBoundingBoxAscent);
						var d = Math.ceil(measurement.actualBoundingBoxDescent);
						var w = l + r;
						var h = a + d;
						if (x + w + padding >= width) {
								x = padding;
								y += 16;
						}
						placements.set(word, {
								l,
								r,
								a,
								d,
								w,
								h,
								x: x,
								y: y
						});
						x += w + padding;
				});
				canvas.width = 512;
				canvas.height = math.nextPowerOfTwo(y + 16 + padding);
				initContext(context);
				context.fillStyle = 'rgb(0, 0, 0)';
				context.fillRect(0, 0, canvas.width, canvas.height);
				placements.forEach((m, word)=>{
						context.fillStyle = isNumber(word) ? 'rgb(255, 255, 255)' : 'rgb(170, 170, 170)';
						context.fillText(word, m.x - m.l, m.y + m.a);
				});
				this.placements = placements;
				var data = context.getImageData(0, 0, canvas.width, canvas.height).data;
				for(var i = 0; i < data.length; i += 4){
						data[i + 3] = data[i + 0];
						data[i + 0] = 255;
						data[i + 1] = 255;
						data[i + 2] = 255;
				}
				this.texture = new Texture(device, {
						name: 'mini-stats-word-atlas',
						width: canvas.width,
						height: canvas.height,
						mipmaps: false,
						minFilter: FILTER_NEAREST,
						magFilter: FILTER_NEAREST,
						levels: [
								data
						]
				});
		}
}

export { WordAtlas };
