/** os.core.network.foreign.js - Load foreign segments */
'use strict';

/* global Log, ENV, ENVC */

const { Future } = require('os.core.future');
const PriorityQueue = require('os.ds.pq');

const DEFAULT_FS_IDLE_RESET = 5;
const DEFAULT_FS_POLL_FREQ = 3;
const DEFAULT_FOREIGN_SEGMENT = ENV('network.default_foreign_segment', ['LeagueOfAutomatedNations', 99]);

const SEGMENT_REQUESTS = new PriorityQueue(null, x => x.priority);

const FS_IDLE_RESET = ENV(`network.fs_idle_reset`, DEFAULT_FS_IDLE_RESET);
const FS_IDLE_POLL_FREQ = ENVC(`network.fs_idle_poll_freq`, DEFAULT_FS_POLL_FREQ, 1);
let last_change = Game.time;

/**
 * Low level access to memory segments as "pages". These are handled purely as strings.
 * Translation occurs elsewhere.
 */
exports.ForeignSegment = class ForeignSegment {
	static *tickIdleReset() {
		while (true) {
			while (Game.time - last_change < FS_IDLE_RESET)
				yield (global.kernel.getCurrentThread().sleep = Game.time + FS_IDLE_POLL_FREQ);
			Log.debug(`Segment requests complete, resetting to default segment ${DEFAULT_FOREIGN_SEGMENT} (idle ${Game.time - last_change})`, 'ForeignSegments');
			const [user, id] = DEFAULT_FOREIGN_SEGMENT;
			RawMemory.setActiveForeignSegment(user, id);
			last_change = Game.time;
			while (!SEGMENT_REQUESTS.length)
				yield (global.kernel.getCurrentThread().sleep = Game.time + FS_IDLE_POLL_FREQ);
		}
	}
	/**
	 * Self-contained state machine. While idle waits for requests.
	 * If requets come in, start serving them by demand. When we're done,
	 * reset to primary segments to save time on next load.
	 */
	static *tickAsync() {
		Log.debug(`Startup`, 'ForeignSegments');
		while (!(yield)) {
			while (SEGMENT_REQUESTS.length) {
				const { user, id, priority, res, rej, throwOnFail } = SEGMENT_REQUESTS.pop();
				Log.debug(`Requesting ${user} ${id} ${priority} on tick ${Game.time}`, 'ForeignSegments');
				yield RawMemory.setActiveForeignSegment(user, id); // Request load, and pause
				if (RawMemory.foreignSegment === undefined && rej && throwOnFail) { // No segment found here, throw error
					rej(new Error("No such segment"));
					continue;
				}
				const resp = RawMemory.foreignSegment || { username: user, id, data: null };
				if (res && resp)
					res(resp.data);
			}

		}
	}

	static fetchAsync([user, sid, priority = 0.5, throwOnFail = true]) {
		if (sid == null || isNaN(sid) || !Number.isInteger(sid))
			throw new TypeError(`Requested segment id ${sid} is not valid`);
		return new Future((res, rej) => SEGMENT_REQUESTS.insert({ user, id: sid, priority, res, rej, throwOnFail }));
	}

	static fetchMultiAsync(requests) {
		if (!Array.isArray(requests))
			throw new TypeError(`Expected array, got ${typeof requests}`);
		return Future.all(requests.map(r => this.fetchAsync(r)));
	}
};