/* 
 * Configuration Constants
 */
'use strict';

global.WHOAMI = _.find(Game.structures).owner.username;
global.PREVENT_UNCLAIM = ['E59S39','E58S41'];

// Object.prototype.toString = function() {
//	return JSON.stringify(this,null,2);
// }

global.RUNTIME_ID = Game.time;

global.MAX_ROOM_LEVEL = 8;							// Because this should really be a constant.
global.MAX_OWNED_ROOMS = Infinity;					// Lower this if we can't afford more.

global.MAINTAIN_MINIMUM_BUCKET = 4000;				// If our CPU bucket drops below this, shutdown 'non-important' operations.
global.TICK_DURATION_SAMPLES = 100;					// How many samples should we average the tick duration over?

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
// Frequency of attacks
global.MINIMUM_INVADER = 75000;
global.SOURCE_RAID_FREQ_OWNED = MINIMUM_INVADER / (SOURCE_GOAL_OWNED * 2);
global.SOURCE_RAID_FREQ_NEUTRAL = MINIMUM_INVADER / (SOURCE_GOAL_NEUTRAL * 2);
global.SOURCE_RAID_FREQ_KEEPER = MINIMUM_INVADER / (SOURCE_GOAL_KEEPER*3);

global.TOWER_OPERATIONS = TOWER_CAPACITY / TOWER_ENERGY_COST;
global.POWER_BANK_MIN_ATTACK = Math.ceil(POWER_BANK_HITS / ATTACK_POWER / POWER_BANK_DECAY);
global.POWER_BANK_MAX_RETURN_DAMAGE = POWER_BANK_HITS * POWER_BANK_HIT_BACK;
global.UPGRADER_PARTS_GOAL = Math.ceil(CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER);
global.TICKS_TO_EMPTY_BUCKET = Math.ceil(10000 / (Game.cpu.tickLimit - Game.cpu.limit));

global.DUAL_SOURCE_MINER_SIZE = (steps, cap=SOURCE_ENERGY_CAPACITY) => Math.ceil( (cap*2) / HARVEST_POWER / (ENERGY_REGEN_TIME - steps*2) );
global.CARRY_PARTS = (capacity, steps) => Math.ceil(capacity / ENERGY_REGEN_TIME * 2 * steps / CARRY_CAPACITY);
global.DISMANTLE_RETURN = (workParts) => DISMANTLE_COST * DISMANTLE_POWER * workParts;

global.GCL_LEVEL = (i) => (Math.pow(i, GCL_POW) - Math.pow(i-1, GCL_POW)) * GCL_MULTIPLY;

global.findNuker = (roomName) => _.find(Game.structures, s => s.structureType === STRUCTURE_NUKER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= NUKE_RANGE);
global.findAllNukers = (roomName) => _.filter(Game.structures, s => s.structureType === STRUCTURE_NUKER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= NUKE_RANGE);

// global.weakMap = new WeakMap();
/*
Game.flags['Flag34'].memory.defer = Game.time +  119200
global.CONTROLLER_DOWNGRADE_FULL = {1: CONTROLLER_DOWNGRADE[1]};
for(i=2; i<=8; i++)
	CONTROLLER_DOWNGRADE_FULL[i] = CONTROLLER_DOWNGRADE_FULL[i-1] + CONTROLLER_DOWNGRADE[i];	
*/
global.ticksTillDead = (level, currentTimer) => _.sum(_.slice(_.values(CONTROLLER_DOWNGRADE), 0, level-1)) + currentTimer;

// 3 energy per 100 ticks? 1 ept to maintain
// 1000 roads = 1 e/t, or 1000 ticks for 100 hits
// or 1 energy per 1000 ticks (without load)
// or 1 energy per hour
global.RAMPART_UPKEEP	= RAMPART_DECAY_AMOUNT / REPAIR_POWER / RAMPART_DECAY_TIME;
global.ROAD_UPKEEP		= ROAD_DECAY_AMOUNT / REPAIR_POWER /  ROAD_DECAY_TIME;
global.ROAD_UPKEEP_SWAMP = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_SWAMP_RATIO) / REPAIR_POWER /  ROAD_DECAY_TIME;
global.CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME_OWNED;
global.REMOTE_CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME;
// Game.rooms['E59S42'].find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_ROAD}).length * ROAD_UPKEEP
// Game.rooms['E59S42'].find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_RAMPART}).length * RAMPART_UPKEEP

// Active globals
global.DEFAULT_BUILD_JOB_EXPIRE = 12000;			// 

global.CONTROLLER_EMERGENCY_THRESHOLD = 3000;
global.MINIMUM_RESERVATION = CREEP_LIFE_TIME+200; // Roughly above CREEP_LIFE_TIME (700 ticks doesn't work when room is shut down)
global.REDUCED_RAMPART_GOAL = 1000000;

/**
 * Range constants
 */
global.CREEP_BUILD_RANGE = 3;
global.CREEP_RANGED_ATTACK_RANGE = 3;
global.CREEP_UPGRADE_RANGE = 3;
global.CREEP_REPAIR_RANGE = 3;

global.NUKE_EFFECT_RANGE = 2;

global.BUCKET_MAX = 10000;
global.BUCKET_LIMITER = true; // Default to enabled during resets.
global.BUCKET_LIMITER_LOWER = 6000;
global.BUCKET_LIMITER_UPPER = 8000;

global.STRUCTURES_ALL = Object.keys(CONTROLLER_STRUCTURES);

global.CONTROLLER_STRUCTURES_LEVEL_FIRST = [];
for(var i=0; i<=8; i++)
	CONTROLLER_STRUCTURES_LEVEL_FIRST[i] = _.transform(CONTROLLER_STRUCTURES, (r,v,k) => r[k] = v[i]);


/** Creep roles */
global.ROLE_PILOT = 'pilot';	// Cheap unit for room recovery (should aim to do away with this)
global.ROLE_MINER = 'miner';
global.ROLE_GUARD = 'guard';
global.ROLE_ATTACK = 'attack';
global.ROLE_BULLDOZER = 'bulldozer';
global.ROLE_BUILDER = 'builder';
global.ROLE_HAULER = 'hauler';
global.ROLES_ALL = [
	ROLE_PILOT, ROLE_MINER, ROLE_GUARD, ROLE_ATTACK, ROLE_BULLDOZER, ROLE_BUILDER, ROLE_HAULER
];
	
/* global.ROLE_MODULES = {
	[ROLE_PILOT]: loadModule('role-pilot'),
	[ROLE_MINER]: loadModule('role-miner'),
	'dualminer': loadModule('role-dualminer'),
}; */
	

/** primary flag types */
global.FLAG_MILITARY		= COLOR_RED;	// Military
global.FLAG_MINING			= COLOR_YELLOW;	// Economy
global.FLAG_TRANSPORT		= COLOR_GREY;	// Transport

/** military flags */
global.STRATEGY_ATTACK		= COLOR_RED;	// Murder.
global.STRATEGY_DISMANTLE	= COLOR_PURPLE;	// Similar to PLAN_DEMOLISH, but no carry. Just take shit apart.
global.STRATEGY_SCOUT		= COLOR_BLUE;	// Assign a scout to this location (memory: auto disable?)
global.STRATEGY_STEAL		= COLOR_CYAN;	// (MOVE,CARRY) drains resources
global.STRATEGY_DEFEND		= COLOR_GREEN;	// Maintain a guard post. (melee or ranged though?)
global.STRATEGY_RESPOND		= COLOR_YELLOW;	// Summons specialized guards to respond to threats.
global.STRATEGY_RESERVE		= COLOR_ORANGE;
global.STRATEGY_G			= COLOR_BROWN;
global.STRATEGY_H			= COLOR_GREY;	// put a reserver here to hold the room.
global.STRATEGY_I			= COLOR_WHITE;

/** economy flags */ // SITE_SK?
global.SITE_DUAL_MINER		= COLOR_RED;
global.SITE_STATUS_UNKNOWN	= COLOR_PURPLE;
global.SITE_SKMINE			= COLOR_BLUE;				// ? requests guards?
global.SITE_PICKUP			= COLOR_CYAN;				// in use, desginated pickup site for haulers
global.SITE_NEAR_RC			= COLOR_GREEN;				// in use, hapgrader
global.SITE_LOCAL			= COLOR_YELLOW;
global.SITE_MINERAL			= COLOR_ORANGE;				// in use, builds extractors
global.SITE_LAB				= COLOR_BROWN;
global.SITE_REMOTE			= COLOR_GREY;
global.SITE_IDLE			= COLOR_WHITE;					// in use, idle sites are ignored

/** transport flags */
global.TRANSPORT_AVOID		= COLOR_RED;		// manually marks an obstacle in the cost matrix
global.TRANSPORT_A			= COLOR_PURPLE;
global.TRANSPORT_B			= COLOR_BLUE;
global.TRANSPORT_C			= COLOR_CYAN;
global.TRANSPORT_D			= COLOR_GREEN;
global.TRANSPORT_E			= COLOR_YELLOW;
global.TRANSPORT_RESERVE	= COLOR_ORANGE;
global.TRANSPORT_G			= COLOR_BROWN;
global.TRANSPORT_H			= COLOR_GREY;	// put a reserver here to hold the room.
global.TRANSPORT_I			= COLOR_WHITE;

global.LOG_TAG_CREEP = 'Creep';
global.LOG_TAG_TERMINAL = 'Terminal';

// Bitwise flags: (1 << 3)
// Need flags for structures, creeps, room, players

// [...testSet('E57S47')].length
// Time.measure( () => [...testSet('E57S47')].length )
// E57S47,E57S46,E58S47,E57S48,E57S45,E58S46,E56S46,E59S47,E58S48,E57S49,E56S48,E57S44,E56S45,E59S46,E56S47,E55S46,E59S48,E58S49,E56S49,E55S48,E57S43,E58S44,E56S44,E55S45,E59S45,E60S46,E55S47,E54S46,E60S48,E59S49,E58S50,E56S50,E55S49,E54S48,E57S42,E58S43,E58S45,E56S43,E55S44,E54S45,E59S44,E60S45,E60S47,E54S47,E53S46,E60S49,E59S50,E57S50,E56S51,E55S50,E54S49,E57S41,E56S42,E58S42,E59S43,E55S43,E54S44,E53S45,E60S44,E61S45,E61S47,E53S47,E52S46,E61S49,E60S50,E59S51,E57S51,E56S52,E55S51,E54S50,E57S40,E56S41,E58S41,E59S42,E60S43,E55S42,E54S43,E53S44,E52S45,E61S44,E61S46,E61S48,E53S48,E52S47,E62S49,E61S50,E60S51,E59S52,E58S51,E57S52,E56S53,E55S52,E54S51,E53S50,E58S40,E56S40,E55S41,E60S42,E61S43,E54S42,E53S43,E52S44,E51S45,E62S44,E62S46,E52S48,E51S47,E62S48,E62S50,E61S51,E60S52,E59S53,E58S52,E57S53,E56S54,E55S53,E54S52,E53S51,E53S49,E52S50,E58S39,E59S40,E56S39,E55S40,E60S41,E61S42,E62S43,E54S41,E53S42,E52S43,E51S44,E51S46,E50S45,E63S44,E62S45,E63S46,E52S49,E50S47,E62S47,E63S50,E62S51,E61S52,E60S53,E59S54,E58S53,E57S54,E56S55,E55S54,E54S53,E53S52,E52S51,E51S50,E58S38,E59S39,E57S39,E60S40,E59S41,E56S38,E55S39,E54S40,E61S41,E62S42,E63S43,E53S41,E52S42,E51S43,E50S44,E50S46,E64S44,E63S45,E64S46,E63S47,E50S48,E64S50,E63S51,E62S52,E61S53,E60S54,E59S55,E58S54,E57S55,E56S56,E55S55,E54S54,E53S53,E52S52,E51S51,E50S50,E58S37,E59S38,E60S39,E61S40,E56S37,E55S38,E54S39,E53S40,E62S41,E63S42,E64S43,E52S41,E51S42,E50S43,E49S44,E49S46,E65S44,E64S45,E65S46,E64S47,E63S48,E51S48,E50S49,E49S48,E64S49,E65S50,E64S51,E62S53,E61S54,E60S55,E59S56,E58S55,E57S56,E56S57,E55S56,E54S55,E53S54,E52S53,E51S52,E50S51,E49S50,E59S37,E57S37,E60S38,E61S39,E62S40,E55S37,E54S38,E53S39,E52S40,E63S41,E64S42,E65S43,E51S41,E50S42,E49S43,E49S45,E48S44,E49S47,E66S44,E65S45,E66S46,E65S47,E64S48,E51S49,E49S49,E48S48,E65S49,E63S49,E66S50,E65S51,E64S52,E63S53,E62S54,E61S55,E60S56,E59S57,E58S56,E57S57,E55S57,E54S56,E53S55,E52S54,E51S53,E50S52,E49S51,E48S50,E57S38,E60S37,E61S38,E62S39,E63S40,E54S37,E53S38,E52S39,E51S40,E64S41,E65S42,E50S41,E49S42,E48S43,E48S45,E48S47,E66S43,E67S44,E66S45,E67S46,E66S47,E65S48,E48S49,E66S49,E67S50,E66S51,E65S52,E63S52,E64S53,E63S54,E62S55,E61S56,E60S57,E58S57,E54S57,E53S56,E52S55,E51S54,E50S53,E49S52,E48S51,E47S50,E61S37,E62S38,E64S40,E53S37,E52S38,E51S39,E50S40,E65S41,E66S42,E49S41,E48S42,E48S46,E47S45,E47S47,E67S43,E67S45,E67S47,E66S48,E67S49,E67S51,E66S52,E65S53,E64S54,E63S55,E62S56,E61S57,E53S57,E52S56,E50S54,E49S53,E48S52,E47S51,E47S49,E62S37,E63S38,E64S39,E65S40,E52S37,E51S38,E50S39,E49S40,E66S41,E48S41,E47S42,E47S46,E67S48,E67S52,E66S53,E65S54,E64S55,E63S56,E62S57,E50S55,E49S54,E48S53,E47S52,E47S48,E64S38,E63S39,E65S39,E66S40,E51S37,E50S38,E49S39,E48S40,E47S41,E47S43,E67S53,E66S54,E65S55,E64S56,E51S55,E50S56,E49S55,E48S54,E47S53,E64S37,E65S38,E66S39,E67S40,E50S37,E49S38,E48S39,E47S40,E47S44,E67S54,E66S55,E65S56,E64S57,E51S56,E50S57,E49S56,E48S55,E47S54,E65S37,E63S37,E66S38,E67S41,E49S37,E48S38,E47S39,E67S55,E66S56,E65S57,E51S57,E49S57,E48S56,E47S55,E66S37,E67S38,E67S42,E48S37,E47S38,E67S56,E66S57,E52S57,E48S57,E47S56,E67S37,E47S37,E67S57,E47S57
global.testSet = function(start, range=OBSERVER_RANGE) {
	// Mostly works. 4-12 cpu, doesn't find _all_ the rooms. 437, 439 in practice.
	var set = new Set([start]);	
	set.forEach(function(roomName) {
		var exits = _.values(Game.map.describeExits(roomName));
		var rooms = _.filter(exits, r => Game.map.getRoomLinearDistance(start, r) <= range);
		_.each(rooms, r => set.add(r));
	});
	return set;
	// range 2
	// E58S41,E58S40,E58S42,E58S39,E59S40
	// E57S40,E59S42,E58S43,E59S39,E57S39,
	// E60S40,E59S41,E57S41,E56S40,E60S42,
	// E59S43,E57S43,E56S39,E60S39,E60S41,E57S42,E56S41,E60S43,E56S42,E56S43
	/* var t;
	for(var x=0; x<50; x++)
	for(var y=0; y<50; y++)
		t = Game.map.getTerrainAt(x,y,roomName) === 'wall'; */
}

/* global.ZN = class extends Number
{
	constructor(n) {
		super(Number.parseInt(n,36));
	}
	
	toString(base=36) {
		return super.toString(base)
	}
	
	toJSON() {
		return this.toString();
	}
} */

Object.defineProperty(global, 'CPU_LIMITER', {
    get: function () {
		// @todo: adjust limit based on remaining bucket, and log function
		return Game.cpu.getUsed() > Game.cpu.limit - 1;
		// return Game.cpu.getUsed() > 9;
	},
	configurable: true
});
// global.CPU_LIMITER = false;

// Log a notification when entering or exiting night mode.
// Probably better to just use 

/* Object.defineProperty(global, 'NIGHT_MODE', {
    get: function () {
		// @todo: This math is wrong.
		// return Math.floor(Game.time / 10000) %  2;
		return _.inRange(new Date().getHours(),6,14);
	}
}); */

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
    [STRUCTURE_TOWER]: 2000,	// These _must_ die.
	[STRUCTURE_SPAWN]: 1000,
    [STRUCTURE_STORAGE]: 500,	// May be adjusted for contents
	[STRUCTURE_TERMINAL]: 500,
    [STRUCTURE_EXTENSION]: 250,
	[STRUCTURE_OBSERVER]: 400,
	[STRUCTURE_LINK]: 5,	
	[STRUCTURE_EXTRACTOR]: 3,
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
	[STRUCTURE_SPAWN]		: 1.00,
    [STRUCTURE_TOWER]		: 0.75,
    [STRUCTURE_EXTENSION]	: 0.75,
	[STRUCTURE_STORAGE]		: 0.5,
	[STRUCTURE_OBSERVER]	: 0.5,    
	[STRUCTURE_LINK]		: 0.5,
	[STRUCTURE_TERMINAL]	: 0.5,
	[STRUCTURE_EXTRACTOR]	: 0.5,
	[STRUCTURE_CONTAINER]	: 0.35,
	[STRUCTURE_WALL]		: 0.25,
	[STRUCTURE_RAMPART]		: 0.25,
	[STRUCTURE_ROAD]		: 0.25
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
]

/**
 * Directional lookup table
 * @example: let [dx,dy] = DIR_TABLE[dir];
 */
global.DIR_TABLE = {
	[TOP]			: [0, -1],
	[TOP_RIGHT]		: [1, -1],
	[RIGHT]			: [1, 0],
	[BOTTOM_RIGHT]	: [1, 1],
	[BOTTOM]		: [0, 1],
	[BOTTOM_LEFT]	: [-1, 1],
	[LEFT]			: [-1, 0],
	[TOP_LEFT]		: [-1, -1]
};

// Unicode options
// https://en.wikipedia.org/wiki/List_of_Unicode_characters
global.UNICODE_ARROWS = {
	[TOP]			: "\u2191",
	[TOP_RIGHT]		: "\u2197",
	[RIGHT]			: "\u2192",
	[BOTTOM_RIGHT]	: "\u2198",
	[BOTTOM]		: "\u2193",
	[BOTTOM_LEFT]	: "\u2199",	
	[LEFT]			: "\u2190",	
	[TOP_LEFT]		: "\u2196",
	"ARROW_BARS"	: "\u21B9",
	"THREE_RIGHT"	: "\u21F6",	
};
global.UNICODE = {
	MU: '\u03BC', // Greek letter mu. Mathematical average.
}
global['\u216F'] = 42;
// Number forms:
// \u2160 - \u216F

global.DIAGONALS = [TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, TOP_LEFT];
global.HORIZONTALS = [TOP,BOTTOM,LEFT,RIGHT];

global.REVERSE_DIR = {
	[TOP]			: BOTTOM,
	[TOP_RIGHT]		: BOTTOM_LEFT,
	[RIGHT]			: LEFT,
	[BOTTOM_RIGHT]	: TOP_LEFT,
	[BOTTOM]		: TOP,
	[BOTTOM_LEFT]	: TOP_RIGHT,
	[LEFT]			: RIGHT,
	[TOP_LEFT]		: BOTTOM_RIGHT
}

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
}


/**
 * Global functions
 */
global.defineCachedGetter = function (proto, propertyName, fn, enumerable=false) {
	Object.defineProperty(proto, propertyName, {
		get: function() { 
			if(this === proto || this == undefined)
				return;
			let result = fn.call(this,this);
			Object.defineProperty(this, propertyName, {
				value: result,
				configurable: true,
				enumerable: false
			});
			return result;
		},
		configurable: true,
		enumerable: false
	});
} 

global.defineGetter = function (proto, propertyName, fn, enumerable=false) {
	Object.defineProperty(proto, propertyName, {
		get: function() {
			return fn.call(this,this);
		},
		configurable: true,
		enumerable: enumerable
	});
}

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

global.affixProperties = function(entity) {
	// enumerate properties, set.
}

global.cloneToThing = function(proto, obj) {
	// create property defs?
	return Object.create(proto, obj);
}
 
/** command */
global.GC = function() {
	// if(Game.time % 10000 === 0) {
	if((Game.time & 16383) === 0) {
		GCStructureMemory();
	}	
	if((Game.time & 15))
		return;
	
	var groups = {};
	
	for(var name in Memory.creeps) {
		if(Memory.creeps[name].gid)
			groups[Memory.creeps[name].gid] = 1;
		if (!Game.creeps[name]) {
			const age = Game.time - Memory.creeps[name].born;
			const maxAge = _.get(Memory, 'stats.maxAge', 0);				
			if(age > 1500)
				Log.debug("Garbage collecting " + name + ' (age: ' + age + ')', 'GC');
			if(age > maxAge)
				Log.info('New max age! ' + name + ' with ' + age + ' ticks!');
			_.set(Memory, 'stats.maxAge', Math.max(maxAge, age));
			delete Memory.creeps[name];
		}
	}
	
	for(var name in Memory.flags ) {
		if(Memory.flags[name].gid)
			groups[Memory.flags[name].gid] = 1;
		if (!Game.flags[name] || _.isEmpty(Memory.flags[name])) {
			delete Memory.flags[name];				
		}
	}
		
	for(var name in Memory.spawns) {
		if(Memory.spawns[name].gid)
			groups[Memory.spawns[name].gid] = 1;
		if (!Game.spawns[name]) {			
			delete Memory.spawns[name];
		} 
	}

	for (var id in Memory.structures ) {
		if(Memory.structures[id].gid)
			groups[Memory.structures[id].gid] = 1;
	}
	
	// console.log("Group ids still around: " + ex(groups));
	Memory.groups = _.omit(Memory.groups, (v,k) => !groups[k]);
	/* for(var name in Memory.rooms)
		if(Game.time - (Memory.rooms[name]['tick'] || 0) > 10000) {
			Log.notify('Garbage collecting old room ' + name);
			delete Memory.rooms[name];
		} */
}

global.GCStructureMemory = function() {
	for (var id in Memory.structures )
		if(!Game.structures[id]) { // || _.isEmpty(Memory.structures[id])) {
			Log.notify("Garbage collecting structure " + id + ', ' + JSON.stringify(Memory.structures[id]));
			delete Memory.structures[id];
		}
}

global.profile = function(ticks=30, filter=null) {
	Game.profiler.profile(ticks, filter);
}

global.progress = function() {
	let ticksTilGCL = (Game.gcl.progressTotal - Game.gcl.progress) / Memory.gclAverageTick;
	console.log("Time till GCL " + (Game.gcl.level+1) + ": " + Time.estimate(ticksTilGCL) + ' ' + Log.progress(Game.gcl.progress, Game.gcl.progressTotal));
	_(Game.rooms)
		.map('controller')
		.filter('my')
		.filter(c => c.level < 8)
		// .each(c => console.log("Room: " + c.room.name + ", RCL: " + (c.level+1) + ", " + c.estimate()))
		.each(c => console.log("Room: " + c.room.name + ", RCL: " + (c.level+1) + ", " + c.estimate() + ' ' + Log.progress(c.room.controller.progress, c.room.controller.progressTotal)))
		.commit();		
}

global.stats = function() {	
	console.log('Bucket: ' + Game.cpu.bucket);
	console.log('Rooms: ' + _.size(Game.rooms));
	console.log('Creeps: ' + _.size(Game.creeps));	
	console.log('Structures: ' + _.size(Game.structures));
	console.log('Flags: ' + _.size(Game.flags));
	console.log('Construction sites: ' + _.size(Game.constructionSites));
	if(Memory.profiler)
		console.log('Profiler: ' + (Memory.profiler.disableTick - Game.time));
	console.log(ex(_.countBy(Game.creeps, 'memory.role')));
}

// ncshupheo's wall score
global.wcmc = (hits) => Math.floor(254*Math.sqrt(Math.sqrt(hits/WALL_HITS_MAX)) + 1);

global.goid = (x) => Game.getObjectById(x);				// get object by id
global.ex = (x) => JSON.stringify(x, null, 2);	// explain
global.exg = (x) => ex(goid(x));
global.hl = (x,radius=5) => x.room.visual.circle(x.pos, {fill:'red',radius,lineStyle:'dashed'});

global.wroom = function(roomName, fn) {			// with room
	let ob = _.find(Game.structures, (s) => s.structureType === STRUCTURE_OBSERVER && Game.map.getRoomLinearDistance(s.pos.roomName, roomName) <= OBSERVER_RANGE);
	if(ob)
		ob.exec(roomName, fn);
	else
		return "No observer in range";
}

global.terminals = function() {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	let rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my',false) && r.terminal != undefined) );
	let terminals = _.map(rooms, 'terminal');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	let headers = ['res'].concat(_.map(rooms, 'name'));	
	let rows = _.map(RESOURCES_ALL, function(res) {
		let stored = _.map(terminals, t => _.get(t, 'store.' + res, 0));
		return [res].concat(stored);
	});
	let totals = _.map(terminals, 'total');
	rows.unshift(['total'].concat(totals));
	output += '</table>';
	console.log(Log.table(headers, rows));
}

global.storage = function() {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	let rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my',false) && r.storage != undefined) );
	let sts = _.map(rooms, 'storage');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	let headers = ['res'].concat(_.map(rooms, 'name'));	
	let rows = _.map(RESOURCES_ALL, function(res) {
		let stored = _.map(sts, t => _.get(t, 'store.' + res, 0));
		return [res].concat(stored);
	});
	let totals = _.map(sts, 'total');
	rows.unshift(['total'].concat(totals));
	output += '</table>';
	console.log(Log.table(headers, rows));
}

global.remoteMine = function(roomName) {
	if(!Game.rooms[roomName])
		return wroom(roomName, (room) => remoteMine(room.name));
	let room = Game.rooms[roomName];
	room.createFlag(room.controller.pos, FLAG_MILITARY, STRATEGY_RESERVE);
	Mining.flagSites(roomName);
}

/**
 *
 */
global.releaseRoom = function(roomName, confirm=false) {
	if(confirm !== true)
		return "Confirmation required";
	_(Game.flags).filter('pos.roomName', roomName).invoke('remove').commit();
	_(Game.structures).filter('pos.roomName', roomName).invoke('destroy').commit();
	_(Game.creeps).filter('pos.roomName', roomName).invoke('suicide').commit();
}

global.resetRoom = function(roomName) {
	var room = Game.rooms[roomName];
	room.find(FIND_FLAGS).forEach(f => f.remove());
	room.find(FIND_STRUCTURES).forEach(s => s.destroy());
	room.find(FIND_MY_CREEPS).forEach(c => c.suicide());
	delete Memory.rooms[roomName];
}

global.memLargestKey = function() {
	return _.max(Object.keys(Memory), k => JSON.stringify(Memory[k]).length);
}

global.largestKey = function(a) {
	return _.max(Object.keys(a), k => JSON.stringify(a[k]).length);
}

global.memStats = function() {
	// return ex(_.transform(Memory, (r,n,k) => r[k] = JSON.stringify(Memory[k]).length, {} ));
	return ex(_.mapValues(Memory, (v) => JSON.stringify(v).length));
}

global.randInt = function randInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

global.history = function(roomName, tick) {
	return "https://screeps.com/a/#!/history/" + roomName + "?t=" + tick + "|" + tick ;
}

/* global.ppc = function() {
	var ordered = _.sortBy(Memory.profiler.map, m => m.time / m.call);
	_.each(ordered, ({time,calls},m) => console.log(`${m} ${time/calls}`));
} */

global.roomLink = (room) => `<a href='https://screeps.com/a/#!/room/${room}'>${room}</a>`;