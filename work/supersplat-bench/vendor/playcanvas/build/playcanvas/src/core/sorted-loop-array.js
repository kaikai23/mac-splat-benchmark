class SortedLoopArray {
		_binarySearch(item) {
				var left = 0;
				var right = this.items.length - 1;
				var search = item[this._sortBy];
				var middle;
				var current;
				while(left <= right){
						middle = Math.floor((left + right) / 2);
						current = this.items[middle][this._sortBy];
						if (current <= search) {
								left = middle + 1;
						} else if (current > search) {
								right = middle - 1;
						}
				}
				return left;
		}
		_doSort(a, b) {
				var sortBy = this._sortBy;
				return a[sortBy] - b[sortBy];
		}
		insert(item) {
				var index = this._binarySearch(item);
				this.items.splice(index, 0, item);
				this.length++;
				if (this.loopIndex >= index) {
						this.loopIndex++;
				}
		}
		append(item) {
				this.items.push(item);
				this.length++;
		}
		remove(item) {
				var idx = this.items.indexOf(item);
				if (idx < 0) return;
				this.items.splice(idx, 1);
				this.length--;
				if (this.loopIndex >= idx) {
						this.loopIndex--;
				}
		}
		sort() {
				var current = this.loopIndex >= 0 ? this.items[this.loopIndex] : null;
				this.items.sort(this._sortHandler);
				if (current !== null) {
						this.loopIndex = this.items.indexOf(current);
				}
		}
		constructor(args){
				this.items = [];
				this.length = 0;
				this.loopIndex = -1;
				this._sortBy = args.sortBy;
				this._sortHandler = this._doSort.bind(this);
		}
}

export { SortedLoopArray };
