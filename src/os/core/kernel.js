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
const Thread = require('os.core.thread');
const GCP = require('os.gc');

const { OperationNotPermitted } = require('os.core.errors');

const DEFAULT_HEAP_CHECK_FREQ = 10;
const DEFAULT_HEAP_WARNING = 0.80;
const DEFAULT_HEAP_CRITICAL = 0.95;
const DEFAULT_SHUTDOWN_GRACE_PERIOD = 10;

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
		MAKE_CONSTANT(this, 'priority', Process.PRIORITY_IDLE);
		// this.minCpu = Infinity;
		// this.maxCpu = -Infinity;

		/** Kernel specific stuff */
		MAKE_CONSTANT(this, 'process', new Map());
		MAKE_CONSTANT(this, 'processByName', new LazyMap(() => new BaseArray()));
		MAKE_CONSTANT(this, 'threads', new BaseMap());
		MAKE_CONSTANT(this, 'threadsByProcess', new LazyWeakMap(() => new Map()));
		MAKE_CONSTANT(this, 'schedule', new PriorityQueue(null, (itm) => itm.priority));
		this.nextThreadId = 0;  // Threads are transient, so we don't need anything fancy here.
		this.threadClass = Thread;
		this.queue = [];
		this.proc = [];				// Safety, must exist during bootstrap
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
			this.startThread(this.watchdog, [], Process.PRIORITY_CRITICAL, 'Kernel watchdog thread');
			this.startThread(this.init, [], Process.PRIORITY_CRITICAL, 'Process initialization');
			this.startThread(Pager.tick, [], Process.PRIORITY_IDLE, 'Pager thread');	// We want this to run last
			this.startThread(ForeignSegment.tickAsync, [], Process.PRIORITY_IDLE, 'Foreign segment thread');
			this.startThread(ForeignSegment.tickIdleReset, [], Process.PRIORITY_IDLE, 'Foreign segment idle reset thread');
			this.startThread(GCP.tick, [], Process.PRIORITY_IDLE, 'Memory garbage collection thread');
			yield* this.loop();
		} catch (e) {
			throw e;
		}
	}

	getHeapUsagePct() {
		const { total_heap_size, externally_allocated_size, heap_size_limit } = Game.cpu.getHeapStatistics();
		return (total_heap_size + externally_allocated_size) / heap_size_limit;
	}

	/** Kernel watch thread attempts to keep heap under control and halts if we're in trouble. */
	*watchdog() {
		while (!(yield this.sleepThread(ENV('kernel.heap_check_freq', DEFAULT_HEAP_CHECK_FREQ)))) {
			const heapUsage = this.getHeapUsagePct();
			if (heapUsage < ENVC('kernel.heap_warning', DEFAULT_HEAP_WARNING, 0, 1))
				continue;
			if (heapUsage >= ENVC('kernel.heap_critical', DEFAULT_HEAP_CRITICAL, 0, 1)) {
				Log.notify(`Heap exceeded critical limit, cpu halted on tick ${Game.time}`);
				yield; // In case we need a tick to send the message.
				Game.cpu.halt();
			}
			if (!global.gc) {
				Log.warn(`Manual gc unavailable (heap ${100 * heapUsage})`, 'Kernel');
				continue;
			}
			global.gc(true);
			yield;
			const heapAfter = this.getHeapUsagePct();
			if (heapAfter < heapUsage)
				Log.notify(`Manual gc intervention reduced heap usage from ${heapUsage} to ${heapAfter} on tick ${Game.time}`);
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
		if (page === '') {
			Log.debug(`Bootstrap initialization on shard ${Game.shard.name} at tick ${Game.time}`, 'Kernel');
			global.reinitAll();
		} else {
			Log.debug(`Process table fetched at ${Game.time}`, 'Kernel');
			this.proc = JSON.parse(page || '[]');
		}

		try {
			for (const entry of this.proc) {
				yield true;	// yield and wait for cpu
				this.cpid = entry.pid;
				this.ctid = null;  // In case we call a thread specific method during class construction
				try {
					const p = Process.deserializeByProcessName(entry);
					this.processByName.get(p.name).push(p);
					Log.debug(`Reloaded ${p} on tick ${Game.time}`, 'Kernel');
					this.process.set(p.pid, p);
				} catch (e) {
					Log.error(`Unable to reload process`, 'Kernel');
					Log.error(e.stack, 'Kernel');
				}
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
		} catch (e) {
			Log.error(`Uncaught exception in process loader`);
			Log.error(e);
			Log.error(e.stack);
		}
	}

	saveProcessTable() {
		Log.debug(`Saving process table on tick ${Game.time}`, 'Kernel');
		Pager.write(SEGMENT_PROC, JSON.stringify(this.proc), true);
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
			delete Memory.process[pid];
		} finally {
			this.postTick(() => this.saveProcessTable());
			this.postTick(() => _.remove(this.schedule, t => !this.threads.has(t.tid)), 'PurgeKilledThreads');
		}
	}

	stopProcess(pid, timeout = ENV('kernel.shutdown_grace_period', DEFAULT_SHUTDOWN_GRACE_PERIOD)) {
		if (pid === 0)
			throw new OperationNotPermitted(`Unable to stop kernel`);
		const process = this.process.get(pid);
		process.timeout = Game.time + timeout;
		if (process && process.shutdown) {
			return process.shutdown();
		}
		return false;
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
			this.throttle = (Game.cpu.bucket / global.BUCKET_MAX > 0.5) ? Game.cpu.tickLimit * 0.90 : MIN_CPU_THIS_TICK;
			this.queue = this.schedule.slice(0);
			var thread; // , i = this.queue.length - 1;		
			while ((thread = this.queue.pop()) != null) {
				const AVG_USED = Math.max(thread.avgSysCpu, thread.avgUsrCpu);
				if (Game.cpu.getUsed() + AVG_USED >= this.throttle) {
					this.lastRunCpu = Game.cpu.getUsed();
					Log.warn(`Kernel paused at ${this.lastRunCpu} / ${this.throttle} cpu usage on tick ${Game.time} (${this.queue.length} threads pending)`, 'Kernel');  // continue running next tick to prevent starvation
					break;
				}

				try {
					if (thread.lastRunSysTick !== Game.time)
						thread.lastTickSysCpu = 0;
					const start = Game.cpu.getUsed();
					thread.lastRunSysTick = Game.time;
					this.runThread(thread);
					const delta = Game.cpu.getUsed() - start;
					thread.avgSysCpu = MM_AVG(delta, thread.avgSysCpu); // May count zeroes for sleeping threads
					thread.lastTickSysCpu += delta;
				} catch (e) {
					Log.error(e.stack, 'Kernel');
					yield* Async.waitForTick(Game.time + 5);
				}
			}

			// Wrap up stats for the tick
			for (thread of this.schedule) {
				if (thread.lastRunSysTick !== Game.time)
					continue;
				thread.avgSysTickCpu = MM_AVG(thread.lastTickSysCpu, thread.avgSysTickCpu || 0);
				thread.avgUsrTickCpu = MM_AVG(thread.lastTickUsrCpu, thread.avgUsrTickCpu || 0);
				thread.minTickCpu = Math.max(0, Math.min(thread.minTickCpu, thread.lastTickSysCpu || 0)); // Already initialized on attach (But why were we getting negative numbers?)
				thread.maxTickCpu = Math.min(Game.cpu.tickLimit - 1, Math.max(thread.maxTickCpu, thread.lastTickSysCpu || 0));
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

	runThread(thread) {
		this.ctid = thread.tid;
		this.cpid = thread.pid;
		const process = this.process.get(thread.pid);
		try {
			if (!process) {
				Log.debug(`${thread.pid}/${thread.tid} Orphaned thread killed on tick ${Game.time} (age ${Game.time - thread.born} ticks)`, 'Kernel');
				this.killThread(thread.tid);
				return;
			} else if (process.ppid && !this.process.has(process.ppid)) {
				Log.warn(`${thread.pid}/${thread.tid} Orphan process ${process.name} killed on tick ${Game.time} (age ${Game.time - process.born} ticks)`, 'Kernel');
				this.killProcess(process.pid);
				return;
			} else if (process.timeout !== undefined && Game.time > process.timeout) {
				Log.warn(`${thread.pid}/${thread.tid} Process ${process.name} timed out on tick ${Game.time} (age ${Game.time - process.born} ticks)`, 'Kernel');
				this.killProcess(process.pid);
				return;
			} else if (process.sleep && Game.time < process.sleep) {
				return;
			}

			const { done, value } = thread.next();
			if (done) {
				Log.debug(`${thread.pid}/${thread.tid} Thread exiting normally on tick ${Game.time} (age ${Game.time - thread.born} ticks) [${thread.desc}]`, 'Kernel');
				this.killThread(thread.tid);
				return;
			} else if (value === undefined || value === false) {
				return; // paused for the tick
			} else if (value === true) {
				this.queue.unshift(thread); // Run it again, Sam
			} else {
				// @todo yield handlers?
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
		if (!thread)
			return false; // No such thread
		this.threads.delete(tid);
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

	startThread(co, args = [], prio, desc, pid = this.cpid || 0, thisArg = this) {
		const coro = co.apply(thisArg, args);
		const thread = new this.threadClass(coro, pid, desc);
		return this.attachThread(thread, prio, pid);
	}

	/** Attach a separately created thread (kernel.attachThread(doStuff(42))) */
	attachThread(thread, tprio = Process.PRIORITY_DEFAULT) {
		if (!thread || !(thread instanceof this.threadClass))
			throw new TypeError(`Expected thread object`);
		const { pid } = thread;
		const process = this.process.get(pid);
		if (!process)
			throw new Error(`Can not attach thread, no such process ${pid}`);
		if (thread.tid == null)
			thread.tid = this.nextThreadId++;
		if (this.threads.has(thread.tid))
			throw new Error(`Thread ${thread.tid} already attached to process ${thread.pid}`);
		const pprio = (process.priority !== undefined) ? process.priority : ENV('process.default_priority', Process.PRIORITY_DEFAULT);
		thread.priority = tprio * pprio;
		Log.debug(`${thread.pid}/${thread.tid} Attaching thread at priority ${thread.priority} total on tick ${Game.time} [${thread.desc}]`, 'Kernel');
		this.threads.set(thread.tid, thread);
		this.schedule.insert(thread);
		this.queue.unshift(thread);
		this.threadsByProcess.get(process).set(thread.tid, thread);
		return thread;
	}

	sleepThread(ticks) {
		this.getCurrentThread().sleep = Game.time + ticks;
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

	toString() {
		return `[Process ${this.pid} ${this.friendlyName}]`;
	}
}

module.exports = Kernel;