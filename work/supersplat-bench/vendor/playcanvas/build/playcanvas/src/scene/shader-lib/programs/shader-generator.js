import { hashCode } from '../../../core/hash.js';

class ShaderGenerator {
		static begin() {
				return 'void main(void)\n{\n';
		}
		static end() {
				return '}\n';
		}
		static definesHash(defines) {
				var sortedArray = Array.from(defines).sort((a, b)=>a[0] > b[0] ? 1 : -1);
				return hashCode(JSON.stringify(sortedArray));
		}
}

export { ShaderGenerator };
