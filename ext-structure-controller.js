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

const CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD = 5000;
const CONTROLLER_SAFEMODE_MARGIN = 500;
const EMERGENCY_THRESHOLD = _.mapValues(CONTROLLER_DOWNGRADE, v => v - CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD + CONTROLLER_SAFEMODE_MARGIN);

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
			this.runCensus();
		} catch(e) {
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
 */
StructureController.prototype.updateNukeDetection = function () {
	if (!_.isEmpty(this.room.find(FIND_NUKES))) {
		Log.notify(`[DEFCON] Nuclear launch detected! ${this.pos.roomName}`);
	}
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
// generalization: if(alive + pending < desired) enqueue(); 
StructureController.prototype.runCensus = function () {
	// Bring state into scope
	var { room, pos, ticksToDowngrade, level, safeModeAvailable, upgradeBlocked } = this;
	var { name, hostiles, energyPct, energyCapacityAvailable } = room;
	const { roomName } = pos;
	const spawns = this.room.find(FIND_MY_SPAWNS);
	const terminalEnergy = _.get(this.room, 'terminal.store.energy', 0);
	const storedEnergy = _.get(this.room, 'storage.store.energy', 0);
	var prio = 50;

	// Log.debug(`${roomName} Starting census on tick ${Game.time}`, 'Controller');

	// Disable spawning for a few ticks if a nuke is about to land.
	var nukes = room.find(FIND_NUKES, { filter: n => n.timeToLand < MAX_CREEP_SPAWN_TIME });
	if (!_.isEmpty(nukes)) {
		var nuke = _.max(nukes, 'timeToLand');
		var defer = Math.min(MAX_CREEP_SPAWN_TIME, nuke.timeToLand + 1);
		Log.warn(`Census holding for ${defer} ticks, nuke inbound`, 'Controller');
		spawns.forEach(s => s.defer(defer));
		return;
	}

	// Get other room states
	var resDecay = _.sum(room.resources, 'decay');
	/* if(resDecay > 2) {
		Log.warn(`Resource decay in room ${roomName}: ${resDecay}`, 'Controller');		
	} */

	const census = this.getCensus(); // creeps that exist, and creeps spawning
	const creeps = this.getMyCreeps().value();
	// let spawn = this.pos.findClosestByRange(FIND_MY_SPAWNS);
	// let spawn = this.getClosestSpawn();
	var spawn = room.findOne(FIND_MY_SPAWNS);
	const sites = room.find(FIND_MY_CONSTRUCTION_SITES);

	let pending = {};
	if (!this.memory.retarget || Game.time > this.memory.retarget) {
		Log.debug(`Reset assisting spawn for ${this.pos.roomName}`, 'Controller');
		this.clearTarget();
		this.memory.retarget = Game.time + 10000;
	}

	// Find us an assiting spawner.
	// If our room is functional and about RCL 5-6 we probably no longer need this.
	const assistingSpawn = this.getAssistingSpawn();
	// if(assistingSpawn)
	//	Log.warn(`Room ${name} wants to use room ${assistingSpawn.pos.roomName}`, 'Controller');
	// Basic premise of census:
	/*
		purpose (unique desc),
		role ('filler', 'scav'),
		condition(s),
		desired (number or eval fn),
		counter
		this.census('scav', true, 2, pending)
	 */

	/**
	 * Emergency conditions - Should probably be detected elsewhere
	 */
	if (_.isEmpty(creeps)) { // Nothing alive, nothing about to spawn.
		Log.notify(`Emergency: No creeps in room ${name}!`, 'Controller');
		if (!spawn)
			spawn = this.getClosestSpawn();
		if (spawn) {
			require('Unit').requestPilot(spawn, roomName);
			return;
		}
	}

	/**
	 * Census failover operations
	 */
	if ((!spawn || spawn.isDefunct())) {
		// Log.warn('No spawn or spawn is defunct, failover to assisting spawn', 'Controller');
		spawn = assistingSpawn;
		if (!spawn)
			spawn = this.getClosestSpawn(); // Still checks for defunct
		if (!spawn)
			[spawn] = _.values(Game.spawns);
	}

	if (!spawn) {
		Log.warn(`No spawn available for ${this.pos.roomName}`, 'Controller');
		return;
	}

	if (spawn && assistingSpawn)
		Log.debug(`${roomName} Controller using spawn ${spawn.name}/${spawn.pos} and ${assistingSpawn.name}/${assistingSpawn.pos} `, 'Controller');

	pending = _.countBy(spawn.getQueue(), 'memory.role');
	var curr = (role) => _.get(census, role, 0) + _.get(pending, role, 0);


	// Don't forget to implement dual-miner later
	// This is a start, but not truly ideal as each room has to track a separate
	// list of sources. If two overlap, we can could double up on spawns.
	// Maybe we don't care who is better at mining it, only that only one
	// controller has it.
	// build source roads?
	/* var sources = this.getSourceList();
	var rejects = _.remove(sources, s => !this.isValidSource(s));
	if(rejects && rejects.length)
		Log.warn('Rejecting sources: ' + JSON.stringify(rejects)); */
	// var sources =  room.find(FIND_SOURCES);
	var sources = this.getSources();
	// var sourcesByRoom = _.groupBy(sources, 'pos.roomName');
	var numSources = sources.length;
	var dual = false;
	// @todo: If we start adding sources to this list, how is this supposed to work?
	// @todo: Start requesting dedicated, assigned haulers?
	if (numSources === 2 && level >= 6) {
		var totalCapacity = _.sum(sources, 'energyCapacity');
		// If we have miners currently skip..
		if (!_.findWhere(Game.creeps, { memory: { site: roomName, role: 'dualminer' } })) {
			if (!this.cache.steps) {
				const [s1, s2] = sources;
				var s1pos = _.create(RoomPosition.prototype, s1.pos);
				var s2pos = _.create(RoomPosition.prototype, s2.pos);
				this.cache.steps = s1pos.getStepsTo(s2pos) * 2; // expecting two sources
			}
			if (require('Unit').requestDualMiner(spawn, this.pos.roomName, totalCapacity, this.cache.steps) !== false) {
				// Log.warn('Requesting dual miner at ' + roomName + ' from ' + spawn.pos.roomName);
				dual = true;
			}
		} else {
			dual = true;
		}
	}
	if (dual !== true) {
		sources.forEach(function (source) {
			var pos = _.create(RoomPosition.prototype, source.pos);
			// let total = _.sum(Game.creeps, c => c.getRole() === 'miner' && pos.isEqualToPlain(c.memory.dest) && c.getBodyParts(WORK) );
			// console.log(`Assigned to ${pos}: ${total}`);
			if (!_.findWhere(Game.creeps, { memory: { dest: source.pos, role: 'miner' } })) {
				prio = 75;
				if (storedEnergy > 10000)
					prio = 50;
				else if (storedEnergy <= 0)
					prio = 100;
				if (source.pos.roomName !== roomName)
					prio = 1;
				// Log.warn(`Requesting miner to ${pos} from ${spawn.pos.roomName} priority ${prio}`);
				if (energyCapacityAvailable < 600)
					Mining.requestMiner(assistingSpawn || spawn, pos, prio);
				else
					Mining.requestMiner(spawn || assistingSpawn, pos, prio);
			}
		});
	}

	// This is actually working just fine, but does overbuild, and doesn't recycle.
	// Also, clogs up spawn queue.
	// @todo: can probably remove the room energyAvailable limit, but need drop miners available
	if (!_.isEmpty(sites)) { // && (this.room.energyAvailable > 200 || storedEnergy > 110000)) {
		const buildRemaining = _.sum(sites, s => s.progressTotal - s.progress);	// Total energy required to finish all builds
		let score = Math.ceil(buildRemaining / CREEP_LIFE_TIME / BUILD_POWER);
		// console.log('build remaining in room: ' + score);
		// score = Math.clamp(0, score, 3);
		score = 1;
		if (storedEnergy > 10000)
			score = 2;
		const builders = _.get(census, 'builder', 0);
		// let useSpawn = assistingSpawn || spawn;
		let useSpawn = spawn;
		if ((!spawn || storedEnergy > 10000) && assistingSpawn)
			useSpawn = assistingSpawn;
		if (!useSpawn)
			Log.warn(`No spawn available to request builders for ${this.pos.roomName}`, "Controller");
		if (builders < score && !useSpawn.hasJob({ memory: { role: 'builder', home: roomName } })) {
			prio = Math.min(90, 100 - Math.ceil(100 * (builders / score))); // Can't exceed 90%?
			var elimit = (storedEnergy > 10000) ? Infinity : (10 * numSources);
			require('Unit').requestBuilder(useSpawn, { elimit, home: roomName, priority: prio });
		}

		/* && !_.any(useSpawn.getQueue(), j => j.memory.role == 'builder' && j.memory.home == roomName)) {
			// let builders = _.get(census, 'builder',0) + _.get(pending, 'builder',0);
			if(buildRemaining && builders < score) {			
				// Log.info('Requesting new builder at ' + this.room.name);
				// if(_.all(sites, s => s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL))
				//	require('Unit').requestMicroBuilder(assistingSpawn || spawn,roomName);
				// else
				prio = 100 - Math.ceil(100 * (builders / score));
				require('Unit').requestBuilder(useSpawn,{home:roomName,priority:prio} );
			} 
		} */
	}

	// let scavNeed = 4;
	const maxScav = (level < 3) ? 6 : 4;
	let scavNeed = Math.clamp(2, resDecay, maxScav);
	const scavHave = curr('scav');
	// @todo: Every tick we can pretty easily get this value. Can we do anything useful with it?
	if (energyPct < 0.25)
		scavNeed += 1;
	// if(level >= 2 && _.get(census, 'scav',0) + _.get(pending, 'scav',0) < scavNeed) {
	// if(level >= 2 && curr('scav') < scavNeed && _.size(this.room.structures) > 1) {
	// const ownedStructures = this.room.find(FIND_MY_STRUCTURES);
	const ownedStructures = this.room.structuresMy;
	// if(scavHave < scavNeed && _.size(this.room.structures) > 1) {
	// console.log(`scav ${scavHave} / ${scavNeed}`);
	if (_.size(ownedStructures) <= 1)
		scavNeed = 1;
	if (scavHave < scavNeed) {
		if (scavHave === 0 && curr('pilot') <= 0) {
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
		require('Unit').requestScav(spawn, roomName, (scavNeed <= 3), prio,
			(level > 2 && roomName === spawn.pos.roomName) // Non local or <2 spawn with extra move?
		); // this is still a test?
	}

	// Miners
	// if we can have 2 sources and can build a dual-miner, do so.
	// otherwise build a pair of a single-part miners.

	// Defenders
	// @todo If not enclosed, requesting ranged kiters.
	// @todo Compare my damage output versus heal in the room.
	const towers = _.size(this.room.find(FIND_MY_STRUCTURES, { filter: Filter.loadedTower }));
	if (!_.isEmpty(hostiles) && (towers <= 0 || hostiles.length > towers)) {
		const have = _.get(census, 'defender', 0) + _.get(pending, 'defender', 0);
		const desired = Math.clamp(1, hostiles.length * 2, 8);		
		for (var di = have; di < desired; di++) {
			prio = Math.max(50, 100 - Math.ceil(100 * (di / desired)));
			const supplier = _.sample(['requestDefender','requestRanger']);
			require('Unit')[supplier](spawn, roomName, prio);
		}
	}

	// Healers
	if(_.any(creeps, c => c.hits < c.hitsMax)) {
		const have = _.get(census, 'healer', 0);
		const desired = 2;
		for (var hi = have; hi < desired; hi++)
			require('Unit').requestHealer(spawn, roomName);
	}

	// Static upgraders (enabled at RCL 3?)

	// if(this.level >= 3) { // static upgrader at RCL 2 is nice, but needs extensions first
	// if((!upgradeBlocked || upgradeBlocked < CREEP_SPAWN_TIME*6) && this.room.energyCapacityAvailable >= 550) { // RCL 2 + Extensions
	if ((!upgradeBlocked || upgradeBlocked < CREEP_SPAWN_TIME * 6)) {
		// let goal = 10;
		// if(level >= 8)
		//	goal = CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER;
		// let desired = Math.clamp(1, 1 + Math.floor(storedEnergy / 300000), 3);

		// Sizing the upgrader based on level and #remotes?
		// 2016-12-24: Changed to 0, fallback scav code will take over
		// 2017-03-26: Changed back to 1 at RCL 8 for expansion purposes
		// desired = Math.floor(1+-Math.log(x/8)))
		let desired = 1;
		if (this.level === MAX_ROOM_LEVEL)
			desired = (ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || storedEnergy > 700000) ? 1 : 0;
		else if (level <= 3)
			desired = 3;
		// if(storedEnergy < 10000 && (!ticksToDowngrade || ticksToDowngrade > CONTROLLER_EMERGENCY_THRESHOLD) )
		//	desired = 0;
		const have = _.get(census, 'upgrader', 0) + _.get(pending, 'upgrader', 0);
		const haps = _.get(census, 'hapgrader', 0) + _.get(pending, 'hapgrader', 0);
		if ((have + haps) < desired) {
			// console.log('Requesting upgrader at ' + this.room.name);
			require('Unit').requestUpgrader(spawn, roomName, 25);
		}
	} else if (this.upgradeBlocked) {
		Log.warn(`${this.pos.roomName} upgrade blocked for ${this.upgradeBlocked} ticks`, 'Controller');
	}

	// No repair needed if nothing's damaged
	// Repair creep with recycle itself.
	// Shut this off if we're dismantling the room.
	// if(_.any(this.room.structures, s => s.hits < s.hitsMax)) {
	if (_.any(this.room.structures, s => s.hits / s.hitsMax < 0.90)) {
		const haveRepair = _.get(census, 'repair', 0) + _.get(pending, 'repair', 0);
		const desiredRepair = (this.level >= 4 && (storedEnergy > 200000 || terminalEnergy > 60000)) ? 1 : 0;
		if (haveRepair < desiredRepair) {
			// console.log('Requesting repairer at ' + this.room.name);
			// require('Unit').requestRepair(spawn, 900); // Make it a small one for now.
			// require('Unit').requestRepair(spawn, Math.max(1800, storedEnergy / 400));
			require('Unit').requestRepair(spawn, roomName);
		} else if (haveRepair > desiredRepair) {
			// How are we even getting here?
			const target = _(creeps)
				.filter('memory.role', 'repair')
				.min('ticksToLive');
			if (target && Math.abs(target) != Infinity) {
				Log.info(`Request recycle of repairer: ${target} at ${target.pos}`, 'Controller');
				target.setRole('recycle');
			}
		}
	}


	// Bulldozers
	// if(room.find(FIND_HOSTILE_STRUCTURES, {filter: s => s.structureType )
	// Keep this small, we don't know if the energy capacity is ours or not.
	if (!_.isEmpty(room.find(FIND_HOSTILE_STRUCTURES)) && curr('bulldozer') < 2) {
		spawn.enqueue([WORK, WORK, MOVE, MOVE], null, { role: 'bulldozer', site: roomName }, 10);
	}
};

StructureController.prototype.getAssistingSpawn = function () {
	return this.getTarget(
		() => _.filter(Game.spawns, s => s.pos.roomName !== this.pos.roomName && Game.map.getRoomLinearDistance(s.pos.roomName, this.pos.roomName) <= 2),
		(candidate) => candidate.room.energyCapacityAvailable > this.room.energyCapacityAvailable && !candidate.isDefunct(),
		// (candidates) => this.wpos.findClosestByRange(candidates)
		(candidates) => this.pos.findClosestByPathFinder(candidates, (c) => ({ pos: c.pos, range: 1 })).goal
	);
};

StructureController.prototype.getCensus = function () {
	// Spawning creeps are in Game.creeps, but not room.find
	// return _(Game.creeps).filter('pos.roomName', this.room.name).countBy('memory.role').value();
	return this.getMyCreeps().countBy('memory.role').value();
};

StructureController.prototype.getMyCreeps = function () {
	// return _(Game.creeps).filter(c => c.pos.roomName === this.pos.roomName || Memory.creeps[c.name].home == this.pos.roomName);
	return _(Game.creeps)
		.filter(c => c.pos.roomName === this.pos.roomName || Memory.creeps[c.name].home === this.pos.roomName)
		.filter(c => c.ticksToLive == null || c.ticksToLive > c.body.length * CREEP_SPAWN_TIME);
};

StructureController.prototype.getSafeModeGoal = function () {
	return (CONTROLLER_LEVELS[2] - this.progress) / this.safeMode;
};

/**
 * Mining operations - Move to empire level, or check if another controller owns this source.
 * At empire level we could periodically update closest dropoff points.
 */
StructureController.prototype.getSources = function () {
	if (!this.memory.sources || this.memory.sources.length === 0) {
		Log.info(`Initilizing list of sources for ${this.pos.roomName}`, 'Controller');
		this.memory.sources = this.room.find(FIND_SOURCES).map(s => _.pick(s, ['id', 'pos', 'energyCapacity']));
	}
	return this.memory.sources;
};

/* StructureController.prototype.pushSource = function({id,pos}) {
	if(!this.isValidSource({id,pos}))
		return false;
	if(_(Memory.structures)
		.filter('sources')
		.map('sources')
		.flatten()
		.findWhere({id}))
		return false;
	return this.getSourceList().push({id,pos});
}

StructureController.prototype.isValidSource = function(s) {
	return s.pos.roomName === this.pos.roomName || (Game.rooms[s.pos.roomName] && !Game.rooms[s.pos.roomName].my) || !Game.rooms[s.pos.roomName];
} */

/**
 * Calculate the room's estimated income-per-tick average.
 * @todo: Adjust for size of miner?
 */
StructureController.prototype.getProjectedIncome = function () {
	return _.sum(this.getSources(), s => s.energyCapacity / ENERGY_REGEN_TIME);
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
	else if(this.ticksToDowngrade > EMERGENCY_THRESHOLD[this.level] && this.memory.ticksToDowngrade <= EMERGENCY_THRESHOLD[this.level]) {
		Log.warn(`${this.pos.roomName}: Safe mode unblocked`, 'Controller');
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
};

StructureController.prototype.onDowngrade = function (level, prev) {
	Log.error(`${this.room.name} has downgraded to level ${this.level}`, 'Controller');
};

// 2016-11-06: Now reports remaining safe mode when we reach RCL 3
StructureController.prototype.onUpgrade = function (level, prev) {
	Log.info(`${this.room.name} has been upgraded to level ${this.level}`, 'Controller');
	this.memory.maxlevel = this.level;
	if (this.level === MAX_ROOM_LEVEL) {
		delete this.memory.rclLastTick;
		delete this.memory.rclAvgTick;
	}

	if (this.level === 3) {
		if (this.safeMode) {
			Log.notify(`RCL 3 reached in ${this.pos.roomName} with ${this.safeMode} ticks left on safe mode!`);
		}
		this.memory['RCL3ReachedIn'] = Game.time - this.memory.claimedAt;
	}
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

/** */
StructureController.prototype.estimateInTicks = function () {
	return Math.ceil((this.progressTotal - this.progress) / this.memory.rclAvgTick);
};

/** */
StructureController.prototype.estimate = function () {
	return Time.estimate(this.estimateInTicks());
};

StructureController.prototype.canUnclaim = function () {
	return !PREVENT_UNCLAIM.includes(this.pos.roomName);
};

const {unclaim} = StructureController.prototype;
StructureController.prototype.unclaim = function () {
	if (this.canUnclaim())
		unclaim.call(this);
	else
		Log.notify(`Unable to unclaim ${this.pos.roomName}`);
};

const MINIMUM_REQUIRED_SAFE_MODE = 300;
const {activateSafeMode} = StructureController.prototype;
StructureController.prototype.activateSafeMode = function() {
	if(this.checkBit(BIT_CTRL_DISABLE_SAFEMODE))
		return ERR_INVALID_TARGET;
	const nukes = this.room.find(FIND_NUKES, { filter: n => n.timeToLand < MINIMUM_REQUIRED_SAFE_MODE });
	if (!_.isEmpty(nukes))
		return ERR_BUSY;
	return activateSafeMode.call(this);
};

/**
 * Override room object get link with a higher default range
 */
StructureController.prototype.getLink = function(range=3) {
	return RoomObject.prototype.getLink.call(this,range);
};