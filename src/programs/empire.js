/** os.prog.empire.js - Empire management */
'use strict';

/* global ENV, ENVC, Market */
import { ENV } from '/os/core/macros';
import Process from '/os/core/process';

const DEFAULT_EMPIRE_EXPANSION_FREQ = CREEP_CLAIM_LIFE_TIME; // Let's set this to at least higher than a creep life time.

export default class EmpireProc extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_IDLE;
		this.default_thread_prio = Process.PRIORITY_IDLE;
	}

	/* eslint-disable require-yield */
	*run() {
		this.startThread(this.autoExpand, null, Process.PRIORITY_IDLE, `Automatic empire expansion`);
		return false;
	}

	/** Periodically attempts to expand to a new room */
	*autoExpand() {
		while (true) {
			if (!this.memory.nextCheck)
				this.memory.nextCheck = Game.time - 1;
			if (Game.time < this.memory.nextCheck)
				yield this.sleepThread(this.memory.nextCheck - Game.time); // When we unpause, we'll be right on schedule
			this.memory.nextCheck = Game.time + ENV('empire.expansion_freq', DEFAULT_EMPIRE_EXPANSION_FREQ);
			if (ENV('empire.auto_expand', true) === false)
				continue; // Don't exit, we might change our minds.
			if (_.sum(Game.rooms, "my") >= Game.gcl.level)
				continue;// Nothing to do.
			startService('expansion');
		}
	}

}