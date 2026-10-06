import { TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT, SHADERSTAGE_COMPUTE, PIXELFORMAT_RGBA8, SAMPLETYPE_UINT, SAMPLETYPE_INT, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_2D_ARRAY } from './constants.js';

var id = 0;
var textureDimensionInfo = {
		[TEXTUREDIMENSION_2D]: 'texture2D',
		[TEXTUREDIMENSION_CUBE]: 'textureCube',
		[TEXTUREDIMENSION_3D]: 'texture3D',
		[TEXTUREDIMENSION_2D_ARRAY]: 'texture2DArray'
};
class BindBaseFormat {
		constructor(name, visibility){
				this.slot = -1;
				this.scopeId = null;
				this.name = name;
				this.visibility = visibility;
		}
}
class BindUniformBufferFormat extends BindBaseFormat {
}
class BindStorageBufferFormat extends BindBaseFormat {
		constructor(name, visibility, readOnly = false){
				super(name, visibility), this.format = '';
				this.readOnly = readOnly;
		}
}
class BindTextureFormat extends BindBaseFormat {
		constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT, hasSampler = true, samplerName = null){
				super(name, visibility);
				this.textureDimension = textureDimension;
				this.sampleType = sampleType;
				this.hasSampler = hasSampler;
				this.samplerName = samplerName != null ? samplerName : "" + name + "_sampler";
		}
}
class BindStorageTextureFormat extends BindBaseFormat {
		constructor(name, format = PIXELFORMAT_RGBA8, textureDimension = TEXTUREDIMENSION_2D, write = true, read = false){
				super(name, SHADERSTAGE_COMPUTE);
				this.format = format;
				this.textureDimension = textureDimension;
				this.write = write;
				this.read = read;
		}
}
class BindGroupFormat {
		destroy() {
				this.impl.destroy();
		}
		getTexture(name) {
				var index = this.textureFormatsMap.get(name);
				if (index !== undefined) {
						return this.textureFormats[index];
				}
				return null;
		}
		getStorageTexture(name) {
				var index = this.storageTextureFormatsMap.get(name);
				if (index !== undefined) {
						return this.storageTextureFormats[index];
				}
				return null;
		}
		getShaderDeclarationTextures(bindGroup) {
				var code = '';
				this.textureFormats.forEach((format)=>{
						var textureType = textureDimensionInfo[format.textureDimension];
						var isArray = textureType === 'texture2DArray';
						var sampleTypePrefix = format.sampleType === SAMPLETYPE_UINT ? 'u' : format.sampleType === SAMPLETYPE_INT ? 'i' : '';
						textureType = "" + sampleTypePrefix + textureType;
						var namePostfix = '';
						var extraCode = '';
						if (isArray) {
								namePostfix = '_texture';
								extraCode = "#define " + format.name + " " + sampleTypePrefix + "sampler2DArray(" + format.name + namePostfix + ", " + format.name + "_sampler)\n";
						}
						code += "layout(set = " + bindGroup + ", binding = " + format.slot + ") uniform " + textureType + " " + format.name + namePostfix + ";\n";
						if (format.hasSampler) {
								code += "layout(set = " + bindGroup + ", binding = " + (format.slot + 1) + ") uniform sampler " + format.name + "_sampler;\n";
						}
						code += extraCode;
				});
				return code;
		}
		loseContext() {}
		constructor(graphicsDevice, formats){
				this.uniformBufferFormats = [];
				this.textureFormats = [];
				this.storageTextureFormats = [];
				this.storageBufferFormats = [];
				this.id = id++;
				var slot = 0;
				formats.forEach((format)=>{
						format.slot = slot++;
						if (format instanceof BindTextureFormat && format.hasSampler) {
								slot++;
						}
						if (format instanceof BindUniformBufferFormat) {
								this.uniformBufferFormats.push(format);
						} else if (format instanceof BindTextureFormat) {
								this.textureFormats.push(format);
						} else if (format instanceof BindStorageTextureFormat) {
								this.storageTextureFormats.push(format);
						} else if (format instanceof BindStorageBufferFormat) {
								this.storageBufferFormats.push(format);
						} else ;
				});
				this.device = graphicsDevice;
				var scope = graphicsDevice.scope;
				this.bufferFormatsMap = new Map();
				this.uniformBufferFormats.forEach((bf, i)=>this.bufferFormatsMap.set(bf.name, i));
				this.textureFormatsMap = new Map();
				this.textureFormats.forEach((tf, i)=>{
						this.textureFormatsMap.set(tf.name, i);
						tf.scopeId = scope.resolve(tf.name);
				});
				this.storageTextureFormatsMap = new Map();
				this.storageTextureFormats.forEach((tf, i)=>{
						this.storageTextureFormatsMap.set(tf.name, i);
						tf.scopeId = scope.resolve(tf.name);
				});
				this.storageBufferFormatsMap = new Map();
				this.storageBufferFormats.forEach((bf, i)=>{
						this.storageBufferFormatsMap.set(bf.name, i);
						bf.scopeId = scope.resolve(bf.name);
				});
				this.impl = graphicsDevice.createBindGroupFormatImpl(this);
		}
}

export { BindGroupFormat, BindStorageBufferFormat, BindStorageTextureFormat, BindTextureFormat, BindUniformBufferFormat };
