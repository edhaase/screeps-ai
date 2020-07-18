/** /os/core/future.js - Better response time than the promise */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';
import { LogicError } from '/os/core/errors';

/**
 * Futures represent values that don't hold a value _yet_, but intend
 * to resolve eventually. Unlike promises, we aim to fire immediately.
 */
export default class Future {
	constructor(fn) {
		this.value = undefined;
		this.err = undefined;
		this.callbacks = [];
		this.resolved = false;
		if (fn)
			fn(v => this.put(v), err => this.throw(err));
	}

	/**
	 * Resolve this Future with an error.
	 * @param {Error} err 
	 */
	throw(err) {
		if (this.resolved)
			throw new LogicError(`Future already resolved`);
		Log.debug(`Future throwing error ${err}`, 'Future');
		this.err = err;
		this.resolved = true;
		for (const cb of this.callbacks)
			_.attempt(cb, undefined, this.err);
		this.callbacks.length = 0;
		return this;
	}

	/**
	 * Resolve this Future with a value
	 * @param {*} value
	 */
	put(value) {
		if (this.resolved)
			throw new LogicError(`Future already resolved`);
		this.value = value;
		this.resolved = true;
		for (const cb of this.callbacks)
			_.attempt(cb, this.value, undefined);
		this.callbacks.length = 0;
		return this;
	}

	callbacks(fn) {
		fn(v => this.put(v), err => this.throw(err));
		return this;
	}

	/**
	 * Pass in a function to call when this future resolves. If the future is
	 * already resolved, it's called immediately with the results.
	 * 
	 * @param {*} fn 
	 */
	complete(fn) {
		if (!fn || typeof fn !== 'function')
			throw new TypeError(`Expected function, received ${typeof fn}`);
		if (this.resolved)
			fn(this.value, this.err);
		else
			this.callbacks.push(fn);
		return this;
	}

	/** Convert between promises and futures */
	static from(promise) {
		const future = new this();
		promise
			.then((res) => future.put(res))
			.catch((err) => future.throw(err));
		return future;
	}

	/** Utilitiy */
	static all(futures) {
		if (!futures)
			throw new TypeError(`Expected array`);
		if (!futures.length)
			return Future.resolve([]);
		var count = futures.length;
		const future = new this();
		for (const f of futures) {
			f.complete((val, err) => {
				if (err)
					future.throw(err);
				else if (--count <= 0 && !future.resolved) {
					future.put(_.map(futures, 'value'));
				}
			});
		}
		return future;
	}

	static resolve(v) {
		const future = new this();
		future.put(v);
		return future;
	}

	static reject(err) {
		const future = new this();
		future.throw(err);
		return future;
	}

	toString() {
		if (this.value)
			return `[Future ${this.value}]`;
		return `[Future]`;
	}
};