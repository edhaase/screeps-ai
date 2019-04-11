/** os.core.future.js - Better response time than the promise */
'use strict';

/**
 * Futures represent values that don't hold a value _yet_, but intend
 * to resolve eventually. Unlike promises, we aim to fire immediately.
 */
class Future {
	/**
	 * ex `new Future( (res,rej) => res(4) )`
	 */
	constructor(fn) {
		this.value = undefined;
		this.err = undefined;

		// this.complete = (val, err) => 

		const res = (val) => this.value = val;
		const rej = (err) => this.err = err;
		try {
			fn(res, rej);
		} catch (err) {
			rej(err);
		}
	}

	/** Create static resolved values e.g. Future.resolve(4) */
	static resolve(value) {
		return new this((res) => res(value));
	}

	static reject(value) {
		return new this((res, rej) => rej(value));
	}

	get resolved() {
		return this.value !== undefined || this.err !== undefined;
	}

	/** The chain, called on resolution.  */
	then(fn) {
		return new this((res, rej) => fn());
	}

	catch(fn) {

	}

	finally(fn) {

	}
}

module.exports = Future;