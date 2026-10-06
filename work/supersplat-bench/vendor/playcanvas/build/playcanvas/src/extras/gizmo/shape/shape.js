import { Color } from '../../../core/math/color.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Entity } from '../../../framework/entity.js';
import { CULLFACE_BACK, SEMANTIC_POSITION, SEMANTIC_COLOR } from '../../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../../scene/constants.js';
import { COLOR_GRAY } from '../color.js';
import { Mesh } from '../../../scene/mesh.js';
import { Geometry } from '../../../scene/geometry/geometry.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { ConeGeometry } from '../../../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../../../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { Mat4 } from '../../../core/math/mat4.js';

var SHADING_DAMP_SCALE = 0.25;
var SHADING_DAMP_OFFSET = 0.75;
var LIGHT_DIR = new Vec3(1, 2, 3);
var GEOMETRIES = {
		box: BoxGeometry,
		cone: ConeGeometry,
		cylinder: CylinderGeometry,
		plane: PlaneGeometry,
		sphere: SphereGeometry,
		torus: TorusGeometry
};
var shaderDesc = {
		uniqueName: 'axis-shape',
		attributes: {
				vertex_position: SEMANTIC_POSITION,
				vertex_color: SEMANTIC_COLOR
		},
		vertexCode: "\n		attribute vec3 vertex_position;\n		attribute vec4 vertex_color;\n		varying vec4 vColor;\n		uniform mat4 matrix_model;\n		uniform mat4 matrix_viewProjection;\n		void main(void) {\n			gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);\n			gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));\n			vColor = vertex_color;\n		}\n	",
		fragmentCode: '\n		#include "gammaPS"\n		precision highp float;\n		varying vec4 vColor;\n		void main(void) {\n			gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(vColor)), vColor.w);\n		}\n	'
};
var shadingMeshMap = new Map();
var tmpV1 = new Vec3();
var tmpV2 = new Vec3();
var tmpM1 = new Mat4();
var tmpG = new Geometry();
tmpG.positions = [];
tmpG.normals = [];
var applyShadowColor = (geom, color, transform)=>{
		if (!geom.normals || !geom.positions) {
				return [];
		}
		var localLightDir;
		if (transform) {
				localLightDir = tmpM1.copy(transform).invert().transformVector(tmpV1.copy(LIGHT_DIR), tmpV1).normalize();
		}
		geom.colors = [];
		var shading = [];
		var numVertices = geom.positions.length / 3;
		for(var i = 0; i < numVertices; i++){
				var strength = 1;
				if (localLightDir) {
						var x = geom.normals[i * 3];
						var y = geom.normals[i * 3 + 1];
						var z = geom.normals[i * 3 + 2];
						var normal = tmpV2.set(x, y, z);
						var dot = localLightDir.dot(normal);
						strength = dot * SHADING_DAMP_SCALE + SHADING_DAMP_OFFSET;
				}
				shading.push(strength);
				geom.colors.push(strength * color.r * 0xFF, strength * color.g * 0xFF, strength * color.b * 0xFF, color.a * 0xFF);
		}
		return shading;
};
var setMeshColor = (mesh, color)=>{
		var shading = shadingMeshMap.get(mesh);
		var colors = [];
		for(var i = 0; i < shading.length; i++){
				colors.push(shading[i] * color.r * 0xFF, shading[i] * color.g * 0xFF, shading[i] * color.b * 0xFF, color.a * 0xFF);
		}
		mesh.setColors32(colors);
		mesh.update();
};
class Shape {
		set disabled(value) {
				for(var i = 0; i < this.meshInstances.length; i++){
						setMeshColor(this.meshInstances[i].mesh, value ? this._disabledColor : this._defaultColor);
				}
				this._disabled = value != null ? value : false;
		}
		get disabled() {
				return this._disabled;
		}
		set shading(value) {
				this._shading = value != null ? value : true;
				var color = this._disabled ? this._disabledColor : this._defaultColor;
				for(var i = 0; i < this.meshInstances.length; i++){
						var mesh = this.meshInstances[i].mesh;
						mesh.getPositions(tmpG.positions);
						mesh.getNormals(tmpG.normals);
						var shadow = applyShadowColor(tmpG, color, this._shading ? this.entity.getWorldTransform() : undefined);
						shadingMeshMap.set(mesh, shadow);
						setMeshColor(mesh, color);
				}
		}
		get shading() {
				return this._shading;
		}
		_createRoot(name) {
				this.entity = new Entity(name + ":" + this.axis);
				this.entity.setLocalPosition(this._position);
				this.entity.setLocalEulerAngles(this._rotation);
				this.entity.setLocalScale(this._scale);
		}
		_createMesh(geom, shading) {
				if (shading === undefined) shading = true;
				var color = this._disabled ? this._disabledColor : this._defaultColor;
				var shadow = applyShadowColor(geom, color, shading ? this.entity.getWorldTransform() : undefined);
				var mesh = Mesh.fromGeometry(this.device, geom);
				shadingMeshMap.set(mesh, shadow);
				return mesh;
		}
		_createRenderComponent(entity, meshes) {
				var material = new ShaderMaterial(shaderDesc);
				material.cull = this._cull;
				material.blendType = BLEND_NORMAL;
				material.update();
				var meshInstances = [];
				for(var i = 0; i < meshes.length; i++){
						var mi = new MeshInstance(meshes[i], material);
						mi.cull = false;
						meshInstances.push(mi);
						this.meshInstances.push(mi);
				}
				entity.addComponent('render', {
						meshInstances: meshInstances,
						layers: this._layers,
						castShadows: false
				});
		}
		_addRenderMesh(entity, type, shading) {
				var _$Geometry = GEOMETRIES[type];
				if (!_$Geometry) {
						throw new Error('Invalid primitive type.');
				}
				this._createRenderComponent(entity, [
						this._createMesh(new _$Geometry(), shading)
				]);
		}
		hover(state) {
				if (this._disabled) {
						return;
				}
				for(var i = 0; i < this.meshInstances.length; i++){
						var color = state ? this._hoverColor : this._defaultColor;
						var mesh = this.meshInstances[i].mesh;
						setMeshColor(mesh, color);
				}
		}
		destroy() {
				this.entity.destroy();
		}
		constructor(device, options){
				this._layers = [];
				this._shading = true;
				this._defaultColor = Color.WHITE;
				this._hoverColor = Color.BLACK;
				this._disabledColor = COLOR_GRAY;
				this._cull = CULLFACE_BACK;
				this.triData = [];
				this.meshInstances = [];
				this.device = device;
				var _options_axis;
				this.axis = (_options_axis = options.axis) != null ? _options_axis : 'x';
				var _options_position;
				this._position = (_options_position = options.position) != null ? _options_position : new Vec3();
				var _options_rotation;
				this._rotation = (_options_rotation = options.rotation) != null ? _options_rotation : new Vec3();
				var _options_scale;
				this._scale = (_options_scale = options.scale) != null ? _options_scale : new Vec3(1, 1, 1);
				var _options_disabled;
				this._disabled = (_options_disabled = options.disabled) != null ? _options_disabled : false;
				var _options_layers;
				this._layers = (_options_layers = options.layers) != null ? _options_layers : this._layers;
				var _options_shading;
				this._shading = (_options_shading = options.shading) != null ? _options_shading : this._shading;
				if (options.defaultColor instanceof Color) {
						this._defaultColor = options.defaultColor;
				}
				if (options.hoverColor instanceof Color) {
						this._hoverColor = options.hoverColor;
				}
				if (options.disabledColor instanceof Color) {
						this._disabledColor = options.disabledColor;
				}
		}
}

export { Shape };
