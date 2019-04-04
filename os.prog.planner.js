/** os.prog.planner.js - Room planner */
'use strict';

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
	}

	*plan(room) {
		this.debug(`Planning ${room.name} on tick ${Game.time}`);
		yield require('Planner').buildRoom(room);
	}
}

module.exports = PlannerProc;