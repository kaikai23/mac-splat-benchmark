var gles3VS = "\n#define attribute in\n#define varying out\n#define texture2D texture\n#define utexture2D texture\n#define itexture2D texture\n#define GL2\n#define VERTEXSHADER\n#define TEXTURE_PASS(name) name\n#define TEXTURE_ACCEPT(name) sampler2D name\n#define TEXTURE_ACCEPT_HIGHP(name) highp sampler2D name\n";

export { gles3VS as default };
