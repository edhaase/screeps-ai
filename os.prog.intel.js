/** os.prog.intel.js */
'use strict';

/* global IS_MMO */

const ForeignSegment = require('os.core.network.foreign');
const Pager = require('os.core.pager');
const Process = require('os.core.process');

const RECON_SEGMENT_MAX = ENVC('intel.recon_segment_max', 99, 0, 99);
const RECON_SEGMENT_MIN = ENVC('intel.recon_segment_min', 0, 0, 99);
const ALLIANCE_UNKNOWN = '?';

class IntelProc extends Process {
	*run() {
		if (IS_MMO) {
			const allianceThread = this.startThread(this.loadAllianceData, null, undefined, `Alliance loader`);
			allianceThread.timeout = Game.time + 5;
		} else {
			this.warn(`We're not running on MMO, some functions may be disabled`);
		}
		this.startThread(this.fsSegmentRecon, null, undefined, `Foreign segment recon`);

		while (true) {
			yield this.sleepThread(255);
			global.Intel.evict();
		}
	}

	// @todo need to know if we get shot?

	/** Coro or thread for testing a room's defenses for weaknesses */
	*probe(room) {
		yield* this.probeParts(room);
	}

	/** Test different creep bodies for "smart" towers */
	*probeParts(room) {

	}

	*loadAllianceData() {
		// LeagueOfAutomatedNations
		const [alliances, bots] = yield* ForeignSegment.read([['LeagueOfAutomatedNations', 99, 1], ['LeagueOfAutomatedNations', 98, 0.5]]);
		this.alliances = _.attempt(JSON.parse, alliances);
		this.players = {};
		this.bots = _.attempt(JSON.parse, bots);
		for (const [allianceName, alliance] of Object.entries(this.alliances)) {
			for (const name of alliance)
				this.players[name] = allianceName;
		}
		this.warn(`Loaded ${alliances}`);
		this.warn(`Loaded ${bots}`);
		return alliances;
	}

	/** Scans foreign segments for interesting stuff */
	*fsSegmentRecon() {
		const thread = global.kernel.getCurrentThread();
		while (true) {
			const names = [...this.getfsSegmentReconNames()];
			if (!names || !names.length)
				this.info(`No segments to scan, going to sleep`);
			for (const user of names) {
				for (var id = RECON_SEGMENT_MAX; id >= RECON_SEGMENT_MIN; id--) {
					thread.title = `Scanning foreign segment ${user} ${id}`;
					const segment = yield* ForeignSegment.fetch(user, id);
					if (!segment)
						continue;
					this.warn(`Found segment at ${user} ${id} ${segment}`);
				}
			}
			yield this.sleepThread(1000);
		}
	}

	*getfsSegmentReconNames() {
		if (Memory.players)
			yield* Object.keys(Memory.player);
		if (this.players)
			yield* Object.keys(this.players);
	}
}

module.exports = IntelProc;