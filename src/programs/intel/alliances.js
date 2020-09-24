/** os.prog.intel-alliances.js - Reload alliance data */
'use strict';

/* global ENV, ENVC, IS_MMO, Log */
import ForeignSegment from '/os/network/foreign';
import { IS_MMO } from '/os/core/constants';
import Process from '/os/core/process';

export default class AllianceProc extends Process {
	constructor(opts) {
		super(opts);
		this.timeout = Game.time + 15;
	}

	*run() {
		if (!IS_MMO) {
			this.info(`We're not running on MMO, some functions may be disabled`);
			return;	// quietly exit, nothing to do
		}

		const intelProcess = startService('intel');
		if (!intelProcess)
			return;
		yield* this.fetchAllianceData(intelProcess);
		this.updateKnownPlayers(intelProcess);
	}

	updateKnownPlayers(intelProcess) {
		if (!intelProcess || !intelProcess.intel || !intelProcess.intel.alliances)
			return;
		if (intelProcess.intel.players == null)
			intelProcess.intel.players = {};
		for (const [allianceName, alliance] of Object.entries(intelProcess.intel.alliances)) {
			for (const name of alliance)
				intelProcess.intel.players[name] = allianceName;
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