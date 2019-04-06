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
	static *read(requests) {
		if (!Array.isArray(requests))
			throw new TypeError(`Expected array, got ${typeof requests}`);
		return yield* Async.mapPar(requests, this.fetch);
	}

	/**
	 * Segment id may be undefined to request user's default public segment
	 */
	static *fetch([user, sid, priority = 0.5]) {
		if (sid == null || isNaN(sid) || !Number.isInteger(sid))
			throw new TypeError(`Requested segment id ${sid} is not valid`);
		Log.debug(`Fetching foreign segment ${user} ${sid} on ${Game.time}`, 'ForeignSegments');
		try {
			SEGMENT_REQUESTS.insert({ user, id: sid, priority });
			while (true) {
				const { username, id, data } = SEGMENT_RESPONSES.get(`${user}_${sid}`) || RawMemory.foreignSegment || {};
				if (username === user && id === sid)
					return data;
				yield;
			}
		} catch (e) {
			Log.warn(`Failed to load segment ${user} ${sid} ${e.getMessage()}`);
			return null;
		} finally {
			Log.debug(`Foreign segment request ${user} ${sid} ended on ${Game.time}`, 'ForeignSegments');
		}
	}

	/**
	 * Self-contained state machine. While idle waits for requests.
	 * If requets come in, start serving them by demand. When we're done,
	 * reset to primary segments to save time on next load.
	 */
	static *tick() {
		Log.debug(`Startup`, 'ForeignSegments');
		while (!(yield)) {
			if (SEGMENT_REQUESTS.length <= 0)
				continue;
			while (SEGMENT_REQUESTS.length) {
				const { user, id, priority } = SEGMENT_REQUESTS.pop();
				Log.debug(`Requesting ${user} ${id} ${priority}`, 'ForeignSegments');
				yield RawMemory.setActiveForeignSegment(user, id); // Request load, and pause
				// if (RawMemory.foreignSegment === undefined) // No segment found here, throw error
				const resp = RawMemory.foreignSegment || { username: user, id, data: null };
				SEGMENT_RESPONSES.set(`${user}_${id}`, resp);
			}
			Log.debug(`Segment requests complete, resetting to default segment ${DEFAULT_FOREIGN_SEGMENT}`, 'ForeignSegments');
			const [user, id] = DEFAULT_FOREIGN_SEGMENT;
			RawMemory.setActiveForeignSegment(user, id);
		}
	}

}

module.exports = ForeignSegment;