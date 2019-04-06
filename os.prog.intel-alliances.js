/** os.prog.intel-alliances.js - Reload alliance data */
'use strict';

/* global ENV, ENVC, IS_MMO, Log */

const ForeignSegment = require('os.core.network.foreign');
const Pager = require('os.core.pager');
const Process = require('os.core.process');

class IntelProc extends Process {
	constructor(opts) {
		super(opts);
		this.timeout = Game.time + 15;
	}

	*run() {
		if (!IS_MMO) {
			this.info(`We're not running on MMO, some functions may be disabled`);
			return;	// quietly exit, nothing to do
		}

		const [intelProcess] = global.kernel.getProcessByName('intel');
		yield* this.fetchAllianceData(intelProcess);
		this.updateKnownPlayers();
	}

	updateKnownPlayers() {
		if (!this.intel || !this.intel.alliances)
			return;
		if (this.intel.players == null)
			this.intel.players = {};
		for (const [allianceName, alliance] of Object.entries(this.intel.alliances)) {
			for (const name of alliance)
				this.intel.players[name] = allianceName;
		}
	}

	*fetchAllianceData(intelProcess) {
		// LeagueOfAutomatedNations
		const [alliancesPage, botsPage] = yield ForeignSegment.fetchMultiAsync([['LeagueOfAutomatedNations', 99, 1, false], ['LeagueOfAutomatedNations', 98, 0.75, false]]);
		const alliances = _.attempt(JSON.parse, alliancesPage);
		const bots = _.attempt(JSON.parse, botsPage);
		if (alliances instanceof Error)
			return this.warn(`Unable to load alliances data`);
		intelProcess.intel.alliances = alliances;	// Override local copy if we have an update
		if (bots instanceof Error)
			return this.warn(`Unable to load bots data`);
		intelProcess.intel.bots = _.attempt(JSON.parse, bots);
		this.warn(`Loaded ${alliancesPage}`);
		this.warn(`Loaded ${botsPage}`);
		return alliances;
	}
}

module.exports = IntelProc;