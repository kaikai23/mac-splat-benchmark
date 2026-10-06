var BitPacking = {
		set (storage, value, shift, mask) {
				if (mask === undefined) mask = 1;
				var data = storage & ~(mask << shift);
				return data | value << shift;
		},
		get (storage, shift, mask) {
				if (mask === undefined) mask = 1;
				return storage >> shift & mask;
		},
		all (storage, shift, mask) {
				if (mask === undefined) mask = 1;
				var shifted = mask << shift;
				return (storage & shifted) === shifted;
		},
		any (storage, shift, mask) {
				if (mask === undefined) mask = 1;
				return (storage & mask << shift) !== 0;
		}
};

export { BitPacking };
