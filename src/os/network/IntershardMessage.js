/**
 * The body of an intershard message
 */
import { createShardLocalUUID } from '/os/core/uuid';
import { ENV } from '/os/core/macros';

export const IST_MESSAGE_TYPE_PUSH = 0;	// One way update
export const IST_MESSAGE_TYPE_SDP = 1;	// Service discovery
export const IST_MESSAGE_TYPE_RPC_REQ = 2;	// Remote procedure call request
export const IST_MESSAGE_TYPE_RPC_RES = 3;	// Remote procedure call response

export const DEFAULT_IST_MESSAGE_TIMEOUT = 120; // In seconds

export default class IntershardMessage {
	constructor(opts) {
		if (!opts)
			throw new Error(`Missing parameter`);
		if (!opts.dest)
			throw new Error(`Missing destination`);
		this.id = createShardLocalUUID();
		this.ts = Date.now();
		this.timeout = opts.timeout || ENV('intershard.message_timeout', DEFAULT_IST_MESSAGE_TIMEOUT);
		this.dest = opts.dest;		
		this.body = body;
		this.type = opts.type || IST_MESSAGE_TYPE_PUSH;
	}

	serialize() { return JSON.stringify(this); }
	static deserialize(str) { return new this(JSON.parse(str)); }

	toString() {
		return `[IntershardMessage ${this.dest} ${this.id}]`;
	}
}