/** os.core.network.foreign.js - Load foreign segments */
'use strict';

/* global Log, ENV */

const Async = require('os.core.async');
const PriorityQueue = require('os.ds.pq');
const LRU = require('os.ds.lru');

const SEGMENT_REQUESTS = new PriorityQueue(null, x => x.priority);

const DEFAULT_FOREIGN_SEGMENT = ENV('network.default_foreign_segment', ['LeagueOfAutomatedNations', 99]);
const FS_TTL = 100;
const FS_MAX = 100;
const SEGMENT_RESPONSES = new LRU({ ttl: FS_TTL, max: FS_MAX });

/**
 * Low level access to memory segments as "pages". These are handled purely as strings.
 * Translation occurs elsewhere.
 */
class ForeignSegment {
	/**
	 * Self-contained state machine. While idle waits for requests.
	 * If requets come in, start serving them by demand. When we're done,
	 * reset to primary segments to save time on next load.
	 */
	static *tickAsync() {
		Log.debug(`Startup`, 'ForeignSegments');
		while (!(yield)) {
			if (!SEGMENT_REQUESTS.length)
				continue; // Two-state machine, so don't kick off unless we have work to do
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
			Log.debug(`Segment requests complete, resetting to default segment ${DEFAULT_FOREIGN_SEGMENT}`, 'ForeignSegments');
			const [user, id] = DEFAULT_FOREIGN_SEGMENT;
			RawMemory.setActiveForeignSegment(user, id);
		}
	}

	static fetchAsync([user, sid, priority = 0.5, throwOnFail = true]) {
		if (sid == null || isNaN(sid) || !Number.isInteger(sid))
			throw new TypeError(`Requested segment id ${sid} is not valid`);
		return new Promise((res, rej) => SEGMENT_REQUESTS.insert({ user, id: sid, priority, res, rej, throwOnFail }));
	}

	static fetchMultiAsync(requests) {
		if (!Array.isArray(requests))
			throw new TypeError(`Expected array, got ${typeof requests}`);
		return Promise.all(requests.map(r => this.fetchAsync(r)));
	}
}

module.exports = ForeignSegment;