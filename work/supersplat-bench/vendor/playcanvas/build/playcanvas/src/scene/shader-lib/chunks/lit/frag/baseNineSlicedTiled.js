var baseNineSlicedTiledPS = "\n#define NINESLICED\n#define NINESLICETILED\nvarying vec2 vMask;\nvarying vec2 vTiledUv;\nuniform mediump vec4 innerOffset;\nuniform mediump vec2 outerScale;\nuniform mediump vec4 atlasRect;\nvec2 nineSlicedUv;\n";

export { baseNineSlicedTiledPS as default };
