import { RENDERSTYLE_WIREFRAME } from './constants.js';
import { MeshInstance } from './mesh-instance.js';
import { MorphInstance } from './morph-instance.js';
import { SkinInstance } from './skin-instance.js';

class Model {
		getGraph() {
				return this.graph;
		}
		setGraph(graph) {
				this.graph = graph;
		}
		getCameras() {
				return this.cameras;
		}
		setCameras(cameras) {
				this.cameras = cameras;
		}
		getLights() {
				return this.lights;
		}
		setLights(lights) {
				this.lights = lights;
		}
		getMaterials() {
				var materials = [];
				for(var i = 0; i < this.meshInstances.length; i++){
						var meshInstance = this.meshInstances[i];
						if (materials.indexOf(meshInstance.material) === -1) {
								materials.push(meshInstance.material);
						}
				}
				return materials;
		}
		clone() {
				var srcNodes = [];
				var cloneNodes = [];
				var _duplicate = function _duplicate1(node) {
						var newNode = node.clone();
						srcNodes.push(node);
						cloneNodes.push(newNode);
						for(var idx = 0; idx < node._children.length; idx++){
								newNode.addChild(_duplicate(node._children[idx]));
						}
						return newNode;
				};
				var cloneGraph = _duplicate(this.graph);
				var cloneMeshInstances = [];
				var cloneSkinInstances = [];
				var cloneMorphInstances = [];
				for(var i = 0; i < this.skinInstances.length; i++){
						var skin = this.skinInstances[i].skin;
						var cloneSkinInstance = new SkinInstance(skin);
						var bones = [];
						for(var j = 0; j < skin.boneNames.length; j++){
								var boneName = skin.boneNames[j];
								var bone = cloneGraph.findByName(boneName);
								bones.push(bone);
						}
						cloneSkinInstance.bones = bones;
						cloneSkinInstances.push(cloneSkinInstance);
				}
				for(var i1 = 0; i1 < this.morphInstances.length; i1++){
						var morph = this.morphInstances[i1].morph;
						var cloneMorphInstance = new MorphInstance(morph);
						cloneMorphInstances.push(cloneMorphInstance);
				}
				for(var i2 = 0; i2 < this.meshInstances.length; i2++){
						var meshInstance = this.meshInstances[i2];
						var nodeIndex = srcNodes.indexOf(meshInstance.node);
						var cloneMeshInstance = new MeshInstance(meshInstance.mesh, meshInstance.material, cloneNodes[nodeIndex]);
						if (meshInstance.skinInstance) {
								var skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
								cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex];
						}
						if (meshInstance.morphInstance) {
								var morphInstanceIndex = this.morphInstances.indexOf(meshInstance.morphInstance);
								cloneMeshInstance.morphInstance = cloneMorphInstances[morphInstanceIndex];
						}
						cloneMeshInstances.push(cloneMeshInstance);
				}
				var clone = new Model();
				clone.graph = cloneGraph;
				clone.meshInstances = cloneMeshInstances;
				clone.skinInstances = cloneSkinInstances;
				clone.morphInstances = cloneMorphInstances;
				clone.getGraph().syncHierarchy();
				return clone;
		}
		destroy() {
				var meshInstances = this.meshInstances;
				for(var i = 0; i < meshInstances.length; i++){
						meshInstances[i].destroy();
				}
				this.meshInstances.length = 0;
		}
		generateWireframe() {
				MeshInstance._prepareRenderStyleForArray(this.meshInstances, RENDERSTYLE_WIREFRAME);
		}
		constructor(){
				this.graph = null;
				this.meshInstances = [];
				this.skinInstances = [];
				this.morphInstances = [];
				this.cameras = [];
				this.lights = [];
				this._shadersVersion = 0;
				this._immutable = false;
		}
}

export { Model };
