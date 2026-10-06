import { BitPacking } from '../../core/math/bit-packing.js';
import { BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA } from './constants.js';

var opMask = 7;
var factorMask = 15;
var colorOpShift = 0;
var colorSrcFactorShift = 3;
var colorDstFactorShift = 7;
var alphaOpShift = 11;
var alphaSrcFactorShift = 14;
var alphaDstFactorShift = 18;
var redWriteShift = 22;
var greenWriteShift = 23;
var blueWriteShift = 24;
var alphaWriteShift = 25;
var blendShift = 26;
var allWriteMasks = 15;
var allWriteShift = redWriteShift;
class BlendState {
		set blend(value) {
				this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blendShift);
		}
		get blend() {
				return BitPacking.all(this.target0, blendShift);
		}
		setColorBlend(op, srcFactor, dstFactor) {
				this.target0 = BitPacking.set(this.target0, op, colorOpShift, opMask);
				this.target0 = BitPacking.set(this.target0, srcFactor, colorSrcFactorShift, factorMask);
				this.target0 = BitPacking.set(this.target0, dstFactor, colorDstFactorShift, factorMask);
		}
		setAlphaBlend(op, srcFactor, dstFactor) {
				this.target0 = BitPacking.set(this.target0, op, alphaOpShift, opMask);
				this.target0 = BitPacking.set(this.target0, srcFactor, alphaSrcFactorShift, factorMask);
				this.target0 = BitPacking.set(this.target0, dstFactor, alphaDstFactorShift, factorMask);
		}
		setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite) {
				this.redWrite = redWrite;
				this.greenWrite = greenWrite;
				this.blueWrite = blueWrite;
				this.alphaWrite = alphaWrite;
		}
		get colorOp() {
				return BitPacking.get(this.target0, colorOpShift, opMask);
		}
		get colorSrcFactor() {
				return BitPacking.get(this.target0, colorSrcFactorShift, factorMask);
		}
		get colorDstFactor() {
				return BitPacking.get(this.target0, colorDstFactorShift, factorMask);
		}
		get alphaOp() {
				return BitPacking.get(this.target0, alphaOpShift, opMask);
		}
		get alphaSrcFactor() {
				return BitPacking.get(this.target0, alphaSrcFactorShift, factorMask);
		}
		get alphaDstFactor() {
				return BitPacking.get(this.target0, alphaDstFactorShift, factorMask);
		}
		set redWrite(value) {
				this.target0 = BitPacking.set(this.target0, value ? 1 : 0, redWriteShift);
		}
		get redWrite() {
				return BitPacking.all(this.target0, redWriteShift);
		}
		set greenWrite(value) {
				this.target0 = BitPacking.set(this.target0, value ? 1 : 0, greenWriteShift);
		}
		get greenWrite() {
				return BitPacking.all(this.target0, greenWriteShift);
		}
		set blueWrite(value) {
				this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blueWriteShift);
		}
		get blueWrite() {
				return BitPacking.all(this.target0, blueWriteShift);
		}
		set alphaWrite(value) {
				this.target0 = BitPacking.set(this.target0, value ? 1 : 0, alphaWriteShift);
		}
		get alphaWrite() {
				return BitPacking.all(this.target0, alphaWriteShift);
		}
		get allWrite() {
				return BitPacking.get(this.target0, allWriteShift, allWriteMasks);
		}
		copy(rhs) {
				this.target0 = rhs.target0;
				return this;
		}
		clone() {
				var clone = new this.constructor();
				return clone.copy(this);
		}
		get key() {
				return this.target0;
		}
		equals(rhs) {
				return this.target0 === rhs.target0;
		}
		constructor(blend = false, colorOp = BLENDEQUATION_ADD, colorSrcFactor = BLENDMODE_ONE, colorDstFactor = BLENDMODE_ZERO, alphaOp, alphaSrcFactor, alphaDstFactor, redWrite = true, greenWrite = true, blueWrite = true, alphaWrite = true){
				this.target0 = 0;
				this.setColorBlend(colorOp, colorSrcFactor, colorDstFactor);
				this.setAlphaBlend(alphaOp != null ? alphaOp : colorOp, alphaSrcFactor != null ? alphaSrcFactor : colorSrcFactor, alphaDstFactor != null ? alphaDstFactor : colorDstFactor);
				this.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
				this.blend = blend;
		}
}
BlendState.NOBLEND = Object.freeze(new BlendState());
BlendState.NOWRITE = Object.freeze(new BlendState(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, false, false));
BlendState.ALPHABLEND = Object.freeze(new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA));
BlendState.ADDBLEND = Object.freeze(new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE));

export { BlendState };
