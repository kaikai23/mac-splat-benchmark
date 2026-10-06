import { GraphNode } from '../../scene/graph-node.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { SkinInstance } from '../../scene/skin-instance.js';
import { SkinInstanceCache } from '../../scene/skin-instance-cache.js';
import { Entity } from '../entity.js';
import { Asset } from '../asset/asset.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';

class GlbContainerResource {
		get model() {
				if (!this._model) {
						var model = GlbContainerResource.createModel(this.data, this._defaultMaterial);
						var modelAsset = GlbContainerResource.createAsset(this._assetName, 'model', model, 0);
						this._assets.add(modelAsset);
						this._model = modelAsset;
				}
				return this._model;
		}
		static createAsset(assetName, type, resource, index) {
				var subAsset = new Asset(assetName + "/" + type + "/" + index, type, {
						url: ''
				});
				subAsset.resource = resource;
				subAsset.loaded = true;
				return subAsset;
		}
		instantiateModelEntity(options) {
				var entity = new Entity();
				entity.addComponent('model', Object.assign({
						type: 'asset',
						asset: this.model
				}, options));
				return entity;
		}
		instantiateRenderEntity(options) {
				var defaultMaterial = this._defaultMaterial;
				var skinnedMeshInstances = [];
				var createMeshInstance = function createMeshInstance(root, entity, mesh, materials, meshDefaultMaterials, skins, gltfNode, nodeInstancingMap) {
						var materialIndex = meshDefaultMaterials[mesh.id];
						var material = materialIndex === undefined ? defaultMaterial : materials[materialIndex];
						var meshInstance = new MeshInstance(mesh, material);
						if (mesh.morph) {
								meshInstance.morphInstance = new MorphInstance(mesh.morph);
						}
						if (gltfNode.hasOwnProperty('skin')) {
								skinnedMeshInstances.push({
										meshInstance: meshInstance,
										rootBone: root,
										entity: entity
								});
						}
						var instData = nodeInstancingMap.get(gltfNode);
						if (instData) {
								var matrices = instData.matrices;
								var vbFormat = VertexFormat.getDefaultInstancingFormat(mesh.device);
								var vb = new VertexBuffer(mesh.device, vbFormat, matrices.length / 16, {
										data: matrices
								});
								meshInstance.setInstancing(vb);
								meshInstance.instancingData._destroyVertexBuffer = true;
						}
						return meshInstance;
				};
				var cloneHierarchy = (root, node, glb)=>{
						var entity = new Entity();
						node._cloneInternal(entity);
						if (!root) root = entity;
						var attachedMi = null;
						var renderAsset = null;
						for(var i = 0; i < glb.nodes.length; i++){
								var glbNode = glb.nodes[i];
								if (glbNode === node) {
										var gltfNode = glb.gltf.nodes[i];
										if (gltfNode.hasOwnProperty('mesh')) {
												var meshGroup = glb.renders[gltfNode.mesh].meshes;
												renderAsset = this.renders[gltfNode.mesh];
												for(var mi = 0; mi < meshGroup.length; mi++){
														var mesh = meshGroup[mi];
														if (mesh) {
																var cloneMi = createMeshInstance(root, entity, mesh, glb.materials, glb.meshDefaultMaterials, glb.skins, gltfNode, glb.nodeInstancingMap);
																if (!attachedMi) {
																		attachedMi = [];
																}
																attachedMi.push(cloneMi);
														}
												}
										}
										if (glb.lights) {
												var lightEntity = glb.lights.get(gltfNode);
												if (lightEntity) {
														entity.addChild(lightEntity.clone());
												}
										}
										if (glb.cameras) {
												var cameraEntity = glb.cameras.get(gltfNode);
												if (cameraEntity) {
														cameraEntity.camera.system.cloneComponent(cameraEntity, entity);
												}
										}
								}
						}
						if (attachedMi) {
								entity.addComponent('render', Object.assign({
										type: 'asset',
										meshInstances: attachedMi
								}, options));
								entity.render.assignAsset(renderAsset);
						}
						var children = node.children;
						for(var i1 = 0; i1 < children.length; i1++){
								var childClone = cloneHierarchy(root, children[i1], glb);
								entity.addChild(childClone);
						}
						return entity;
				};
				var sceneClones = [];
				for (var scene of this.data.scenes){
						sceneClones.push(cloneHierarchy(null, scene, this.data));
				}
				skinnedMeshInstances.forEach((data)=>{
						data.meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(data.meshInstance.mesh.skin, data.rootBone, data.entity);
						data.meshInstance.node.render.rootBone = data.rootBone;
				});
				return GlbContainerResource.createSceneHierarchy(sceneClones, Entity);
		}
		getMaterialVariants() {
				return this.data.variants ? Object.keys(this.data.variants) : [];
		}
		applyMaterialVariant(entity, name) {
				var variant = name ? this.data.variants[name] : null;
				if (variant === undefined) {
						return;
				}
				var renders = entity.findComponents('render');
				for(var i = 0; i < renders.length; i++){
						var renderComponent = renders[i];
						this._applyMaterialVariant(variant, renderComponent.meshInstances);
				}
		}
		applyMaterialVariantInstances(instances, name) {
				var variant = name ? this.data.variants[name] : null;
				if (variant === undefined) {
						return;
				}
				this._applyMaterialVariant(variant, instances);
		}
		_applyMaterialVariant(variant, instances) {
				instances.forEach((instance)=>{
						if (variant === null) {
								instance.material = this._defaultMaterial;
						} else {
								var meshVariants = this.data.meshVariants[instance.mesh.id];
								if (meshVariants) {
										instance.material = this.data.materials[meshVariants[variant]];
								}
						}
				});
		}
		static createSceneHierarchy(sceneNodes, nodeType) {
				var root = null;
				if (sceneNodes.length === 1) {
						root = sceneNodes[0];
				} else {
						root = new nodeType('SceneGroup');
						for (var scene of sceneNodes){
								root.addChild(scene);
						}
				}
				return root;
		}
		static createModel(glb, defaultMaterial) {
				var createMeshInstance = function createMeshInstance(model, mesh, skins, skinInstances, materials, node, gltfNode) {
						var materialIndex = glb.meshDefaultMaterials[mesh.id];
						var material = materialIndex === undefined ? defaultMaterial : materials[materialIndex];
						var meshInstance = new MeshInstance(mesh, material, node);
						if (mesh.morph) {
								var morphInstance = new MorphInstance(mesh.morph);
								meshInstance.morphInstance = morphInstance;
								model.morphInstances.push(morphInstance);
						}
						if (gltfNode.hasOwnProperty('skin')) {
								var skinIndex = gltfNode.skin;
								var skin = skins[skinIndex];
								mesh.skin = skin;
								var skinInstance = skinInstances[skinIndex];
								meshInstance.skinInstance = skinInstance;
								model.skinInstances.push(skinInstance);
						}
						model.meshInstances.push(meshInstance);
				};
				var model = new Model();
				var skinInstances = [];
				for (var skin of glb.skins){
						var skinInstance = new SkinInstance(skin);
						skinInstance.bones = skin.bones;
						skinInstances.push(skinInstance);
				}
				model.graph = GlbContainerResource.createSceneHierarchy(glb.scenes, GraphNode);
				for(var i = 0; i < glb.nodes.length; i++){
						var node = glb.nodes[i];
						if (node.root === model.graph) {
								var gltfNode = glb.gltf.nodes[i];
								if (gltfNode.hasOwnProperty('mesh')) {
										var meshGroup = glb.renders[gltfNode.mesh].meshes;
										for(var mi = 0; mi < meshGroup.length; mi++){
												var mesh = meshGroup[mi];
												if (mesh) {
														createMeshInstance(model, mesh, glb.skins, skinInstances, glb.materials, node, gltfNode);
												}
										}
								}
						}
				}
				return model;
		}
		destroy() {
				var registry = this._assets;
				var destroyAsset = function destroyAsset(asset) {
						registry.remove(asset);
						asset.unload();
				};
				var destroyAssets = function destroyAssets(assets) {
						assets.forEach((asset)=>{
								destroyAsset(asset);
						});
				};
				if (this.animations) {
						destroyAssets(this.animations);
						this.animations = null;
				}
				if (this.textures) {
						destroyAssets(this.textures);
						this.textures = null;
				}
				if (this.materials) {
						destroyAssets(this.materials);
						this.materials = null;
				}
				if (this.renders) {
						destroyAssets(this.renders);
						this.renders = null;
				}
				if (this._model) {
						destroyAsset(this._model);
						this._model = null;
				}
				this.data = null;
				this.assets = null;
		}
		constructor(data, asset, assets, defaultMaterial){
				var createAsset = function createAsset(type, resource, index) {
						var subAsset = GlbContainerResource.createAsset(asset.name, type, resource, index);
						assets.add(subAsset);
						return subAsset;
				};
				var renders = [];
				for(var i = 0; i < data.renders.length; ++i){
						renders.push(createAsset('render', data.renders[i], i));
				}
				var materials = [];
				for(var i1 = 0; i1 < data.materials.length; ++i1){
						materials.push(createAsset('material', data.materials[i1], i1));
				}
				var animations = [];
				for(var i2 = 0; i2 < data.animations.length; ++i2){
						animations.push(createAsset('animation', data.animations[i2], i2));
				}
				this.data = data;
				this._model = null;
				this._assetName = asset.name;
				this._assets = assets;
				this._defaultMaterial = defaultMaterial;
				this.renders = renders;
				this.materials = materials;
				this.textures = data.textures;
				this.animations = animations;
		}
}

export { GlbContainerResource };
