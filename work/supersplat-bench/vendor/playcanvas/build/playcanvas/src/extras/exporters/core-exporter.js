import { createShaderFromCode } from '../../scene/shader-lib/utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { isCompressedPixelFormat, PIXELFORMAT_RGBA8, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';

var textureBlitVertexShader = "\n	attribute vec2 vertex_position;\n	varying vec2 uv0;\n	void main(void) {\n		gl_Position = vec4(vertex_position, 0.5, 1.0);\n		uv0 = vertex_position.xy * 0.5 + 0.5;\n	}";
var textureBlitFragmentShader = "\n	varying vec2 uv0;\n	uniform sampler2D blitTexture;\n	void main(void) {\n		gl_FragColor = texture2D(blitTexture, uv0);\n	}";
class CoreExporter {
		textureToCanvas(texture, options) {
				if (options === undefined) options = {};
				var image = texture.getSource();
				if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
						var { width, height } = this.calcTextureSize(image.width, image.height, options.maxTextureSize);
						var canvas = document.createElement('canvas');
						canvas.width = width;
						canvas.height = height;
						var context = canvas.getContext('2d');
						if (context === null) {
								return Promise.resolve(undefined);
						}
						context.drawImage(image, 0, 0, canvas.width, canvas.height);
						if (options.color) {
								var { r, g, b } = options.color;
								var imagedata = context.getImageData(0, 0, width, height);
								var data = imagedata.data;
								for(var i = 0; i < data.length; i += 4){
										data[i + 0] = data[i + 0] * r;
										data[i + 1] = data[i + 1] * g;
										data[i + 2] = data[i + 2] * b;
								}
								context.putImageData(imagedata, 0, 0);
						}
						return Promise.resolve(canvas);
				}
				var device = texture.device;
				var { width: width1, height: height1 } = this.calcTextureSize(texture.width, texture.height, options.maxTextureSize);
				var format = isCompressedPixelFormat(texture.format) ? PIXELFORMAT_RGBA8 : texture.format;
				var dstTexture = new Texture(device, {
						name: 'ExtractedTexture',
						width: width1,
						height: height1,
						format: format,
						cubemap: false,
						mipmaps: false,
						minFilter: FILTER_LINEAR,
						magFilter: FILTER_LINEAR,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE
				});
				var renderTarget = new RenderTarget({
						colorBuffer: dstTexture,
						depth: false
				});
				var shader = createShaderFromCode(device, textureBlitVertexShader, textureBlitFragmentShader, 'ShaderCoreExporterBlit');
				device.scope.resolve('blitTexture').setValue(texture);
				device.setBlendState(BlendState.NOBLEND);
				drawQuadWithShader(device, renderTarget, shader);
				return dstTexture.read(0, 0, width1, height1, {
						renderTarget: renderTarget,
						immediate: true
				}).then((textureData)=>{
						dstTexture.destroy();
						renderTarget.destroy();
						var pixels = new Uint8ClampedArray(width1 * height1 * 4);
						pixels.set(textureData);
						var newImage = new ImageData(pixels, width1, height1);
						var canvas = document.createElement('canvas');
						canvas.width = width1;
						canvas.height = height1;
						var newContext = canvas.getContext('2d');
						if (!newContext) {
								return Promise.resolve(undefined);
						}
						newContext.putImageData(newImage, 0, 0);
						return Promise.resolve(canvas);
				});
		}
		calcTextureSize(width, height, maxTextureSize) {
				if (maxTextureSize) {
						var scale = Math.min(maxTextureSize / Math.max(width, height), 1);
						width = Math.round(width * scale);
						height = Math.round(height * scale);
				}
				return {
						width,
						height
				};
		}
		constructor(){}
}

export { CoreExporter };
