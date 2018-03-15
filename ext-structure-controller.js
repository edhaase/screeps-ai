/**
 * ext-structure-controller.js - The centralized logic for each claimed room
 *
 *	The room controller is the single central decider for behavior of an owned room.
 * We have one per owned room, and only one. And they're already in Game.structures,
 * so the moment we claim a room it begins running.
 *
 * The room is as to the empire as a state is to a country.
 *
 * Functions:
 *	Unit census - Compares creeps we have versus creeps we need and adjusts
 *
 * Ideas:
 *  - Utility based AI / Goal based (What's the utility function for wall building?)
 *  - For automation purposes each room _really_ needs to know what rooms are next to it.
 *
 *
 * @todo Scale census against projected income (Single source rooms should work but be slower)
 * @todo Hapgrader. Adjusts projected income, projected rcl, and eliminates static upgrader and link.
 * @todo Size scavs better. Maybe based on projected income?
 * @todo Minerals in source list for SK rooms?
 */
"use strict";

/**
 * This is the rate we need to maintain to reach RCL 3 before safe mode drops.
 * Preferentially, we want to significantly exceed that so we have time to build the tower.
 */
global.DESIRED_UPGRADE_RATE = (CONTROLLER_LEVELS[1] + CONTROLLER_LEVELS[2]) / SAFE_MODE_DURATION;

// Maximum upgraders:
// Math.pow((2*CREEP_UPGRADE_RANGE+1),2) - 1; // 48, max 49 work parts = 2352 ept

// @todo: FIND_HOSTILE_STRUCTURES, spawn bulldozer (doesn't have to be very big)
// @todo: Room goals (bunker raises defenses, expand pushes gcl) 
// @todo:
/* global.CONTROLLER_STATE_NORMAL = 0;		// Room is operational.
global.CONTROLLER_STATE_BOOTUP = 1;		// Create tiny units if we need to, just until extensions are fun.
global.CONTROLLER_STATE_HALT = 2;		// No spawning, load extensions.
global.CONTROLLER_STATE_ABANDON = 3;	// Offload resources to other rooms, prepare to unclaim
global.CONTROLLER_STATE_BREEDER_REACTOR = 4;	// Requires maintaining room energy < 300

// Reconnaissance - Scout adjacent rooms for sign of attack, gather cost matrix data, etc

global.BIT_CTRL_ANNOUNCE_ATTACKS = (1 << 1); // Do we notify on hostiles?
..bits instead of state maybe, or utility functions/scores.
*/

global.BIT_CTRL_DISABLE_CENSUS = (1 << 1);		// Disable room census. For claimed remote mines.
global.BIT_CTRL_DISABLE_AUTOBUILD = (1 << 2);	// Prevent this controller from placing buildings.
global.BIT_CTRL_DISABLE_SAFEMODE = (1 << 3);

global.BITS_CTRL_REMOTE_CLAIM = BIT_CTRL_DISABLE_CENSUS | BIT_CTRL_DISABLE_AUTOBUILD | BIT_CTRL_DISABLE_SAFEMODE;

global.BIT_CTRL_REMOTE_MINING = (1 << 2);			// Do we enable mining of harvesting rooms?
global.BIT_CTRL_REMOTE_MINERL_MINING = (1 << 3);	// Do we enable mineral harvesting in SK rooms?
global.BIT_DISABLE_TOWER_REPAIR = (1 << 4);
global.BIT_DISABLE_TOWER_HEAL = (1 << 5);

const CONTROLLER_SAFEMODE_MARGIN = 500;
const EMERGENCY_THRESHOLD = _.mapValues(CONTROLLER_DOWNGRADE, v => v - CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD + CONTROLLER_SAFEMODE_MARGIN);
const MINIMUM_REQUIRED_SAFE_MODE = 300;

/**
 * Custom properties
 */
defineCachedGetter(StructureController.prototype, 'progressRemaining', con => con.progressTotal - con.progress);
defineCachedGetter(StructureController.prototype, 'age', con => Game.time - con.memory.claimedAt);

// Game.rooms['E59S39'].visual.rect(33-3,40-3,6,6)

// RCL 1: Micros. Whatever it takes. Upgrade to RCL 2.
// RCL 2: Safe mode. Static upgrader.
// RCL 3: Tower.
// RCL 4: Storage.  We have 20000 ticks till downgrade, ignore upgraders until we get storage up?
// RCL 5: Second tower. Link storage to controller.
StructureController.prototype.run = function () {
	this.updateLevel();
	this.updateRclAvg();
	this.updateSafeMode();
	//
	// Working countdown clock
	// let {x,y,roomName} = this.pos;
	// let newPos = new RoomPosition(x,y-1,roomName);
	// this.room.visual.text(this.ticksToDowngrade, newPos, {color: 'yellow'});

	if (this.level < MAX_ROOM_LEVEL) {
		const avgTick = _.round(this.memory.rclAvgTick, 2);
		const estimate = this.estimateInTicks();
		this.say(`${avgTick} (${estimate})`);
	}

	if ((Game.time % (DEFAULT_SPAWN_JOB_EXPIRE + 1)) === 0 && !this.checkBit(BIT_CTRL_DISABLE_CENSUS)) {
		// if (this.clock(DEFAULT_SPAWN_JOB_EXPIRE) === 0 && !this.checkBit(BIT_CTRL_DISABLE_CENSUS)) { // Staggering jobs might be bad.
		try {
			var nukes = this.room.find(FIND_NUKES, { filter: n => n.timeToLand < MAX_CREEP_SPAWN_TIME });
			if (nukes && nukes.length) {
				var nuke = _.max(nukes, 'timeToLand');
				var defer = Math.min(MAX_CREEP_SPAWN_TIME, nuke.timeToLand + 1);
				Log.warn(`Census holding for ${defer} ticks, nuke inbound`, 'Controller');
				this.room.find(FIND_MY_SPAWNS).forEach(s => s.defer(defer));
				this.evacuate(Game.time + nuke.timeToLand + 1);
			} else {
				this.runCensus();
				/* _.each(Game.map.describeExits(this.pos.roomName), rn => {
					if(Game.rooms[rn] && !Game.rooms[rn].my && Room.getType(rn) !== 'SourceKeeper')
						this.runCensus(rn);
				}); */
			}
		} catch (e) {
			Log.error(`Error in controller ${this.pos.roomName}: ${e}`);
			Log.error(e.stack);
		}
		this.updateNeighbors();
	}

	if (!(Game.time & 1023))
		this.updateNukeDetection();

	if (this.ticksToDowngrade === CONTROLLER_EMERGENCY_THRESHOLD) {
		Log.notify(`Low ticks to downgrade on room controller in ${this.pos.roomName}`);
	}

	// If we're about to lose the room, clean up.
	if (this.ticksToDowngrade === 2 && this.level === 1) {
		this.room.find(FIND_STRUCTURES).forEach(s => s.destroy());
		this.room.find(FIND_MY_CONSTRUCTION_SITES).forEach(s => s.remove());
		this.room.clearBuildQueue();
	}
	// What conditions to activate safe mode?

	// more stuff running the room! control low power mode. may be able to update room outside seperate room processor?
	// won't run in remote rooms!
};

StructureController.prototype.updateDefenses = function () {

};

StructureController.prototype.clock = function (freq) {
	return (Game.time - (this.memory.claimedAt || 0)) % freq;
};

/**
 * Emergency conditions
 *  No spawns: _.isEmpty(this.room.find(FIND_MY_SPAWNS));
 */
// Downgrades are an emergency
StructureController.prototype.isEmergencyModeActive = function () {
	// If we use maxlevel, they'll lock onto a downgraded controller and never stop.
	return (this.ticksToDowngrade <= EMERGENCY_THRESHOLD[this.level] || this.progress > this.progressTotal); // || this.memory.maxlevel > this.level);
};

/**
 * Nuke detection - Exactly what it sounds like.
 *
 * @todo Group by time intervals so we don't waste safe modes.
 * @todo Switch to threat level model. Nuke sets to highest threat level forcing safe mode on next hostile action.
 */
// const MAX_NUKE_DEBOUNCE = 500;
StructureController.prototype.updateNukeDetection = function () {
	const nukes = this.room.find(FIND_NUKES);
	if (nukes == null || !nukes.length)
		return;
	Log.notify(`[DEFCON] Nuclear launch detected! ${this.pos.roomName}`);
	// const nukesByTimeGroup = _.groupBy(nukes, n => Math.floor(n.timeToLand / MAX_NUKE_DEBOUNCE));
	const maxNuke = _.max(nukes, 'timeToLand');
	const postNukeSafeMode = maxNuke.timeToLand + CONTROLLER_NUKE_BLOCKED_UPGRADE + _.random(1, 150);
	Log.debug(`${this.pos.roomName} Scheduling immediate safe mode following nuke arrival in ${postNukeSafeMode} ticks`, 'Controller');
	this.memory.postNukeSafeMode = postNukeSafeMode;
};

/**
 * Unit census - Expect this to be expensive
 * 
 * Basic premise - Since each creep expires or can be killed, there needs
 * to be a way to replace these missing creeps. Enter the census process.
 * this runs periodically to check what a room needs, what it has, and fix
 * the difference.
 *
 * Since our implementation of creep logic is role-based, so is our census.
 * For each census capable role we need:
 *   The role name
 *   A counter function (#creeps or #parts)
 *	 A desire function (#creeps or #parts desired)
 *	 An action function (for spawn or recycle)
 *   A spawn selector (ours, or a better option?)
 *
 * @todo: Priority should not be a role assigned constant. It should be a float between 0 and 1
 * based on current demand.
 *
 * @todo: If no towers, keep guard posted (low priorty over economy though).
 * @todo: If hostiles present, don't request repair creeps
 *
 * 2017-02-22: Support for memory-backed census jobs?
 * 2017-02-04: Repair units only spawn if we have a use for them
 * 2016-12-13: Increased maximum repair unit energy from 900 to 1800
 */
StructureController.prototype.runCensus = function (roomName = this.pos.roomName) {
	var room = Game.rooms[roomName];
	if (!room)
		throw new Error(`No visibility on ${roomName}`);
	if (roomName !== this.pos.roomName && room.my)
		throw new Error("This room under acting under another controller");
	var spawns = this.room.find(FIND_MY_SPAWNS);
	var [spawn] = spawns;
	const terminalEnergy = _.get(this.room, 'terminal.store.energy', 0);
	const storedEnergy = _.get(this.room, 'storage.store.energy', 0);
	var prio = 50;

	/** This is really all we need.. */
	if (Game.census == null) {
		const creepsFiltered = _.filter(Game.creeps, c => c.ticksToLive == null || c.ticksToLive > c.body.length * CREEP_SPAWN_TIME);
		Game.census = _.groupBy(creepsFiltered, c => `${c.memory.home || c.memory.origin || c.pos.roomName}_${c.memory.role}`);
		Game.creepsByRoom = _.groupBy(creepsFiltered, c => `${c.memory.home || c.memory.origin || c.pos.roomName}`);
		// Game.censusFlags = _.groupBy(Game.flags, f => `${f.color}_${f.secondaryColor}`);
		Log.debug(`Generating census report`, 'Controller');
	}

	// Creeps
	const creeps = Game.creepsByRoom[roomName];
	const { census } = Game;

	const pilot = census[`${roomName}_pilot`] || [];
	const haulers = census[`${roomName}_hauler`] || [];
	const builders = census[`${roomName}_builder`] || [];
	const upgraders = census[`${roomName}_upgrader`] || [];
	const defenders = census[`${roomName}_defender`] || [];
	const healers = census[`${roomName}_healer`] || [];
	const repair = census[`${roomName}_repair`] || [];
	const scav = census[`${roomName}_scav`] || [];
	const bulldozer = census[`${roomName}_bulldozer`] || [];
	const scouts = census[`${roomName}_scout`] || [];
	const miners = census[`${roomName}_miner`] || [];
	const dualminers = census[`${roomName}_dualminer`] || [];
	const assistingSpawn = this.getAssistingSpawn();

	var resDecay = _.sum(room.resources, 'decay');

	// Income
	const sources = this.room.find(FIND_SOURCES);
	const base = Math.min(_.sum(sources, 'ept'), _.sum(miners, 'harvestPower') + _.sum(dualminers, 'harvestPower'));
	const remote = Math.floor(_.sum(haulers, 'memory.ept')) || 0;
	const reactor = (this.room.energyAvailable >= SPAWN_ENERGY_START) ? 0 : spawns.length;
	const income = base + remote + reactor;

	const upkeep = _.sum(creeps, 'cpt') + _.sum(this.room.structures, 'upkeep');
	const expense = 0;
	const net = income - (expense + upkeep);
	const avail = income - upkeep;
	Log.info(`${this.pos.roomName}: Income ${income}, Expense: ${expense}, Upkeep: ${_.round(upkeep, 3)}, Net: ${_.round(net, 3)}, Avail ${_.round(avail,3)}, Banked: ${storedEnergy}`, 'Controller');


	// Distribution
	const allotedUpgrade = Math.floor(avail * 0.80);
	const allotedRepair = Math.floor(avail * 0.20);
	Log.info(`Allotments: ${allotedUpgrade} upgrade ${allotedRepair} repair`, 'Controller');

	/**
	 * Emergency conditions - Should probably be detected elsewhere
	 */
	let assistCost = 0;
	if (roomName === this.pos.roomName && (!creeps || !creeps.length)) { // Nothing alive, nothing about to spawn.
		Log.notify(`Emergency: No creeps in room ${roomName}!`, 'Controller');
		if (!spawn)
			[spawn, assistCost = 0] = this.getClosestSpawn({ plainCost: 2 });
		if (spawn) {
			require('Unit').requestPilot(spawn, roomName);
			return;
		}
	}

	/**
	 * Census failover operations
	 */
	if (!spawn || spawn.isDefunct()) {
		// Log.warn('No spawn or spawn is defunct, failover to assisting spawn', 'Controller');
		spawn = assistingSpawn;
		if (!spawn)
			[spawn, assistCost = 0] = this.getClosestSpawn({ plainCost: 2 });
		if (!spawn)
			[spawn] = _.values(Game.spawns);
	}

	if (!spawn) {
		Log.warn(`No spawn available for ${this.pos.roomName}`, 'Controller');
		return;
	}

	if (spawn && assistingSpawn)
		Log.debug(`${this.pos.roomName} Controller using spawn ${spawn.name}/${spawn.pos} and ${assistingSpawn.name}/${assistingSpawn.pos} `, 'Controller');


	// var sourcesByRoom = _.groupBy(sources, 'pos.roomName');
	var numSources = sources.length;
	var dual = false;
	// @todo: If we start adding sources to this list, how is this supposed to work?
	// @todo: Start requesting dedicated, assigned haulers?
	if (numSources === 2 && this.level >= 6) {
		var totalCapacity = _.sum(sources, 'energyCapacity');
		// If we have miners currently skip..
		const dualminer = _.findWhere(dualminers, { memory: { site: roomName, role: 'dualminer' } });
		if (!dualminer) {
			if (!this.cache.steps || this.cache.steps < 0) {
				const [s1, s2] = sources;
				var s1pos = _.create(RoomPosition.prototype, s1.pos);
				var s2pos = _.create(RoomPosition.prototype, s2.pos);
				this.cache.steps = s1pos.getStepsTo({pos: s2pos, range: 1}) * 2; // expecting two sources
				Log.debug(`${this.pos.roomName} steps: ${this.cache.steps}`, 'Controller');
			}
			const result = _.attempt( () => require('Unit').requestDualMiner(spawn, this.pos.roomName, totalCapacity, this.cache.steps) );
			if (result !== false && !(result instanceof Error)) {
				// Log.warn('Requesting dual miner at ' + roomName + ' from ' + spawn.pos.roomName);
				dual = true;
			}
		} else {
			dual = true;
		}
	}
	if (dual !== true) {
		sources.forEach(source => {
			const miner = _.findWhere(miners, { memory: { dest: source.pos, role: 'miner' } });
			if (!miner || (miner.ticksToLive && this.room.energyCapacityAvailable < 600 && miner.ticksToLive < UNIT_BUILD_TIME(miner.body) + assistCost)) {
				prio = 75;
				if (storedEnergy > 10000)
					prio = 50;
				else if (storedEnergy <= 0)
					prio = 100;
				if (source.pos.roomName !== roomName)
					prio = 1;
				// Log.warn(`Requesting miner to ${pos} from ${spawn.pos.roomName} priority ${prio}`);
				if (this.room.energyCapacityAvailable < 600)
					require('Unit').requestMiner(assistingSpawn || spawn, source.pos, prio);
				else
					require('Unit').requestMiner(spawn || assistingSpawn, source.pos, prio);
			}
		});
	}

	const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
	if (sites && sites.length && builders.length < (numSources || 1)) { // && (this.room.energyAvailable > 200 || storedEnergy > 110000)) {
		const buildRemaining = _.sum(sites, s => s.progressTotal - s.progress);	// Total energy required to finish all builds
		const score = Math.ceil(buildRemaining / CREEP_LIFE_TIME / BUILD_POWER);
		// console.log('build remaining in room: ' + score);
		// score = Math.clamp(0, score, 3);
		let useSpawn = spawn || assistingSpawn;
		// Past a certain point it doesn't make sense to use. Otherwise mix things up.
		if (this.level < 6 && assistingSpawn && Math.random() < 0.5)
			useSpawn = assistingSpawn;
		if (!useSpawn)
			Log.warn(`No spawn available to request builders for ${this.pos.roomName}`, 'Controller');
		prio = Math.clamp(0, 100 - Math.ceil(100 * (builders.length / numSources)), 90);
		var elimit = (storedEnergy > 10000) ? Infinity : (10 * numSources);
		require('Unit').requestBuilder(useSpawn, { elimit, home: roomName, priority: prio });
	}

	// Defenders
	// @todo If not enclosed, requesting ranged kiters.
	// @todo Compare my damage output versus heal in the room.
	if ((this.safeMode || 0) < SAFE_MODE_IGNORE_TIMER) {
		const towers = _.size(room.find(FIND_MY_STRUCTURES, { filter: Filter.loadedTower }));
		// if (!_.isEmpty(hostiles) && room.my && (towers <= 0 || hostiles.length > towers)) {
		if (towers <= 0 || room.hostiles.length > towers) {
			const desired = Math.clamp(1, room.hostiles.length * 2, 8);
			for (var di = defenders.length; di < desired; di++) {
				prio = Math.max(50, 100 - Math.ceil(100 * (di / desired)));
				const supplier = _.sample(['requestDefender', 'requestRanger']);
				require('Unit')[supplier](spawn, roomName, prio);
			}
			if (this.room.hostiles.length && _.all(this.room.hostiles, 'owner.username', INVADER_USERNAME))
				this.evacuate(`Game.rooms['${this.pos.roomName}'].hostiles.length <= 0`);
		}
	}

	// Healers
	// @todo Disabled until we can prevent these spawning for injured creeps in other rooms.
	// if (healers.length < 1 && _.any(creeps, c => c.hits < c.hitsMax)) {
	//	require('Unit').requestHealer(spawn, roomName);
	// }

	// beyond this point, room-local spawns only
	if (roomName !== this.pos.roomName)
		return;

	if (Memory.empire && Memory.empire.scout && !scouts.length) {
		require('Unit').requestScout(spawn, { origin: this.pos.roomName }, 25);
	}

	const maxScav = (this.level < 3) ? 6 : 4;
	let scavNeed = Math.clamp(2, resDecay, maxScav);
	const scavHave = scav.length;
	// @todo: Every tick we can pretty easily get this value. Can we do anything useful with it?
	if (this.room.energyPct < 0.25)
		scavNeed += 1;
	const ownedStructures = this.room.structuresMy;
	// if(scavHave < scavNeed && _.size(this.room.structures) > 1) {
	// console.log(`scav ${scavHave} / ${scavNeed}`);
	if (_.size(ownedStructures) <= 1)
		scavNeed = 1;
	if (scavHave < scavNeed) {
		if (scavHave === 0 && pilot.length <= 0) {
			Log.warn(`${this.pos.roomName} No scavs, creating pilot`, 'Controller');
			require('Unit').requestPilot(spawn, roomName);
			return;
		}
		// prio = 100 - Math.ceil(100 * (scavHave / scavNeed));
		prio = Math.clamp(25, 100 - Math.ceil(100 * (scavHave / scavNeed)), 100);
		if (scavHave <= 0 && assistingSpawn)
			spawn = assistingSpawn;
		// Log.warn("Short on scavengers at " + this.pos.roomName + ' (prio: ' + prio + ')');		
		// Log.warn(`Requesting scavenger to ${this.pos.roomName} from ${spawn.pos.roomName} priority ${prio}`);
		// function(spawn, home=null, canRenew=true, priority=50, hasRoad=true)
		require('Unit').requestScav(spawn, roomName, (scavNeed <= 3), prio, (this.level > 2 && roomName === spawn.pos.roomName));
	}

	// @todo conflict mode reduce this
	// @todo did we beak RCL 8 low power mode?
	if ((!this.upgradeBlocked || this.upgradeBlocked < CREEP_SPAWN_TIME * 6)) {
		const workAssigned = _.sum(upgraders, c => c.getBodyParts(WORK));
		// let workDesired = 10 * (numSources / 2);
		let workDesired = allotedUpgrade;
		if (this.level === MAX_ROOM_LEVEL) {
			if (workAssigned < CONTROLLER_MAX_UPGRADE_PER_TICK && (this.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || storedEnergy > 700000))
				require('Unit').requestUpgrader(spawn, roomName, 90, CONTROLLER_MAX_UPGRADE_PER_TICK);
		} else {
			if (this.room.storage)
				workDesired = Math.floor(workDesired * this.room.storage.stock);
			if(workDesired > 1) {
				const workDiff = workDesired - workAssigned;
				const pctWork = _.round(workAssigned / workDesired, 3);
				Log.debug(`${this.pos.roomName} Upgraders: ${workAssigned} assigned, ${workDesired} desired, ${workDiff} diff (${pctWork})`, 'Controller');
				if (pctWork < 0.80)
					require('Unit').requestUpgrader(spawn, roomName, 25, (workDesired));
			} else {
				Log.debug(`${this.pos.roomName} Upgraders: No upgraders desired, ${workAssigned} assigned.`, 'Controller');
			}
		}
	} else if (this.upgradeBlocked) {
		Log.warn(`${this.pos.roomName} upgrade blocked for ${this.upgradeBlocked} ticks`, 'Controller');
	}

	// No repair needed if nothing's damaged
	// Repair creep with recycle itself.
	// Shut this off if we're dismantling the room.
	// if(_.any(this.room.structures, s => s.hits < s.hitsMax)) {
	// const desiredRepair = (this.level >= 4 && (storedEnergy > 200000 || terminalEnergy > 60000)) ? 1 : 0;
	// const desiredRepai
	if (!repair.length && allotedRepair > 0 && _.any(this.room.structures, s => s.hits / s.hitsMax < 0.90)) {
		require('Unit').requestRepair(spawn, roomName, allotedRepair);
	} else if (repair.length && allotedRepair <= 0) {
		_.invoke(repair, 'setRole', 'recycle');
	}
};

StructureController.prototype.getAssistingSpawn = function () {
	if (!this.memory.retarget || Game.time > this.memory.retarget) {
		Log.debug(`Reset assisting spawn for ${this.pos.roomName}`, 'Controller');
		this.clearTarget();
		this.memory.retarget = Game.time + 10000;
	}
	return this.getTarget(
		() => _.filter(Game.spawns, s => s.pos.roomName !== this.pos.roomName && Game.map.getRoomLinearDistance(s.pos.roomName, this.pos.roomName) <= 2),
		(candidate) => candidate.room.energyCapacityAvailable > this.room.energyCapacityAvailable && !candidate.isDefunct(),
		(candidates) => this.pos.findClosestByPathFinder(candidates, (c) => ({ pos: c.pos, range: 1 })).goal
	);
};

StructureController.prototype.getSafeModeGoal = function () {
	return (CONTROLLER_LEVELS[2] - this.progress) / this.safeMode;
};

/**
 * Push a flee state for all creeps
 * @param {String|Number} condition - Tick to end wait, or eval condition
 */
StructureController.prototype.evacuate = function (condition) {
	this.room.find(FIND_MY_CREEPS).forEach(c => {
		c.pushState('Wait', condition);
		c.pushState('FleeRoom', this.room.name);
	});
};

/**
 * Neighbor considerations.
 *
 * @todo: Dead-end considerations
 */
StructureController.prototype.updateNeighbors = function () {
	var exits = Game.map.describeExits(this.pos.roomName);
	//var avail = _.mapValues(exits, e => Game.map.isRoomAvailable(e));
	var mine = _.mapValues(exits, e => (Game.rooms[e] && Game.rooms[e].my) || false);
	// Require vis
	if (_.all(mine)) {
		// console.log('Room is sheltered');
	}
	return mine;
};

/**
 * Safe mode automation
 */
const SAFE_MODE_LOW_COOLDOWN = 2000;
const SAFE_MODE_LOW_TICKS = 4000;
StructureController.prototype.updateSafeMode = function () {
	if (this.safeModeCooldown === SAFE_MODE_LOW_COOLDOWN)
		Log.notify(`${this.pos.roomName}: Safe mode cooldown almost complete`);
	if (this.safeMode > this.memory.safeMode)
		this.onSafeModeEnter();
	else if (this.safeMode == null && this.memory.safeMode)
		this.onSafeModeExit();
	if (this.safeMode === SAFE_MODE_LOW_TICKS)
		Log.notify(`${this.room.name}: Safe mode expiring soon!`);
	if (this.ticksToDowngrade === EMERGENCY_THRESHOLD[this.level])
		Log.warn(`${this.pos.roomName}: Low ticksToDowngrade, Safe mode at risk`, 'Controller');
	else if (this.ticksToDowngrade > EMERGENCY_THRESHOLD[this.level] && this.memory.ticksToDowngrade <= EMERGENCY_THRESHOLD[this.level] && !this.safeModeCooldown) {
		Log.warn(`${this.pos.roomName}: Safe mode unblocked`, 'Controller');
	}

	if (Game.time === this.memory.postNukeSafeMode) {
		Log.notify(`${this.pos.roomName} Activating post-nuke safe mode.`);
		this.activateSafeMode();
	}
	this.memory.safeMode = this.safeMode || 0;
	this.memory.ticksToDowngrade = this.ticksToDowngrade || 0;
};

StructureController.prototype.onSafeModeEnter = function () {
	Log.notify(`Room ${this.room.name} entering safe mode!`);
};

StructureController.prototype.onSafeModeExit = function () {
	Log.notify(`Room ${this.room.name} leaving safe mode!`);
};

/** 
 * Controller level automation
 */
StructureController.prototype.updateLevel = function () {
	if (!this.memory.level)
		this.onBootup();
	if (this.level < this.memory.level)
		this.onDowngrade(this.level, this.memory.level);
	if (this.level > this.memory.level)
		this.onUpgrade(this.level, this.memory.level);
	// If build room has nothing to do it uses around 1-3 cpu.
	// If the build queue is full it returns early.
	// So we can call this at a higher frequency.
	// if(Game.time % 300 == 0)
	//	Planner.buildRoom(this.room);
	this.memory.level = this.level;
};

/**
 * Controller event for claimed room. One time events? They go here.
 */
StructureController.prototype.onBootup = function () {
	Log.success(`Room ${this.pos.roomName} claimed`, 'Controller');
	this.memory.maxlevel = this.level;
	this.memory.claimedAt = Game.time;
	this.room.find(FIND_HOSTILE_STRUCTURES).forEach(s => s.destroy());
};

StructureController.prototype.onDowngrade = function (level, prev) {
	Log.error(`${this.room.name} has downgraded to level ${this.level}`, 'Controller');
};

// 2016-11-06: Now reports remaining safe mode when we reach RCL 3
StructureController.prototype.onUpgrade = function (level, prev) {
	Log.info(`${this.room.name} has been upgraded to level ${this.level}`, 'Controller');

	if (!this.memory.ticksToReach)
		this.memory.ticksToReach = [];
	if (this.memory.ticksToReach[level] == null)
		this.memory.ticksToReach[level] = Game.time - this.memory.claimedAt;

	this.memory.maxlevel = this.level;
	if (this.level === MAX_ROOM_LEVEL) {
		this.memory.rclLastTick = undefined;
		this.memory.rclAvgTick = undefined;
	}

	if (this.level === 3) {
		if (this.safeMode) {
			Log.notify(`RCL 3 reached in ${this.pos.roomName} with ${this.safeMode} ticks left on safe mode!`);
		}
		this.memory['RCL3ReachedIn'] = Game.time - this.memory.claimedAt;
	}

	if (this.level === 2 && !this.safeMode)
		this.activateSafeMode();
};

/**
 * Progress tracking
 */
StructureController.prototype.updateRclAvg = function () {
	if (this.level === MAX_ROOM_LEVEL)
		return;
	if (this.memory.rclLastTick || this.memory.rclLastTick === 0) {
		var diff = this.progress - this.memory.rclLastTick;
		// this.memory.rclAvgTick = Math.cmAvg(diff, this.memory.rclAvgTick, 1000);
		this.memory.rclAvgTick = Math.mmAvg(diff, this.memory.rclAvgTick, 1000);
	}
	this.memory.rclLastTick = this.progress;
};

StructureController.prototype.estimateInTicks = function () {
	return Math.ceil((this.progressTotal - this.progress) / this.memory.rclAvgTick);
};

StructureController.prototype.estimate = function () {
	return Time.estimate(this.estimateInTicks());
};

StructureController.prototype.canUnclaim = function () {
	return !PREVENT_UNCLAIM.includes(this.pos.roomName);
};

const { unclaim } = StructureController.prototype;
StructureController.prototype.unclaim = function () {
	if (this.canUnclaim())
		unclaim.call(this);
	else
		Log.notify(`Unable to unclaim ${this.pos.roomName}`);
};

const { activateSafeMode } = StructureController.prototype;
StructureController.prototype.activateSafeMode = function () {
	if (this.checkBit(BIT_CTRL_DISABLE_SAFEMODE))
		return ERR_INVALID_TARGET;
	// const nukes = this.room.find(FIND_NUKES, { filter: n => n.timeToLand < MINIMUM_REQUIRED_SAFE_MODE });
	// if (!_.isEmpty(nukes))
	//	return ERR_BUSY;
	return activateSafeMode.call(this);
};

/**
 * Override room object get link with a higher default range
 */
StructureController.prototype.getLink = function (range = 3) {
	return RoomObject.prototype.getLink.call(this, range);
};