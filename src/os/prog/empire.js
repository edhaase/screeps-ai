/** os.prog.market.js - Market management */
'use strict';

/* global ENV, ENVC, Market */

const Process = require('os.core.process');

const DEFAULT_EMPIRE_EXPANSION_FREQ = 2056; // Let's set this to at least higher than a creep life time.

class EmpireProc extends Process {
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
			yield this.sleepThread(ENV('empire.expansion_freq', DEFAULT_EMPIRE_EXPANSION_FREQ));
			if (ENV('empire.auto_expand', true) === false)
				continue; // Don't exit, we might change our minds.
			if (_.sum(Game.rooms, "my") >= Game.gcl.level)
				continue;// Nothing to do.
			yield this.startThread(this.expand, null, Process.PRIORITY_CRITICAL, `Claiming room`);
			// @todo check if we succeeded
		}
	}

	/** Actually expands to a new room (Kept separte for manual intervention) */
	*expand() {
		if (_.sum(Game.rooms, "my") >= Game.gcl.level)
			throw new Error(`Already at room limit`);
		// Pick a room!
		// Verify it isn't owned or reserved. Continue picking.
		// Launch claimer!
		// Or build colonizer to target lock a room. (Except which room spawns him?)
		const body = [MOVE, CLAIM];
		const cost = UNIT_COST(body);
		const spawns = _.reject(Game.spawns, r => r.isDefunct() || r.room.energyCapacityAvailable < cost);
		if (!spawns || !spawns.length)
			return this.error(`No available spawn for expansion on tick ${Game.time}`);

		// @todo check if safe to send a claimer
		const candidates = Empire.getAllCandidateRoomsByScore().value();
		if (!candidates || !candidates.length)
			return this.error(`No expansion candidates`, 'Empire');
		this.warn(`Candidate rooms: ${candidates}`, 'Empire');
		const [first] = candidates;
		const spawn = _.min(spawns, s => Game.map.findRoute(s.pos.roomName, first).length);
		Log.notify(`Expansion in progress! (Origin: ${spawn.pos.roomName})`);
		return yield spawn.submit({ body: [MOVE, CLAIM], memory: { role: 'pioneer', rooms: candidates }, priority: PRIORITY_MED });
	}

	static cpuAllowsExpansion() {
		// return (Memory.stats["cpu1000"] < Game.cpu.limit - 10);
		const estCpuPerRoom = Memory.stats["cpu1000"] / this.ownedRoomCount();
		Log.debug(`Empire estimated ${estCpuPerRoom} cpu used per room`, 'Empire');
		return (Memory.stats["cpu1000"] + estCpuPerRoom) < Game.cpu.limit - 10;
	}
}

module.exports = EmpireProc;