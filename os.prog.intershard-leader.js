/** os.prog.intershard.leader.js - Primary shard */
'use strict';

/* global ENVC */

const Process = require('os.core.process');
const Intershard = require('os.prog.intershard');

const IST_LEAD_DEFAULT_MAIN_THREAD_DELAY = 250;

class IntershardLead extends Process {
	*run() {
		while (true) {
			const leader = Intershard.electLeader();
			if (Game.shard.name !== leader) {
				return this.warn(`Shard [${Game.shard.name}] has been replaced by [${leader}] as intershard lead, exiting`);
			}
			
			/** We can have a pretty long delay here, we're mostly setting shard cpu limits and handling executive decisions */
			yield this.sleepThread(ENVC('intershard.main_thread_delay', IST_LEAD_DEFAULT_MAIN_THREAD_DELAY));
		}
	}
}

module.exports = IntershardLead;