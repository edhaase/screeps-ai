/**  */
'use strict';

export default class BaseArray extends Array {
	/**
	 * 
	 * @param {*} item 
	 */
	remove(item) {
		const i = this.indexOf(item);
		if (i !== -1)
			this.splice(i, 1);
	}

	invoke(method, ...args) {
		for (const item of this)
			item[method](...args);
	}

	/**
	 * 
	 * @param {*} orig 
	 * @param {*} n 
	 */
	static cycle(orig, n) {
		const arr = new this();
		for (var i = 0; i < n; i++)
			arr.push(orig[i % orig.length]);
		return arr;
	}

	/**
     * 
     */
	static repeat(arr, maxCost, maxSize = MAX_CREEP_SIZE) {
		var n = Math.min(maxSize / arr.length, maxCost / UNIT_COST(arr));
		n = Math.floor(n);
		return this.cycle(arr, arr.length * n);
	}

	freeze() {
		Object.freeze(this);
		return this;
	}

	clone() {
		return new this.constructor(...this);
	}

	static get [Symbol.species]() { return Array; }
}