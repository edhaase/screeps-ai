/** os.core.network.intershard.js */
'use strict';

/* global MAKE_CONSTANT, ENV, IST_BROADCAST_ADDRESS, SHARD_TOKEN */

const DEFAULT_INTERSHARD_IO_TIMEOUT = 120; // In seconds
const MINIMUM_SHARD_CPU = 1;

const { createShardLocalUUID } = require('os.core.uuid');

MAKE_CONSTANT(global, 'IST_BROADCAST_ADDRESS', '*');

class Message {
	constructor(opts) {
		this.id = createShardLocalUUID();
		this.ts = Date.now();
		this.timeout = opts.timeout || ENV('intershard.message_timeout', DEFAULT_INTERSHARD_IO_TIMEOUT);
		this.dest = opts.dest || IST_BROADCAST_ADDRESS;
	}

	serialize() { return JSON.stringify(this); }
	static deserialize(str) { return new this(JSON.parse(str)); }
}

Message.TYPE_PING = 0;
Message.TYPE_PONG = 1;	// Connection testing
Message.TYPE_RPC = 2;	// Remote procedure call
Message.TYPE_SDP = 3;	// Service discovery

exports.Message = Message;


exports.ping = function (shard) {
	exports.send(new Message({
		dest: shard,
		type
	}));
};

exports.send = function (msg) {
	if (!(msg instanceof Message))
		throw new TypeError(`Expected param1 type Message`);
	else if (!Game.cpu.shardLimits)
		throw new Error(`Shards not enabled`);
	else if (msg.dest && msg.dest === Game.shard.name)
		throw new Error(`Can't intershard message ourselves`); // Maybe maybe not.
	else if (msg.dest && msg.dest !== global.IST_BROADCAST_ADDRESS && Game.cpu.shardLimits[msg.dest] == null)
		throw new Error(`No such shard ${msg.dest}`);
	else if (Game.cpu.shardLimits[msg.dest] < MINIMUM_SHARD_CPU)
		throw new Error(`Shard not active`);
	const [ist] = global.kernel.getProcessByName('intershard');
	if (!ist)
		throw new Error(`Intershard communication unavailable`);
	return ist.send(msg);
};
