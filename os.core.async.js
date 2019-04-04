/**
 * Coroutine functionality library
 */
'use strict';

const { AbortError } = require('os.core.errors');

module.exports = {
	/**
	 * Sequential map
	 * 
	 * @param {*} arr 
	 * @param {*} co 
	 * 
	 * const result = yield* async.map(arr, co);
	 */
	*mapSeq(arr, co) {
		const output = [];
		for (const d of arr) {
			const dx = yield* co(d);
			output.push(dx);
		}
		return output;
	},

	/**
	 * Parallel map
	 * @param {*} arr 
	 * @param {*} co 
	 */
	*mapPar(arr, co) {
		const work = [];
		for (var pos = 0; pos < arr.length; pos++) {
			const gen = co(arr[pos]);
			gen.pos = pos;
			work.push(gen);
		}

		const output = new Array(arr.length);
		while (work.length && !(yield)) {
			for (let i = work.length - 1; i >= 0; i--) {
				const gen = work[i];
				const { value, done } = gen.next();
				if (!done)
					continue;
				work.splice(i, 1);
				output[gen.pos] = value;
			}
		}
		return output;
	},

	/**
	 * 
	 * @param {*} arr 
	 * @param {*} co 
	 * 
	 * const result = yield* async.filter([1,2,3], )
	 */
	*filterSeq(arr, co) {
		const output = [];
		for (const d of arr) {
			// if (Game.cpu.getUsed() >)
			if (yield* co(d))
				output.push(d);
		}
		return output;
	},

	/**
	 * Parallel filter
	 * @param {*} arr 
	 * @param {*} co 
	 */
	*filterPar(arr, co) {
		const results = this.mapPar(arr, co);
		return results.filter(x => x); // return only truthy values
	},

	/**
	 * 
	 * @param {*} arr 
	 * @param {*} co 
	 */
	*each(arr, co, thisArg) {
		for (const d of arr)
			yield* co.call(thisArg, d);
	},

	/**
	 * Starts and runs multiple coroutines, returns when all are done.
	 */
	*concurrent(arr, limit = 5) {
		const active = [];
		const pending = arr.slice(0); // clone array

		while (active.length || pending.length) {
			// Populate up to limit
			while (active.length < limit && pending.length > 0) {
				active.push(pending.pop());
				// Log.debug(`async.conc start coro`);
			}
			// Run and purge empty
			for (var i = active.length - 1; i >= 0; i--) {
				const { done } = active[i].next();
				if (!done)
					continue;
				active.splice(i, 1);
				// Log.debug(`async.conc end coro`);
			}
			yield;
		}
	},

	*wait(fn) {
		while (!fn())
			yield;
	},

	*waitForTick(tick) {
		while (Game.time < tick)
			yield;
	},

	*waitForCpu() {
		while (Game.cpu.getUsed() > Game.cpu.limit)
			yield;
	},

	/**
	 * Returns when any routine is complete
	 * 
	 * @param {*} arr 
	 */
	*race(arr, abort = true) {
		while (!(yield)) {
			for (var x of arr) {
				const { done, value } = x.next();
				if (!done)
					continue;
				if (abort) {
					for (var y of arr) {
						if (y !== x)
							y.throw(new AbortError());
					}
				}
				return value;
			}
		}
	},

	/**
	 * Returns when all routines complete
	 * 
	 * @param {*} arr 
	 */
	*all(arr) {

	}

};