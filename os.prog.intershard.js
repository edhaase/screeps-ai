/** os.prog.intershard.js - Message handler */
'use strict';

/* global InterShardMemory, ENV, ENVC */

const Process = require('os.core.process');
const { Message } = require('os.core.network.intershard');

const IST_DEFAULT_MAIN_THREAD_DELAY = 50;
const IST_DEFAULT_DATE_TIME_FORMAT_OPTIONS = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'America/Los_Angeles' };
/*
	  { ...
		lastUpdate: // Date in seconds,
		lastCpuAssignment: // Date
		messages:  { shard0: { id: msg, tickSent },
	    acks: {shard0: [ [id, time] ]
	  }
*/
class Intershard extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.workers = new Map();

		this.shardData = new Map();
		this.shardStrs = new Map();
		this.ack_cb = new Map();

		this.process.shards = {};
	}

	onThreadExit(tid, thread) {
		this.workers.delete(thread.key);
	}

	/** Only call this when we need to know the current leader, which should be rare */
	static electLeader() {
		var shard, max = -Infinity;
		if (_.isEmpty(Game.cpu.shardLimits))
			return Game.shard.name;
		for (const [candidate, allocated] of Object.entries(Game.cpu.shardLimits)) {
			if (allocated < max)
				continue;
			if (candidate.slice(-1) >= shard.slice(-1))
				continue;
			shard = candidate;
			max = allocated;
		}
		return shard;
	}

	*run() {
		if (Game.cpu.shardLimits == null) {
			this.warn(`No shards available, must be PS. Will never have work`);
			return;
		}
		this.startThread(this.writer, null, undefined, `IST-W`);
		while (true) {
			for (const [name, limit] of Object.entries(Game.cpu.shardLimits)) {
				if (!limit || limit <= 0 || name === Game.shard.name)
					continue;
				if (this.workers.has(name))
					continue;
				const thread = this.startThread(this.reader, [name], undefined, `IST ${name}`);
				thread.key = name;
				this.workers.set(thread.key, thread);
				this.debug(`Starting watcher thread for shard ${name}`);
			}
			yield this.sleepThread(ENVC('intershard.main_thread_delay', IST_DEFAULT_MAIN_THREAD_DELAY)); // Pause execution and put the thread to sleep
		}
	}

	reinitLocalIntershard() {
		this.data = {
			messages: {},
			acks: []
		};
		return this.data;
	}

	*writer() {
		this.contents = InterShardMemory.getLocal() || '{}';
		this.data = _.attempt(JSON.parse, this.contents);
		if (this.data instanceof Error) {
			this.warn(`Local intershard corrupt, reinitializing`);
			this.reinitLocalIntershard();
			this.dirty = true;
		}
		while (!(yield)) {
			if (!this.dirty)
				continue;
			this.contents.lastUpdate = Date.now();
			this.contents = JSON.stringify(this.data);
			InterShardMemory.setLocal(this.contents);
			this.dirty = false;
		}
	}

	*reader(shardName) {
		while (!(yield)) {
			const str = InterShardMemory.getRemote(shardName);
			const last = this.shardStrs.get(shardName);
			if (str === last)
				continue;
			this.shardStrs.set(shardName, str);
			this.debug(`Shard ${shardName} memory changed`);
			yield* this.parseChanges(shardName, str);
		}
	}

	*parseChanges(shardName, str) {
		const data = _.attempt(JSON.parse, str);
		if (data instanceof Error) {
			this.error(`Incoming data from shard ${shardName} is corrupt, ignoring`);
			return;
		}
		this.shardData.set(shardName, data);
		yield* this.processAcks(data, shardName);		// If we incoming acks, process them.
		yield* this.processInbound(data, shardName);	// If we have incoming messages, process and ack.
		yield* this.flushAcks(data, shardName);// Drop any outgoing acks if the related message is gone
	}

	static getFormatter() {
		const options = ENV(`intershard.date_format`, IST_DEFAULT_DATE_TIME_FORMAT_OPTIONS);
		return new Intl.DateTimeFormat("en-US", options);
	}

	*processAcks(data, shardName) {
		const options = ENV(`intershard.date_format`, IST_DEFAULT_DATE_TIME_FORMAT_OPTIONS);
		const formatter = new Intl.DateTimeFormat("en-US", options);

		const acks = _.det(data, ['acks', Game.shard.name], {});
		const { messages } = this.data;
		for (const [id, time] of acks) {
			if (!this.ack_cb.has(id))
				continue;
			const message = messages.shard[shardName][id];
			if (!message)
				continue;
			delete messages.shard[shardName][id];
			const [res] = this.ack_cb.get(id);
			this.ack_cb.delete(id);
			this.info(`MSG ${id} TRX COMPLETE: SEND ${formatter.format(message.ts)} RECV ${formatter.format(time)} ACKD  ${formatter.format(Date.now())}`);
			_.attempt(res, Date.now());
			yield true;
		}
	}

	send(msg) {
		const { messages } = this.data;
		if (messages.shard[msg.dest] == null)
			messages.shard[msg.dest] = {};
		messages.shard[msg.dest][msg.id] = msg;
		this.dirty = true; // Trigger write.
		return new Promise((res, rej) => this.ack_cb.set(msg.id, [res, rej]));
	}
}

module.exports = Intershard;