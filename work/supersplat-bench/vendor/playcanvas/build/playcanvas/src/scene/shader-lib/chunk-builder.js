class ChunkBuilder {
		append() {
				for(var _len = arguments.length, chunks = new Array(_len), _key = 0; _key < _len; _key++){
						chunks[_key] = arguments[_key];
				}
				chunks.forEach((chunk)=>{
						if (chunk.endsWith('\n')) {
								this.code += chunk;
						} else {
								this.code += "" + chunk + "\n";
						}
				});
		}
		prepend() {
				for(var _len = arguments.length, chunks = new Array(_len), _key = 0; _key < _len; _key++){
						chunks[_key] = arguments[_key];
				}
				chunks.forEach((chunk)=>{
						if (chunk.endsWith('\n')) {
								this.code = chunk + this.code;
						} else {
								this.code = chunk + "\n" + this.code;
						}
				});
		}
		constructor(){
				this.code = '';
		}
}

export { ChunkBuilder };
