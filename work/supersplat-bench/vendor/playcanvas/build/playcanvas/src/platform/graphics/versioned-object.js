import { Version } from './version.js';

var idCounter = 0;
class VersionedObject {
		increment() {
				this.version.revision++;
		}
		constructor(){
				idCounter++;
				this.version = new Version();
				this.version.globalId = idCounter;
		}
}

export { VersionedObject };
