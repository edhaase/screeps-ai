/* 
 * Configuration Constants
 */
"use strict";

global.WHOAMI = _.find(Game.structures).owner.username;
global.PREVENT_UNCLAIM = ['E59S39', 'E58S41'];
global.INVADER_USERNAME = 'Invader';
global.SOURCE_KEEPER_USERNAME = 'Source Keeper';
global.IS_PTR = !!(Game.shard && Game.shard.ptr);
global.IS_SIM = !!Game.rooms['sim'];

global.RUNTIME_ID = Game.time;

global.MAX_ROOM_LEVEL = 8;							// Because this should really be a constant.
global.MAX_OWNED_ROOMS = Infinity;					// Lower this if we can't afford more.

global.CONST_COST = 0.2;
global.HARD_UNIT_CAP = Game.cpu.limit / CONST_COST;			// Anything above this value is guaranteed to eat bucket.
global.SOFT_UNIT_CAP = 60;									// Arbritary limit, as we're already eating bucket.
global.HARD_CONST_CAP = Game.cpu.tickLimit / CONST_COST;	// Hard cap on number of const actions per tick.

// General energy-per-tick (EPT) goal to aim for
global.SOURCE_GOAL_OWNED = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
global.SOURCE_GOAL_NEUTRAL = SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME;
global.SOURCE_GOAL_KEEPER = SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME;
// Optimal number of parts per source (but 1 to 3 more can lower cpu at a minor increase in creep cost)
global.SOURCE_HARVEST_PARTS = SOURCE_ENERGY_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;
global.SOURCE_HARVEST_PARTS_NEUTRAL = SOURCE_ENERGY_NEUTRAL_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;
global.SOURCE_HARVEST_PARTS_KEEPER = SOURCE_ENERGY_KEEPER_CAPACITY / HARVEST_POWER / ENERGY_REGEN_TIME;
// Number of carry parts needed per step (approriated from knightshade)
global.SOURCE_CARRY_PARTS_PER_DISTANCE_OWNED = SOURCE_GOAL_OWNED / CARRY_CAPACITY;
global.SOURCE_CARRY_PARTS_PER_DISTANCE_NEUTRAL = SOURCE_GOAL_NEUTRAL / CARRY_CAPACITY;
global.SOURCE_CARRY_PARTS_PER_DISTANCE_KEEPER = SOURCE_GOAL_KEEPER / CARRY_CAPACITY;
// Frequency of attacks
global.MINIMUM_INVADER = 75000;
global.SOURCE_RAID_FREQ_OWNED = MINIMUM_INVADER / (SOURCE_GOAL_OWNED * 2);
global.SOURCE_RAID_FREQ_NEUTRAL = MINIMUM_INVADER / (SOURCE_GOAL_NEUTRAL * 2);
global.SOURCE_RAID_FREQ_KEEPER = MINIMUM_INVADER / (SOURCE_GOAL_KEEPER * 3);

global.TOWER_OPERATIONS = TOWER_CAPACITY / TOWER_ENERGY_COST;

global.POWER_BANK_MIN_ATTACK = Math.ceil(POWER_BANK_HITS / ATTACK_POWER / POWER_BANK_DECAY);
global.POWER_BANK_MAX_RETURN_DAMAGE = POWER_BANK_HITS * POWER_BANK_HIT_BACK;
global.POWER_BANK_SINGLE_SPAWN = Math.ceil(POWER_BANK_HITS / ATTACK_POWER / CREEP_LIFE_TIME);

global.UPGRADER_PARTS_GOAL = Math.ceil(CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER);
global.TICKS_TO_EMPTY_BUCKET = Math.ceil(10000 / (Game.cpu.tickLimit - Game.cpu.limit));

global.BODYPART_MAX_HITS = 100;
global.UNIT_COST = (body) => _.sum(body, p => BODYPART_COST[p]);
global.UNIT_BUILD_TIME = (body) => CREEP_SPAWN_TIME * body.length;

global.DUAL_SOURCE_MINER_SIZE = (steps, cap = SOURCE_ENERGY_CAPACITY) => Math.ceil((cap * 2) / HARVEST_POWER / (ENERGY_REGEN_TIME - steps * 2));
global.CARRY_PARTS = (capacity, steps) => Math.ceil(capacity / ENERGY_REGEN_TIME * 2 * steps / CARRY_CAPACITY);
global.DISMANTLE_RETURN = (workParts) => DISMANTLE_COST * DISMANTLE_POWER * workParts;

global.GCL_LEVEL = (i) => (Math.pow(i, GCL_POW) - Math.pow(i - 1, GCL_POW)) * GCL_MULTIPLY;

global.findNuker = (roomName) => _.find(Game.structures, s => s.structureType === STRUCTURE_NUKER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= NUKE_RANGE);
global.findAllNukers = (roomName) => _.filter(Game.structures, s => s.structureType === STRUCTURE_NUKER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= NUKE_RANGE);

/*
global.CONTROLLER_DOWNGRADE_FULL = {1: CONTROLLER_DOWNGRADE[1]};
for(i=2; i<=8; i++)
	CONTROLLER_DOWNGRADE_FULL[i] = CONTROLLER_DOWNGRADE_FULL[i-1] + CONTROLLER_DOWNGRADE[i];	
*/
global.ticksTillDead = (level, currentTimer) => _.sum(_.slice(_.values(CONTROLLER_DOWNGRADE), 0, level - 1)) + currentTimer;

// 3 energy per 100 ticks? 1 ept to maintain
// 1000 roads = 1 e/t, or 1000 ticks for 100 hits
// or 1 energy per 1000 ticks (without load)
// or 1 energy per hour
global.RAMPART_UPKEEP = RAMPART_DECAY_AMOUNT / REPAIR_POWER / RAMPART_DECAY_TIME;
global.ROAD_UPKEEP = ROAD_DECAY_AMOUNT / REPAIR_POWER / ROAD_DECAY_TIME;
global.ROAD_UPKEEP_SWAMP = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_SWAMP_RATIO) / REPAIR_POWER / ROAD_DECAY_TIME;
global.CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME_OWNED;
global.REMOTE_CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME;

global.DEFAULT_STORAGE_RESERVE = 100000;
global.DEFAULT_BUILD_JOB_EXPIRE = 12000;
global.DEFAULT_BUILD_JOB_PRIORITY = 0.5;

global.SAFE_MODE_IGNORE_TIMER = CREEP_LIFE_TIME + 500;

global.CONTROLLER_EMERGENCY_THRESHOLD = 3000;
global.MINIMUM_RESERVATION = Math.max(CREEP_LIFE_TIME + 200, Math.ceil(CONTROLLER_RESERVE_MAX / 2));
global.REDUCED_RAMPART_GOAL = 1000000;

/**
 * Range constants
 */
global.CREEP_BUILD_RANGE = 3;
global.CREEP_RANGED_ATTACK_RANGE = 3;
global.CREEP_UPGRADE_RANGE = 3;
global.CREEP_REPAIR_RANGE = 3;
global.CREEP_RANGED_HEAL_RANGE = 3;
global.MINIMUM_SAFE_FLEE_DISTANCE = 4; // Because ranged actions as usually 3.

global.FATIGUE_ROAD = 0.5;
global.FATIGUE_BASE = 1;
global.FATIGUE_SWAMP = 5;

global.NUKE_EFFECT_RANGE = 2;

global.BUCKET_MAX = 10000;
global.BUCKET_LIMITER = true; // Default to enabled during resets.
global.BUCKET_LIMITER_LOWER = 4000;
global.BUCKET_LIMITER_UPPER = 6000;

global.CONTROLLER_STRUCTURES_LEVEL_FIRST = [];
for (var i = 0; i <= 8; i++)
	CONTROLLER_STRUCTURES_LEVEL_FIRST[i] = _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[i]);

/** Critical infrastructure is auto-ramparted periodically or on creation */
global.CRITICAL_INFRASTRUCTURE = [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN, STRUCTURE_LAB, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN];

/** primary flag types */
global.FLAG_MILITARY = COLOR_RED;	// Military
global.FLAG_MINING = COLOR_YELLOW;	// Economy
global.FLAG_TRANSPORT = COLOR_GREY;	// Transport

/** military flags */
global.STRATEGY_ATTACK = COLOR_RED;	// Murder.
global.STRATEGY_DISMANTLE = COLOR_PURPLE;	// Similar to PLAN_DEMOLISH, but no carry. Just take shit apart.
global.STRATEGY_SCOUT = COLOR_BLUE;	// Assign a scout to this location (memory: auto disable?)
global.STRATEGY_STEAL = COLOR_CYAN;	// (MOVE,CARRY) drains resources
global.STRATEGY_DEFEND = COLOR_GREEN;	// Maintain a guard post. (melee or ranged though?)
global.STRATEGY_RESPOND = COLOR_YELLOW;	// Summons specialized guards to respond to threats.
global.STRATEGY_RESERVE = COLOR_ORANGE;
global.STRATEGY_G = COLOR_BROWN;
global.STRATEGY_H = COLOR_GREY;	// put a reserver here to hold the room.
global.STRATEGY_I = COLOR_WHITE;

/** economy flags */ // SITE_SK?
global.SITE_DUAL_MINER = COLOR_RED;
global.SITE_STATUS_UNKNOWN = COLOR_PURPLE;
global.SITE_SKMINE = COLOR_BLUE;				// ? requests guards?
global.SITE_PICKUP = COLOR_CYAN;				// in use, desginated pickup site for haulers
global.SITE_LOCAL = COLOR_YELLOW;
global.SITE_MINERAL = COLOR_ORANGE;				// in use, builds extractors
global.SITE_LAB = COLOR_BROWN;
global.SITE_REMOTE = COLOR_GREY;
global.SITE_IDLE = COLOR_WHITE;					// in use, idle sites are ignored

/** transport flags */
global.TRANSPORT_AVOID = COLOR_RED;		// manually marks an obstacle in the cost matrix
global.TRANSPORT_A = COLOR_PURPLE;
global.TRANSPORT_B = COLOR_BLUE;
global.TRANSPORT_C = COLOR_CYAN;
global.TRANSPORT_D = COLOR_GREEN;
global.TRANSPORT_E = COLOR_YELLOW;
global.TRANSPORT_RESERVE = COLOR_ORANGE;
global.TRANSPORT_G = COLOR_BROWN;
global.TRANSPORT_H = COLOR_GREY;	// put a reserver here to hold the room.
global.TRANSPORT_I = COLOR_WHITE;

global.LOG_TAG_CREEP = 'Creep';

Object.defineProperty(global, 'CPU_LIMITER', {
	get: function () {
		// @todo: adjust limit based on remaining bucket, and log function
		return Game.cpu.getUsed() > Game.cpu.limit - 1;
		// return Game.cpu.getUsed() > 9;
	},
	configurable: true
});

global.BODYPART_THREAT = {
	[HEAL]: 150,
	[ATTACK]: 100,
	[RANGED_ATTACK]: 50,
	[WORK]: 10,
	[CLAIM]: 10,
	[CARRY]: 5,
	[MOVE]: 2,
	[TOUGH]: 1
};

/**
 * Will probably be evaluated as max (priority / distance).
 */
global.STRUCTURE_THREAT = {
	[STRUCTURE_SPAWN]: 1.0,
	[STRUCTURE_TOWER]: 0.95,	// These _must_ die.
	[STRUCTURE_EXTENSION]: 0.75,
	[STRUCTURE_STORAGE]: 0.75,	// May be adjusted for contents
	[STRUCTURE_TERMINAL]: 0.75,
	[STRUCTURE_LINK]: 0.10,
	[STRUCTURE_WALL]: 0.5,
	[STRUCTURE_OBSERVER]: 0,
	[STRUCTURE_EXTRACTOR]: 0,
	[STRUCTURE_ROAD]: 0,		// These aren't threats
	[STRUCTURE_RAMPART]: 0,		// will be dealth with if in the way.
	[STRUCTURE_WALL]: 0,
	[STRUCTURE_CONTAINER]: 0,
};

/**
 * Relationship is max (priority  || 1) / distance
 * So if we want something to _always_ take priority,
 * it must be > 50 * priority of the next lowesst.
 */
global.STRUCTURE_BUILD_PRIORITY = {
	[STRUCTURE_SPAWN]: 1.00,
	[STRUCTURE_TOWER]: 0.9,
	[STRUCTURE_LINK]: 0.70,
	[STRUCTURE_EXTENSION]: 0.65,
	[STRUCTURE_STORAGE]: 0.5,
	[STRUCTURE_OBSERVER]: 0.5,
	[STRUCTURE_TERMINAL]: 0.5,
	[STRUCTURE_EXTRACTOR]: 0.5,
	[STRUCTURE_CONTAINER]: 0.35,
	[STRUCTURE_WALL]: 0.25,
	[STRUCTURE_RAMPART]: 0.25,
	[STRUCTURE_ROAD]: 0.25,
	[STRUCTURE_POWER_SPAWN]: 0.10,
	[STRUCTURE_LAB]: 0.10
};

/**
 * Distance factor into this? Walls and ramparts further away take priority?
 */
global.REPAIR_LIMIT = [
	5000,		// RCL 0
	5000,		// RCL 1
	5000,		// RCL 2
	18000,		// RCL 3
	50000,		// RCL 4
	128000,		// RCL 5
	128000,		// RCL 6
	2450000,	// RCL 7
	3000000,	// RCL 8
];

/**
 * Directional lookup table
 * @example: let [dx,dy] = DIR_TABLE[dir];
 */
global.DIR_TABLE = {
	[TOP]: [0, -1],
	[TOP_RIGHT]: [1, -1],
	[RIGHT]: [1, 0],
	[BOTTOM_RIGHT]: [1, 1],
	[BOTTOM]: [0, 1],
	[BOTTOM_LEFT]: [-1, 1],
	[LEFT]: [-1, 0],
	[TOP_LEFT]: [-1, -1]
};

// Unicode options
// https://en.wikipedia.org/wiki/List_of_Unicode_characters
global.UNICODE_ARROWS = {
	[TOP]: "\u2191",
	[TOP_RIGHT]: "\u2197",
	[RIGHT]: "\u2192",
	[BOTTOM_RIGHT]: "\u2198",
	[BOTTOM]: "\u2193",
	[BOTTOM_LEFT]: "\u2199",
	[LEFT]: "\u2190",
	[TOP_LEFT]: "\u2196",
	"ARROW_BARS": "\u21B9",
	"THREE_RIGHT": "\u21F6",
};
global.UNICODE = {
	MU: '\u03BC', // Greek letter mu. Mathematical average.
};
// Number forms:
// \u2160 - \u216F

global.DIAGONALS = [TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, TOP_LEFT];
global.HORIZONTALS = [TOP, BOTTOM, LEFT, RIGHT];

global.REVERSE_DIR = {
	[TOP]: BOTTOM,
	[TOP_RIGHT]: BOTTOM_LEFT,
	[RIGHT]: LEFT,
	[BOTTOM_RIGHT]: TOP_LEFT,
	[BOTTOM]: TOP,
	[BOTTOM_LEFT]: TOP_RIGHT,
	[LEFT]: RIGHT,
	[TOP_LEFT]: BOTTOM_RIGHT
};

/**
 * Stolen from dragoonreas github
 * https://github.com/dragoonreas/Screeps/blob/9a1c6dbccad327d481a774f20b8152ecce117a0b/scripts/globals.js
 */
global.ICONS = {
	[STRUCTURE_CONTROLLER]: "\uD83C\uDFF0"
	, [STRUCTURE_SPAWN]: "\uD83C\uDFE5"
	, [STRUCTURE_EXTENSION]: "\uD83C\uDFEA"
	, [STRUCTURE_CONTAINER]: "\uD83D\uDCE4"
	, [STRUCTURE_STORAGE]: "\uD83C\uDFE6"
	, [STRUCTURE_RAMPART]: "\uD83D\uDEA7"
	, [STRUCTURE_WALL]: "\u26F0"
	, [STRUCTURE_TOWER]: "\uD83D\uDD2B"
	, [STRUCTURE_ROAD]: "\uD83D\uDEE3"
	, [STRUCTURE_LINK]: "\uD83D\uDCEE"
	, [STRUCTURE_EXTRACTOR]: "\uD83C\uDFED"
	, [STRUCTURE_LAB]: "\u2697"
	, [STRUCTURE_TERMINAL]: "\uD83C\uDFEC"
	, [STRUCTURE_OBSERVER]: "\uD83D\uDCE1"
	, [STRUCTURE_POWER_SPAWN]: "\uD83C\uDFDB"
	, [STRUCTURE_NUKER]: "\u2622"
	, [STRUCTURE_KEEPER_LAIR]: "" // TODO: Add icon for keeper lair
	, [STRUCTURE_PORTAL]: "" // TODO: Add icon for portal
	, [STRUCTURE_POWER_BANK]: "" // TODO: Add icon for power bank
	, source: "" // TODO: Add icon for source
	, constructionSite: "\uD83C\uDFD7"
	, resource: "\uD83D\uDEE2"
	, creep: "" // TODO: Add icon for creep
	, moveTo: "\u27A1"
	, attack: "\uD83D\uDDE1" // NOTE: Same as attackController
	, build: "\uD83D\uDD28"
	, repair: "\uD83D\uDD27"
	, dismantle: "\u2692"
	, harvest: "\u26CF"
	, pickup: "\u2B07" // NOTE: Same as withdraw
	, withdraw: "\u2B07" // NOTE: Same as pickup
	, transfer: "\u2B06" // NOTE: Same as upgradeController
	, upgradeController: "\u2B06" // NOTE: Same as transfer
	, claimController: "\uD83D\uDDDD"
	, reserveController: "\uD83D\uDD12"
	, attackController: "\uD83D\uDDE1" // NOTE: Same as attack
	, recycle: "\u267B"
	, wait0: "\uD83D\uDD5B" // 12:00
	, wait1: "\uD83D\uDD67" // 12:30
	, wait2: "\uD83D\uDD50" // 01:00
	, wait3: "\uD83D\uDD5C" // 01:30
	, wait4: "\uD83D\uDD51" // 02:00
	, wait5: "\uD83D\uDD5D" // 02:30
	, wait6: "\uD83D\uDD52" // 03:00
	, wait7: "\uD83D\uDD5E" // 03:30
	, wait8: "\uD83D\uDD53" // 04:00
	, wait9: "\uD83D\uDD5F" // 04:30
	, wait10: "\uD83D\uDD54" // 05:00
	, wait11: "\uD83D\uDD60" // 05:30
	, wait12: "\uD83D\uDD55" // 06:00
	, wait13: "\uD83D\uDD61" // 06:30
	, wait14: "\uD83D\uDD56" // 07:00
	, wait15: "\uD83D\uDD62" // 07:30
	, wait16: "\uD83D\uDD57" // 08:00
	, wait17: "\uD83D\uDD63" // 08:30
	, wait18: "\uD83D\uDD58" // 09:00
	, wait19: "\uD83D\uDD64" // 09:30
	, wait20: "\uD83D\uDD59" // 10:00
	, wait21: "\uD83D\uDD65" // 10:30
	, wait22: "\uD83D\uDD5A" // 11:00
	, wait23: "\uD83D\uDD66" // 11:30
	, testPassed: "\uD83C\uDF89" // for when scout reaches its goal location
	, testFinished: "\uD83C\uDFC1" // for when scout has finished its test run
};

/**
 * Global functions
 */
global.defineCachedGetter = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			if (this === proto || this == null)
				return null;
			var result = fn.call(this, this);
			Object.defineProperty(this, propertyName, {
				value: result,
				configurable: true,
				enumerable: false
			});
			return result;
		},
		configurable: true,
		enumerable: enumerable
	});
};

global.defineGetter = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return fn.call(this, this);
		},
		configurable: true,
		enumerable: enumerable
	});
};

global.defineMemoryBackedProperty = function (proto, propertyName, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return this.memory[propertyName];
		},
		set: function(v) {
			return (this.memory[propertyName] = v);
		},
		configurable: true,
		enumerable: enumerable
	});
};

/* global.defineLazyProperties = function(scope, obj) {
	_.each(obj, (v,k) => defineCachedGetter(scope, k, v));
}

defineLazyProperties(global, {
	'MSG_ERR': () => {
		var rtn = _(global)
		.pick((v,k) => k.startsWith('ERR_'))
		.invert()
		.value();
		rtn[OK] = "OK";
		return rtn;
	}
}) */

/**
 * Lookup tables
 */
/* global.MSG_ERR = _(global)
	.pick((v,k) => k.startsWith('ERR_'))
	.invert()
	.value();
MSG_ERR[OK] = "OK";

global.MSG_COLOR = _(global)
	.pick((v,k) => k.startsWith('COLOR_'))
	.invert()
	.value();
	
global.MSG_FIND = _(global)
	.pick((v,k) => k.startsWith('FIND_'))
	.invert()
	.value();
	
global.MSG_STRUCT = _(global)
	.pick((v,k) => k.startsWith('STRUCTURE_'))
	.invert()
	.value();
	
global.MSG_RES = _(global)
	.pick((v,k) => k.startsWith('RESOURCE_'))
	.invert()
	.value();
*/
/* global.HSV_COLORS = [];
for(var i=0; i<100; i++)
	HSV_COLORS[i] = Util.getColorBasedOnPercentage(i);
*/

/** command */
global.GC = function () {
	// if(Game.time % 10000 === 0) {
	if ((Game.time & 16383) === 0) {
		GCStructureMemory();
	}
	if ((Game.time & 15))
		return;

	var groups = {};
	var name;
	for (name in Memory.creeps) {
		if (Memory.creeps[name].gid)
			groups[Memory.creeps[name].gid] = 1;
		if (!Game.creeps[name]) {
			const age = Game.time - Memory.creeps[name].born;
			const maxAge = _.get(Memory, 'stats.maxAge', CREEP_LIFE_TIME);
			if (age > CREEP_LIFE_TIME)
				Log.debug(`Garbage collecting ${name} (age: ${age})`, 'GC');
			if (age > maxAge)
				Log.info(`New max age! ${name} with ${age} ticks!`);
			_.set(Memory, 'stats.maxAge', Math.max(maxAge, age));
			Memory.creeps[name] = undefined;
		}
	}

	for (name in Memory.flags) {
		if (Memory.flags[name].gid)
			groups[Memory.flags[name].gid] = 1;
		if (!Game.flags[name] || _.isEmpty(Memory.flags[name])) {
			Memory.flags[name] = undefined;
		}
	}

	for (name in Memory.spawns) {
		if (Memory.spawns[name].gid)
			groups[Memory.spawns[name].gid] = 1;
		if (!Game.spawns[name]) {
			Memory.spawns[name] = undefined;
		}
	}

	Memory.rooms = _.omit(Memory.rooms, _.isEmpty);
	// console.log("Group ids still around: " + ex(groups));
	Memory.groups = _.omit(Memory.groups, (v, k) => !groups[k]);
	/* for(var name in Memory.rooms)
		if(Game.time - (Memory.rooms[name]['tick'] || 0) > 10000) {
			Log.notify('Garbage collecting old room ' + name);
			delete Memory.rooms[name];
		} */
};

global.GCStructureMemory = function () {
	for (var id in Memory.structures)
		if (!Game.structures[id]) { // || _.isEmpty(Memory.structures[id])) {
			Log.notify(`Garbage collecting structure ${id}, ${JSON.stringify(Memory.structures[id])}`);
			Memory.structures[id] = undefined;
		}
};

global.profile = function (ticks = 30, filter = null) {
	Game.profiler.profile(ticks, filter);
};

global.progress = function () {
	const ticksTilGCL = (Game.gcl.progressTotal - Game.gcl.progress) / Memory.gclAverageTick;
	console.log(`Time till GCL ${(Game.gcl.level + 1)}: ${Time.estimate(ticksTilGCL)} ${Log.progress(Game.gcl.progress, Game.gcl.progressTotal)}`);
	_(Game.rooms)
		.map('controller')
		.filter('my')
		.filter(c => c.level < 8)
		// .each(c => console.log("Room: " + c.room.name + ", RCL: " + (c.level+1) + ", " + c.estimate()))
		.each(c => console.log(`Room: ${c.room.name}, RCL: ${(c.level + 1)},  ${c.estimate()} ${Log.progress(c.room.controller.progress, c.room.controller.progressTotal)}`))
		.commit();
};

global.stats = function () {
	console.log(`Bucket: ${Game.cpu.bucket}`);
	console.log(`Rooms: ${_.size(Game.rooms)}`);
	console.log(`Creeps: ${_.size(Game.creeps)}`);
	console.log(`Structures: ${_.size(Game.structures)}`);
	console.log(`Flags: ${_.size(Game.flags)}`);
	console.log(`Construction sites: ${_.size(Game.constructionSites)}`);
	if (Memory.profiler)
		console.log(`Profiler: ${(Memory.profiler.disableTick - Game.time)}`);
	console.log(ex(_.countBy(Game.creeps, 'memory.role')));
};

// ncshupheo's wall score
global.wcmc = (hits) => Math.floor(254 * Math.sqrt(Math.sqrt(hits / WALL_HITS_MAX)) + 1);

global.goid = (x) => Game.getObjectById(x);				// get object by id
global.ex = (x) => JSON.stringify(x, null, 2);	// explain
global.exg = (x) => ex(goid(x));
global.hl = (x, radius = 5) => x.room.visual.circle(x.pos, { fill: 'red', radius, lineStyle: 'dashed' });

global.wroom = function (roomName, fn) {			// with room
	let ob = _.find(Game.structures, (s) => s.structureType === STRUCTURE_OBSERVER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= OBSERVER_RANGE);
	if (ob)
		ob.exec(roomName, fn);
	else
		return "No observer in range";
};

global.terminals = function () {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	let rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.terminal != undefined));
	let terminals = _.map(rooms, 'terminal');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	let headers = ['res'].concat(_.map(rooms, 'name'));
	let rows = _.map(RESOURCES_ALL, function (res) {
		let stored = _.map(terminals, t => _.get(t, 'store.' + res, 0));
		return [res].concat(stored);
	});
	rows = _.filter(rows, r => _.any(r,(v,k) => v > 0));
	let totals = _.map(terminals, 'total');
	rows.unshift(['total'].concat(totals));
	output += '</table>';
	console.log(Log.table(headers, rows));
};

global.storage = function () {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	const rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.storage != undefined));
	const sts = _.map(rooms, 'storage');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	const headers = ['res'].concat(_.map(rooms, 'name'));
	let rows = _.map(RESOURCES_ALL, function (res) {
		const stored = _.map(sts, t => _.get(t, `store.${res}`, 0));
		return [res].concat(stored);
	});
	rows = _.filter(rows, r => _.any(r,(v,k) => v > 0));
	const totals = _.map(sts, 'total');
	rows.unshift(['total'].concat(totals));
	output += '</table>';
	console.log(Log.table(headers, rows));
};

/**
 *
 */
global.releaseRoom = function (roomName, confirm = false) {
	if (confirm !== true)
		return "Confirmation required";
	_(Game.flags).filter('pos.roomName', roomName).invoke('remove').commit();
	_(Game.structures).filter('pos.roomName', roomName).invoke('destroy').commit();
	_(Game.creeps).filter('pos.roomName', roomName).invoke('suicide').commit();
};

global.resetRoom = function (roomName) {
	var room = Game.rooms[roomName];
	room.find(FIND_FLAGS).forEach(f => f.remove());
	room.find(FIND_STRUCTURES).forEach(s => s.destroy());
	room.find(FIND_MY_CREEPS).forEach(c => c.suicide());
	Memory.rooms[roomName] = undefined;
};

global.memLargestKey = function () {
	return _.max(Object.keys(Memory), k => JSON.stringify(Memory[k]).length);
};

global.largestKey = function (a) {
	return _.max(Object.keys(a), k => JSON.stringify(a[k]).length);
};

global.memStats = function () {
	// return ex(_.transform(Memory, (r,n,k) => r[k] = JSON.stringify(Memory[k]).length, {} ));
	return ex(_.mapValues(Memory, (v) => JSON.stringify(v).length));
};

global.randInt = function randInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Loops over only functions on the prototype and
 * passes them to a callback function.
 */
global.forEachFn = function forEachFn(proto, cb) {
	var names = Object.getOwnPropertyNames(proto);
	var name, j, desc;
	for (j = 0; j < names.length; j++) {
		name = names[j];
		desc = Object.getOwnPropertyDescriptor(proto, name);
		if (desc.get !== undefined || desc.set !== undefined)
			continue;
		cb(name, proto);
	}
};

/* global.ppc = function() {
	var ordered = _.sortBy(Memory.profiler.map, m => m.time / m.call);
	_.each(ordered, ({time,calls},m) => console.log(`${m} ${time/calls}`));
} */

global.roomLink = (room,shard='shard0') => `<a href='https://screeps.com/a/#!/room/${shard}/${room}'>${shard}/${room}</a>`;

/** Set height of console, author Spedwards */
global.setConsoleLines = function(lines) {
	console.log(`<script>document.querySelector(\'.editor-panel\').style.height = "${Math.ceil(lines * 22.5714) + 30}px";</script>`);
};