import { Color } from '../../core/math/color.js';

var COLOR_RED = Object.freeze(new Color(1, 0.3, 0.3));
var COLOR_GREEN = Object.freeze(new Color(0.3, 1, 0.3));
var COLOR_BLUE = Object.freeze(new Color(0.3, 0.3, 1));
var COLOR_YELLOW = Object.freeze(new Color(1, 1, 0.5));
var COLOR_GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 0.5));
var color3from4 = (color)=>{
		return new Color(color.r, color.g, color.b);
};
var color4from3 = (color, a)=>{
		return new Color(color.r, color.g, color.b, a);
};

export { COLOR_BLUE, COLOR_GRAY, COLOR_GREEN, COLOR_RED, COLOR_YELLOW, color3from4, color4from3 };
