/** AbstractKernel.js - Base implementation */
'use strict';

/* global ENV, ENVC, SEGMENT_PROC, MM_AVG, DEFERRED_MODULES, MAKE_CONSTANT, Log */

const Async = require('os.core.async');
const BaseArray = require('os.ds.array');
const BaseMap = require('os.ds.map');
const ForeignSegment = require('os.core.network.foreign');
const LazyMap = require('os.ds.lazymap');
const LazyWeakMap = require('os.ds.lazyweakmap');
const Pager = require('os.core.pager');
const PriorityQueue = require('os.ds.pq');
const Process = require('os.core.process');

const { OperationNotPermitted } = require('os.core.errors');

const MAX_PRECISION = 7;
const DEFAULT_PRECISION = 5;
global.CPU_PRECISION = ENVC('process.default_cpu_precision', DEFAULT_PRECISION, 0, MAX_PRECISION);

// @todo load stats once, sync to heap, switch to write only
// @todo base stats logging (to segment) [bucket, cpu, cpu.used, gcl, gpl, heap]
// @todo os stats logging [kernel, process, threads, #running, #pending, #asleep]
// @todo market logging [prices]
// add os.async
// kill process with zero threads
// Improve error handling (macaros?)
// Total cpu loading / #ticks to load
class Kernel {

	constructor() {
		/** We're a process! Sort of. */
		MAKE_CONSTANT(this, 'pid', 0);
		MAKE_CONSTANT(this, 'name', 'kernel');
		MAKE_CONSTANT(this, 'friendlyName', 'Kernel');
		MAKE_CONSTANT(this, 'born', Game.time);
		MAKE_CONSTANT(this, 'instantiated', Game.time);
		MAKE_CONSTANT(this, 'priority', Process.PRIORITY_CRITICAL);
		// this.minCpu = Infinity;
		// this.maxCpu = -Infinity;

		/** Kernel specific stuff */
		MAKE_CONSTANT(this, 'process', new Map());
		MAKE_CONSTANT(this, 'processByName', new LazyMap(() => new BaseArray()));
		MAKE_CONSTANT(this, 'threads', new BaseMap());
		MAKE_CONSTANT(this, 'threadsByProcess', new LazyWeakMap(() => new Map()));
		MAKE_CONSTANT(this, 'schedule', new PriorityQueue(null, (itm) => itm.priority));
		this.queue = [];
		this.process.set(0, this);
		this.processByName.set('kernel', [this]);

		this.postTickFn = {};	// Clear the post-tick actions list
		this.halt = false;
		this.throttle = Game.cpu.tickLimit;
		Log.debug(`New kernel on tick ${Game.time}`, 'Kernel');
	}

	/**
	 *
	 */
	*tick() {
		try {
			yield* this.wire(); // Prototypes must be loaded first
			this.startThread(this.init, [], Process.PRIORITY_CRITICAL, 'Init thread');
			this.startThread(Pager.tick, [], Process.PRIORITY_IDLE, 'Pager thread');	// We want this to run last
			this.startThread(ForeignSegment.tick, [], Process.PRIORITY_IDLE, 'Foreign segment thread');
			yield* this.loop();
		} catch (e) {
			throw e;
		}
	}

	*wire() {
		for (const m of DEFERRED_MODULES) {
			if (Game.cpu.getUsed() / Game.cpu.tickLimit > 0.90) {
				Log.warn(`Module loader has yielded on ${Game.time}`, 'Kernel');
				yield;
			}
			require(m);
		}
	}

	*init() {
		Log.debug(`Init started on ${Game.time}`, 'Kernel');
		const [page] = yield* Pager.read([SEGMENT_PROC]);
		Log.debug(`Process table fetched at ${Game.time}`, 'Kernel');
		this.proc = JSON.parse(page || '[]');

		for (const entry of this.proc) {
			if (Game.cpu.getUsed() / Game.cpu.tickLimit > 0.90)
				yield Log.warn(`Process loader has yielded on ${Game.time}`, 'Kernel');
			this.cpid = entry.pid;
			this.ctid = null;  // In case we call a thread specific method during class construction
			const p = Process.deserializeByProcessName(entry);
			this.processByName.get(p.name).push(p);
			Log.debug(`Reloaded ${p} on tick ${Game.time}`, 'Kernel');
			this.process.set(p.pid, p);
		}
		// Call reload methods _after_ all process deserialized in case one of them needs to find another
		for (const [, p] of this.process) {
			if (Game.cpu.getUsed() / Game.cpu.tickLimit > 0.90)
				yield Log.warn(`Process loader has yielded on ${Game.time}`, 'Kernel');
			this.cpid = p.pid;
			if (p && p.onReload)
				p.onReload();
		}

		Log.info(`Init complete on tick ${Game.time}`, 'Kernel');
	}

	saveProcessTable() {
		Log.debug(`Saving process table on tick ${Game.time}`, 'Kernel');
		Pager.write(SEGMENT_PROC, JSON.stringify(this.proc));
	}

	startProcess(name, opts = {}, ppid) {
		const entry = _.clone(opts);
		entry.pid = Process.getNextId();
		entry.ppid = ppid;
		entry.name = name;
		const parent = this.process.get(ppid);
		const p = Process.deserializeByProcessName(entry);
		this.threadsByProcess.set(p, new Map());
		this.processByName.get(p.name).push(p);
		const prevTid = this.ctid;
		const prevPid = this.cpid;
		this.cpid = entry.pid;
		this.ctid = entry.tid;
		this.process.set(entry.pid, p);
		this.proc.push(entry);
		if (p.onStart)
			p.onStart();
		if (p.onReload)
			p.onReload();
		if (parent && parent.onChildStart)
			parent.onChildStart(entry.pid, p);
		this.ctid = prevTid;
		this.cpid = prevPid;
		this.postTick(() => this.saveProcessTable());
		return p;
	}

	killProcess(pid) {
		if (pid === 0)
			throw new OperationNotPermitted(`Unable to kill kernel`);
		const process = this.process.get(pid);
		const parent = (process && process.parent);
		this.process.delete(pid);			// Remove process instance from map
		_.remove(this.proc, 'pid', pid);	// Remove process entry from memory		

		try {
			this.processByName.get(process.name).remove(process);	// Remove process from name index
			if (process && process.onExit)
				process.onExit();
			if (parent && parent.onChildExit)
				parent.onChildExit(pid, process);
		} finally {
			this.postTick(() => this.saveProcessTable());
			this.postTick(() => _.remove(this.schedule, t => !this.threads.has(t.tid)), 'PurgeKilledThreads');
		}
	}

	getProcessByName(name) {
		return this.processByName.get(name);
	}

	/** register end-of-tick behavior */
	postTick(fn, key = fn.toString()) {
		this.postTickFn[key] = fn;
	}

	*loop() {
		while (!this.halt) {
			const MIN_CPU_THIS_TICK = Math.min(Game.cpu.limt, Game.cpu.tickLimit);
			this.throttle = (Game.cpu.bucket / global.BUCKET_MAX > 0.5) ? Game.cpu.tickLimit : MIN_CPU_THIS_TICK;
			this.queue = this.schedule.slice(0);
			var thread; // , i = this.queue.length - 1;
			while ((thread = this.queue.pop()) != null) {
				if (Game.cpu.getUsed() + thread.avgUsrCpu >= this.throttle) {
					this.lastRunCpu = Game.cpu.getUsed();
					Log.warn(`Kernel paused at ${this.lastRunCpu} / ${this.throttle} cpu usage on tick ${Game.time}`, 'Kernel');  // continue running next tick to prevent starvation
					break;
				}
				const start = Game.cpu.getUsed();
				try {
					this.runThread(thread);
				} catch (e) {
					Log.error(e.stack, 'Kernel');
					yield* Async.waitForTick(Game.time + 5);
				}
				thread.lastRunTick = Game.time;
				const delta = Game.cpu.getUsed() - start;
				thread.avgSysCpu = MM_AVG(delta, thread.avgSysCpu); // May count zeroes for sleeping threads
			}

			// Post tick cleanup
			for (const action in this.postTickFn) {
				try {
					this.postTickFn[action]();
				} catch (e) {
					Log.error(`Unable to complete post tick cleanup`, 'Kernel');
					Log.error(e.stack);
				}
			}
			this.postTickFn = {};	// Clear the post-tick actions list
			this.lastRunCpu = Game.cpu.getUsed();
			yield;
		}
	}

	runThread(thread, maxTimes = global.MAX_THREAD_RUN_PER_TICK) {
		this.ctid = thread.tid;
		this.cpid = thread.pid;
		const process = this.process.get(thread.pid);
		try {
			if (!process) {
				Log.debug(`${thread.pid}/${thread.tid} Orphaned thread killed on tick ${Game.time} (age ${Game.time - thread.born} ticks)`, 'Kernel');
				this.killThread(thread.tid);
				return;
			} else if (process.ppid && !this.process.has(process.ppid)) {
				Log.warn(`${thread.pid}/${thread.tid} Orphan process ${process.name} killed on tick ${Game.time} (age ${Game.time - process.born} ticks)`);
				this.killProcess(process.pid);
				return;
			} else if (process.sleep && Game.time < process.sleep) {
				return;
			}

			if (thread.sleep && Game.time < thread.sleep)
				return;
			if (thread.timeout !== undefined && Game.time > thread.timeout)
				thread.throw(new Error(`Thread exceeded time limit`));
			const start = Game.cpu.getUsed();
			const { done, value } = thread.next();
			const delta = Game.cpu.getUsed() - start;
			thread.lastRunCpu = delta;
			thread.minCpu = Math.max(0, Math.min(thread.minCpu, delta)); // Already initialized on attach (But why were we getting negative numbers?)
			thread.maxCpu = Math.min(Game.cpu.tickLimit - 1, Math.max(thread.maxCpu, delta));
			thread.avgUsrCpu = MM_AVG(delta, thread.avgUsrCpu);	// Tracks only samples of when a thread actually runs
			if (done) {
				Log.debug(`${thread.pid}/${thread.tid} Thread exiting normally on tick ${Game.time} (age ${Game.time - thread.born} ticks) [${thread.desc}]`, 'Kernel');
				this.killThread(thread.tid);
				return;
			} else if (value === true && maxTimes > 0) {
				this.runThread(thread, maxTimes - 1);
			}

		} catch (e) {
			Log.error(`${thread.pid}/${thread.tid} Uncaught thread exception [${thread.desc}]`, 'Kernel');
			Log.error(e.stack);
			this.killThread(thread.tid);
			if (process && process.flags & Process.FLAG_ALL_THREADS_CRITICAL)
				this.killProcess(process.pid);
		} finally {
			this.ctid = null;
			this.cpid = null;
		}
	}

	killThread(tid) {
		const thread = this.threads.get(tid);
		this.threads.delete(thread.tid);
		try {
			const process = this.process.get(thread.pid);
			if (!process) {
				Log.debug(`No process found for ${thread.pid}, no further cleanup needed`, 'Kernel');
				return;
			}
			const threadGroup = this.threadsByProcess.get(process);
			threadGroup.delete(thread.tid);
			if (process.onThreadExit)
				process.onThreadExit(thread.tid, thread);
			if (threadGroup.size <= 0 && thread.pid !== 0) {
				Log.warn(`${thread.pid}/${thread.tid}/${process.name} Last thread exiting, terminating process on tick ${Game.time} (age ${Game.time - process.born} ticks)`, 'Kernel');
				this.killProcess(thread.pid);
			}
		} catch (e) {
			Log.error(`Uncaught error while killing thread ${tid} on tick ${Game.time}`, 'Kernel');
			Log.error(e.stack);
		} finally {
			this.postTick(() => _.remove(this.schedule, t => !this.threads.has(t.tid)), 'PurgeKilledThreads');
		}
	}

	startThread(co, args = [], prio, desc, pid = this.cpid || 0) {
		const thread = co.apply(this, args);
		thread.desc = desc;
		return this.attachThread(thread, prio, pid);
	}

	/** Attach a separately created thread (kernel.attachThread(doStuff(42))) */
	attachThread(thread, tprio = Process.PRIORITY_DEFAULT, pid = this.cpid) {
		// const thread = (coro instanceof GeneratorFunction) ? coro : coro();	
		const process = this.process.get(pid);
		if (!process)
			throw new Error(`Can not attach thread, no such process ${pid}`);
		if (!thread.tid)
			thread.tid = Process.getNextId('T');
		thread.pid = pid;
		thread.avgUsrCpu = 0;
		thread.avgSysCpu = 0;
		thread.minCpu = Infinity;
		thread.maxCpu = -Infinity;
		if (this.threads.has(thread.tid))
			throw new Error(`Thread ${thread.tid} already attached to process ${thread.pid}`);
		const pprio = (process.priority !== undefined) ? process.priority : ENV('process.default_priority', Process.PRIORITY_DEFAULT);
		thread.priority = tprio * pprio;
		Log.debug(`${thread.pid}/${thread.tid} Attaching thread at priority ${thread.priority} total on tick ${Game.time} [${thread.desc}]`, 'Kernel');
		this.threads.set(thread.tid, thread);
		this.schedule.insert(thread);
		this.queue.unshift(thread);
		this.threadsByProcess.get(process).set(thread.tid, thread);
		thread.born = Game.time;
		return thread;
	}

	getCurrentThread() {
		return this.threads.get(this.ctid);
	}

	get totalCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += thread.lastRunCpu;
		return _.round(total, CPU_PRECISION);
	}
}

module.exports = Kernel;