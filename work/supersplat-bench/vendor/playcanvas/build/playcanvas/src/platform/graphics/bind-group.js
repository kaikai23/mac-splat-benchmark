import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { getBuiltInTexture } from './built-in-textures.js';

var id = 0;
class DynamicBindGroup {
		constructor(){
				this.offsets = [];
		}
}
class BindGroup {
		destroy() {
				this.impl.destroy();
				this.impl = null;
				this.format = null;
				this.defaultUniformBuffer = null;
		}
		setUniformBuffer(name, uniformBuffer) {
				var index = this.format.bufferFormatsMap.get(name);
				if (this.uniformBuffers[index] !== uniformBuffer) {
						this.uniformBuffers[index] = uniformBuffer;
						this.dirty = true;
				}
		}
		setStorageBuffer(name, storageBuffer) {
				var index = this.format.storageBufferFormatsMap.get(name);
				if (this.storageBuffers[index] !== storageBuffer) {
						this.storageBuffers[index] = storageBuffer;
						this.dirty = true;
				}
		}
		setTexture(name, texture) {
				var index = this.format.textureFormatsMap.get(name);
				if (this.textures[index] !== texture) {
						this.textures[index] = texture;
						this.dirty = true;
				} else if (this.renderVersionUpdated < texture.renderVersionDirty) {
						this.dirty = true;
				}
		}
		setStorageTexture(name, texture) {
				var index = this.format.storageTextureFormatsMap.get(name);
				if (this.storageTextures[index] !== texture) {
						this.storageTextures[index] = texture;
						this.dirty = true;
				} else if (this.renderVersionUpdated < texture.renderVersionDirty) {
						this.dirty = true;
				}
		}
		updateUniformBuffers() {
				for(var i = 0; i < this.uniformBuffers.length; i++){
						this.uniformBuffers[i].update();
				}
		}
		update() {
				var { textureFormats, storageTextureFormats, storageBufferFormats } = this.format;
				for(var i = 0; i < textureFormats.length; i++){
						var textureFormat = textureFormats[i];
						var value = textureFormat.scopeId.value;
						if (!value) {
								if (textureFormat.name === 'uSceneDepthMap') {
										value = getBuiltInTexture(this.device, 'white');
								}
								if (textureFormat.name === 'uSceneColorMap') {
										value = getBuiltInTexture(this.device, 'pink');
								}
								if (!value) {
										value = getBuiltInTexture(this.device, 'pink');
								}
						}
						this.setTexture(textureFormat.name, value);
				}
				for(var i1 = 0; i1 < storageTextureFormats.length; i1++){
						var storageTextureFormat = storageTextureFormats[i1];
						var value1 = storageTextureFormat.scopeId.value;
						this.setStorageTexture(storageTextureFormat.name, value1);
				}
				for(var i2 = 0; i2 < storageBufferFormats.length; i2++){
						var storageBufferFormat = storageBufferFormats[i2];
						var value2 = storageBufferFormat.scopeId.value;
						this.setStorageBuffer(storageBufferFormat.name, value2);
				}
				this.uniformBufferOffsets.length = this.uniformBuffers.length;
				for(var i3 = 0; i3 < this.uniformBuffers.length; i3++){
						var uniformBuffer = this.uniformBuffers[i3];
						this.uniformBufferOffsets[i3] = uniformBuffer.offset;
						if (this.renderVersionUpdated < uniformBuffer.renderVersionDirty) {
								this.dirty = true;
						}
				}
				if (this.dirty) {
						this.dirty = false;
						this.renderVersionUpdated = this.device.renderVersion;
						this.impl.update(this);
				}
		}
		constructor(graphicsDevice, format, defaultUniformBuffer){
				this.renderVersionUpdated = -1;
				this.uniformBufferOffsets = [];
				this.id = id++;
				this.device = graphicsDevice;
				this.format = format;
				this.dirty = true;
				this.impl = graphicsDevice.createBindGroupImpl(this);
				this.textures = [];
				this.storageTextures = [];
				this.storageBuffers = [];
				this.uniformBuffers = [];
				this.defaultUniformBuffer = defaultUniformBuffer;
				if (defaultUniformBuffer) {
						this.setUniformBuffer(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, defaultUniformBuffer);
				}
		}
}

export { BindGroup, DynamicBindGroup };
