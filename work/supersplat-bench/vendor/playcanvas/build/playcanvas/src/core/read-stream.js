class ReadStream {
		get remainingBytes() {
				return this.dataView.byteLength - this.offset;
		}
		reset(offset) {
				if (offset === undefined) offset = 0;
				this.offset = offset;
		}
		skip(bytes) {
				this.offset += bytes;
		}
		align(bytes) {
				this.offset = this.offset + bytes - 1 & ~(bytes - 1);
		}
		_inc(amount) {
				this.offset += amount;
				return this.offset - amount;
		}
		readChar() {
				return String.fromCharCode(this.dataView.getUint8(this.offset++));
		}
		readChars(numChars) {
				var result = '';
				for(var i = 0; i < numChars; ++i){
						result += this.readChar();
				}
				return result;
		}
		readU8() {
				return this.dataView.getUint8(this.offset++);
		}
		readU16() {
				return this.dataView.getUint16(this._inc(2), true);
		}
		readU32() {
				return this.dataView.getUint32(this._inc(4), true);
		}
		readU64() {
				return this.readU32() + 2 ** 32 * this.readU32();
		}
		readU32be() {
				return this.dataView.getUint32(this._inc(4), false);
		}
		readArray(result) {
				for(var i = 0; i < result.length; ++i){
						result[i] = this.readU8();
				}
		}
		readLine() {
				var view = this.dataView;
				var result = '';
				while(true){
						if (this.offset >= view.byteLength) {
								break;
						}
						var c = String.fromCharCode(this.readU8());
						if (c === '\n') {
								break;
						}
						result += c;
				}
				return result;
		}
		constructor(arraybuffer){
				this.offset = 0;
				this.arraybuffer = arraybuffer;
				this.dataView = new DataView(arraybuffer);
		}
}

export { ReadStream };
