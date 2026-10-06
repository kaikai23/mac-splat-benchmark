var ADDRESS_REPEAT = 0;
var ADDRESS_CLAMP_TO_EDGE = 1;
var ADDRESS_MIRRORED_REPEAT = 2;
var BLENDMODE_ZERO = 0;
var BLENDMODE_ONE = 1;
var BLENDMODE_SRC_COLOR = 2;
var BLENDMODE_ONE_MINUS_SRC_COLOR = 3;
var BLENDMODE_DST_COLOR = 4;
var BLENDMODE_ONE_MINUS_DST_COLOR = 5;
var BLENDMODE_SRC_ALPHA = 6;
var BLENDMODE_SRC_ALPHA_SATURATE = 7;
var BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;
var BLENDMODE_DST_ALPHA = 9;
var BLENDMODE_ONE_MINUS_DST_ALPHA = 10;
var BLENDMODE_CONSTANT = 11;
var BLENDMODE_ONE_MINUS_CONSTANT = 12;
var BLENDEQUATION_ADD = 0;
var BLENDEQUATION_SUBTRACT = 1;
var BLENDEQUATION_REVERSE_SUBTRACT = 2;
var BLENDEQUATION_MIN = 3;
var BLENDEQUATION_MAX = 4;
var BUFFERUSAGE_READ = 0x0001;
var BUFFERUSAGE_WRITE = 0x0002;
var BUFFERUSAGE_COPY_SRC = 0x0004;
var BUFFERUSAGE_COPY_DST = 0x0008;
var BUFFERUSAGE_INDEX = 0x0010;
var BUFFERUSAGE_VERTEX = 0x0020;
var BUFFERUSAGE_UNIFORM = 0x0040;
var BUFFERUSAGE_STORAGE = 0x0080;
var BUFFERUSAGE_INDIRECT = 0x0100;
var BUFFER_STATIC = 0;
var BUFFER_DYNAMIC = 1;
var BUFFER_STREAM = 2;
var BUFFER_GPUDYNAMIC = 3;
var CLEARFLAG_COLOR = 1;
var CLEARFLAG_DEPTH = 2;
var CLEARFLAG_STENCIL = 4;
var CUBEFACE_POSX = 0;
var CUBEFACE_NEGX = 1;
var CUBEFACE_POSY = 2;
var CUBEFACE_NEGY = 3;
var CUBEFACE_POSZ = 4;
var CUBEFACE_NEGZ = 5;
var CULLFACE_NONE = 0;
var CULLFACE_BACK = 1;
var CULLFACE_FRONT = 2;
var CULLFACE_FRONTANDBACK = 3;
var FILTER_NEAREST = 0;
var FILTER_LINEAR = 1;
var FILTER_NEAREST_MIPMAP_NEAREST = 2;
var FILTER_NEAREST_MIPMAP_LINEAR = 3;
var FILTER_LINEAR_MIPMAP_NEAREST = 4;
var FILTER_LINEAR_MIPMAP_LINEAR = 5;
var FUNC_NEVER = 0;
var FUNC_LESS = 1;
var FUNC_EQUAL = 2;
var FUNC_LESSEQUAL = 3;
var FUNC_GREATER = 4;
var FUNC_NOTEQUAL = 5;
var FUNC_GREATEREQUAL = 6;
var FUNC_ALWAYS = 7;
var INDEXFORMAT_UINT8 = 0;
var INDEXFORMAT_UINT16 = 1;
var INDEXFORMAT_UINT32 = 2;
var PIXELFORMAT_A8 = 0;
var PIXELFORMAT_L8 = 1;
var PIXELFORMAT_LA8 = 2;
var PIXELFORMAT_RGB565 = 3;
var PIXELFORMAT_RGBA5551 = 4;
var PIXELFORMAT_RGBA4 = 5;
var PIXELFORMAT_RGB8 = 6;
var PIXELFORMAT_RGBA8 = 7;
var PIXELFORMAT_DXT1 = 8;
var PIXELFORMAT_DXT3 = 9;
var PIXELFORMAT_DXT5 = 10;
var PIXELFORMAT_RGB16F = 11;
var PIXELFORMAT_RGBA16F = 12;
var PIXELFORMAT_RGB32F = 13;
var PIXELFORMAT_RGBA32F = 14;
var PIXELFORMAT_R32F = 15;
var PIXELFORMAT_DEPTH = 16;
var PIXELFORMAT_DEPTHSTENCIL = 17;
var PIXELFORMAT_111110F = 18;
var PIXELFORMAT_SRGB8 = 19;
var PIXELFORMAT_SRGBA8 = 20;
var PIXELFORMAT_ETC1 = 21;
var PIXELFORMAT_ETC2_RGB = 22;
var PIXELFORMAT_ETC2_RGBA = 23;
var PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;
var PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;
var PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;
var PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;
var PIXELFORMAT_ASTC_4x4 = 28;
var PIXELFORMAT_ATC_RGB = 29;
var PIXELFORMAT_ATC_RGBA = 30;
var PIXELFORMAT_BGRA8 = 31;
var PIXELFORMAT_R8I = 32;
var PIXELFORMAT_R8U = 33;
var PIXELFORMAT_R16I = 34;
var PIXELFORMAT_R16U = 35;
var PIXELFORMAT_R32I = 36;
var PIXELFORMAT_R32U = 37;
var PIXELFORMAT_RG8I = 38;
var PIXELFORMAT_RG8U = 39;
var PIXELFORMAT_RG16I = 40;
var PIXELFORMAT_RG16U = 41;
var PIXELFORMAT_RG32I = 42;
var PIXELFORMAT_RG32U = 43;
var PIXELFORMAT_RGBA8I = 44;
var PIXELFORMAT_RGBA8U = 45;
var PIXELFORMAT_RGBA16I = 46;
var PIXELFORMAT_RGBA16U = 47;
var PIXELFORMAT_RGBA32I = 48;
var PIXELFORMAT_RGBA32U = 49;
var PIXELFORMAT_R16F = 50;
var PIXELFORMAT_RG16F = 51;
var PIXELFORMAT_R8 = 52;
var PIXELFORMAT_RG8 = 53;
var PIXELFORMAT_DXT1_SRGB = 54;
var PIXELFORMAT_DXT3_SRGBA = 55;
var PIXELFORMAT_DXT5_SRGBA = 56;
var PIXELFORMAT_ETC2_SRGB = 61;
var PIXELFORMAT_ETC2_SRGBA = 62;
var PIXELFORMAT_ASTC_4x4_SRGB = 63;
var PIXELFORMAT_SBGRA8 = 64;
var PIXELFORMAT_BC6F = 65;
var PIXELFORMAT_BC6UF = 66;
var PIXELFORMAT_BC7 = 67;
var PIXELFORMAT_BC7_SRGBA = 68;
var PIXELFORMAT_DEPTH16 = 69;
var pixelFormatInfo = new Map([
		[
				PIXELFORMAT_A8,
				{
						name: 'A8',
						size: 1,
						ldr: true
				}
		],
		[
				PIXELFORMAT_R8,
				{
						name: 'R8',
						size: 1,
						ldr: true
				}
		],
		[
				PIXELFORMAT_L8,
				{
						name: 'L8',
						size: 1,
						ldr: true
				}
		],
		[
				PIXELFORMAT_LA8,
				{
						name: 'LA8',
						size: 2,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RG8,
				{
						name: 'RG8',
						size: 2,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RGB565,
				{
						name: 'RGB565',
						size: 2,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RGBA5551,
				{
						name: 'RGBA5551',
						size: 2,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RGBA4,
				{
						name: 'RGBA4',
						size: 2,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RGB8,
				{
						name: 'RGB8',
						size: 4,
						ldr: true
				}
		],
		[
				PIXELFORMAT_RGBA8,
				{
						name: 'RGBA8',
						size: 4,
						ldr: true,
						srgbFormat: PIXELFORMAT_SRGBA8
				}
		],
		[
				PIXELFORMAT_R16F,
				{
						name: 'R16F',
						size: 2
				}
		],
		[
				PIXELFORMAT_RG16F,
				{
						name: 'RG16F',
						size: 4
				}
		],
		[
				PIXELFORMAT_RGB16F,
				{
						name: 'RGB16F',
						size: 8
				}
		],
		[
				PIXELFORMAT_RGBA16F,
				{
						name: 'RGBA16F',
						size: 8
				}
		],
		[
				PIXELFORMAT_RGB32F,
				{
						name: 'RGB32F',
						size: 16
				}
		],
		[
				PIXELFORMAT_RGBA32F,
				{
						name: 'RGBA32F',
						size: 16
				}
		],
		[
				PIXELFORMAT_R32F,
				{
						name: 'R32F',
						size: 4
				}
		],
		[
				PIXELFORMAT_DEPTH,
				{
						name: 'DEPTH',
						size: 4
				}
		],
		[
				PIXELFORMAT_DEPTH16,
				{
						name: 'DEPTH16',
						size: 2
				}
		],
		[
				PIXELFORMAT_DEPTHSTENCIL,
				{
						name: 'DEPTHSTENCIL',
						size: 4
				}
		],
		[
				PIXELFORMAT_111110F,
				{
						name: '111110F',
						size: 4
				}
		],
		[
				PIXELFORMAT_SRGB8,
				{
						name: 'SRGB8',
						size: 4,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_SRGBA8,
				{
						name: 'SRGBA8',
						size: 4,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_BGRA8,
				{
						name: 'BGRA8',
						size: 4,
						ldr: true
				}
		],
		[
				PIXELFORMAT_SBGRA8,
				{
						name: 'SBGRA8',
						size: 4,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_DXT1,
				{
						name: 'DXT1',
						blockSize: 8,
						ldr: true,
						srgbFormat: PIXELFORMAT_DXT1_SRGB
				}
		],
		[
				PIXELFORMAT_DXT3,
				{
						name: 'DXT3',
						blockSize: 16,
						ldr: true,
						srgbFormat: PIXELFORMAT_DXT3_SRGBA
				}
		],
		[
				PIXELFORMAT_DXT5,
				{
						name: 'DXT5',
						blockSize: 16,
						ldr: true,
						srgbFormat: PIXELFORMAT_DXT5_SRGBA
				}
		],
		[
				PIXELFORMAT_ETC1,
				{
						name: 'ETC1',
						blockSize: 8,
						ldr: true
				}
		],
		[
				PIXELFORMAT_ETC2_RGB,
				{
						name: 'ETC2_RGB',
						blockSize: 8,
						ldr: true,
						srgbFormat: PIXELFORMAT_ETC2_SRGB
				}
		],
		[
				PIXELFORMAT_ETC2_RGBA,
				{
						name: 'ETC2_RGBA',
						blockSize: 16,
						ldr: true,
						srgbFormat: PIXELFORMAT_ETC2_SRGBA
				}
		],
		[
				PIXELFORMAT_PVRTC_2BPP_RGB_1,
				{
						name: 'PVRTC_2BPP_RGB_1',
						ldr: true,
						blockSize: 8
				}
		],
		[
				PIXELFORMAT_PVRTC_2BPP_RGBA_1,
				{
						name: 'PVRTC_2BPP_RGBA_1',
						ldr: true,
						blockSize: 8
				}
		],
		[
				PIXELFORMAT_PVRTC_4BPP_RGB_1,
				{
						name: 'PVRTC_4BPP_RGB_1',
						ldr: true,
						blockSize: 8
				}
		],
		[
				PIXELFORMAT_PVRTC_4BPP_RGBA_1,
				{
						name: 'PVRTC_4BPP_RGBA_1',
						ldr: true,
						blockSize: 8
				}
		],
		[
				PIXELFORMAT_ASTC_4x4,
				{
						name: 'ASTC_4x4',
						blockSize: 16,
						ldr: true,
						srgbFormat: PIXELFORMAT_ASTC_4x4_SRGB
				}
		],
		[
				PIXELFORMAT_ATC_RGB,
				{
						name: 'ATC_RGB',
						blockSize: 8,
						ldr: true
				}
		],
		[
				PIXELFORMAT_ATC_RGBA,
				{
						name: 'ATC_RGBA',
						blockSize: 16,
						ldr: true
				}
		],
		[
				PIXELFORMAT_BC6F,
				{
						name: 'BC6H_RGBF',
						blockSize: 16
				}
		],
		[
				PIXELFORMAT_BC6UF,
				{
						name: 'BC6H_RGBUF',
						blockSize: 16
				}
		],
		[
				PIXELFORMAT_BC7,
				{
						name: 'BC7_RGBA',
						blockSize: 16,
						ldr: true,
						srgbFormat: PIXELFORMAT_BC7_SRGBA
				}
		],
		[
				PIXELFORMAT_DXT1_SRGB,
				{
						name: 'DXT1_SRGB',
						blockSize: 8,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_DXT3_SRGBA,
				{
						name: 'DXT3_SRGBA',
						blockSize: 16,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_DXT5_SRGBA,
				{
						name: 'DXT5_SRGBA',
						blockSize: 16,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_ETC2_SRGB,
				{
						name: 'ETC2_SRGB',
						blockSize: 8,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_ETC2_SRGBA,
				{
						name: 'ETC2_SRGBA',
						blockSize: 16,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_ASTC_4x4_SRGB,
				{
						name: 'ASTC_4x4_SRGB',
						blockSize: 16,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_BC7_SRGBA,
				{
						name: 'BC7_SRGBA',
						blockSize: 16,
						ldr: true,
						srgb: true
				}
		],
		[
				PIXELFORMAT_R8I,
				{
						name: 'R8I',
						size: 1,
						isInt: true
				}
		],
		[
				PIXELFORMAT_R8U,
				{
						name: 'R8U',
						size: 1,
						isInt: true
				}
		],
		[
				PIXELFORMAT_R16I,
				{
						name: 'R16I',
						size: 2,
						isInt: true
				}
		],
		[
				PIXELFORMAT_R16U,
				{
						name: 'R16U',
						size: 2,
						isInt: true
				}
		],
		[
				PIXELFORMAT_R32I,
				{
						name: 'R32I',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_R32U,
				{
						name: 'R32U',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG8I,
				{
						name: 'RG8I',
						size: 2,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG8U,
				{
						name: 'RG8U',
						size: 2,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG16I,
				{
						name: 'RG16I',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG16U,
				{
						name: 'RG16U',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG32I,
				{
						name: 'RG32I',
						size: 8,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RG32U,
				{
						name: 'RG32U',
						size: 8,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA8I,
				{
						name: 'RGBA8I',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA8U,
				{
						name: 'RGBA8U',
						size: 4,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA16I,
				{
						name: 'RGBA16I',
						size: 8,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA16U,
				{
						name: 'RGBA16U',
						size: 8,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA32I,
				{
						name: 'RGBA32I',
						size: 16,
						isInt: true
				}
		],
		[
				PIXELFORMAT_RGBA32U,
				{
						name: 'RGBA32U',
						size: 16,
						isInt: true
				}
		]
]);
var isCompressedPixelFormat = (format)=>{
		var _pixelFormatInfo_get;
		return ((_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.blockSize) !== undefined;
};
var isSrgbPixelFormat = (format)=>{
		var _pixelFormatInfo_get;
		return ((_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.srgb) === true;
};
var isIntegerPixelFormat = (format)=>{
		var _pixelFormatInfo_get;
		return ((_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.isInt) === true;
};
var pixelFormatLinearToGamma = (format)=>{
		var _pixelFormatInfo_get;
		return ((_pixelFormatInfo_get = pixelFormatInfo.get(format)) == null ? undefined : _pixelFormatInfo_get.srgbFormat) || format;
};
var pixelFormatGammaToLinear = (format)=>{
		for (var [key, value] of pixelFormatInfo){
				if (value.srgbFormat === format) {
						return key;
				}
		}
		return format;
};
var requiresManualGamma = (format)=>{
		var info = pixelFormatInfo.get(format);
		return !!((info == null ? undefined : info.ldr) && !(info == null ? undefined : info.srgb));
};
var getPixelFormatArrayType = (format)=>{
		switch(format){
				case PIXELFORMAT_R32F:
				case PIXELFORMAT_RGB32F:
				case PIXELFORMAT_RGBA32F:
						return Float32Array;
				case PIXELFORMAT_R32I:
				case PIXELFORMAT_RG32I:
				case PIXELFORMAT_RGBA32I:
						return Int32Array;
				case PIXELFORMAT_R32U:
				case PIXELFORMAT_RG32U:
				case PIXELFORMAT_RGBA32U:
						return Uint32Array;
				case PIXELFORMAT_R16I:
				case PIXELFORMAT_RG16I:
				case PIXELFORMAT_RGBA16I:
						return Int16Array;
				case PIXELFORMAT_RG8:
				case PIXELFORMAT_R16U:
				case PIXELFORMAT_RG16U:
				case PIXELFORMAT_RGBA16U:
				case PIXELFORMAT_RGB565:
				case PIXELFORMAT_RGBA5551:
				case PIXELFORMAT_RGBA4:
				case PIXELFORMAT_R16F:
				case PIXELFORMAT_RG16F:
				case PIXELFORMAT_RGB16F:
				case PIXELFORMAT_RGBA16F:
						return Uint16Array;
				case PIXELFORMAT_R8I:
				case PIXELFORMAT_RG8I:
				case PIXELFORMAT_RGBA8I:
						return Int8Array;
				default:
						return Uint8Array;
		}
};
var PRIMITIVE_POINTS = 0;
var PRIMITIVE_LINES = 1;
var PRIMITIVE_LINELOOP = 2;
var PRIMITIVE_LINESTRIP = 3;
var PRIMITIVE_TRIANGLES = 4;
var PRIMITIVE_TRISTRIP = 5;
var PRIMITIVE_TRIFAN = 6;
var SEMANTIC_POSITION = 'POSITION';
var SEMANTIC_NORMAL = 'NORMAL';
var SEMANTIC_TANGENT = 'TANGENT';
var SEMANTIC_BLENDWEIGHT = 'BLENDWEIGHT';
var SEMANTIC_BLENDINDICES = 'BLENDINDICES';
var SEMANTIC_COLOR = 'COLOR';
var SEMANTIC_TEXCOORD = 'TEXCOORD';
var SEMANTIC_TEXCOORD0 = 'TEXCOORD0';
var SEMANTIC_TEXCOORD1 = 'TEXCOORD1';
var SEMANTIC_TEXCOORD2 = 'TEXCOORD2';
var SEMANTIC_TEXCOORD3 = 'TEXCOORD3';
var SEMANTIC_TEXCOORD4 = 'TEXCOORD4';
var SEMANTIC_TEXCOORD5 = 'TEXCOORD5';
var SEMANTIC_TEXCOORD6 = 'TEXCOORD6';
var SEMANTIC_TEXCOORD7 = 'TEXCOORD7';
var SEMANTIC_ATTR0 = 'ATTR0';
var SEMANTIC_ATTR1 = 'ATTR1';
var SEMANTIC_ATTR2 = 'ATTR2';
var SEMANTIC_ATTR3 = 'ATTR3';
var SEMANTIC_ATTR4 = 'ATTR4';
var SEMANTIC_ATTR5 = 'ATTR5';
var SEMANTIC_ATTR6 = 'ATTR6';
var SEMANTIC_ATTR7 = 'ATTR7';
var SEMANTIC_ATTR8 = 'ATTR8';
var SEMANTIC_ATTR9 = 'ATTR9';
var SEMANTIC_ATTR10 = 'ATTR10';
var SEMANTIC_ATTR11 = 'ATTR11';
var SEMANTIC_ATTR12 = 'ATTR12';
var SEMANTIC_ATTR13 = 'ATTR13';
var SEMANTIC_ATTR14 = 'ATTR14';
var SEMANTIC_ATTR15 = 'ATTR15';
var SHADERTAG_MATERIAL = 1;
var STENCILOP_KEEP = 0;
var STENCILOP_ZERO = 1;
var STENCILOP_REPLACE = 2;
var STENCILOP_INCREMENT = 3;
var STENCILOP_INCREMENTWRAP = 4;
var STENCILOP_DECREMENT = 5;
var STENCILOP_DECREMENTWRAP = 6;
var STENCILOP_INVERT = 7;
var TEXTURELOCK_NONE = 0;
var TEXTURELOCK_READ = 1;
var TEXTURELOCK_WRITE = 2;
var TEXTURETYPE_DEFAULT = 'default';
var TEXTURETYPE_RGBM = 'rgbm';
var TEXTURETYPE_RGBE = 'rgbe';
var TEXTURETYPE_RGBP = 'rgbp';
var TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';
var TEXHINT_NONE = 0;
var TEXHINT_SHADOWMAP = 1;
var TEXHINT_ASSET = 2;
var TEXHINT_LIGHTMAP = 3;
var TEXTUREDIMENSION_1D = '1d';
var TEXTUREDIMENSION_2D = '2d';
var TEXTUREDIMENSION_2D_ARRAY = '2d-array';
var TEXTUREDIMENSION_CUBE = 'cube';
var TEXTUREDIMENSION_CUBE_ARRAY = 'cube-array';
var TEXTUREDIMENSION_3D = '3d';
var SAMPLETYPE_FLOAT = 0;
var SAMPLETYPE_UNFILTERABLE_FLOAT = 1;
var SAMPLETYPE_DEPTH = 2;
var SAMPLETYPE_INT = 3;
var SAMPLETYPE_UINT = 4;
var TEXTUREPROJECTION_NONE = 'none';
var TEXTUREPROJECTION_CUBE = 'cube';
var TEXTUREPROJECTION_EQUIRECT = 'equirect';
var TEXTUREPROJECTION_OCTAHEDRAL = 'octahedral';
var SHADERLANGUAGE_GLSL = 'glsl';
var SHADERLANGUAGE_WGSL = 'wgsl';
var TYPE_INT8 = 0;
var TYPE_UINT8 = 1;
var TYPE_INT16 = 2;
var TYPE_UINT16 = 3;
var TYPE_INT32 = 4;
var TYPE_UINT32 = 5;
var TYPE_FLOAT32 = 6;
var TYPE_FLOAT16 = 7;
var UNIFORMTYPE_BOOL = 0;
var UNIFORMTYPE_INT = 1;
var UNIFORMTYPE_FLOAT = 2;
var UNIFORMTYPE_VEC2 = 3;
var UNIFORMTYPE_VEC3 = 4;
var UNIFORMTYPE_VEC4 = 5;
var UNIFORMTYPE_IVEC2 = 6;
var UNIFORMTYPE_IVEC3 = 7;
var UNIFORMTYPE_IVEC4 = 8;
var UNIFORMTYPE_BVEC2 = 9;
var UNIFORMTYPE_BVEC3 = 10;
var UNIFORMTYPE_BVEC4 = 11;
var UNIFORMTYPE_MAT2 = 12;
var UNIFORMTYPE_MAT3 = 13;
var UNIFORMTYPE_MAT4 = 14;
var UNIFORMTYPE_TEXTURE2D = 15;
var UNIFORMTYPE_TEXTURECUBE = 16;
var UNIFORMTYPE_FLOATARRAY = 17;
var UNIFORMTYPE_TEXTURE2D_SHADOW = 18;
var UNIFORMTYPE_TEXTURECUBE_SHADOW = 19;
var UNIFORMTYPE_TEXTURE3D = 20;
var UNIFORMTYPE_VEC2ARRAY = 21;
var UNIFORMTYPE_VEC3ARRAY = 22;
var UNIFORMTYPE_VEC4ARRAY = 23;
var UNIFORMTYPE_MAT4ARRAY = 24;
var UNIFORMTYPE_TEXTURE2D_ARRAY = 25;
var UNIFORMTYPE_UINT = 26;
var UNIFORMTYPE_UVEC2 = 27;
var UNIFORMTYPE_UVEC3 = 28;
var UNIFORMTYPE_UVEC4 = 29;
var UNIFORMTYPE_INTARRAY = 30;
var UNIFORMTYPE_UINTARRAY = 31;
var UNIFORMTYPE_BOOLARRAY = 32;
var UNIFORMTYPE_IVEC2ARRAY = 33;
var UNIFORMTYPE_UVEC2ARRAY = 34;
var UNIFORMTYPE_BVEC2ARRAY = 35;
var UNIFORMTYPE_IVEC3ARRAY = 36;
var UNIFORMTYPE_UVEC3ARRAY = 37;
var UNIFORMTYPE_BVEC3ARRAY = 38;
var UNIFORMTYPE_IVEC4ARRAY = 39;
var UNIFORMTYPE_UVEC4ARRAY = 40;
var UNIFORMTYPE_BVEC4ARRAY = 41;
var UNIFORMTYPE_ITEXTURE2D = 42;
var UNIFORMTYPE_UTEXTURE2D = 43;
var UNIFORMTYPE_ITEXTURECUBE = 44;
var UNIFORMTYPE_UTEXTURECUBE = 45;
var UNIFORMTYPE_ITEXTURE3D = 46;
var UNIFORMTYPE_UTEXTURE3D = 47;
var UNIFORMTYPE_ITEXTURE2D_ARRAY = 48;
var UNIFORMTYPE_UTEXTURE2D_ARRAY = 49;
var uniformTypeToName = [
		'bool',
		'int',
		'float',
		'vec2',
		'vec3',
		'vec4',
		'ivec2',
		'ivec3',
		'ivec4',
		'bvec2',
		'bvec3',
		'bvec4',
		'mat2',
		'mat3',
		'mat4',
		'sampler2D',
		'samplerCube',
		'',
		'sampler2DShadow',
		'samplerCubeShadow',
		'sampler3D',
		'',
		'',
		'',
		'',
		'sampler2DArray',
		'uint',
		'uvec2',
		'uvec3',
		'uvec4',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'isampler2D',
		'usampler2D',
		'isamplerCube',
		'usamplerCube',
		'isampler3D',
		'usampler3D',
		'isampler2DArray',
		'usampler2DArray'
];
var uniformTypeToNameWGSL = [
		[
				'bool'
		],
		[
				'i32'
		],
		[
				'f32'
		],
		[
				'vec2f',
				'vec2<f32>'
		],
		[
				'vec3f',
				'vec3<f32>'
		],
		[
				'vec4f',
				'vec4<f32>'
		],
		[
				'vec2i',
				'vec2<i32>'
		],
		[
				'vec3i',
				'vec3<i32>'
		],
		[
				'vec4i',
				'vec4<i32>'
		],
		[
				'vec2<bool>'
		],
		[
				'vec3<bool>'
		],
		[
				'vec4<bool>'
		],
		[
				'mat2x2f',
				'mat2x2<f32>'
		],
		[
				'mat3x3f',
				'mat3x3<f32>'
		],
		[
				'mat4x4f',
				'mat4x4<f32>'
		],
		[
				'texture_2d<f32>'
		],
		[
				'texture_cube<f32>'
		],
		[
				'array<f32>'
		],
		[
				'texture_depth_2d'
		],
		[
				'texture_depth_cube'
		],
		[
				'texture_3d<f32>'
		],
		[
				'array<vec2<f32>>'
		],
		[
				'array<vec3<f32>>'
		],
		[
				'array<vec4<f32>>'
		],
		[
				'array<mat4x4<f32>>'
		],
		[
				'texture_2d_array<f32>'
		],
		[
				'u32'
		],
		[
				'vec2u',
				'vec2<u32>'
		],
		[
				'vec3u',
				'vec3<u32>'
		],
		[
				'vec4u',
				'vec4<u32>'
		],
		[
				'array<i32>'
		],
		[
				'array<u32>'
		],
		[
				'array<bool>'
		],
		[
				'array<vec2i>',
				'array<vec2<i32>>'
		],
		[
				'array<vec2u>',
				'array<vec2<u32>>'
		],
		[
				'array<vec2b>',
				'array<vec2<bool>>'
		],
		[
				'array<vec3i>',
				'array<vec3<i32>>'
		],
		[
				'array<vec3u>',
				'array<vec3<u32>>'
		],
		[
				'array<vec3b>',
				'array<vec3<bool>>'
		],
		[
				'array<vec4i>',
				'array<vec4<i32>>'
		],
		[
				'array<vec4u>',
				'array<vec4<u32>>'
		],
		[
				'array<vec4b>',
				'array<vec4<bool>>'
		],
		[
				'texture_2d<i32>'
		],
		[
				'texture_2d<u32>'
		],
		[
				'texture_cube<i32>'
		],
		[
				'texture_cube<u32>'
		],
		[
				'texture_3d<i32>'
		],
		[
				'texture_3d<u32>'
		],
		[
				'texture_2d_array<i32>'
		],
		[
				'texture_2d_array<u32>'
		]
];
var uniformTypeToNameMapWGSL = new Map();
uniformTypeToNameWGSL.forEach((names, index)=>{
		names.forEach((name)=>uniformTypeToNameMapWGSL.set(name, index));
});
var uniformTypeToStorage = new Uint8Array([
		TYPE_INT32,
		TYPE_INT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_FLOAT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_FLOAT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_UINT32,
		TYPE_UINT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_UINT32,
		TYPE_INT32,
		TYPE_UINT32
]);
var DEVICETYPE_WEBGL2 = 'webgl2';
var DEVICETYPE_WEBGPU = 'webgpu';
var DEVICETYPE_NULL = 'null';
var SHADERSTAGE_VERTEX = 1;
var SHADERSTAGE_FRAGMENT = 2;
var SHADERSTAGE_COMPUTE = 4;
var DISPLAYFORMAT_LDR = 'ldr';
var DISPLAYFORMAT_LDR_SRGB = 'ldr_srgb';
var DISPLAYFORMAT_HDR = 'hdr';
var TEXPROPERTY_MIN_FILTER = 1;
var TEXPROPERTY_MAG_FILTER = 2;
var TEXPROPERTY_ADDRESS_U = 4;
var TEXPROPERTY_ADDRESS_V = 8;
var TEXPROPERTY_ADDRESS_W = 16;
var TEXPROPERTY_COMPARE_ON_READ = 32;
var TEXPROPERTY_COMPARE_FUNC = 64;
var TEXPROPERTY_ANISOTROPY = 128;
var TEXPROPERTY_ALL = 255;
var BINDGROUP_VIEW = 0;
var BINDGROUP_MESH = 1;
var BINDGROUP_MESH_UB = 2;
var bindGroupNames = [
		'view',
		'mesh',
		'mesh_ub'
];
var UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';
var UNUSED_UNIFORM_NAME = '_unused_float_uniform';
var typedArrayTypes = [
		Int8Array,
		Uint8Array,
		Int16Array,
		Uint16Array,
		Int32Array,
		Uint32Array,
		Float32Array,
		Uint16Array
];
var typedArrayTypesByteSize = [
		1,
		1,
		2,
		2,
		4,
		4,
		4,
		2
];
var vertexTypesNames = [
		'INT8',
		'UINT8',
		'INT16',
		'UINT16',
		'INT32',
		'UINT32',
		'FLOAT32',
		'FLOAT16'
];
var typedArrayToType = {
		'Int8Array': TYPE_INT8,
		'Uint8Array': TYPE_UINT8,
		'Int16Array': TYPE_INT16,
		'Uint16Array': TYPE_UINT16,
		'Int32Array': TYPE_INT32,
		'Uint32Array': TYPE_UINT32,
		'Float32Array': TYPE_FLOAT32
};
var typedArrayIndexFormats = [
		Uint8Array,
		Uint16Array,
		Uint32Array
];
var typedArrayIndexFormatsByteSize = [
		1,
		2,
		4
];
var semanticToLocation = {};
semanticToLocation[SEMANTIC_POSITION] = 0;
semanticToLocation[SEMANTIC_NORMAL] = 1;
semanticToLocation[SEMANTIC_BLENDWEIGHT] = 2;
semanticToLocation[SEMANTIC_BLENDINDICES] = 3;
semanticToLocation[SEMANTIC_COLOR] = 4;
semanticToLocation[SEMANTIC_TEXCOORD0] = 5;
semanticToLocation[SEMANTIC_TEXCOORD1] = 6;
semanticToLocation[SEMANTIC_TEXCOORD2] = 7;
semanticToLocation[SEMANTIC_TEXCOORD3] = 8;
semanticToLocation[SEMANTIC_TEXCOORD4] = 9;
semanticToLocation[SEMANTIC_TEXCOORD5] = 10;
semanticToLocation[SEMANTIC_TEXCOORD6] = 11;
semanticToLocation[SEMANTIC_TEXCOORD7] = 12;
semanticToLocation[SEMANTIC_TANGENT] = 13;
semanticToLocation[SEMANTIC_ATTR0] = 0;
semanticToLocation[SEMANTIC_ATTR1] = 1;
semanticToLocation[SEMANTIC_ATTR2] = 2;
semanticToLocation[SEMANTIC_ATTR3] = 3;
semanticToLocation[SEMANTIC_ATTR4] = 4;
semanticToLocation[SEMANTIC_ATTR5] = 5;
semanticToLocation[SEMANTIC_ATTR6] = 6;
semanticToLocation[SEMANTIC_ATTR7] = 7;
semanticToLocation[SEMANTIC_ATTR8] = 8;
semanticToLocation[SEMANTIC_ATTR9] = 9;
semanticToLocation[SEMANTIC_ATTR10] = 10;
semanticToLocation[SEMANTIC_ATTR11] = 11;
semanticToLocation[SEMANTIC_ATTR12] = 12;
semanticToLocation[SEMANTIC_ATTR13] = 13;
semanticToLocation[SEMANTIC_ATTR14] = 14;
semanticToLocation[SEMANTIC_ATTR15] = 15;
var CHUNKAPI_1_51 = '1.51';
var CHUNKAPI_1_55 = '1.55';
var CHUNKAPI_1_56 = '1.56';
var CHUNKAPI_1_57 = '1.57';
var CHUNKAPI_1_58 = '1.58';
var CHUNKAPI_1_60 = '1.60';
var CHUNKAPI_1_62 = '1.62';
var CHUNKAPI_1_65 = '1.65';
var CHUNKAPI_1_70 = '1.70';
var CHUNKAPI_2_1 = '2.1';
var CHUNKAPI_2_3 = '2.3';
var CHUNKAPI_2_5 = '2.5';

export { ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BINDGROUP_MESH, BINDGROUP_MESH_UB, BINDGROUP_VIEW, BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDEQUATION_REVERSE_SUBTRACT, BLENDEQUATION_SUBTRACT, BLENDMODE_CONSTANT, BLENDMODE_DST_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_CONSTANT, BLENDMODE_ONE_MINUS_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC_COLOR, BLENDMODE_ZERO, BUFFERUSAGE_COPY_DST, BUFFERUSAGE_COPY_SRC, BUFFERUSAGE_INDEX, BUFFERUSAGE_INDIRECT, BUFFERUSAGE_READ, BUFFERUSAGE_STORAGE, BUFFERUSAGE_UNIFORM, BUFFERUSAGE_VERTEX, BUFFERUSAGE_WRITE, BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM, CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_58, CHUNKAPI_1_60, CHUNKAPI_1_62, CHUNKAPI_1_65, CHUNKAPI_1_70, CHUNKAPI_2_1, CHUNKAPI_2_3, CHUNKAPI_2_5, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CUBEFACE_NEGX, CUBEFACE_NEGY, CUBEFACE_NEGZ, CUBEFACE_POSX, CUBEFACE_POSY, CUBEFACE_POSZ, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE, DEVICETYPE_NULL, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, DISPLAYFORMAT_HDR, DISPLAYFORMAT_LDR, DISPLAYFORMAT_LDR_SRGB, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, INDEXFORMAT_UINT8, PIXELFORMAT_111110F, PIXELFORMAT_A8, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ASTC_4x4_SRGB, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BC6F, PIXELFORMAT_BC6UF, PIXELFORMAT_BC7, PIXELFORMAT_BC7_SRGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTH16, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DXT1, PIXELFORMAT_DXT1_SRGB, PIXELFORMAT_DXT3, PIXELFORMAT_DXT3_SRGBA, PIXELFORMAT_DXT5, PIXELFORMAT_DXT5_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ETC2_SRGB, PIXELFORMAT_ETC2_SRGBA, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_R16F, PIXELFORMAT_R16I, PIXELFORMAT_R16U, PIXELFORMAT_R32F, PIXELFORMAT_R32I, PIXELFORMAT_R32U, PIXELFORMAT_R8, PIXELFORMAT_R8I, PIXELFORMAT_R8U, PIXELFORMAT_RG16F, PIXELFORMAT_RG16I, PIXELFORMAT_RG16U, PIXELFORMAT_RG32I, PIXELFORMAT_RG32U, PIXELFORMAT_RG8, PIXELFORMAT_RG8I, PIXELFORMAT_RG8U, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGB565, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA16I, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32I, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA8I, PIXELFORMAT_RGBA8U, PIXELFORMAT_SBGRA8, PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_INT, SAMPLETYPE_UINT, SAMPLETYPE_UNFILTERABLE_FLOAT, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_ATTR5, SEMANTIC_ATTR6, SEMANTIC_ATTR7, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, SHADERTAG_MATERIAL, STENCILOP_DECREMENT, STENCILOP_DECREMENTWRAP, STENCILOP_INCREMENT, STENCILOP_INCREMENTWRAP, STENCILOP_INVERT, STENCILOP_KEEP, STENCILOP_REPLACE, STENCILOP_ZERO, TEXHINT_ASSET, TEXHINT_LIGHTMAP, TEXHINT_NONE, TEXHINT_SHADOWMAP, TEXPROPERTY_ADDRESS_U, TEXPROPERTY_ADDRESS_V, TEXPROPERTY_ADDRESS_W, TEXPROPERTY_ALL, TEXPROPERTY_ANISOTROPY, TEXPROPERTY_COMPARE_FUNC, TEXPROPERTY_COMPARE_ON_READ, TEXPROPERTY_MAG_FILTER, TEXPROPERTY_MIN_FILTER, TEXTUREDIMENSION_1D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_CUBE_ARRAY, TEXTURELOCK_NONE, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_OCTAHEDRAL, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR, TYPE_FLOAT16, TYPE_FLOAT32, TYPE_INT16, TYPE_INT32, TYPE_INT8, TYPE_UINT16, TYPE_UINT32, TYPE_UINT8, UNIFORMTYPE_BOOL, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_ITEXTURE2D, UNIFORMTYPE_ITEXTURE2D_ARRAY, UNIFORMTYPE_ITEXTURE3D, UNIFORMTYPE_ITEXTURECUBE, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_IVEC4, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURE2D_ARRAY, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_UINT, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_UTEXTURE2D, UNIFORMTYPE_UTEXTURE2D_ARRAY, UNIFORMTYPE_UTEXTURE3D, UNIFORMTYPE_UTEXTURECUBE, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_UVEC4, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, UNUSED_UNIFORM_NAME, bindGroupNames, getPixelFormatArrayType, isCompressedPixelFormat, isIntegerPixelFormat, isSrgbPixelFormat, pixelFormatGammaToLinear, pixelFormatInfo, pixelFormatLinearToGamma, requiresManualGamma, semanticToLocation, typedArrayIndexFormats, typedArrayIndexFormatsByteSize, typedArrayToType, typedArrayTypes, typedArrayTypesByteSize, uniformTypeToName, uniformTypeToNameMapWGSL, uniformTypeToNameWGSL, uniformTypeToStorage, vertexTypesNames };
