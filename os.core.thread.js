/** os.core.thread.js */
'use strict';

/* global ENV, ENVC, MM_AVG, Log */

const { TimeLimitExceeded } = require('os.core.errors');

const THREAD_CONTINUE = { done: false, value: undefined };
const DEFAULT_WAIT_TIMEOUT = 100;

class Thread {
	constructor(co, pid, desc) {
		this.co = co;
		this.promise = new Promise((res, rej) => {
			this.res = res;
			this.rej = rej;
		});
		this.pid = pid;
		this.avgUsrCpu = 0;
		this.avgSysCpu = 0;
		this.minCpu = Infinity;
		this.maxCpu = -Infinity;
		this.state = Thread.STATE_RUNNING;
		this.desc = desc;
		this.born = Game.time;
	}

	/** Pretend to be a promise */
	then() {
		return this.promise.then.apply(this.promise, arguments);
	}

	catch() {
		return this.promise.catch.apply(this.promise, arguments);
	}

	/** Pretend to be a generator */
	throw(k) {
		try {
			this.co.throw(k);
		} catch (e) {
			this.rej(e);
		}
	}

	tick(k) {
		this.lastRunUsrTick = Game.time;
		const start = Game.cpu.getUsed();
		try {
			if (this.pending_error)
				return this.co.throw(this.pending_error);
			else
				return this.co.next(this.pending_deliver || k);
		} finally {
			const delta = Game.cpu.getUsed() - start;
			this.lastRunCpu = delta;
			this.minCpu = Math.max(0, Math.min(this.minCpu, delta)); // Already initialized on attach (But why were we getting negative numbers?)
			this.maxCpu = Math.min(Game.cpu.tickLimit - 1, Math.max(this.maxCpu, delta));
			this.avgUsrCpu = MM_AVG(delta, this.avgUsrCpu);	// Tracks only samples of when a thread actually runs	

			this.pending_deliver = undefined;
			this.pending_error = undefined;
			this.wait_timeout = undefined;
		}
	}

	next(k) {
		try {
			if (this.wait_timeout !== undefined && Game.time > this.wait_timeout)
				throw new TimeLimitExceeded(`IO Timeout`); // Don't allow it to be caught
			if (this.timeout !== undefined && Game.time > this.timeout) // Even pending threads can time out
				throw new TimeLimitExceeded(`Thread exceeded time limit`); // Don't allow it to be caught
			if (this.state === Thread.STATE_PENDING)
				return THREAD_CONTINUE; // We're waiting for a response.
			if (this.sleep && Game.time < this.sleep)
				return THREAD_CONTINUE;

			const result = this.tick(k);
			const { done, value } = result;
			if (done)
				this.res(result.value);
			else if (value instanceof Promise || value instanceof Thread) {
				Log.debug(`Thread ${this.tid}/${this.desc} yielded promise on tick ${Game.time}`, 'Kernel');
				this.state = Thread.STATE_PENDING;
				value // Keep this short, promise resolution is janky.
					.then((res) => this.pending_deliver = res)
					.catch((err) => this.pending_error = err)
					.then(() => this.state = Thread.STATE_RUNNING)
					;
				const WAIT_TIMEOUT = ENVC('threads.wait_timeout', DEFAULT_WAIT_TIMEOUT, 0);
				if (value.timeout)
					this.wait_timeout = Game.time + value.timeout;
				else if (WAIT_TIMEOUT > 0)
					this.wait_timeout = Game.time + WAIT_TIMEOUT;
				return THREAD_CONTINUE; // Lie, we're handling this matter internally.
			}
			return result;
		} catch (e) {
			this.rej(e);
			throw e;		// Rethrow so we can kill the thread
		}
	}

	toString() {
		if (this.desc)
			return `[Thread ${this.tid} - ${this.desc}]`;
		else
			return `[Thread ${this.tid}]`;
	}
}

Thread.STATE_PENDING = 'PENDING';	// Waiting for a promise to resolve
Thread.STATE_RUNNING = 'RUNNING';	// Running threads
Thread.STATE_ACTIVE = 'ACTIVE';		// Current running thread

module.exports = Thread;