/**
 * The body of an intershard message
 */
import { createShardLocalUUID } from '/os/core/uuid';
import { ENV } from '/os/core/macros';
import { IntershardMessage } from './IntershardMessage';

export * from './IntershardMessage';

export default class IntershardRpcMessage extends IntershardMessage {
	constructor(opts) {
		super(opts);
		this.pid = opts.pid;
		this.method = opts.method;
		this.args = opts.args;
	}

	serialize() { return JSON.stringify(this); }
	static deserialize(str) { return new this(JSON.parse(str)); }

	toString() {
		return `[IntershardRpcMessage ${this.dest} ${this.id}]`;
	}
}