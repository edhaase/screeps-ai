/** Process.js - The base process definition */
'use strict';

/* global ENV, ENVC, MAKE_CONSTANT, MAKE_CONSTANTS, PROCESS_NAMESPACE, Log */

const { OperationNotPermitted } = require('os.core.errors');

if (!Memory.process) {
	Log.warn(`Initializing process memory space`, 'Memory');
	Memory.process = {};
}

class Process {
	constructor(opts) {
		if (opts.pid == null)
			throw new Error("Expected pid");
		MAKE_CONSTANT(this, 'instantiated', Game.time, false);
		MAKE_CONSTANTS(this, opts);
		MAKE_CONSTANT(this, 'friendlyName', this.name.charAt(0).toUpperCase() + this.name.slice(1));
		MAKE_CONSTANT(this, 'born', opts.born || parseInt(this.pid.toString().split('.')[0], 36));	
		MAKE_CONSTANT(this, 'ts', Date.now());

		if (this.default_thread_prio == null)
			this.default_thread_prio = ENVC('thread.default_priority', Process.PRIORITY_DEFAULT, 0.0, 1.0);
	}

	serialize() {
		return JSON.stringify(this);
	}

	/** Overridable */
	static deserialize(opts) {
		return new this(opts);
	}

	static deserializeByProcessName(opts) {
		const module = require(`${PROCESS_NAMESPACE}${opts.name}`);
		return module.deserialize(opts);
	}

	get children() {
		return this.kernel.childrenLookupTable.get(this);
	}

	get parent() {
		return this.kernel.process.get(this.ppid) || null;
	}

	get threads() {
		return this.kernel.threadsByProcess.get(this);
	}

	/** Memory */
	get memory() {
		if (!Memory.process[this.pid])
			Memory.process[this.pid] = {};
		return Memory.process[this.pid];
	}

	set memory(v) {
		return (Memory.process[this.pid] = v);
	}

	get local() {
		return this.getCurrentThread().local;
	}

	/** Stats */
	get totalCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += (thread.lastRunCpu || 0);
		return _.round(total, CPU_PRECISION);
	}

	get avgSysCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += (thread.avgSysCpu || 0);
		return _.round(total, CPU_PRECISION);
	}

	get avgUsrCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += (thread.avgUsrCpu || 0);
		return _.round(total, CPU_PRECISION);
	}

	get minCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += (thread.minCpu || 0);
		return _.round(total, CPU_PRECISION);
	}

	get maxCpu() {
		var total = 0;
		for (const [, thread] of this.threads)
			total += (thread.maxCpu || 0);
		return _.round(total, CPU_PRECISION);
	}

	/** Lifecycle */
	onStart() { }
	onExit() { }
	onThreadExit(tid, thread) { }
	onChildExit(pid, process) { }

	onReload() {
		this.startThread(this.run, undefined, undefined, 'Main thread');
	}

	shutdown() {
		/** A graceful shutdown has been requested */
		this.kernel.killProcess(this.pid);
	}

	/** Thread management */
	startProcess(name, opts, ppid = this.pid) {
		return this.kernel.startProcess(name, opts, ppid);
	}

	startThread(co, args = [], prio, desc, thisArg = this) {
		return this.kernel.startThread(co, args, prio, desc, this.pid, thisArg);
	}

	attachThread(thread, priority = this.default_thread_prio) {
		return this.kernel.attachThread(thread, priority);
	}

	getCurrentThread() {
		const thread = this.kernel.getCurrentThread(); // Should hopefully always be the same one running
		if (thread && thread.pid !== this.pid)
			throw new OperationNotPermitted(`Process ${this.pid} does not have permission to access ${thread.tid} in process ${thread.pid}`);
		return thread;
	}

	sleepThread(ticks) {
		this.getCurrentThread().sleep = Game.time + ticks;
	}

	sleepProcess(ticks) {
		this.sleep = Game.time + ticks;
	}

	*waitForThread(thread) {
		while (this.kernel.threads.has(thread.tid))
			yield;
	}

	setThreadTitle(title) {
		return this.getCurrentThread().desc = title;
	}

	/** Logging */
	log(level = Log.LEVEL_WARN, msg) {
		Log.log(level, `${this.pid}/${(this.kernel && this.kernel.ctid) || '-'} ${msg}`, this.friendlyName);
	}

	debug(msg) { this.log(Log.LEVEL_DEBUG, msg); }
	info(msg) { this.log(Log.LEVEL_INFO, msg); }
	warn(msg) { this.log(Log.LEVEL_WARN, msg); }
	error(msg) { this.log(Log.LEVEL_ERROR, msg); }
	success(msg) { this.log(Log.LEVEL_SUCCESS, msg); }

	toString() {
		return `[Process ${this.pid} ${this.friendlyName}]`;
	}
}

Process.PRIORITY_DEFAULT = ENVC('process.default_priority', 0.5, 0.0, 1.0);
Process.PRIORITY_LOWEST = 1.0;
Process.PRIORITY_HIGHEST = 0.0;

Process.PRIORITY_CRITICAL = Process.PRIORITY_HIGHEST;
Process.PRIORITY_IDLE = Process.PRIORITY_LOWEST;

module.exports = Process;
