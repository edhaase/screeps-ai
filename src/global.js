/**
 * global.js - Configuration Constants
 * 
 * Please refer to /lib/icons for unicode symbols
 */
'use strict';

/* eslint-disable no-magic-numbers, no-undef */

global.WHOAMI = (_.find(Game.structures) || _.find(Game.creeps)).owner.username;
global.PREVENT_UNCLAIM = ['E59S39', 'E58S41'];

global.MAX_ROOM_LEVEL = 8;							// Because this should really be a constant.
global.MAX_OWNED_ROOMS = Infinity;					// Lower this if we can't afford more.

global.CONST_COST = 0.2;
global.HARD_UNIT_CAP = Game.cpu.limit / CONST_COST;			// Anything above this value is guaranteed to eat bucket.
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
global.UNIT_MAX_TTL = (body) => body.some(p => p.type === CLAIM || p === CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
global.UNIT_COST = (body) => _.sum(body, p => BODYPART_COST[p.type || p]);
global.UNIT_COST_PER_TICK = (body) => UNIT_COST(body) / UNIT_MAX_TTL(body);
global.UNIT_BUILD_TIME = (body) => CREEP_SPAWN_TIME * body.length;
global.RENEW_COST = (body) => Math.ceil(SPAWN_RENEW_RATIO * UNIT_COST(body) / CREEP_SPAWN_TIME / body.length);
global.RENEW_TICKS = (body) => Math.floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / body.length); // Can't renew claim

global.DUAL_SOURCE_MINER_SIZE = (steps, cap = SOURCE_ENERGY_CAPACITY) => Math.ceil((cap * 2) / HARVEST_POWER / (ENERGY_REGEN_TIME - steps * 2));
global.CARRY_PARTS = (capacity, steps) => Math.ceil(capacity / ENERGY_REGEN_TIME * 2 * steps / CARRY_CAPACITY);
// Max hauler size for 1:1 move, including minimum income
global.MAX_HAULER_STEPS = (M, C = SOURCE_ENERGY_CAPACITY) => ((CREEP_LIFE_TIME * CARRY_CAPACITY) * (C - M * ENERGY_REGEN_TIME)) / (2 * (BODYPART_COST[CARRY] + BODYPART_COST[MOVE]) * C);
global.DISMANTLE_RETURN = (workParts) => DISMANTLE_COST * DISMANTLE_POWER * workParts;

global.GCL_LEVEL = (i) => ((i ** GCL_POW) - ((i - 1) ** GCL_POW)) * GCL_MULTIPLY;

global.ENERGY_CAPACITY_AT_LEVEL = (x) => (CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][x] * SPAWN_ENERGY_START) + CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][x] * EXTENSION_ENERGY_CAPACITY[x];

/*
global.CONTROLLER_DOWNGRADE_FULL = {1: CONTROLLER_DOWNGRADE[1]};
for(i=2; i<=8; i++)
	CONTROLLER_DOWNGRADE_FULL[i] = CONTROLLER_DOWNGRADE_FULL[i-1] + CONTROLLER_DOWNGRADE[i];	
*/
global.TICKS_TILL_DEAD = (level, currentTimer) => _.sum(_.slice(_.values(CONTROLLER_DOWNGRADE), 0, level - 1)) + currentTimer;

/**
 * Upkeep costs in energy/tick
 */
global.RAMPART_UPKEEP = RAMPART_DECAY_AMOUNT / REPAIR_POWER / RAMPART_DECAY_TIME;
global.ROAD_UPKEEP = ROAD_DECAY_AMOUNT / REPAIR_POWER / ROAD_DECAY_TIME;
global.ROAD_UPKEEP_SWAMP = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_SWAMP_RATIO) / REPAIR_POWER / ROAD_DECAY_TIME;
global.ROAD_UPKEEP_TUNNEL = (ROAD_DECAY_AMOUNT * CONSTRUCTION_COST_ROAD_WALL_RATIO) / REPAIR_POWER / ROAD_DECAY_TIME;
global.CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME_OWNED;
global.REMOTE_CONTAINER_UPKEEP = CONTAINER_DECAY / REPAIR_POWER / CONTAINER_DECAY_TIME;

global.DEFAULT_BUILD_JOB_EXPIRE = 12000;
global.DEFAULT_BUILD_JOB_PRIORITY = 0.5;

global.SAFE_MODE_IGNORE_TIMER = CREEP_LIFE_TIME + 500;

global.CONTROLLER_EMERGENCY_THRESHOLD = 3000;
global.MINIMUM_RESERVATION = Math.max(CREEP_LIFE_TIME + 200, Math.ceil(CONTROLLER_RESERVE_MAX / 2));

/**
 * Range constants
 */
global.CREEP_BUILD_RANGE = 3;
global.CREEP_RANGED_ATTACK_RANGE = 3;
global.CREEP_UPGRADE_RANGE = 3;
global.CREEP_REPAIR_RANGE = 3;
global.CREEP_RANGED_HEAL_RANGE = 3;
global.CREEP_HARVEST_RANGE = 1;
global.CREEP_WITHDRAW_RANGE = 1;
global.MINIMUM_SAFE_FLEE_DISTANCE = 4; // Because ranged actions as usually 3.

global.FATIGUE_ROAD = 0.5;
global.FATIGUE_BASE = 1;
global.FATIGUE_SWAMP = 5;

global.NUKE_EFFECT_RANGE = 2;

global.PATHFINDER_MAX_ROOMS = 64;

global.BUCKET_MAX = 10000;

/** Critical infrastructure is auto-ramparted periodically or on creation */
global.CRITICAL_INFRASTRUCTURE = [STRUCTURE_FACTORY, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN, STRUCTURE_LAB, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN];

/** primary flag types */
global.FLAG_MILITARY = COLOR_RED;	// Military
global.FLAG_ECONOMY = COLOR_YELLOW;	// Economy

/** military flags */
global.STRATEGY_ATTACK = COLOR_RED;
global.STRATEGY_DISMANTLE = COLOR_PURPLE;	// Similar to PLAN_DEMOLISH, but no carry. Just take shit apart.
global.STRATEGY_C = COLOR_BLUE;
global.STRATEGY_STEAL = COLOR_CYAN;	// (MOVE,CARRY) drains resources
global.STRATEGY_DEFEND = COLOR_GREEN;	// Maintain a guard post. (melee or ranged though?)
global.STRATEGY_RESPOND = COLOR_YELLOW;	// Summons specialized guards to respond to threats.
global.STRATEGY_RESERVE = COLOR_ORANGE;
global.STRATEGY_G = COLOR_BROWN;
global.STRATEGY_H = COLOR_GREY;	// put a reserver here to hold the room.
global.STRATEGY_I = COLOR_WHITE;

/** economy flags */ // SITE_SK?
global.SITE_DUAL_MINER = COLOR_RED;
global.SITE_DEPOSIT = COLOR_PURPLE;
global.SITE_SKMINE = COLOR_BLUE;				// ? requests guards?
global.SITE_PICKUP = COLOR_CYAN;				// in use, desginated pickup site for haulers
global.SITE_LOCAL = COLOR_YELLOW;
global.SITE_MINERAL = COLOR_ORANGE;				// in use, builds extractors
global.SITE_LAB = COLOR_BROWN;
global.SITE_REMOTE = COLOR_GREY;
global.SITE_IDLE = COLOR_WHITE;					// in use, idle sites are ignored

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
	[STRUCTURE_TERMINAL]: 0.5,	// Should build before extractor
	[STRUCTURE_EXTRACTOR]: 0.4,
	[STRUCTURE_CONTAINER]: 0.35,
	[STRUCTURE_WALL]: 0.25,
	[STRUCTURE_RAMPART]: 0.25,
	[STRUCTURE_ROAD]: 0.25,
	[STRUCTURE_NUKER]: 0.20,	// Not important to infrastructure
	[STRUCTURE_POWER_SPAWN]: 0.10,
	[STRUCTURE_LAB]: 0.10
};

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

// Appropriated from engineeryo
global.RES_COLORS = {
	[RESOURCE_HYDROGEN]: '#989898',
	[RESOURCE_OXYGEN]: '#989898',
	[RESOURCE_UTRIUM]: '#48C5E5',
	[RESOURCE_LEMERGIUM]: '#24D490',
	[RESOURCE_KEANIUM]: '#9269EC',
	[RESOURCE_ZYNTHIUM]: '#D9B478',
	[RESOURCE_CATALYST]: '#F26D6F',
	[RESOURCE_ENERGY]: '#FEE476',
	[RESOURCE_POWER]: '#F1243A',

	[RESOURCE_HYDROXIDE]: '#B4B4B4',
	[RESOURCE_ZYNTHIUM_KEANITE]: '#B4B4B4',
	[RESOURCE_UTRIUM_LEMERGITE]: '#B4B4B4',
	[RESOURCE_GHODIUM]: '#FFFFFF',

	UH: '#50D7F9',
	UO: '#50D7F9',
	KH: '#A071FF',
	KO: '#A071FF',
	LH: '#00F4A2',
	LO: '#00F4A2',
	ZH: '#FDD388',
	ZO: '#FDD388',
	GH: '#FFFFFF',
	GO: '#FFFFFF',

	UH2O: '#50D7F9',
	UHO2: '#50D7F9',
	KH2O: '#A071FF',
	KHO2: '#A071FF',
	LH2O: '#00F4A2',
	LHO2: '#00F4A2',
	ZH2O: '#FDD388',
	ZHO2: '#FDD388',
	GH2O: '#FFFFFF',
	GHO2: '#FFFFFF',

	XUH2O: '#50D7F9',
	XUHO2: '#50D7F9',
	XKH2O: '#A071FF',
	XKHO2: '#A071FF',
	XLH2O: '#00F4A2',
	XLHO2: '#00F4A2',
	XZH2O: '#FDD388',
	XZHO2: '#FDD388',
	XGH2O: '#FFFFFF',
	XGHO2: '#FFFFFF'
};

/**
 * Global functions
 * @todo stick in actual cache?
 */
global.DEFINE_CACHED_GETTER = function (proto, propertyName, fn, enumerable = false) {
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

global.DEFINE_GETTER = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return fn.call(this, this);
		},
		configurable: true,
		enumerable: enumerable
	});
};

global.DEFINE_BACKED_PROPERTY = function (proto, propertyName, store, opts = {}) {
	const { enumerable = false, key = propertyName } = opts;
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return this[store][key];
		},
		set: function (v) {
			return (this[store][key] = v);
		},
		configurable: true,
		enumerable: enumerable
	});
};

global.DEFINE_MEMORY_BACKED_PROPERTY = function (proto, propertyName, opts = {}) {
	DEFINE_BACKED_PROPERTY(proto, propertyName, 'memory', opts);
};

global.DEFINE_CACHE_BACKED_PROPERTY = function (proto, propertyName, opts = {}) {
	DEFINE_BACKED_PROPERTY(proto, propertyName, 'cache', opts);
};

global.STACK_TRACE = function () {
	return new Error("Stack Trace").stack;
};

global.profile = function (ticks = 30, filter = null) {
	Game.profiler.profile(ticks, filter);
};

// ncshupheo's wall score
global.wcmc = (hits) => Math.floor(254 * Math.sqrt(Math.sqrt(hits / WALL_HITS_MAX)) + 1);

global.goid = (x) => Game.getObjectById(x);				// get object by id
global.exg = (x) => ex(goid(x));
