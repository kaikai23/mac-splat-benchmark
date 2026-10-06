import { Mat4 } from '../../core/math/mat4.js';
import { PRIMITIVE_LINES } from '../../platform/graphics/constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { GraphNode } from '../graph-node.js';

var identityGraphNode = new GraphNode();
identityGraphNode.worldTransform = Mat4.IDENTITY;
identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;
class ImmediateBatch {
		addLines(positions, color) {
				var destPos = this.positions;
				var count = positions.length;
				for(var i = 0; i < count; i++){
						var pos = positions[i];
						destPos.push(pos.x, pos.y, pos.z);
				}
				var destCol = this.colors;
				if (color.length) {
						for(var i1 = 0; i1 < count; i1++){
								var col = color[i1];
								destCol.push(col.r, col.g, col.b, col.a);
						}
				} else {
						for(var i2 = 0; i2 < count; i2++){
								destCol.push(color.r, color.g, color.b, color.a);
						}
				}
		}
		addLinesArrays(positions, color) {
				var destPos = this.positions;
				for(var i = 0; i < positions.length; i += 3){
						destPos.push(positions[i], positions[i + 1], positions[i + 2]);
				}
				var destCol = this.colors;
				if (color.length) {
						for(var i1 = 0; i1 < color.length; i1 += 4){
								destCol.push(color[i1], color[i1 + 1], color[i1 + 2], color[i1 + 3]);
						}
				} else {
						var count = positions.length / 3;
						for(var i2 = 0; i2 < count; i2++){
								destCol.push(color.r, color.g, color.b, color.a);
						}
				}
		}
		onPreRender(visibleList, transparent) {
				if (this.positions.length > 0 && this.material.transparent === transparent) {
						this.mesh.setPositions(this.positions);
						this.mesh.setColors(this.colors);
						this.mesh.update(PRIMITIVE_LINES, false);
						if (!this.meshInstance) {
								this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);
						}
						visibleList.push(this.meshInstance);
				}
		}
		clear() {
				this.positions.length = 0;
				this.colors.length = 0;
		}
		constructor(device, material, layer){
				this.material = material;
				this.layer = layer;
				this.positions = [];
				this.colors = [];
				this.mesh = new Mesh(device);
				this.meshInstance = null;
		}
}

export { ImmediateBatch };
