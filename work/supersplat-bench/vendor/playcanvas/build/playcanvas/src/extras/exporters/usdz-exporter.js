import { CoreExporter } from './core-exporter.js';
import { zipSync, strToU8 } from '../../../modules/fflate/esm/browser.js';
import { Color } from '../../core/math/color.js';
import { SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1 } from '../../platform/graphics/constants.js';

var ROOT_FILE_NAME = 'root';
var header = '#usda 1.0\n(\n    customLayerData = {\n        string creator = "PlayCanvas UsdzExporter"\n    }\n    metersPerUnit = 1\n    upAxis = "Y"\n)\n';
var materialListTemplate = (materials)=>'\ndef "Materials"\n{\n    ' + materials.join('\n') + "\n}\n";
var meshTemplate = (faceVertexCounts, indices, normals, positions, uv0, uv1)=>'\ndef "Mesh"\n{\n    def Mesh "Mesh"\n    {\n        int[] faceVertexCounts = [' + faceVertexCounts + "]\n        int[] faceVertexIndices = [" + indices + "]\n        normal3f[] normals = [" + normals + '] (\n            interpolation = "vertex"\n        )\n        point3f[] points = [' + positions + "]\n        texCoord2f[] primvars:st = [" + uv0 + '] (\n            interpolation = "vertex"\n        )\n        texCoord2f[] primvars:st1 = [' + uv1 + '] (\n            interpolation = "vertex"\n        )\n        uniform token subdivisionScheme = "none"\n    }\n}\n';
var meshInstanceTemplate = (nodeName, meshRefPath, worldMatrix, materialRefPath)=>'\ndef Xform "' + nodeName + '" (\n    prepend references = ' + meshRefPath + "\n)\n{\n    matrix4d xformOp:transform = " + worldMatrix + '\n    uniform token[] xformOpOrder = ["xformOp:transform"]\n\n    rel material:binding = ' + materialRefPath + "\n}\n";
var materialValueTemplate = (type, name, value)=>"                    " + type + " inputs:" + name + " = " + value;
class UsdzExporter extends CoreExporter {
		init() {
				this.meshMap = new Map();
				this.textureMap = new Map();
				this.materialMap = new Map();
				this.materials = [];
				this.files = {};
				this.nodeNames = new Set();
		}
		done() {
				this.meshMap = null;
				this.textureMap = null;
				this.materialMap = null;
				this.materials = null;
				this.files = null;
				this.nodeNames = null;
		}
		build(entity, options) {
				var _this, _loop = function(i) {
						var mimeType = 'image/png' ;
						var texture = textureArray[i];
						var texturePromise = _this.textureToCanvas(texture, textureOptions).then((canvas)=>{
								if (canvas) {
										return new Promise((resolve)=>canvas.toBlob(resolve, mimeType, 1)).then((blob)=>blob.arrayBuffer());
								}
								console.warn("Export of texture " + texture.name + " is not currently supported.");
								return new Promise((resolve)=>resolve(null));
						});
						promises.push(texturePromise);
				};
				if (options === undefined) options = {};
				this.init();
				this.addFile(null, ROOT_FILE_NAME);
				var allMeshInstances = [];
				if (entity) {
						var renders = entity.findComponents('render');
						renders.forEach((render)=>{
								allMeshInstances.push(...render.meshInstances);
						});
				}
				var rootContent = '';
				allMeshInstances.forEach((meshInstance)=>{
						rootContent += this.buildMeshInstance(meshInstance);
				});
				rootContent += materialListTemplate(this.materials);
				this.addFile(null, ROOT_FILE_NAME, '', rootContent);
				var textureOptions = {
						maxTextureSize: options.maxTextureSize
				};
				var textureArray = Array.from(this.textureMap.keys());
				var promises = [];
				for(var i = 0; i < textureArray.length; i++)_this = this, _loop(i);
				var finalData = Promise.all(promises).then((values)=>{
						values.forEach((textureArrayBuffer, index)=>{
								var texture = textureArray[index];
								var ids = this.getTextureFileIds(texture);
								this.files[ids.fileName] = new Uint8Array(textureArrayBuffer);
						});
						this.alignFiles();
						var arraybuffer = zipSync(this.files, {
								level: 0
						});
						this.done();
						return arraybuffer;
				});
				return finalData;
		}
		alignFiles() {
				var offset = 0;
				for(var filename in this.files){
						var file = this.files[filename];
						var headerSize = 34 + filename.length;
						offset += headerSize;
						var offsetMod64 = offset & 63;
						if (offsetMod64 !== 4) {
								var padLength = 64 - offsetMod64;
								var padding = new Uint8Array(padLength);
								this.files[filename] = [
										file,
										{
												extra: {
														12345: padding
												}
										}
								];
						}
						offset = file.length;
				}
		}
		getFileIds(category, name, ref, extension) {
				if (extension === undefined) extension = 'usda';
				var fileName = "" + (category ? "" + category + "/" : '') + name + "." + extension;
				var refName = "@./" + fileName + "@</" + ref + ">";
				return {
						name,
						fileName,
						refName
				};
		}
		getTextureFileIds(texture) {
				return this.getFileIds('texture', "Texture_" + texture.id, 'Texture', 'png');
		}
		addFile(category, uniqueId, refName, content) {
				if (refName === undefined) refName = '';
				if (content === undefined) content = '';
				var contentU8 = null;
				if (content) {
						content = header + "\n" + content;
						contentU8 = strToU8(content);
				}
				var ids = this.getFileIds(category, uniqueId, refName);
				this.files[ids.fileName] = contentU8;
				return ids.refName;
		}
		getMaterialRef(material) {
				var materialRef = this.materialMap.get(material);
				if (!materialRef) {
						materialRef = this.buildMaterial(material);
						this.materialMap.set(material, materialRef);
				}
				return materialRef;
		}
		getMeshRef(mesh) {
				var meshRef = this.meshMap.get(mesh);
				if (!meshRef) {
						meshRef = this.buildMesh(mesh);
						this.meshMap.set(mesh, meshRef);
				}
				return meshRef;
		}
		buildArray2(array) {
				var components = [];
				var count = array.length;
				for(var i = 0; i < count; i += 2){
						components.push("(" + array[i] + ", " + (1 - array[i + 1]) + ")");
				}
				return components.join(', ');
		}
		buildArray3(array) {
				var components = [];
				var count = array.length;
				for(var i = 0; i < count; i += 3){
						components.push("(" + array[i] + ", " + array[i + 1] + ", " + array[i + 2] + ")");
				}
				return components.join(', ');
		}
		buildMat4(mat) {
				var data = mat.data;
				var vectors = [];
				for(var i = 0; i < 16; i += 4){
						vectors.push("(" + data[i] + ", " + data[i + 1] + ", " + data[i + 2] + ", " + data[i + 3] + ")");
				}
				return "( " + vectors.join(', ') + " )";
		}
		buildMaterial(material) {
				var materialName = "Material_" + material.id;
				var materialPath = "/Materials/" + materialName;
				var materialPropertyPath = (property)=>"<" + materialPath + property + ">";
				var buildTexture = (texture, textureIds, mapType, uvChannel, tiling, offset, rotation, tintColor)=>{
						return '\n                def Shader "Transform2d_' + mapType + '" (\n                    sdrMetadata = {\n                        string role = "math"\n                    }\n                )\n                {\n                    uniform token info:id = "UsdTransform2d"\n                    float2 inputs:in.connect = ' + materialPropertyPath("/uvReader_" + uvChannel + ".outputs:result") + "\n                    float inputs:rotation = " + rotation + "\n                    float2 inputs:scale = (" + tiling.x + ", " + tiling.y + ")\n                    float2 inputs:translation = (" + offset.x + ", " + offset.y + ')\n                    float2 outputs:result\n                }\n\n                def Shader "Texture_' + texture.id + "_" + mapType + '"\n                {\n                    uniform token info:id = "UsdUVTexture"\n                    asset inputs:file = @' + textureIds.fileName + "@\n                    float2 inputs:st.connect = " + materialPropertyPath("/Transform2d_" + mapType + ".outputs:result") + '\n                    token inputs:wrapS = "repeat"\n                    token inputs:wrapT = "repeat"\n                    float4 inputs:scale = (' + tintColor.r + ", " + tintColor.g + ", " + tintColor.b + ", " + tintColor.a + ")\n                    float outputs:r\n                    float outputs:g\n                    float outputs:b\n                    float3 outputs:rgb\n                    float outputs:a\n                }\n            ";
				};
				var inputs = [];
				var samplers = [];
				var addTexture = (textureSlot, uniform, propType, propName, valueName, handleOpacity, tintTexture)=>{
						if (handleOpacity === undefined) handleOpacity = false;
						if (tintTexture === undefined) tintTexture = false;
						var texture = material[textureSlot];
						if (texture) {
								var textureIds = this.getTextureFileIds(texture);
								this.textureMap.set(texture, textureIds.refName);
								var channel = material["" + textureSlot + "Channel"] || 'rgb';
								var textureValue = materialPropertyPath("/" + textureIds.name + "_" + valueName + ".outputs:" + channel);
								inputs.push(materialValueTemplate(propType, "" + propName + ".connect", textureValue));
								if (handleOpacity) {
										if (material.alphaTest > 0.0) ;
								}
								var tiling = material["" + textureSlot + "Tiling"];
								var offset = material["" + textureSlot + "Offset"];
								var rotation = material["" + textureSlot + "Rotation"];
								var uvChannel = material["" + textureSlot + "Uv"] === 1 ? 'st1' : 'st';
								var tintColor = tintTexture && uniform ? uniform : Color.WHITE;
								samplers.push(buildTexture(texture, textureIds, valueName, uvChannel, tiling, offset, rotation, tintColor));
						} else if (uniform) {
								var value = propType === 'float' ? "" + uniform : "(" + uniform.r + ", " + uniform.g + ", " + uniform.b + ")";
								inputs.push(materialValueTemplate(propType, propName, value));
						}
				};
				addTexture('diffuseMap', material.diffuse, 'color3f', 'diffuseColor', 'diffuse', false, true);
				if (material.transparent || material.alphaTest > 0.0) {
						addTexture('opacityMap', material.opacity, 'float', 'opacity', 'opacity', true);
				}
				addTexture('normalMap', null, 'normal3f', 'normal', 'normal');
				addTexture('emissiveMap', material.emissive, 'color3f', 'emissiveColor', 'emissive', false, true);
				addTexture('aoMap', null, 'float', 'occlusion', 'occlusion');
				addTexture('metalnessMap', material.metalness, 'float', 'metallic', 'metallic');
				addTexture('glossMap', material.gloss, 'float', 'roughness', 'roughness');
				var materialObject = '\n            def Material "' + materialName + '"\n            {\n                def Shader "PreviewSurface"\n                {\n                    uniform token info:id = "UsdPreviewSurface"\n' + inputs.join('\n') + "\n                    int inputs:useSpecularWorkflow = 0\n                    token outputs:surface\n                }\n\n                token outputs:surface.connect = " + materialPropertyPath('/PreviewSurface.outputs:surface') + '\n\n                def Shader "uvReader_st"\n                {\n                    uniform token info:id = "UsdPrimvarReader_float2"\n                    token inputs:varname = "st"\n                    float2 inputs:fallback = (0.0, 0.0)\n                    float2 outputs:result\n                }\n\n                def Shader "uvReader_st1"\n                {\n                    uniform token info:id = "UsdPrimvarReader_float2"\n                    token inputs:varname = "st1"\n                    float2 inputs:fallback = (0.0, 0.0)\n                    float2 outputs:result\n                }\n\n                ' + samplers.join('\n') + "\n            }\n        ";
				this.materials.push(materialObject);
				return materialPropertyPath('');
		}
		buildMesh(mesh) {
				var positions = [];
				var indices = [];
				var normals = [];
				var uv0 = [];
				var uv1 = [];
				mesh.getVertexStream(SEMANTIC_POSITION, positions);
				mesh.getVertexStream(SEMANTIC_NORMAL, normals);
				mesh.getVertexStream(SEMANTIC_TEXCOORD0, uv0);
				mesh.getVertexStream(SEMANTIC_TEXCOORD1, uv1);
				mesh.getIndices(indices);
				var indicesCount = indices.length || positions.length;
				var faceVertexCounts = Array(indicesCount / 3).fill(3).join(', ');
				if (!indices.length) {
						for(var i = 0; i < indicesCount; i++){
								indices[i] = i;
						}
				}
				var numVerts = positions.length / 3;
				normals = normals.length ? normals : Array(numVerts * 3).fill(0);
				uv0 = uv0.length ? uv0 : Array(numVerts * 2).fill(0);
				uv1 = uv1.length ? uv1 : Array(numVerts * 2).fill(0);
				positions = this.buildArray3(positions);
				normals = this.buildArray3(normals);
				uv0 = this.buildArray2(uv0);
				uv1 = this.buildArray2(uv1);
				var meshObject = meshTemplate(faceVertexCounts, indices, normals, positions, uv0, uv1);
				var refPath = this.addFile('mesh', "Mesh_" + mesh.id, 'Mesh', meshObject);
				return refPath;
		}
		buildMeshInstance(meshInstance) {
				var meshRefPath = this.getMeshRef(meshInstance.mesh);
				var materialRefPath = this.getMaterialRef(meshInstance.material);
				var worldMatrix = this.buildMat4(meshInstance.node.getWorldTransform());
				var name = meshInstance.node.name.replace(/[^a-z0-9]/gi, '_');
				var nodeName = name;
				while(this.nodeNames.has(nodeName)){
						nodeName = name + "_" + Math.random().toString(36).slice(2, 7);
				}
				this.nodeNames.add(nodeName);
				return meshInstanceTemplate(nodeName, meshRefPath, worldMatrix, materialRefPath);
		}
}

export { UsdzExporter };
