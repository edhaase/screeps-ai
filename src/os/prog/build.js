/** os.prog.build.js */
'use strict';

/* global Log, MAX_CREEP_SPAWN_TIME */

const Co = require('os.core.co');
const Process = require('os.core.process');
const { runCensus } = require('Util');

const DEFAULT_BUILD_ALLOTED = 10; // in energy per tick
const MAX_BUILD_DESIRED = 20 * BUILD_POWER; // 160 e/t if we have storage?

class BuildProc extends Process {

	*run() {
		while (true) {
			yield this.sleepThread(5);
			if (_.isEmpty(Game.spawns)) {
				this.title = 'Idle (No spawns)';
				continue;
			}
			if (_.isEmpty(Game.constructionSites)) {	// Nothing to do.
				this.title = 'Idle (No sites)';
				continue;
			}

			yield* this.ensureBuilders();
		}
	}

	*ensureBuilders() {
		this.title = 'Construction in progress';
		const cbr = _.groupBy(Game.constructionSites, 'pos.roomName');	// What rooms are we trying to build in?

		// Check if we have builders for everything
		// Everything from here down may get refactored.			
		runCensus();

		for (const [roomName, sites] of Object.entries(cbr)) {
			const room = Game.rooms[roomName];
			if (room && room.my)
				continue; // Remote rooms only until we replace the census one.
			const { storage } = room || {};
			const builders = Game.census[`${roomName}_builder`] || [];
			// const allotedBuild = (room) ? _.sum(room.find(FIND_SOURCES), 'ept') : DEFAULT_BUILD_ALLOTED;
			const allotedBuild = DEFAULT_BUILD_ALLOTED;
			const buildAssigned = _.sum(builders, c => c.getBodyParts(WORK)) * BUILD_POWER;
			const buildDesired = Math.max(allotedBuild, (storage && storage.stock * MAX_BUILD_DESIRED || 0));
			if (buildAssigned >= buildDesired)
				continue;
			this.title = 'Requesting builders';
			const [site] = sites;
			const spawn = site.pos.findClosestByPathFinder(Game.spawns, (c) => ({ pos: c.pos, range: 1 })).goal;
			const prio = CLAMP(0, Math.ceil(100 * (buildAssigned / buildDesired)), 90);
			// var elimit = (storedEnergy > 10000) ? Infinity : (10 * numSources);
			require('Unit').requestBuilder(spawn, { elimit: buildDesired, home: roomName, priority: prio });

		}

		// If no spawns, request via intershard			
		yield* Co.waitForTick(Game.time + DEFAULT_SPAWN_JOB_EXPIRE);	// Go to sleep
	}


}

module.exports = BuildProc;