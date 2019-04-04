/** os.prog.intershard.js - Intershard behavior */
'use strict';

const Process = require('os.core.process');

class Intershard extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.table = new Map();
	}

	*run() {
		if (Game.cpu.shardLimits == null) {
			this.warn(`No shards available, must be PS. Will never have work`);
			return;
		}
		
		while (!(yield)) {
			for (const [name, limit] of Object.entries(Game.cpu.shardLimits)) {
				if (!limit || limit <= 0)
					continue;
				if (this.table.has(name))
					continue;
				const thread = this.startThread(this.invoker, [name], undefined, `${name}`);
				this.table.set(name, thread);
				this.debug(`Starting watcher thread for shard ${name}`);
			}
		}
	}

	*watcher(shardName) {
		while (!(yield)) {
			// Spin
		}
	}

}

module.exports = Intershard;