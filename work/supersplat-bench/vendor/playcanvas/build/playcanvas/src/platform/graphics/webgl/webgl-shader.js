import { WebglShaderInput } from './webgl-shader-input.js';
import { semanticToLocation } from '../constants.js';
import { DeviceCache } from '../device-cache.js';

var _vertexShaderBuiltins = new Set([
		'gl_VertexID',
		'gl_InstanceID',
		'gl_DrawID',
		'gl_BaseVertex',
		'gl_BaseInstance'
]);
class CompiledShaderCache {
		destroy(device) {
				this.map.forEach((shader)=>{
						device.gl.deleteShader(shader);
				});
		}
		loseContext(device) {
				this.map.clear();
		}
		constructor(){
				this.map = new Map();
		}
}
var _vertexShaderCache = new DeviceCache();
var _fragmentShaderCache = new DeviceCache();
class WebglShader {
		destroy(shader) {
				if (this.glProgram) {
						shader.device.gl.deleteProgram(this.glProgram);
						this.glProgram = null;
				}
		}
		init() {
				this.uniforms = [];
				this.samplers = [];
				this.attributes = [];
				this.glProgram = null;
				this.glVertexShader = null;
				this.glFragmentShader = null;
		}
		loseContext() {
				this.init();
		}
		restoreContext(device, shader) {
				this.compile(device, shader);
				this.link(device, shader);
		}
		compile(device, shader) {
				var definition = shader.definition;
				this.glVertexShader = this._compileShaderSource(device, definition.vshader, true);
				this.glFragmentShader = this._compileShaderSource(device, definition.fshader, false);
		}
		link(device, shader) {
				if (this.glProgram) {
						return;
				}
				var gl = device.gl;
				if (gl.isContextLost()) {
						return;
				}
				var glProgram = gl.createProgram();
				this.glProgram = glProgram;
				gl.attachShader(glProgram, this.glVertexShader);
				gl.attachShader(glProgram, this.glFragmentShader);
				var definition = shader.definition;
				var attrs = definition.attributes;
				if (definition.useTransformFeedback) {
						var outNames = [];
						for(var attr in attrs){
								if (attrs.hasOwnProperty(attr)) {
										outNames.push("out_" + attr);
								}
						}
						gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
				}
				for(var attr1 in attrs){
						if (attrs.hasOwnProperty(attr1)) {
								var semantic = attrs[attr1];
								var loc = semanticToLocation[semantic];
								gl.bindAttribLocation(glProgram, loc, attr1);
						}
				}
				gl.linkProgram(glProgram);
		}
		_compileShaderSource(device, src, isVertexShader) {
				var gl = device.gl;
				if (gl.isContextLost()) {
						return null;
				}
				var shaderDeviceCache = isVertexShader ? _vertexShaderCache : _fragmentShaderCache;
				var shaderCache = shaderDeviceCache.get(device, ()=>{
						return new CompiledShaderCache();
				});
				var glShader = shaderCache.map.get(src);
				if (!glShader) {
						glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
						gl.shaderSource(glShader, src);
						gl.compileShader(glShader);
						shaderCache.map.set(src, glShader);
				}
				return glShader;
		}
		finalize(device, shader) {
				var gl = device.gl;
				if (gl.isContextLost()) {
						return true;
				}
				var glProgram = this.glProgram;
				var definition = shader.definition;
				var linkStatus = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
				if (!linkStatus) {
						if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, 'vertex')) {
								return false;
						}
						if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, 'fragment')) {
								return false;
						}
						var message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);
						console.error(message);
						return false;
				}
				var numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
				for(var i = 0; i < numAttributes; i++){
						var info = gl.getActiveAttrib(glProgram, i);
						var location = gl.getAttribLocation(glProgram, info.name);
						if (_vertexShaderBuiltins.has(info.name)) {
								continue;
						}
						if (definition.attributes[info.name] === undefined) {
								console.error('Vertex shader attribute "' + info.name + '" is not mapped to a semantic in shader definition, shader [' + shader.label + "]", shader);
								shader.failed = true;
						} else {
								var shaderInput = new WebglShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
								this.attributes.push(shaderInput);
						}
				}
				var samplerTypes = device._samplerTypes;
				var numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
				for(var i1 = 0; i1 < numUniforms; i1++){
						var info1 = gl.getActiveUniform(glProgram, i1);
						var location1 = gl.getUniformLocation(glProgram, info1.name);
						var shaderInput1 = new WebglShaderInput(device, info1.name, device.pcUniformType[info1.type], location1);
						if (samplerTypes.has(info1.type)) {
								this.samplers.push(shaderInput1);
						} else {
								this.uniforms.push(shaderInput1);
						}
				}
				shader.ready = true;
				return true;
		}
		_isCompiled(device, shader, glShader, source, shaderType) {
				var gl = device.gl;
				if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
						var infoLog = gl.getShaderInfoLog(glShader);
						var [code, error] = this._processError(source, infoLog);
						var message = "Failed to compile " + shaderType + " shader:\n\n" + infoLog + "\n" + code + " while rendering " + undefined;
						console.error(message);
						return false;
				}
				return true;
		}
		isLinked(device) {
				var { extParallelShaderCompile } = device;
				if (extParallelShaderCompile) {
						return device.gl.getProgramParameter(this.glProgram, extParallelShaderCompile.COMPLETION_STATUS_KHR);
				}
				return true;
		}
		_processError(src, infoLog) {
				var error = {};
				var code = '';
				if (src) {
						var lines = src.split('\n');
						var from = 0;
						var to = lines.length;
						if (infoLog && infoLog.startsWith('ERROR:')) {
								var match = infoLog.match(/^ERROR:\s(\d+):(\d+):\s*(.+)/);
								if (match) {
										error.message = match[3];
										error.line = parseInt(match[2], 10);
										from = Math.max(0, error.line - 6);
										to = Math.min(lines.length, error.line + 5);
								}
						}
						for(var i = from; i < to; i++){
								code += i + 1 + ":	" + lines[i] + "\n";
						}
						error.source = src;
				}
				return [
						code,
						error
				];
		}
		constructor(shader){
				this.compileDuration = 0;
				this.init();
				this.compile(shader.device, shader);
				this.link(shader.device, shader);
				shader.device.shaders.push(shader);
		}
}

export { WebglShader };
