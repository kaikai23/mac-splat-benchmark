var baseVS = '\nattribute vec4 vertex_tangent;\nattribute vec2 vertex_texCoord0;\nattribute vec2 vertex_texCoord1;\nattribute vec4 vertex_color;\nvec3 dPositionW;\nmat4 dModelMatrix;\n#include "transformCoreVS"\n';

export { baseVS as default };
