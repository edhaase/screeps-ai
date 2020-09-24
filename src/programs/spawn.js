/** os.prog.spawn.js - Draw visuals */
'use strict';

import Process from '/os/core/process';
import Future from '/os/core/future';
import { findClosestRoomByRoute } from '/algorithms/map/closest';
import { distinct } from '/lib/util';

export default class Spawn extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.title = 'Creep spawning';
		this.queue = [];
	}

	*run() {
		while (true) {
			yield;
		}
	}

	/**
	 * Request a creep be spawned. This may be called from the intershard process with a remote job.
	 * 
	 * @todo actually finish implementation of Future (should it resolve on start of spawn or finished spawning?) 
	 * 
	 * @param {*} job 
	 * @returns {Future}
	 */
	submit(job) {
		// Let the process best figure out how to handle this request?
		// const future = new Future();
		// currently just route request to a spawn
		const active = _.filter(Game.spawns, s => s.isActive());
		if (!active || !active.length)
			throw new Error(`No available spawns`);
		const spawnRooms = distinct(active, s => s.pos.roomName);
		this.debug(`Spawn rooms: ${spawnRooms.join(', ')}`);
		const dest = job.room || (job.memory && job.memory.home);
		if (!dest)
			throw new Error(`No destination room specified`);

		const [spawnRoom, distance] = findClosestRoomByRoute(dest, spawnRooms);  // ?
		this.debug(`Spawn room: ${spawnRoom}`);
		if (!spawnRoom)
			this.error(`No spawn found`);
		else {
			const room = Game.rooms[spawnRoom];
			const [spawn] = room.find(FIND_MY_SPAWNS);
			spawn.submit(job);
		}
		// return future;
	}
}