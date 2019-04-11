/** os.prog.planner.js - Room planner */
'use strict';

const Async = require('os.core.async');
const Process = require('os.core.process');

class PlannerProc extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
	}

	*run() {
		// Cleanup memory
		if (this.roomName)
			return yield* this.plan(Game.rooms[this.roomName]);
		return yield* this.planAll();
	}

	*planAll() {
		for (const room of Object.values(Game.rooms)) {
			if (!room.my)
				continue;
			this.startThread(this.plan, [room], undefined, `Room planner ${room.name}`);
			yield true;
		}
		yield Promise.all(this.threads); // Proof of concept. Works because map is an iterable
	}

	*plan(room) {
		yield* Async.waitForCpu();
		this.debug(`Planning ${room.name} on tick ${Game.time}`);
		require('Planner').buildRoom(room);
	}
}

module.exports = PlannerProc;