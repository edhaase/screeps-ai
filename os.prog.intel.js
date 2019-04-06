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
		const [page] = yield* Pager.read([SEGMENT_INTEL]);
		this.intel = _.attempt(JSON.parse, page);
		if (this.intel instanceof Error || !this.intel) {
			this.warn(`Segment corrupt, resetting`);
			this.intel = {};
		}

		if (IS_MMO) {
			const allianceThread = this.startThread(this.fetchAllianceData, null, undefined, `Alliance loader`);
			allianceThread.timeout = Game.time + 5;
		} else {
			this.warn(`We're not running on MMO, some functions may be disabled`);
		}

		this.updateKnownPlayers();
		this.startThread(this.fsSegmentRecon, null, undefined, `Foreign segment recon`);

		while (true) {
			Pager.write(SEGMENT_INTEL, JSON.stringify(this.intel)); // Needs serialization
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

	updateKnownPlayers() {
		if (!this.intel || !this.intel.alliances)
			return;
		for (const [allianceName, alliance] of Object.entries(this.intel.alliances)) {
			for (const name of alliance)
				this.players[name] = allianceName;
		}
	}

	*fetchAllianceData() {
		// LeagueOfAutomatedNations
		const [alliancesPage, botsPage] = yield* ForeignSegment.read([['LeagueOfAutomatedNations', 99, 1], ['LeagueOfAutomatedNations', 98, 0.5]]);
		const alliances = _.attempt(JSON.parse, alliancesPage);
		const bots = _.attempt(JSON.parse, botsPage);
		if (alliances instanceof Error)
			return this.warn(`Unable to load alliances data`);
		this.intel.alliances = alliances;	// Override local copy if we have an update
		if (bots instanceof Error)
			return this.warn(`Unable to load bots data`);
		this.players = {};
		this.intel.bots = _.attempt(JSON.parse, bots);
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