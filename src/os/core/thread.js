/** /os/core/thread.js */
'use strict';

/* global ENV, ENVC, MM_AVG, Log */
import { MM_AVG, CLAMP } from '/os/core/math';
import { TimeLimitExceeded } from '/os/core/errors';
import Future from '/os/core/future';
import { ENV, ENVC } from '/os/core/macros';
import { Log, LOG_LEVEL } from '/os/core/Log';

export const THREAD_CONTINUE = { done: false, value: undefined };
export const DEFAULT_WAIT_TIMEOUT = 100;

export default class Thread {
	constructor(co, pid, desc) {
		this.co = co;
		this.future = new Future((res, rej) => {
			this.res = res;
			this.rej = rej;
		});
		this.pid = pid;
		this.avgUsrCpu = 0;
		this.avgSysCpu = 0;
		this.minCpu = Infinity;
		this.maxCpu = -Infinity;
		this.minTickCpu = Infinity;
		this.maxTickCpu = -Infinity;
		this.lastTickSysCpu = 0;
		this.lastTickUsrCpu = 0;
		this.state = Thread.STATE_RUNNING;
		this.desc = desc;
		this.born = Game.time;
		this.local = {}; // poor man's thread local scope
	}

	complete(fn) {
		return this.future.complete(fn);
	}

	/** Pretend to be a generator */
	throw(k) {
		try {
			this.co.throw(k);
		} catch (e) {
			this.rej(e);
		}
	}

	tick() {
		const start = Game.cpu.getUsed();
		try {
			if (this.pending_error)
				return this.co.throw(this.pending_error);
			else
				return this.co.next(this.pending_deliver);
		} finally {
			const delta = Game.cpu.getUsed() - start;
			this.lastRunUsrTick = Game.time;

			// Per tick stats, only update if the value makes sense.
			if (delta >= 0 && delta <= Game.cpu.tickLimit) {
				this.lastTickUsrCpu += delta;

				// Iteration stats
				this.lastRunCpu = delta;
				this.minCpu = CLAMP(0, delta, this.minCpu); // Already initialized on attach (But why were we getting negative numbers?)
				this.maxCpu = CLAMP(this.maxCpu, delta, Game.cpu.tickLimit - 1);
				this.avgUsrCpu = MM_AVG(delta, this.avgUsrCpu);	// Tracks only samples of when a thread actually runs	
			}

			// Reset pending deliverables
			this.pending_deliver = undefined;
			this.pending_error = undefined;
			this.wait_timeout = undefined;
		}
	}

	next() {
		try {
			// @todo TimeLimitExceeded should be injected so we can resolve it
			if (this.wait_timeout !== undefined && Game.time > this.wait_timeout) {
				this.pending_error = new TimeLimitExceeded(`IO Timeout`); // Don't allow it to be caught
				this.state = Thread.STATE_RUNNING;
			}
			if (this.timeout !== undefined && Game.time > this.timeout) { // Even pending threads can time out
				this.pending_error = new TimeLimitExceeded(`Thread exceeded time limit`); // Don't allow it to be caught
				this.state = Thread.STATE_RUNNING;
			}
			if (this.state === Thread.STATE_PENDING)
				return THREAD_CONTINUE; // We're waiting for a response.
			if (this.sleep && Game.time < this.sleep)
				return THREAD_CONTINUE;

			const result = this.tick();
			const { done, value } = result;
			if (done)
				this.res(result.value);
			else if (value == null || value === false || value === true)
				return result;
			else if (value instanceof Promise || value instanceof Thread || value instanceof Future) {
				this.state = Thread.STATE_PENDING;
				const WAIT_TIMEOUT = ENVC('threads.wait_timeout', DEFAULT_WAIT_TIMEOUT, 0);
				if (value.timeout != null)
					this.wait_timeout = Game.time + value.timeout;
				else if (WAIT_TIMEOUT > 0)
					this.wait_timeout = Game.time + WAIT_TIMEOUT;

				// Do this last, because we might fire before this iteration is done
				if (value instanceof Future || value instanceof Thread) {
					Log.debug(`Thread ${this.pid}/${this.tid} (${this.desc}) yielded future on tick ${Game.time}`, 'Kernel');
					value.complete((v, err) => {
						Log.debug(`Thread ${this.pid}/${this.tid} (${this.desc}) future resolved on tick ${Game.time}`, 'Kernel');
						this.state = Thread.STATE_RUNNING;
						this.pending_deliver = v;
						this.pending_error = err;
						if (this.lastRunSysTick === Game.time)	// We've already been skipped, queue us up to run again.
							this.kernel.queue.unshift(this);
					});
				} else {
					Log.debug(`Thread ${this.tid}/${this.desc} yielded promise on tick ${Game.time}`, 'Kernel');
					value // Keep this short, promise resolution is janky.
						.then((res) => this.pending_deliver = res)
						.catch((err) => this.pending_error = err)
						.then(() => this.state = Thread.STATE_RUNNING)
						;
				}
				return THREAD_CONTINUE; // Lie, we're handling this matter internally.
			} /* else {
				const isArray = Array.isArray(value);
				const con = value.constructor ? value.constructor.name : 'No constructor'; 
				const specs = `isArray: ${isArray}, Type: ${typeof value}, Constructor: ${con}`;
				Log.debug(`Thread ${this.pid}/${this.tid} (${this.desc}) yielded unknown value: ${value} ${specs}`, 'Kernel');
			} */
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