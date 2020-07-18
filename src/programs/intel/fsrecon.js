/** os.prog.intel.js */
'use strict';

/* global ENV, ENVC, IS_MMO, Log, THP_SEGMENT_INTEL */
import { ENV, ENVC } from '/os/core/macros';
import ForeignSegment from '/os/network/foreign';
import Process from '/os/core/process';
import { Log, LOG_LEVEL } from '/os/core/Log';

export const RECON_SEGMENT_MAX = ENVC('intel.recon_segment_max', 99, 0, 99);
export const RECON_SEGMENT_MIN = ENVC('intel.recon_segment_min', 0, 0, 99);

export default class IntelFSRecon extends Process {
	/** Scans foreign segments for interesting stuff */
	*run() {
		// const [alliancesPage, botsPage] = yield ForeignSegment.fetchMultiAsync([['LeagueOfAutomatedNations', 99, 1, false], ['LeagueOfAutomatedNations', 98, 0.75, false]]);
		// const alliances = _.attempt(JSON.parse, alliancesPage);
		// const [intel] = kernel.getProcessByName('intel');
		while (true) {
			const names = _.compact(_.unique([...this.getfsSegmentReconNames()]));
			if (!names || !names.length)
				this.info(`No segments to scan, going to sleep`);
			var uidx = 0, segid = 0;
			if (this.memory.lastUser) {
				uidx = _.findIndex(names, v => v === this.memory.lastUser);
				this.info(`Resuming search with user ${names[uidx]}`);
			}
			for (; uidx < names.length; uidx++) {
				const name = names[uidx];
				yield* this.search(name, this.memory.lastSegment);
				delete this.memory.lastSegment;
			}
			this.info(`Search complete. Taking a nap`);
			delete this.memory.lastUser;
			yield this.sleepThread(1000);
		}
	}

	*search(user, segid = RECON_SEGMENT_MAX) {
		this.info(`Searching foreign segments of user ${user}`);
		for (var id = segid; id >= RECON_SEGMENT_MIN; id--) {
			this.title = `Scanning foreign segment ${user} ${id}`;
			const segment = yield ForeignSegment.fetchAsync([user, id, 0.5, false]);
			this.memory.lastUser = user;
			this.memory.lastSegment = id;
			if (!segment)
				continue;
			this.warn(`Found segment at ${user} ${id} ${segment}`);
			if (ENV('intel.recon_segment_notify', false))
				Log.notify(`Segment scanner found segment at ${user} ${id} ${segment}`);
			if (!this.memory.segments)
				this.memory.segments = {};
			const key = `${user}_${id}`;
			this.memory.segments[key] = `Found at ${Game.time}`;
		}
	}

	*getfsSegmentReconNames() {
		if (Memory.players)
			yield* Object.keys(Memory.players);
		yield* _.map(Memory.intel, 'owner');
	}
}