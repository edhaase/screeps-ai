/**
 * Harvest power and pickup abandoned power drops, consider raiding highway creeps
 * Must have enough accessible positions available for teams.
 * Must have enough time
 * 
 * Team consists of 1 attacker, 1 healer (unboosted)
 * 2+ teams recommended
 */
'use strict';

/* global Log, MAX_CREEP_SPAWN_TIME */

const Process = require('/os/core/process');

class PowerbankProc extends Process {
	/** Low priority */
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_IDLE;
		this.default_thread_prio = Process.PRIORITY_IDLE;
	}

	*run() {
		yield;
		this.startThread(this.locate, null, Process.PRIORITY_IDLE, `Powerbank scanning`);
		this.startThread(this.process, null, Process.PRIORITY_IDLE, `Powerbank processing`);
	}

	/**
	 * Thread to scan highway rooms for powerbanks and mark them for processing
	 */
	*locate() {
		// @todo if we find one, make sure the destination isn't full
		while (true) {
			// this.setThreadTitle(`Scanning room ${roomName}`);
			yield;
		}
	}

	/**
	 * 
	 */
	*process() {
		while (true) {
			yield;
		}
	}
}

module.exports = PowerbankProc;