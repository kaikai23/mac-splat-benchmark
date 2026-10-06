import { SEMANTIC_POSITION, PRIMITIVE_TRISTRIP, SEMANTIC_COLOR } from '../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ImmediateBatches } from './immediate-batches.js';
import { Vec3 } from '../../core/math/vec3.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';

var tempPoints = [];
var vec = new Vec3();
var lineShaderDesc = {
		uniqueName: 'ImmediateLine',
		vertexCode: "\n		attribute vec3 vertex_position;\n		attribute vec4 vertex_color;\n		uniform mat4 matrix_model;\n		uniform mat4 matrix_viewProjection;\n		varying vec4 color;\n		void main(void) {\n			color = vertex_color;\n			gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1);\n		}\n	",
		fragmentCode: '\n		#include "gammaPS"\n		varying vec4 color;\n		void main(void) {\n			gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(color.rgb)), color.a);\n		}\n	',
		attributes: {
				vertex_position: SEMANTIC_POSITION,
				vertex_color: SEMANTIC_COLOR
		}
};
class Immediate {
		createMaterial(depthTest) {
				var material = new ShaderMaterial(lineShaderDesc);
				material.blendType = BLEND_NORMAL;
				material.depthTest = depthTest;
				material.update();
				return material;
		}
		get materialDepth() {
				if (!this._materialDepth) {
						this._materialDepth = this.createMaterial(true);
				}
				return this._materialDepth;
		}
		get materialNoDepth() {
				if (!this._materialNoDepth) {
						this._materialNoDepth = this.createMaterial(false);
				}
				return this._materialNoDepth;
		}
		getBatch(layer, depthTest) {
				var batches = this.batchesMap.get(layer);
				if (!batches) {
						batches = new ImmediateBatches(this.device);
						this.batchesMap.set(layer, batches);
				}
				this.allBatches.add(batches);
				var material = depthTest ? this.materialDepth : this.materialNoDepth;
				return batches.getBatch(material, layer);
		}
		getShaderDesc(id, fragment) {
				if (!this.shaderDescs.has(id)) {
						var vertex = "\n				attribute vec2 vertex_position;\n				uniform mat4 matrix_model;\n				varying vec2 uv0;\n				void main(void) {\n					gl_Position = matrix_model * vec4(vertex_position, 0, 1);\n					uv0 = vertex_position.xy + 0.5;\n				}\n			";
						this.shaderDescs.set(id, {
								uniqueName: "DebugShader:" + id,
								vertexCode: vertex,
								fragmentCode: fragment,
								attributes: {
										vertex_position: SEMANTIC_POSITION
								}
						});
				}
				return this.shaderDescs.get(id);
		}
		getTextureShaderDesc(encoding) {
				var decodeFunc = ChunkUtils.decodeFunc(encoding);
				return this.getShaderDesc("textureShader-" + encoding, '\n			#include "gammaPS"\n			varying vec2 uv0;\n			uniform sampler2D colorMap;\n			void main (void) {\n				vec3 linearColor = ' + decodeFunc + "(texture2D(colorMap, uv0));\n				gl_FragColor = vec4(gammaCorrectOutput(linearColor), 1);\n			}\n		");
		}
		getUnfilterableTextureShaderDesc() {
				return this.getShaderDesc('textureShaderUnfilterable', "\n			varying vec2 uv0;\n			uniform highp sampler2D colorMap;\n			void main (void) {\n				ivec2 uv = ivec2(uv0 * textureSize(colorMap, 0));\n				gl_FragColor = vec4(texelFetch(colorMap, uv, 0).xyz, 1);\n			}\n		");
		}
		getDepthTextureShaderDesc() {
				return this.getShaderDesc('depthTextureShader', "\n			" + shaderChunks.screenDepthPS + '\n			#include "gammaPS"\n			varying vec2 uv0;\n			void main() {\n				float depth = getLinearScreenDepth(getImageEffectUV(uv0)) * camera_params.x;\n				gl_FragColor = vec4(gammaCorrectOutput(vec3(depth)), 1.0);\n			}\n		');
		}
		getQuadMesh() {
				if (!this.quadMesh) {
						this.quadMesh = new Mesh(this.device);
						this.quadMesh.setPositions([
								-0.5,
								-0.5,
								0,
								0.5,
								-0.5,
								0,
								-0.5,
								0.5,
								0,
								0.5,
								0.5,
								0
						]);
						this.quadMesh.update(PRIMITIVE_TRISTRIP);
				}
				return this.quadMesh;
		}
		drawMesh(material, matrix, mesh, meshInstance, layer) {
				if (!meshInstance) {
						var graphNode = this.getGraphNode(matrix);
						meshInstance = new MeshInstance(mesh, material, graphNode);
				}
				var layerMeshInstances = this.layerMeshInstances.get(layer);
				if (!layerMeshInstances) {
						layerMeshInstances = [];
						this.layerMeshInstances.set(layer, layerMeshInstances);
				}
				layerMeshInstances.push(meshInstance);
		}
		drawWireAlignedBox(min, max, color, depthTest, layer, mat) {
				if (mat) {
						var mulPoint = (x, y, z)=>{
								vec.set(x, y, z);
								mat.transformPoint(vec, vec);
								tempPoints.push(vec.x, vec.y, vec.z);
						};
						mulPoint(min.x, min.y, min.z);
						mulPoint(min.x, max.y, min.z);
						mulPoint(min.x, max.y, min.z);
						mulPoint(max.x, max.y, min.z);
						mulPoint(max.x, max.y, min.z);
						mulPoint(max.x, min.y, min.z);
						mulPoint(max.x, min.y, min.z);
						mulPoint(min.x, min.y, min.z);
						mulPoint(min.x, min.y, max.z);
						mulPoint(min.x, max.y, max.z);
						mulPoint(min.x, max.y, max.z);
						mulPoint(max.x, max.y, max.z);
						mulPoint(max.x, max.y, max.z);
						mulPoint(max.x, min.y, max.z);
						mulPoint(max.x, min.y, max.z);
						mulPoint(min.x, min.y, max.z);
						mulPoint(min.x, min.y, min.z);
						mulPoint(min.x, min.y, max.z);
						mulPoint(min.x, max.y, min.z);
						mulPoint(min.x, max.y, max.z);
						mulPoint(max.x, max.y, min.z);
						mulPoint(max.x, max.y, max.z);
						mulPoint(max.x, min.y, min.z);
						mulPoint(max.x, min.y, max.z);
				} else {
						tempPoints.push(min.x, min.y, min.z, min.x, max.y, min.z, min.x, max.y, min.z, max.x, max.y, min.z, max.x, max.y, min.z, max.x, min.y, min.z, max.x, min.y, min.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, max.z, min.x, max.y, max.z, max.x, max.y, max.z, max.x, max.y, max.z, max.x, min.y, max.z, max.x, min.y, max.z, min.x, min.y, max.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, min.z, min.x, max.y, max.z, max.x, max.y, min.z, max.x, max.y, max.z, max.x, min.y, min.z, max.x, min.y, max.z);
				}
				var batch = this.getBatch(layer, depthTest);
				batch.addLinesArrays(tempPoints, color);
				tempPoints.length = 0;
		}
		drawWireSphere(center, radius, color, numSegments, depthTest, layer) {
				var step = 2 * Math.PI / numSegments;
				var angle = 0;
				for(var i = 0; i < numSegments; i++){
						var sin0 = Math.sin(angle);
						var cos0 = Math.cos(angle);
						angle += step;
						var sin1 = Math.sin(angle);
						var cos1 = Math.cos(angle);
						tempPoints.push(center.x + radius * sin0, center.y, center.z + radius * cos0);
						tempPoints.push(center.x + radius * sin1, center.y, center.z + radius * cos1);
						tempPoints.push(center.x + radius * sin0, center.y + radius * cos0, center.z);
						tempPoints.push(center.x + radius * sin1, center.y + radius * cos1, center.z);
						tempPoints.push(center.x, center.y + radius * sin0, center.z + radius * cos0);
						tempPoints.push(center.x, center.y + radius * sin1, center.z + radius * cos1);
				}
				var batch = this.getBatch(layer, depthTest);
				batch.addLinesArrays(tempPoints, color);
				tempPoints.length = 0;
		}
		getGraphNode(matrix) {
				var graphNode = new GraphNode('ImmediateDebug');
				graphNode.worldTransform = matrix;
				graphNode._dirtyWorld = graphNode._dirtyNormal = false;
				return graphNode;
		}
		onPreRenderLayer(layer, visibleList, transparent) {
				this.batchesMap.forEach((batches, batchLayer)=>{
						if (batchLayer === layer) {
								batches.onPreRender(visibleList, transparent);
						}
				});
				if (!this.updatedLayers.has(layer)) {
						this.updatedLayers.add(layer);
						var meshInstances = this.layerMeshInstances.get(layer);
						if (meshInstances) {
								for(var i = 0; i < meshInstances.length; i++){
										visibleList.push(meshInstances[i]);
								}
								meshInstances.length = 0;
						}
				}
		}
		onPostRender() {
				this.allBatches.forEach((batch)=>batch.clear());
				this.allBatches.clear();
				this.updatedLayers.clear();
		}
		constructor(device){
				this.shaderDescs = new Map();
				this.device = device;
				this.quadMesh = null;
				this.textureShader = null;
				this.depthTextureShader = null;
				this.cubeLocalPos = null;
				this.cubeWorldPos = null;
				this.batchesMap = new Map();
				this.allBatches = new Set();
				this.updatedLayers = new Set();
				this._materialDepth = null;
				this._materialNoDepth = null;
				this.layerMeshInstances = new Map();
		}
}

export { Immediate };
