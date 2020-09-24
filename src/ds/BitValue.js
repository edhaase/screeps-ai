/**
 * @module
 */

/**
 * @class
 */
export default class BitValue {

	constructor(value) {
		this.value = value || 0;
	}

	isset(bit) {
		return !!(this.value & (1 << bit));
	}

	set(bit) {
		this.value |= (1 << bit);
	}

	unset(bit) {
		this.value &= ~(1 << bit);
	}

	clear() {
		this.value = 0;
	}

	static from(number) {
		if (typeof number !== 'number')
			throw new TypeError(`Expected number`);
		return new this(number);
	}

	toString() {
		return `[BitValue ${this.value}]`;
	}
};