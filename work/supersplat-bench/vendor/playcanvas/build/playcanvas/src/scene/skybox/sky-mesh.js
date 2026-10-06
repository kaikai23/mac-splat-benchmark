import { SEMANTIC_POSITION, CULLFACE_FRONT } from '../../platform/graphics/constants.js';
import { SKYTYPE_INFINITE, LAYERID_SKYBOX } from '../constants.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { MeshInstance } from '../mesh-instance.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { SkyGeometry } from './sky-geometry.js';

class SkyMesh {
		destroy() {
				if (this.meshInstance) {
						if (this.skyLayer) {
								this.skyLayer.removeMeshInstances([
										this.meshInstance
								]);
						}
						this.meshInstance.destroy();
						this.meshInstance = null;
				}
		}
		constructor(device, scene, node, texture, type){
				this.meshInstance = null;
				var material = new ShaderMaterial({
						uniqueName: 'SkyMaterial',
						vertexCode: shaderChunks.skyboxVS,
						fragmentCode: shaderChunks.skyboxPS,
						attributes: {
								aPosition: SEMANTIC_POSITION
						}
				});
				material.setDefine('__INJECT_SKYBOX_DECODE_FNC', ChunkUtils.decodeFunc(texture.encoding));
				if (type !== SKYTYPE_INFINITE) material.setDefine('SKYMESH', '');
				if (texture.cubemap) material.setDefine('SKY_CUBEMAP', '');
				material.setParameter('skyboxHighlightMultiplier', scene.skyboxHighlightMultiplier);
				if (texture.cubemap) {
						material.setParameter('texture_cubeMap', texture);
				} else {
						material.setParameter('texture_envAtlas', texture);
						material.setParameter('mipLevel', scene.skyboxMip);
				}
				material.cull = CULLFACE_FRONT;
				material.depthWrite = false;
				var skyLayer = scene.layers.getLayerById(LAYERID_SKYBOX);
				if (skyLayer) {
						var mesh = SkyGeometry.create(device, type);
						var meshInstance = new MeshInstance(mesh, material, node);
						this.meshInstance = meshInstance;
						meshInstance.cull = false;
						meshInstance.pick = false;
						skyLayer.addMeshInstances([
								meshInstance
						]);
						this.skyLayer = skyLayer;
				}
		}
}

export { SkyMesh };
