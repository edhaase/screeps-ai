/** os.prog.intershard.leader.js - Primary shard */
'use strict';

/* global ENVC */

const Process = require('/os/core/process');
const Intershard = require('os.prog.intershard');

const IST_LEAD_DEFAULT_MAIN_THREAD_DELAY = 250;

class IntershardLead extends Process {
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
		while (true) {
			const leader = this.electLeader();
			if (Game.shard.name !== leader) {
				return this.warn(`Shard [${Game.shard.name}] has been replaced by [${leader}] as intershard lead, exiting`);
			}

			/** We can have a pretty long delay here, we're mostly setting shard cpu limits and handling executive decisions */
			yield this.sleepThread(ENVC('intershard.main_thread_delay', IST_LEAD_DEFAULT_MAIN_THREAD_DELAY));
		}
	}
}

module.exports = IntershardLead;