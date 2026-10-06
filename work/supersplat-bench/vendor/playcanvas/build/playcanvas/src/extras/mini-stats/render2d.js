import { SEMANTIC_POSITION, TYPE_FLOAT32, SEMANTIC_TEXCOORD0, BUFFER_STREAM, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, CULLFACE_NONE, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { GraphNode } from '../../scene/graph-node.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';

var vertexShader = "\nattribute vec3 vertex_position;\nattribute vec4 vertex_texCoord0;\nvarying vec4 uv0;\nvarying float wordFlag;\nvoid main(void) {\n	gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);\n	uv0 = vertex_texCoord0;\n	wordFlag = vertex_position.z;\n}";
var fragmentShader = "\nvarying vec4 uv0;\nvarying float wordFlag;\nuniform vec4 clr;\nuniform sampler2D graphTex;\nuniform sampler2D wordsTex;\nvoid main (void) {\n	vec4 graphSample = texture2D(graphTex, uv0.xy);\n	vec4 graph;\n	if (uv0.w < graphSample.r)\n		graph = vec4(0.7, 0.2, 0.2, 1.0);\n	else if (uv0.w < graphSample.g)\n		graph = vec4(0.2, 0.7, 0.2, 1.0);\n	else if (uv0.w < graphSample.b)\n		graph = vec4(0.2, 0.2, 0.7, 1.0);\n	else\n		graph = vec4(0.0, 0.0, 0.0, 1.0 - 0.25 * sin(uv0.w * 3.14159));\n	vec4 words = texture2D(wordsTex, vec2(uv0.x, 1.0 - uv0.y));\n	gl_FragColor = mix(graph, words, wordFlag) * clr;\n}";
class Render2d {
		quad(x, y, w, h, u, v, uw, uh, texture, wordFlag) {
				if (wordFlag === undefined) wordFlag = 0;
				var rw = this.targetSize.width;
				var rh = this.targetSize.height;
				var x0 = x / rw;
				var y0 = y / rh;
				var x1 = (x + w) / rw;
				var y1 = (y + h) / rh;
				var tw = texture.width;
				var th = texture.height;
				var u0 = u / tw;
				var v0 = v / th;
				var u1 = (u + (uw != null ? uw : w)) / tw;
				var v1 = (v + (uh != null ? uh : h)) / th;
				this.data.set([
						x0,
						y0,
						wordFlag,
						u0,
						v0,
						0,
						0,
						x1,
						y0,
						wordFlag,
						u1,
						v0,
						1,
						0,
						x1,
						y1,
						wordFlag,
						u1,
						v1,
						1,
						1,
						x0,
						y1,
						wordFlag,
						u0,
						v1,
						0,
						1
				], 4 * 7 * this.quads);
				this.quads++;
				this.prim.count += 6;
		}
		startFrame() {
				this.quads = 0;
				this.prim.count = 0;
				this.targetSize.width = this.device.canvas.scrollWidth;
				this.targetSize.height = this.device.canvas.scrollHeight;
		}
		render(app, layer, graphTexture, wordsTexture, clr, height) {
				this.buffer.setData(this.data.buffer);
				this.uniforms.clr.set(clr, 0);
				this.material.setParameter('clr', this.uniforms.clr);
				this.material.setParameter('graphTex', graphTexture);
				this.material.setParameter('wordsTex', wordsTexture);
				app.drawMeshInstance(this.meshInstance, layer);
		}
		constructor(device, maxQuads = 512){
				var format = new VertexFormat(device, [
						{
								semantic: SEMANTIC_POSITION,
								components: 3,
								type: TYPE_FLOAT32
						},
						{
								semantic: SEMANTIC_TEXCOORD0,
								components: 4,
								type: TYPE_FLOAT32
						}
				]);
				var indices = new Uint16Array(maxQuads * 6);
				for(var i = 0; i < maxQuads; ++i){
						indices[i * 6 + 0] = i * 4;
						indices[i * 6 + 1] = i * 4 + 1;
						indices[i * 6 + 2] = i * 4 + 2;
						indices[i * 6 + 3] = i * 4;
						indices[i * 6 + 4] = i * 4 + 2;
						indices[i * 6 + 5] = i * 4 + 3;
				}
				this.device = device;
				this.buffer = new VertexBuffer(device, format, maxQuads * 4, {
						usage: BUFFER_STREAM
				});
				this.data = new Float32Array(this.buffer.numBytes / 4);
				this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT16, maxQuads * 6, BUFFER_STATIC, indices);
				this.prim = {
						type: PRIMITIVE_TRIANGLES,
						indexed: true,
						base: 0,
						count: 0
				};
				this.quads = 0;
				this.mesh = new Mesh(device);
				this.mesh.vertexBuffer = this.buffer;
				this.mesh.indexBuffer[0] = this.indexBuffer;
				this.mesh.primitive = [
						this.prim
				];
				var material = new ShaderMaterial({
						uniqueName: 'MiniStats',
						vertexCode: vertexShader,
						fragmentCode: fragmentShader
				});
				this.material = material;
				material.cull = CULLFACE_NONE;
				material.depthState = DepthState.NODEPTH;
				material.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
				material.update();
				this.meshInstance = new MeshInstance(this.mesh, material, new GraphNode('MiniStatsMesh'));
				this.uniforms = {
						clr: new Float32Array(4)
				};
				this.targetSize = {
						width: device.width,
						height: device.height
				};
		}
}

export { Render2d };
