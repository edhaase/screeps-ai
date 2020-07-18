/** os.prog.intershard.js - Message handler */
'use strict';

/* global InterShardMemory, ENV, ENVC */
import { ENV, ENVC } from '/os/core/macros';
import Future from '/os/core/future';
import Process from '/os/core/process';
import IntershardMessage from '/os/network/IntershardMessage';
import { DATETIME_FORMATTER } from '/lib/time';

export const IST_DEFAULT_MAIN_THREAD_DELAY = 50;
export const IST_BROADCAST_ADDRESS = '*';

export const IST_MINIMUM_SHARD_CPU = 1;

/*
	  { ...
		lastUpdate: // Date in seconds,  Periodically update per heartbeat, so we can tell if the shard is still alive
		lastCpuAssignment: // Date
		messages:  { shard0: { id: msg, tickSent },
	    acks: {shard0: [ [id, time] ]
	  }
*/
export default class Intershard extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.workers = new Map();

		this.shardData = new Map();
		this.shardStrs = new Map();
		this.ack_cb = new Map();
	}

	onThreadExit(tid, thread) {
		this.workers.delete(thread.key);
	}

	*run() {
		if (Game.cpu.shardLimits == null) {
			this.warn(`No shards available, must be PS. Will never have work`);
			return;
		}
		this.setThreadTitle('Intershard Maintenace Thread');
		this.startThread(this.writer, null, undefined, `IST-W`);
		while (true) {
			for (const [name, limit] of Object.entries(Game.cpu.shardLimits)) {
				if (!limit || limit <= 0 || name === Game.shard.name)
					continue;
				if (this.workers.has(name))
					continue;
				const thread = this.startThread(this.reader, [name], undefined, `IST-R ${name}`);
				thread.key = name;
				this.workers.set(thread.key, thread);
				this.debug(`Starting watcher thread for shard ${name}`);
			}
			yield this.sleepThread(ENVC('intershard.main_thread_delay', IST_DEFAULT_MAIN_THREAD_DELAY)); // Pause execution and put the thread to sleep
		}
	}

	reinitLocalIntershard() {
		this.data = {
			lastUpdate: null,
			stats: {},
			messages: {},
			acks: {}
		};
		return this.data;
	}

	/**
	 * Write local intershard memory
	 */
	*writer() {
		this.contents = InterShardMemory.getLocal() || '{}';
		this.data = _.attempt(JSON.parse, this.contents);
		if (this.data instanceof Error) {
			this.warn(`Local intershard corrupt, reinitializing`);
			this.reinitLocalIntershard();
		}
		this.clearMessages(); // We've lost all the callbacks anyways
		while (!(yield)) {
			try {
				this.data.lastUpdate = Date.now();
				this.contents = JSON.stringify(this.data);
				InterShardMemory.setLocal(this.contents);
			} catch (err) {
				this.error(err);
				this.error(err.stack);
			}
		}
	}

	/**
	 * Read incoming messages and data
	 * 
	 * @param {*} shardName 
	 */
	*reader(shardName) {
		while (!(yield)) {
			try {
				const str = InterShardMemory.getRemote(shardName);
				const last = this.shardStrs.get(shardName);
				if (str === last)
					continue;
				this.shardStrs.set(shardName, str);
				this.debug(`Shard ${shardName} memory changed -- Updating`);
				const data = _.attempt(JSON.parse, str);
				if (data instanceof Error) {
					this.error(`Incoming data from shard ${shardName} is corrupt, ignoring`);
					return;
				}
				this.shardData.set(shardName, data);
				yield* this.processAcks(data, shardName);		// If we have incoming acks, process them.
				// yield* this.processInbound(data, shardName);	// If we have incoming messages, process and ack.
				// yield* this.flushAcks(data, shardName);// Drop any outgoing acks if the related message is gone
			} catch (err) {
				this.error(err);
				this.error(err.stack);
			}
		}
	}

	/**
	 * For a given shard, process all standing ACKs and complete any messages waiting on them
	 * 
	 * [Intershard] IKKGN.0/22 MSG 1XN TRX COMPLETE: SEND [4/8/2019, 11:48:10 PM] RECV [4/8/2019, 11:50:36 PM] ACKD  [4/8/2019, 11:50:56 PM]
	 * 
	 * @param {*} data 
	 * @param {*} shardName 
	 */
	*processAcks(data, shardName) {
		const acks = _.get(data, ['acks', Game.shard.name], []);
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
			this.info(`MSG ${id} TRX COMPLETE: SEND [${DATETIME_FORMATTER.format(message.ts)}] RECV [${DATETIME_FORMATTER.format(time)}] ACKD ${DATETIME_FORMATTER.format(Date.now())}`);
			_.attempt(res, Date.now());
			yield true;
		}
	}

	/**
	 * Send a message to another shard, this function returns a future that resolves
	 * when the shard has posted an acknowledgement that it received the message.
	 * 
	 * @param {*} msg 
	 * @return Future
	 */
	send(msg) {
		if (!(msg instanceof IntershardMessage))
			throw new TypeError(`Expected param1 type IntershardMessage`);
		else if (!Game.cpu.shardLimits)
			throw new Error(`Shards not enabled`);
		else if (!msg.dest)
			throw new Error(`Message missing destination`);
		else if (msg.dest === Game.shard.name)
			throw new Error(`Can't intershard message ourselves`); // Maybe maybe not.
		else if (msg.dest !== IST_BROADCAST_ADDRESS && Game.cpu.shardLimits[msg.dest] == null)
			throw new Error(`No such shard ${msg.dest}`);
		else if (Game.cpu.shardLimits[msg.dest] < IST_MINIMUM_SHARD_CPU)
			throw new Error(`Shard not active`);
		_.set(this.data, ['messages', msg.dest, msg.id], msg);
		this.info(`MSG ${msg.id} TRX START: SEND [${DATETIME_FORMATTER.format(msg.ts)}]`);
		const future = new Future();
		future.complete((v, err) => {
			delete this.data.messages[msg.id];
		});
		this.ack_cb.set(msg.id, future);
		return future;
	}

	/**
	 * Clear any outgoing messages.
	 */
	clearMessages() {
		this.data.messages = {};
	}
}