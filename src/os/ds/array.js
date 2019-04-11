/**  */
'use strict';

class BaseArray extends Array {
	remove(item) {
		const i = this.indexOf(item);
		if (i !== -1)
			this.splice(i, 1);
	}

	static get [Symbol.species]() { return Array; }
}

module.exports = BaseArray;