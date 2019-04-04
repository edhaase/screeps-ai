/** os.prog.intershard.js - Intershard behavior */
'use strict';

/* global InterShardMemory */

const Process = require('os.core.process');

class Intershard extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.workers = new Map();
		this.shards = new Map();
	}

	onThreadExit(tid, thread) {
		this.workers.delete(thread.key);
	}

	*run() {
		if (Game.cpu.shardLimits == null) {
			this.warn(`No shards available, must be PS. Will never have work`);
			return;
		}
		this.startThread(this.writer, null, undefined, `IST-W`);
		while (!(yield)) {
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
		}
	}

	*writer() {
		this.contents = InterShardMemory.getLocal();
		while (!(yield)) {
			InterShardMemory.setLocal(this.contents);
		}
	}

	*reader(shardName) {
		while (!(yield)) {
			const str = InterShardMemory.getRemote(shardName);
			const last = this.shards.get(shardName);
			if (str === last)
				continue;
			this.debug(`Shard ${shardName} memory changed`);
			this.shards.get(shardName, str);
		}
	}

}

module.exports = Intershard;