/** prog-cron.js */
'use strict';

const Pager = require('os.core.pager');
const PriorityQueue = require('os.ds.pq');
const Process = require('os.core.process');

class Cron extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.queue = new PriorityQueue([], j => j.next);
	}

	*run() {
		yield* this.read();
		while (!(yield)) {
			const [job] = this.queue; // just watch the first
			if (!job || Game.time < job.next)
				continue;
			this.debug(`Wants to start ${job}`);
			this.queue.shift(); // Remove job

			try {
				let process = job.lastPid && global.kernel.process.get(job.lastPid);
				if (process) {
					this.warn(`Can't start job ${job.name}, last process still running (pid ${job.lastPid})`);
				} else {
					process = this.startProcess(job.name, job.opts);
				}
				if (job.freq > 0) {
					job.next = Game.time + job.freq;
					job.lastPid = process.pid;
					this.schedule(job);
				}
			} catch (e) {
				this.error(`Uncaught exception in cron job on tick ${Game.time}`);
				this.error(e.stack);
			}
		}
	}

	schedule(job) {
		this.debug(`Scheduling ${job}`);
		this.queue.insert(job);
		global.kernel.postTick(() => this.write(), 'Cron');
	}

	init() {
		this.queue.length = 0;
		this.schedule(new Cron.Job(Game.time + 1500, 'gc', {}, 1500));
		this.schedule(new Cron.Job(Game.time + 150, 'planner', {}, 150));
		this.schedule(new Cron.Job(Game.time + 20000, 'intel-alliances', {}, 20000));
	}

	*read() {
		this.debug(`Reading cron table`);
		const [page] = yield* Pager.read([SEGMENT_CRON]);
		const tbl = _.attempt(JSON.parse, page);
		if (tbl instanceof Error) {
			this.warn(`Cron segment corrupt, resetting`);
			this.init();
		} else {
			// Reload
			for (const entry of tbl)
				this.queue.insert(Cron.Job.deserialize(entry));
		}
	}

	write() {
		this.debug(`Writing cron table`);
		const str = JSON.stringify(this.queue);
		Pager.write(SEGMENT_CRON, str);
	}


	*wait() {
		while (true)
			yield;
	}
}

Cron.Job = class {
	constructor(next, name, opts = undefined, freq = undefined, lastPid = undefined) {
		this.next = next;
		this.freq = freq;
		this.name = name;
		this.opts = opts;
		this.lastPid = lastPid;
	}

	static deserialize([next, name, opts, freq, lastPid]) {
		return new this(next, name, opts, freq, lastPid);
	}

	serialize() {
		return [this.next, this.name, this.opts, this.freq, this.lastPid];
	}

	toString() {
		return JSON.stringify(this);
	}

	toJSON() {
		return this.serialize();
	}
};


module.exports = Cron;