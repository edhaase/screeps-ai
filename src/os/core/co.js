/**
 * Coroutine functionality library
 */
'use strict';

const { AbortError } = require('os.core.errors');

/**
 * Endless polling loop
 */
exports.forever = function* (co, delay = 0, ...args) {
	while (true) {
		yield* co.call(this, ...args);
		for (var i = delay || 0; i >= 0; i--)
			yield;
	}
};

/**
 * Sequential map
 * 
 * @param {*} arr 
 * @param {*} co 
 * 
 * const result = yield* async.map(arr, co);
 */
exports.mapSeq = function* mapSeq(arr, co) {
	const output = [];
	for (const d of arr) {
		const dx = yield* co(d);
		output.push(dx);
	}
	return output;
};


/**
 * Parallel map
 * @param {*} arr 
 * @param {*} co 
 */
exports.mapPar = function* mapPar(arr, co) {
	const work = [];
	for (var pos = 0; pos < arr.length; pos++) {
		const gen = co(arr[pos]);
		gen.pos = pos;
		work.push(gen);
	}

	const output = new Array(arr.length);
	while (work.length) {
		for (let i = work.length - 1; i >= 0; i--) {
			const gen = work[i];
			const { value, done } = gen.next();
			if (!done)
				continue;
			work.splice(i, 1);
			output[gen.pos] = value;
		}
		if (work.length)
			yield;
	}
	return output;
};

/**
 * 
 * @param {*} arr 
 * @param {*} co 
 * 
 * const result = yield* async.filter([1,2,3], )
 */
exports.filterSeq = function* filterSeq(arr, co) {
	const output = [];
	for (const d of arr) {
		// if (Game.cpu.getUsed() >)
		if (yield* co(d))
			output.push(d);
	}
	return output;
};

/**
 * Parallel filter
 * @param {*} arr 
 * @param {*} co 
 */
exports.filterPar = function* filterPar(arr, co) {
	const results = this.mapPar(arr, co);
	return results.filter(x => x); // return only truthy values
};

/**
 * 
 * @param {*} arr 
 * @param {*} co 
 */
exports.each = function* each(arr, co, thisArg) {
	for (const d of arr)
		yield* co.call(thisArg, d);
};

/**
 * Starts and runs multiple coroutines, returns when all are done.
 */
exports.concurrent = function* concurrent(arr, limit = 5) {
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
};

exports.wait = function* wait(fn) {
	while (!fn())
		yield;
};

exports.waitForTick = function* waitForTick(tick) {
	while (Game.time < tick)
		yield;
};

exports.waitForCpu = function* waitForCpu() {
	while (Game.cpu.getUsed() > (global.kernel.throttle || Game.cpu.limit))
		yield;
};

/**
 * Returns when any routine is complete
 * 
 * @param {*} arr 
 */
exports.race = function* race(arr, abort = true) {
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
};

/**
 * Returns when all routines complete
 * 
 * @param {*} arr 
 */
exports.all = function* all(arr) {

};