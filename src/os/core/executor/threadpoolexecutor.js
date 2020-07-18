/** /os/core/executor.threadpool */
'use strict';

import Future from '/os/core/future';

const DEFAULT_MAX_THREADS = 4;
const DEFAULT_IDLE_LIMIT = 5; // Number of ticks without work before a thread exits

/**
 * Takes items for processing and automatically spins up threads
 * to handle, allowing all threads to exit when work is complete.
 */
export default class ThreadPoolExecutor {
	/**
	 * 
	 * @param {*} process - can take process or kernel
	 * @param {*} co 
	 * @param {*} opts 
	 */
	constructor(process, co, opts = {}) {
		this.process = process;
		this.co = co;
		this.opts = opts;
		this.threads = new Set();
		this.items = [];

		this.id = ThreadPoolExecutor.NEXT_ID++;
		this.wid = 0;
		this.debug(`New thread pool ${this.id}`);
	}

	get max_threads() {
		return this.opts.max_threads || DEFAULT_MAX_THREADS;
	}

	get max_idle() {
		return this.opts.max_idle || DEFAULT_IDLE_LIMIT;
	}

	/**
	 * Submit an item for processing, start a thread if we aren't at max.
	 * 
	 * @param {...*} args
	 * 
	 * @returns Future - in case we want to wait for the result
	 */
	submit(...args) {
		const future = new Future((cb, rej) => this.items.push([args, cb, rej]));
		if (this.threads.size >= this.max_threads)
			return future;
		if (!(this.threads.size <= 0 || this.items.length > this.threads.size * 2))
			return future;
		const wid = this.wid++;
		const thread = this.process.kernel.startThread(this.run, [wid], this.opts.priority, `Thread pool ${this.id} worker ${wid}`, this.process.pid, this);
		this.threads.add(thread);
		thread.complete(() => this.threads.delete(thread));
		this.debug(`Thread pool ${this.id} starting thread #${wid} on tick ${Game.time}`);
		return future;
	}

	/**
	 * Thread run function. While we have items, pull items to work on,
	 * otherwise shutdown the thread.
	 */
	*run(wid) {
		let idle = 0;
		while (true) {
			const [args, cb, rej] = this.items.shift() || [];
			if (args) {
				idle = 0;
				try {
					const result = yield* this.co.apply(this.process, args);
					cb(result);
				} catch (e) {
					rej(e);
				}
				yield true;	// Attempt to run again this tick, but other threads should run first.
				continue;
			}
			if (++idle >= this.max_idle)
				break;
			else
				yield; // pause for the tick
		}
		this.debug(`TP${this.id}:${wid} worker thread exiting`);
	}

	debug(msg) {
		if (this.opts.debugging)
			this.process.debug(msg);
	}
}

ThreadPoolExecutor.NEXT_ID = 0;