import { math } from '../../../core/math/math.js';
import { isCompressedPixelFormat, PIXELFORMAT_DEPTHSTENCIL, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, isIntegerPixelFormat, pixelFormatInfo, BUFFERUSAGE_READ, BUFFERUSAGE_COPY_DST, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR } from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import { gpuTextureFormats } from './constants.js';

var gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';
var gpuFilterModes = [];
gpuFilterModes[FILTER_NEAREST] = {
		level: 'nearest',
		mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR] = {
		level: 'linear',
		mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_NEAREST] = {
		level: 'nearest',
		mip: 'nearest'
};
gpuFilterModes[FILTER_NEAREST_MIPMAP_LINEAR] = {
		level: 'nearest',
		mip: 'linear'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_NEAREST] = {
		level: 'linear',
		mip: 'nearest'
};
gpuFilterModes[FILTER_LINEAR_MIPMAP_LINEAR] = {
		level: 'linear',
		mip: 'linear'
};
var dummyUse = (thingOne)=>{};
class WebgpuTexture {
		create(device) {
				var texture = this.texture;
				var wgpu = device.wgpu;
				var numLevels = texture.numLevels;
				this.desc = {
						size: {
								width: texture.width,
								height: texture.height,
								depthOrArrayLayers: texture.cubemap ? 6 : texture.array ? texture.arrayLength : 1
						},
						format: this.format,
						mipLevelCount: numLevels,
						sampleCount: 1,
						dimension: texture.volume ? '3d' : '2d',
						usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | (isCompressedPixelFormat(texture.format) ? 0 : GPUTextureUsage.RENDER_ATTACHMENT) | (texture.storage ? GPUTextureUsage.STORAGE_BINDING : 0)
				};
				this.gpuTexture = wgpu.createTexture(this.desc);
				var viewDescr;
				if (this.texture.format === PIXELFORMAT_DEPTHSTENCIL) {
						viewDescr = {
								format: 'depth24plus',
								aspect: 'depth-only'
						};
				}
				this.view = this.createView(viewDescr);
		}
		destroy(device) {}
		propertyChanged(flag) {
				this.samplers.length = 0;
		}
		getView(device) {
				this.uploadImmediate(device, this.texture);
				return this.view;
		}
		createView(viewDescr) {
				var options = viewDescr != null ? viewDescr : {};
				var textureDescr = this.desc;
				var texture = this.texture;
				var defaultViewDimension = ()=>{
						if (texture.cubemap) return 'cube';
						if (texture.volume) return '3d';
						if (texture.array) return '2d-array';
						return '2d';
				};
				var _options_format, _options_dimension, _options_aspect, _options_baseMipLevel, _options_mipLevelCount, _options_baseArrayLayer, _options_arrayLayerCount;
				var desc = {
						format: (_options_format = options.format) != null ? _options_format : textureDescr.format,
						dimension: (_options_dimension = options.dimension) != null ? _options_dimension : defaultViewDimension(),
						aspect: (_options_aspect = options.aspect) != null ? _options_aspect : 'all',
						baseMipLevel: (_options_baseMipLevel = options.baseMipLevel) != null ? _options_baseMipLevel : 0,
						mipLevelCount: (_options_mipLevelCount = options.mipLevelCount) != null ? _options_mipLevelCount : textureDescr.mipLevelCount,
						baseArrayLayer: (_options_baseArrayLayer = options.baseArrayLayer) != null ? _options_baseArrayLayer : 0,
						arrayLayerCount: (_options_arrayLayerCount = options.arrayLayerCount) != null ? _options_arrayLayerCount : textureDescr.depthOrArrayLayers
				};
				var view = this.gpuTexture.createView(desc);
				return view;
		}
		getSampler(device, sampleType) {
				var sampler = this.samplers[sampleType];
				if (!sampler) {
						var texture = this.texture;
						var desc = {
								addressModeU: gpuAddressModes[texture.addressU],
								addressModeV: gpuAddressModes[texture.addressV],
								addressModeW: gpuAddressModes[texture.addressW]
						};
						if (!sampleType && texture.compareOnRead) {
								sampleType = SAMPLETYPE_DEPTH;
						}
						if (sampleType === SAMPLETYPE_DEPTH || sampleType === SAMPLETYPE_INT || sampleType === SAMPLETYPE_UINT) {
								desc.compare = 'less';
								desc.magFilter = 'linear';
								desc.minFilter = 'linear';
						} else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {
								desc.magFilter = 'nearest';
								desc.minFilter = 'nearest';
								desc.mipmapFilter = 'nearest';
						} else {
								var forceNearest = !device.textureFloatFilterable && (texture.format === PIXELFORMAT_RGBA32F || texture.format === PIXELFORMAT_RGBA16F);
								if (forceNearest || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || isIntegerPixelFormat(this.texture.format)) {
										desc.magFilter = 'nearest';
										desc.minFilter = 'nearest';
										desc.mipmapFilter = 'nearest';
								} else {
										desc.magFilter = gpuFilterModes[texture.magFilter].level;
										desc.minFilter = gpuFilterModes[texture.minFilter].level;
										desc.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
								}
						}
						var allLinear = desc.minFilter === 'linear' && desc.magFilter === 'linear' && desc.mipmapFilter === 'linear';
						desc.maxAnisotropy = allLinear ? math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy) : 1;
						sampler = device.wgpu.createSampler(desc);
						this.samplers[sampleType] = sampler;
				}
				return sampler;
		}
		loseContext() {}
		uploadImmediate(device, texture) {
				if (texture._needsUpload || texture._needsMipmapsUpload) {
						this.uploadData(device);
						texture._needsUpload = false;
						texture._needsMipmapsUpload = false;
				}
		}
		uploadData(device) {
				var texture = this.texture;
				if (texture._levels) {
						var anyUploads = false;
						var anyLevelMissing = false;
						var requiredMipLevels = texture.numLevels;
						for(var mipLevel = 0; mipLevel < requiredMipLevels; mipLevel++){
								var mipObject = texture._levels[mipLevel];
								if (mipObject) {
										if (texture.cubemap) {
												for(var face = 0; face < 6; face++){
														var faceSource = mipObject[face];
														if (faceSource) {
																if (this.isExternalImage(faceSource)) {
																		this.uploadExternalImage(device, faceSource, mipLevel, face);
																		anyUploads = true;
																} else if (ArrayBuffer.isView(faceSource)) {
																		this.uploadTypedArrayData(device, faceSource, mipLevel, face);
																		anyUploads = true;
																} else ;
														} else {
																anyLevelMissing = true;
														}
												}
										} else if (texture._volume) ; else if (texture.array) {
												if (texture.arrayLength === mipObject.length) {
														for(var index = 0; index < texture._arrayLength; index++){
																var arraySource = mipObject[index];
																if (this.isExternalImage(arraySource)) {
																		this.uploadExternalImage(device, arraySource, mipLevel, index);
																		anyUploads = true;
																} else if (ArrayBuffer.isView(arraySource)) {
																		this.uploadTypedArrayData(device, arraySource, mipLevel, index);
																		anyUploads = true;
																} else ;
														}
												} else {
														anyLevelMissing = true;
												}
										} else {
												if (this.isExternalImage(mipObject)) {
														this.uploadExternalImage(device, mipObject, mipLevel, 0);
														anyUploads = true;
												} else if (ArrayBuffer.isView(mipObject)) {
														this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
														anyUploads = true;
												} else ;
										}
								} else {
										anyLevelMissing = true;
								}
						}
						if (anyUploads && anyLevelMissing && texture.mipmaps && !isCompressedPixelFormat(texture.format) && !isIntegerPixelFormat(texture.format)) {
								device.mipmapRenderer.generate(this);
						}
						if (texture._gpuSize) {
								texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
						}
						texture._gpuSize = texture.gpuSize;
						texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
				}
		}
		isExternalImage(image) {
				return image instanceof ImageBitmap || image instanceof HTMLVideoElement || image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas;
		}
		uploadExternalImage(device, image, mipLevel, index) {
				var src = {
						source: image,
						origin: [
								0,
								0
						],
						flipY: false
				};
				var dst = {
						texture: this.gpuTexture,
						mipLevel: mipLevel,
						origin: [
								0,
								0,
								index
						],
						aspect: 'all'
				};
				var copySize = {
						width: this.desc.size.width,
						height: this.desc.size.height,
						depthOrArrayLayers: 1
				};
				device.submit();
				dummyUse(image instanceof HTMLCanvasElement && image.getContext('2d'));
				device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
		}
		uploadTypedArrayData(device, data, mipLevel, index) {
				var texture = this.texture;
				var wgpu = device.wgpu;
				var dest = {
						texture: this.gpuTexture,
						origin: [
								0,
								0,
								index
						],
						mipLevel: mipLevel
				};
				var width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
				var height = TextureUtils.calcLevelDimension(texture.height, mipLevel);
				TextureUtils.calcLevelGpuSize(width, height, 1, texture.format);
				var formatInfo = pixelFormatInfo.get(texture.format);
				var dataLayout;
				var size;
				if (formatInfo.size) {
						dataLayout = {
								offset: 0,
								bytesPerRow: formatInfo.size * width,
								rowsPerImage: height
						};
						size = {
								width: width,
								height: height
						};
				} else if (formatInfo.blockSize) {
						var blockDim = (size)=>{
								return Math.floor((size + 3) / 4);
						};
						dataLayout = {
								offset: 0,
								bytesPerRow: formatInfo.blockSize * blockDim(width),
								rowsPerImage: blockDim(height)
						};
						size = {
								width: Math.max(4, width),
								height: Math.max(4, height)
						};
				} else ;
				device.submit();
				wgpu.queue.writeTexture(dest, data, dataLayout, size);
		}
		read(x, y, width, height, options) {
				var _options_mipLevel;
				var mipLevel = (_options_mipLevel = options.mipLevel) != null ? _options_mipLevel : 0;
				var _options_face;
				var face = (_options_face = options.face) != null ? _options_face : 0;
				var _options_data;
				var data = (_options_data = options.data) != null ? _options_data : null;
				var _options_immediate;
				var immediate = (_options_immediate = options.immediate) != null ? _options_immediate : false;
				var texture = this.texture;
				var formatInfo = pixelFormatInfo.get(texture.format);
				var bytesPerRow = width * formatInfo.size;
				var paddedBytesPerRow = math.roundUp(bytesPerRow, 256);
				var size = paddedBytesPerRow * height;
				var device = texture.device;
				var stagingBuffer = device.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
				stagingBuffer.allocate(device, size);
				var src = {
						texture: this.gpuTexture,
						mipLevel: mipLevel,
						origin: [
								x,
								y,
								face
						]
				};
				var dst = {
						buffer: stagingBuffer.buffer,
						offset: 0,
						bytesPerRow: paddedBytesPerRow
				};
				var copySize = {
						width,
						height,
						depthOrArrayLayers: 1
				};
				var commandEncoder = device.getCommandEncoder();
				commandEncoder.copyTextureToBuffer(src, dst, copySize);
				return device.readBuffer(stagingBuffer, size, null, immediate).then((temp)=>{
						data != null ? data : data = new Uint8Array(height * bytesPerRow);
						for(var i = 0; i < height; i++){
								var srcOffset = i * paddedBytesPerRow;
								var dstOffset = i * bytesPerRow;
								var sub = temp.subarray(srcOffset, srcOffset + bytesPerRow);
								data.set(sub, dstOffset);
						}
						return data;
				});
		}
		constructor(texture){
				this.samplers = [];
				this.texture = texture;
				this.format = gpuTextureFormats[texture.format];
				this.create(texture.device);
		}
}

export { WebgpuTexture };
