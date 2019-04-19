/** os.prog.planner.js - Room planner */
'use strict';

const Co = require('os.core.co');
const Process = require('os.core.process');
const PagedProcess = require('os.core.process.paged');
const { Future } = require('os.core.future');

class PlannerProc extends PagedProcess {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.pageIds = [SEGMENT_BUILD];
	}

	onPageCorrupted() {
		return {};
	}

	*run() {
		const [builder] = yield* this.read(); // also stored in this.pages
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
		yield Future.all(this.threads.values());
	}

	*plan(room) {
		yield* Co.waitForCpu();
		this.debug(`Planning ${room.name} on tick ${Game.time}`);
		require('Planner').buildRoom(room);
	}
}

module.exports = PlannerProc;