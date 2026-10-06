import { hashCode } from '../../core/hash.js';
import { version, revision } from '../../core/core.js';
import { Shader } from '../../platform/graphics/shader.js';
import { SHADER_DEPTH, SHADER_PICK, SHADER_PREPASS, SHADER_FORWARD, SHADER_SHADOW } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { StandardMaterialOptions } from '../materials/standard-material-options.js';
import { CameraShaderParams } from '../camera-shader-params.js';

class ProgramLibrary {
		destroy() {
				this.clearCache();
		}
		register(name, generator) {
				if (!this._generators.has(name)) {
						this._generators.set(name, generator);
				}
		}
		unregister(name) {
				if (this._generators.has(name)) {
						this._generators.delete(name);
				}
		}
		isRegistered(name) {
				return this._generators.has(name);
		}
		generateShaderDefinition(generator, name, key, options) {
				var def = this.definitionsCache.get(key);
				if (!def) {
						var _options_litOptions, _options_litOptions1;
						var lights;
						if ((_options_litOptions = options.litOptions) == null ? undefined : _options_litOptions.lights) {
								lights = options.litOptions.lights;
								options.litOptions.lights = lights.map((l)=>{
										var lcopy = l.clone ? l.clone() : l;
										lcopy.key = l.key;
										return lcopy;
								});
						}
						this.storeNewProgram(name, options);
						if ((_options_litOptions1 = options.litOptions) == null ? undefined : _options_litOptions1.lights) {
								options.litOptions.lights = lights;
						}
						if (this._precached) ;
						var device = this._device;
						def = generator.createShaderDefinition(device, options);
						var _def_name;
						def.name = (_def_name = def.name) != null ? _def_name : options.pass ? name + "-pass:" + options.pass : name;
						this.definitionsCache.set(key, def);
				}
				return def;
		}
		getCachedShader(key) {
				return this.processedCache.get(key);
		}
		setCachedShader(key, shader) {
				this.processedCache.set(key, shader);
		}
		getProgram(name, options, processingOptions, userMaterialId) {
				var generator = this._generators.get(name);
				if (!generator) {
						return null;
				}
				var generationKeyString = generator.generateKey(options);
				var generationKey = hashCode(generationKeyString);
				var processingKeyString = processingOptions.generateKey(this._device);
				var processingKey = hashCode(processingKeyString);
				var totalKey = generationKey + "#" + processingKey;
				var processedShader = this.getCachedShader(totalKey);
				if (!processedShader) {
						var generatedShaderDef = this.generateShaderDefinition(generator, name, generationKey, options);
						var passName = '';
						var shaderPassInfo;
						if (options.pass !== undefined) {
								shaderPassInfo = ShaderPass.get(this._device).getByIndex(options.pass);
								passName = "-" + shaderPassInfo.name;
						}
						this._device.fire('shader:generate', {
								userMaterialId,
								shaderPassInfo,
								definition: generatedShaderDef
						});
						var shaderDefinition = {
								name: "" + generatedShaderDef.name + passName + "-proc",
								attributes: generatedShaderDef.attributes,
								vshader: generatedShaderDef.vshader,
								vincludes: generatedShaderDef.vincludes,
								fincludes: generatedShaderDef.fincludes,
								fshader: generatedShaderDef.fshader,
								processingOptions: processingOptions,
								shaderLanguage: generatedShaderDef.shaderLanguage,
								meshUniformBufferFormat: generatedShaderDef.meshUniformBufferFormat,
								meshBindGroupFormat: generatedShaderDef.meshBindGroupFormat
						};
						processedShader = new Shader(this._device, shaderDefinition);
						this.setCachedShader(totalKey, processedShader);
				}
				return processedShader;
		}
		storeNewProgram(name, options) {
				var opt = {};
				if (name === 'standard') {
						var defaultMat = this._getDefaultStdMatOptions(options.pass);
						for(var p in options){
								if (options.hasOwnProperty(p) && defaultMat[p] !== options[p] || p === 'pass') {
										opt[p] = options[p];
								}
						}
						for(var p1 in options.litOptions){
								opt[p1] = options.litOptions[p1];
						}
				} else {
						opt = options;
				}
				this._programsCollection.push(JSON.stringify({
						name: name,
						options: opt
				}));
		}
		dumpPrograms() {
				var text = 'let device = pc.app ? pc.app.graphicsDevice : pc.Application.getApplication().graphicsDevice;\n';
				text += 'let shaders = [';
				if (this._programsCollection[0]) {
						text += "\n	" + this._programsCollection[0];
				}
				for(var i = 1; i < this._programsCollection.length; ++i){
						text += ",\n	" + this._programsCollection[i];
				}
				text += '\n];\n';
				text += 'pc.getProgramLibrary(device).precompile(shaders);\n';
				text += 'if (pc.version != "' + version + '" || pc.revision != "' + revision + '")\n';
				text += '\tconsole.warn(\"precompile-shaders.js: engine version mismatch, rebuild shaders lib with current engine\");';
				var element = document.createElement('a');
				element.setAttribute('href', "data:text/plain;charset=utf-8," + encodeURIComponent(text));
				element.setAttribute('download', 'precompile-shaders.js');
				element.style.display = 'none';
				document.body.appendChild(element);
				element.click();
				document.body.removeChild(element);
		}
		clearCache() {
				this._isClearingCache = true;
				this.processedCache.forEach((shader)=>{
						shader.destroy();
				});
				this.processedCache.clear();
				this._isClearingCache = false;
		}
		removeFromCache(shader) {
				if (this._isClearingCache) {
						return;
				}
				this.processedCache.forEach((cachedShader, key)=>{
						if (shader === cachedShader) {
								this.processedCache.delete(key);
						}
				});
		}
		_getDefaultStdMatOptions(pass) {
				var shaderPassInfo = ShaderPass.get(this._device).getByIndex(pass);
				return pass === SHADER_DEPTH || pass === SHADER_PICK || pass === SHADER_PREPASS || shaderPassInfo.isShadow ? this._defaultStdMatOptionMin : this._defaultStdMatOption;
		}
		precompile(cache) {
				if (cache) {
						var shaders = new Array(cache.length);
						for(var i = 0; i < cache.length; i++){
								if (cache[i].name === 'standard') {
										var opt = cache[i].options;
										var defaultMat = this._getDefaultStdMatOptions(opt.pass);
										for(var p in defaultMat){
												if (defaultMat.hasOwnProperty(p) && opt[p] === undefined) {
														opt[p] = defaultMat[p];
												}
										}
								}
								shaders[i] = this.getProgram(cache[i].name, cache[i].options);
						}
				}
				this._precached = true;
		}
		constructor(device, standardMaterial){
				this.processedCache = new Map();
				this.definitionsCache = new Map();
				this._generators = new Map();
				this._device = device;
				this._isClearingCache = false;
				this._precached = false;
				this._programsCollection = [];
				this._defaultStdMatOption = new StandardMaterialOptions();
				this._defaultStdMatOptionMin = new StandardMaterialOptions();
				var defaultCameraShaderParams = new CameraShaderParams();
				standardMaterial.shaderOptBuilder.updateRef(this._defaultStdMatOption, {}, defaultCameraShaderParams, standardMaterial, null, [], SHADER_FORWARD, null);
				standardMaterial.shaderOptBuilder.updateMinRef(this._defaultStdMatOptionMin, {}, standardMaterial, null, SHADER_SHADOW, null);
				device.on('destroy:shader', (shader)=>{
						this.removeFromCache(shader);
				});
		}
}

export { ProgramLibrary };
