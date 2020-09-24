/**
 * ext/creep.actor.js - Creep extensions for intelligent actors
 */
'use strict';

import ROLES from '/role/index';
import * as Intel from '/Intel';
import { unauthorizedCombatHostile, canProvideEnergy } from '/lib/filter';
import { CLAMP } from '/os/core/math';
import { MM_AVG } from '/os/core/math';
import { TERMINAL_MINIMUM_ENERGY } from '/prototypes/structure/terminal';
import { LOGISTICS_MATRIX } from '/cache/costmatrix/LogisticsMatrixCache';
import { ICON_PROHIBITED } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { PLAYER_STATUS } from '/Player';
import Path from '/ds/Path';

const ON_ERROR_SLEEP_DELAY = 3;
const CREEP_AUTOFLEE_HP = 0.90;		// Run away at 90% hp

DEFINE_CACHED_GETTER(Creep.prototype, 'module', c => ROLES[c.getRole()]);

/**
 * Intents are currently 0.2 cpu. With simultaneous action pipelines,
 * a creep can do multiple things in a tick, driving up intent costs.
 * A busy creep might enact anywhere from .2 to .6 cpu per tick regardless
 * of logic and decision making.
 *
 * A creep's cpu cost might be seen as average cpu per tick, or
 * total cpu used for lifetime.
 *
 * A creep's energy cost might be seen as a one time up front payment,
 * or as energy per tick (cost / age). If accounting for age and renewels,
 * cost should be raised when renewed.
 *
 */
Creep.prototype.run = function run() {
	if (this.spawning)
		return;

	// Off because SK miners
	// this.updateHits();
	const { memory } = this;
	if (this.isDeferred()) {
		this.say(memory.defer - Game.time);
		return;
	}

	try {
		if (this.invokeState() === false) {
			// if (this.hitPct < CREEP_AUTOFLEE_HP)
			if (Math.random() > this.hitPct) {
				this.pushState('HealSelf');
				return;
			}
			// Replaced with stack state.
			if (memory.home !== undefined && (this.pos.roomName !== memory.home || this.pos.isOnRoomBorder()))
				this.pushState("MoveToRoom", { room: memory.home, enter: true });
			else
				this.runRole();
		}
		this.updateStuck();
	} catch (e) {
		Log.error(`Exception on creep ${this.name} at ${this.pos}: ${e}`, "Creep");
		Log.error(e.stack, "Creep");
		this.say("HELP");
		this.defer(ON_ERROR_SLEEP_DELAY);
		// this.memory.error = { msg: e.toString(), tick: Game.time, stack: e.stack };
	}
};

/**
 * @param {string} message - String to log out
 * @param {Number} level - Log level
 */
Creep.prototype.log = function (message, level = LOG_LEVEL.WARN) {
	const { x, y, roomName } = this.pos;
	Log.log(level, `${this.name}/[${roomName}-${x}-${y}]: ${message}`, 'Creep');
};

/**
 * Check if a creep is asleep.
 */
Creep.prototype.isDeferred = function () {
	var memory = Memory.creeps[this.name];
	if (memory !== undefined && memory.defer !== undefined && Game.time < memory.defer)
		return true;
	else if (memory !== undefined && memory.defer)
		Memory.creeps[this.name].defer = undefined;
	return false;
};

/**
 * Can we renew this creep?
 * @todo (Optional) (Cpu) Remove body part check and just mark roles with claim parts.
 */
var unRenewableRoles = ['recycle', 'filler', 'pilot', 'defender', 'upgrader'];
Creep.prototype.canRenew = function () {
	if (!this.my)
		return false;
	const { eca, home } = this.memory;
	if (eca && home && Game.rooms[home].energyCapacityAvailable > eca)
		return false;
	return this.spawning === false
		&& this.ticksToLive < CREEP_LIFE_TIME - Math.floor(600 / this.body.length)			// Don't waste our time
		&& this.ticksToLive > UNIT_BUILD_TIME(this.body) + (DEFAULT_SPAWN_JOB_EXPIRE - 1)	// Prevent issues with pre-spawning
		&& !unRenewableRoles.includes(this.getRole())				// More time wasting
		&& !this.isBoosted()										// Don't break our boosts
		&& !this.hasBodypart(CLAIM)									// Can't renew claimers
		;
};

Creep.prototype.transferOrMove = function (target, res, amt) {
	// const status = this.transfer.apply(this, arguments);
	const status = this.transfer(target, res, amt);
	if (status === ERR_NOT_IN_RANGE)
		this.moveTo(target, {
			range: (target instanceof StructureController) ? CREEP_UPGRADE_RANGE : 1
		});
	return status;
};

global.ROLES = ROLES;
Creep.prototype.runRole = function () {
	const start = Game.cpu.getUsed();
	var roleName = this.getRole();
	if (!roleName)
		return;
	const role = ROLES[roleName];
	if (!role)
		return Log.error(`No role found for ${roleName}`, 'Creep');
	role.run.call(this);
	const used = Game.cpu.getUsed() - start;
	this.memory.cpu = MM_AVG(used, this.memory.cpu, 100);
	// console.log(this.name + ' used ' + used + ' cpu');
};

/**
 * @return string
 */
Creep.prototype.getRole = function () {
	// Role in memory is now considered an override. In case of memory problems, role is inherited by name.	
	if (Memory.creeps[this.name] && Memory.creeps[this.name].role)
		return Memory.creeps[this.name].role;
	Log.notify(`Creep ${this.name}/${this.pos} missing role. recycling.`);
	return this.setRole('recycle');
};

/**
 * @param {string}
 */
Creep.prototype.setRole = function (role) {
	if (typeof role !== 'string')
		throw new Error('setRole expects string');
	this.say(`${role}!`);
	return (this.memory.role = role);
};

Creep.prototype.getRepairTarget = function () {
	return this.getTarget(
		({ room }) => room.find(FIND_STRUCTURES),
		(structure) => structure.hits < structure.hitsMax,
		(candidates) => _.min(candidates, "hits")
	);
};

Creep.prototype.take = function (target, resource = RESOURCE_ENERGY) {
	var creep = this;
	var result;
	if (target instanceof Structure || target instanceof Tombstone || target instanceof Ruin) {
		result = creep.withdraw(target, resource);
	} else if (target instanceof Creep) {
		result = target.transfer(creep, resource);
	} else if (target instanceof Resource) {
		result = creep.pickup(target);
	} else if (target instanceof Source) {
		result = creep.harvest(target);
	}
	if (result === ERR_INVALID_TARGET) {
		Log.warn(`${creep.name} take failed. Target: ${target.id} Resource: ${resource}`, 'Creep');
	}
	return result;
};

const { withdraw } = Creep.prototype;
Creep.prototype.withdraw = function (target, resource, amount) {
	if (resource === RESOURCE_ENERGY && target instanceof StructureTerminal && target.my) {
		if (target.store[RESOURCE_ENERGY] <= TERMINAL_MINIMUM_ENERGY)
			return ERR_NOT_ENOUGH_RESOURCES;
	}
	var status = withdraw.apply(this, arguments);
	return status;
};

Creep.prototype.withdrawAny = function (target, limit) {
	if (target.store) {
		const resource = _.findKey(target.store);
		return this.withdraw(target, resource, Math.min(target.store[resource], limit));
	} else if (target.energy != null) {
		return this.withdraw(target, RESOURCE_ENERGY, Math.min(target.energy, limit));
	} else
		throw new Error(`${this.name} unable to withdrawAny from ${target}`);
};

Creep.prototype.dropAny = function () {
	var res = _.findKey(this.carry);
	if (res)
		this.drop(res);
	return ERR_NOT_ENOUGH_RESOURCES;
};

/**
 * Traveller
 */
Creep.prototype.isAvoidingRoom = function (roomName) {
	return false;
};

Creep.prototype.prefersRoom = function (roomName) {
	return false;
};

Creep.prototype.routeCallback = function (roomName, fromRoomName) {
	return 1.0;
};

// @return PathFinder.CostMatrix|false
Creep.prototype.getCostMatrix = function (roomName) {
	Log.warn("Requesting cost matrix for " + roomName);
	return false;
};

/**
 * 2016-12-11: Only flee from creeps that are actually a threat to us.
 * 2016-11-02: Reintroduced the arena matrix in a way that makes sense. 
 */
const DEFAULT_FLEE_PLAN_AHEAD = 5;
const DEFAULT_FLEE_OPTS = { maxRooms: 3, maxOps: 2500, flee: true, fleeRoom: true, planAhead: DEFAULT_FLEE_PLAN_AHEAD, heuristicWeight: 0.8 };
Creep.prototype.flee = function (min = MINIMUM_SAFE_FLEE_DISTANCE, all = false, opts = {}) {
	if (!min || typeof min !== "number" || min <= 1)
		throw new TypeError(`Unacceptable minimum distance: ${min}, must be postive integer greater than 1`);
	if (this.fatigue)
		return ERR_TIRED;
	var hostiles;
	if (all)
		hostiles = this.pos.findInRange(FIND_CREEPS, min - 1, { filter: c => c.id !== this.id });
	else
		hostiles = this.pos.findInRange(this.room.hostiles, min - 1, { filter: unauthorizedCombatHostile });

	if (hostiles == null || hostiles.length <= 0)
		return ERR_NOT_FOUND;

	_.defaults(opts, DEFAULT_FLEE_OPTS);
	const goals = _.map(hostiles, c => ({ pos: c.pos, range: min + opts.planAhead }));
	if (opts.fleeRoom) // Harder to chase us across room bounderies
		goals.unshift({ pos: new RoomPosition(25, 25, this.pos.roomName), range: 25 });
	// Smarter flee via cost fixing.
	// If we can move equally across both, prefer swamps
	if (opts.swampCost == null || opts.plainCost == null) {
		const swampCost = this.swampSpeed;
		const plainCost = (swampCost <= 1) ? swampCost + 5 : this.plainSpeed;  // Too many edge cases if we have non-zero swamp fatigue, so only for the fastest right now
		opts.plainCost = plainCost;
		opts.swampCost = swampCost;
	}
	if (opts.roomCallback == null)
		opts.roomCallback = (r) => {
			if (Intel.hasOwner(r) && Intel.getRoomStatus(r) <= PLAYER_STATUS.NEUTRAL)
				return false;
			return LOGISTICS_MATRIX.get(r);
			// return Game.rooms[r] ? Game.rooms[r].FLEE_MATRIX : ARENA_MATRIX;
		};
	const { path, ops, cost, incomplete } = Path.search(this.pos, goals, opts);
	if (!path || path.length <= 0) {
		this.log(`Unable to flee`, LOG_LEVEL.ERROR);
		this.say("EEK!");
		return ERR_NO_PATH;
	}
	// this.log(`flee: incomplete ${incomplete}, ops ${ops}, cost ${cost}`, LOG_LEVEL.INFO);
	this.room.visual.poly(path);
	if (this.carry[RESOURCE_ENERGY])
		this.drop(RESOURCE_ENERGY);
	return this.move(this.pos.getDirectionTo(path[0]));
};

/**
 * Used for fleeing and for intercepting.
 */
Creep.prototype.getFleePosition = function (targets, range = CREEP_RANGED_ATTACK_RANGE) {
	if (_.isEmpty(targets))
		return ERR_NO_PATH;
	const goals = _.map(targets, c => ({ pos: c.pos, range: range }));
	const { path } = Path.search(this.pos, goals, {
		flee: true,
		maxOps: 500,
		maxRooms: 1
	});
	return (path !== undefined && path.length > 0) ? path[0] : ERR_NO_PATH;
};

/**
 * Predictive intercept 
 */
Creep.prototype.intercept = function (target, range = CREEP_RANGED_ATTACK_RANGE) {
	// Log.warn('Intercept in action at ' + this.pos);
	const goals = target.pos.findInRange(FIND_CREEPS, range, { filter: c => c.owner.username !== target.owner.username });
	const pos = target.getFleePosition(goals, range);
	if (pos === ERR_NO_PATH)
		return this.moveTo(target);
	else
		return this.moveTo(pos, { reusePath: 0 });
};

/**
 * Monkey patch dismantle to limit risks
 */
const { dismantle } = Creep.prototype;
Creep.prototype.dismantle = function (target) {
	// Friendly structures don't get attacked.
	if (target instanceof OwnedStructure
		&& !target.my
		&& Player.status(target.owner.username) >= PLAYER_STATUS.TRUSTED) {
		Log.warn("[WARNING] Won't dismantle friendly structure!", "Creep");
		this.say(ICON_PROHIBITED);
		return ERR_INVALID_TARGET;
	}

	if (target.structureType === STRUCTURE_SPAWN && target.my && target.room.my) {
		Log.notify("Money patch prevent spawn disamantle");
		this.say(ICON_PROHIBITED);
		throw new Error("Attempted to dismantle our spawn");
	}

	return dismantle.call(this, target);
};

/**
 * Attack restrictions
 */
const { attack } = Creep.prototype;
Creep.prototype.attack = function (target) {
	// Friendlies are safe.			
	if (target == null || target.my || (target.owner && Player.status(target.owner.username) >= PLAYER_STATUS.TRUSTED)) {
		return ERR_INVALID_TARGET;
	}
	return attack.call(this, target);
};

const { rangedAttack } = Creep.prototype;
Creep.prototype.rangedAttack = function (target) {
	if (target.my || (target.owner && Player.status(target.owner.username) >= PLAYER_STATUS.TRUSTED)) {
		return ERR_INVALID_TARGET;
	}
	return rangedAttack.call(this, target);
};

/**
 * Build restrictions
 *
 * Uses 5 energy per work per tick (5 pe/t)
 */
const { build } = Creep.prototype;
Creep.prototype.build = function (target) {
	if (!target || !(target instanceof ConstructionSite))
		return ERR_INVALID_TARGET;
	if (!target.my && Player.status(target.owner.username) !== PLAYER_STATUS.ALLY && target.structureType !== STRUCTURE_CONTAINER)
		return ERR_INVALID_TARGET;
	const status = build.call(this, target);
	if (status === ERR_INVALID_TARGET && OBSTACLE_OBJECT_TYPES.includes(target.structureType)) {
		const obstruction = target.pos.getCreep();
		if (obstruction)
			return obstruction.scatter();
	}
	return status;
};

/**
 * Heal restrictions
 */
const { heal } = Creep.prototype;
Creep.prototype.heal = function (target, force = true) {
	if (target.hits >= target.hitsMax && !force)
		return ERR_FULL;
	if (!target.my && Player.status(target.owner.username) !== PLAYER_STATUS.ALLY)
		return ERR_INVALID_TARGET;
	const status = heal.call(this, target);
	if (status === OK)
		Object.defineProperty(target, "hits", {
			value: target.hits + (HEAL_POWER * this.getActiveBodyparts(HEAL)),
			configurable: true
		});
	return status;
};

const { rangedHeal } = Creep.prototype;
Creep.prototype.rangedHeal = function (target) {
	if (!target.my && Player.status(target.owner.username) !== PLAYER_STATUS.ALLY)
		return ERR_INVALID_TARGET;
	return rangedHeal.call(this, target);
};

/**
 * Repair restrictions
 */
const { repair } = Creep.prototype;
Creep.prototype.repair = function (target) {
	if (target.hits >= target.hitsMax)
		return ERR_FULL;
	if (!CONSTRUCTION_COST[target.structureType]) {
		Log.error(`Target ${target} at ${target.pos} can not be repaired, has no construction cost`, "Creep");
		return ERR_INVALID_TARGET;
	}
	if (!target || target.owner && !target.my && Player.status(target.owner.username) !== PLAYER_STATUS.ALLY) {
		Log.warn(`Target ${target} at ${((!target) ? 'null' : target.pos)} invalid ownership, unable to repair`, "Creep");
		return ERR_INVALID_TARGET;
	}
	return repair.call(this, target);
};

const { upgradeController } = Creep.prototype;
Creep.prototype.upgradeController = function (controller) {
	const status = upgradeController.apply(this, arguments);
	if (status === OK) {
		controller.assisted = this.id;
	}
	return status;
};

const { harvest } = Creep.prototype;
Creep.prototype.harvest = function (target) {
	const status = harvest.call(this, target);
	if (status === ERR_INVALID_TARGET) {
		Log.error(`${this.name}/${this.pos} harvest failed with ERR_INVALID_TARGET`, "Creep");
		this.defer(5);
	}
	return status;
};

/**
 * Globally patch creep actions to log error codes.
 */
/* ['attack','attackController','build','claimController','dismantle','drop',
 'generateSafeMode','harvest','heal','move','moveByPath','moveTo','pickup',
 'rangedAttack','rangedHeal','rangedMassAttack','repair','reserveController',
 'signController','suicide','transfer','upgradeController','withdraw'].forEach(function(method) {
	 let original = Creep.prototype[method];
	 // Magic
	 Creep.prototype[method] = function() {
		 let status = original.apply(this, arguments);
		 if(typeof status === 'number' && status < 0 && status !== ERR_NOT_IN_RANGE) {
			 console.log(`Creep ${this.name} action ${method} failed with status ${status} at ${this.pos}`);
		 }
		 return status;
	 }
 }); */


/**
 * Stack machine actions
 */
/* eslint-disable consistent-return */
Creep.prototype.pushState = function (state, opts = {}, runNext = true) {
	return RoomObject.prototype.pushState.call(this, state, opts, ((this.spawning) ? false : runNext));
};

Creep.prototype.runWait = function (opts) {
	RoomObject.prototype.runWait.call(this, opts);
	if (this.hits < this.hitsMax && this.hasActiveBodypart(HEAL))
		this.heal(this);
	this.flee(MINIMUM_SAFE_FLEE_DISTANCE);
};

/** ex: goto, claim, recycle */
Creep.prototype.runSetRole = function (opts) {
	this.setRole(opts);
	this.popState();
};

/**
 * Harvest energy to fill ourself up
 */
Creep.prototype.runHarvestEnergy = function ({ allowMove = true }) {
	if (this.carryCapacityAvailable <= 0 || !this.hasBodypart(WORK))
		return this.popState();
	if (this.hits < this.hitsMax)
		this.pushState('HealSelf');	// We can let it continue this tick.
	let source;
	if (allowMove)
		source = this.getTarget(({ room }) => room.find(FIND_SOURCES), s => s.energy > 0, c => this.pos.findClosestByPath(c));
	else
		source = this.getTarget(({ room }) => room.find(FIND_SOURCES), s => s.pos.isNearTo(this));
	if (!source)
		return this.popState();
	const status = this.harvest(source);
	if (status === ERR_NOT_IN_RANGE && allowMove)
		this.moveTo(source, { range: CREEP_HARVEST_RANGE, maxRooms: 1 });
};

/**
 * Hunts down a lab with boosts.
 * Can limit amount
 * One boost per state
 * Game.creeps['scav676'].pushState('BoostSelf', {boost:'KO',parts:5})
 * Game.creeps['builder641'].pushState('BoostSelf', {boost:'XLH2O'})
 */
Creep.prototype.runBoostSelf = function ({ boost, parts }) {
	const target = this.getTarget(
		({ room }) => room.structuresByType[STRUCTURE_LAB] || [],
		(lab) => lab.mineralType === boost && lab.mineralAmount >= LAB_BOOST_MINERAL,
		(candidates) => _.min(candidates, c => c.pos.getRangeTo(this)));
	if (!target) {
		this.say("No lab");
		// May acquire resource if has carry part
		// If we have an idle lab, carry, and terminal, go ahead and load it up ourselves
		return this.popState();
	} else if (!this.pos.isNearTo(target))
		return this.moveTo(target, { range: 1 });
	else {
		const sum = _.sum(this.body, p => p.boost === boost);
		const non = _.sum(this.body, p => !p.boost && BOOSTS[p.type] != null && BOOSTS[p.type]['XLH2O'] != null);
		const total = parts ? parts - sum : undefined;
		const cost = non * LAB_BOOST_ENERGY;
		const cpt = cost / CREEP_LIFE_TIME;
		Log.debug(`Boost cost: ${non}/${sum} ${cost} or ${cpt}/t`, 'Creep');
		const status = target.boostCreep(this, total);
		Log.debug(`${this.pos.roomName}/${this.name} boosting result: ${status}`, 'Creep');
		if (sum <= 0 || status !== OK)
			this.popState();
	}
};

/**
 * Locate a lab and unboost ourselves
 */
Creep.prototype.runUnboostSelf = function () {
	if (!this.isBoosted())
		return this.popState();
	else if (this.ticksToLive <= 1)
		Log.notify(`Failed to unboost ${this} at ${this.pos} in time!`);

	const target = this.getTarget(
		() => Game.structures,
		(s) => s.structureType === STRUCTURE_LAB && !s.cooldown && s.isActive(),
		(candidates) => {
			const { goal, cost } = this.pos.findClosestByPathFinder(candidates, (x) => ({ pos: x.pos, range: 1 }), { maxCost: this.ticksToLive - 1 });
			this.memory.eta = Game.time + cost;
			return goal;
		}
	);

	if (!target)
		return this.popState();
	const status = target.unboostCreep(this);
	if (status === OK)
		return;
	if (status === ERR_NOT_IN_RANGE)
		this.moveTo(target, { range: 1 });
	else
		Log.warn(`Unable to unboost creep ${this} with ${target}, status ${status}`, 'Creep');
};

/**
 * Build a site at a a position
 */
Creep.prototype.runBuild = function (opts = {}) {
	const { pos } = opts;
	const roomPos = new RoomPosition(pos.x, pos.y, pos.roomName);
	const { allowHarvest = false, allowMove = true } = opts;
	const site = roomPos.getConstructionSite();
	if (!site)
		return this.popState();
	if (this.carry[RESOURCE_ENERGY] <= 0 && this.hasActiveBodypart(CARRY))
		return this.pushState('AcquireEnergy', { allowMove, allowHarvest }, false);
	const status = this.build(site);
	if (status === ERR_NOT_IN_RANGE)
		this.pushState("EvadeMove", { pos: roomPos, range: CREEP_BUILD_RANGE });
	else if (status !== OK)
		Log.warn(`build status: ${status} for ${this.name} at ${this.pos} target ${site}`);
};

/**
 * Check for a structure or site and attempt to build it.
 * @todo check for construction sites
 * @todo add build state
 */
Creep.prototype.runEnsureStructure = function (opts = {}) {
	const { pos, structureType, range = 0, minLevel = 0 } = opts;
	const { allowBuild = true, allowHarvest = true, allowMove = true } = opts;
	const roomPos = new RoomPosition(pos.x, pos.y, pos.roomName);
	this.popState(false); // Check only needs to happen once.

	if (minLevel > 0) {
		const { controller } = this.room;
		if (controller && controller.owner && controller.level < minLevel)
			return this.popState();
	}

	if (roomPos.hasStructure(structureType, range)) {
		Log.info(`Creep ${this.name} found ${structureType} at ${roomPos} range ${range}`, 'Creep');
		return;
	} else {
		const site = roomPos.getConstructionSite(structureType, range);
		if (site) {
			Log.info(`Creep ${this.name} found construction site for ${structureType} at ${site.pos}`, 'Creep');
			if (allowBuild && this.hasActiveBodypart(WORK) && this.hasActiveBodypart(CARRY))
				this.pushState('Build', { pos: site.pos, allowHarvest, allowMove }, true);
			return;
		}
	}
	Log.warn(`Creep ${this.name} missed ${structureType} at ${roomPos}`, 'Creep');
	var nPos;
	if (!roomPos.hasObstacle()) {
		nPos = roomPos;
	} else if (this.pos.inRangeTo(roomPos, range)) {
		// @todo check if obstacle or whether one can be placed at our feet.
		nPos = this.pos;
	} else {
		const adjust = OBSTACLE_OBJECT_TYPES.includes(structureType) ? 1 : 0;
		nPos = this.pos.findPositionNear(roomPos, range, {}, adjust);
		Log.info(`Creep ${this.name} requesting nearby position ${roomPos} range ${range}, newPos: ${nPos}`, 'Creep');
	}
	Log.info(`Creep ${this.name} wants to place ${structureType} at ${nPos}`, 'Creep');
	const status = nPos.createConstructionSite(structureType);
	if (status === OK && allowBuild && this.hasActiveBodypart(WORK) && this.hasActiveBodypart(CARRY))
		this.pushState('Build', { pos: nPos, allowHarvest, allowMove }, false);
};

/**
 * 
 */
Creep.prototype.runTransfer = function (opts) {
	const { src, dst = opts.dest, res = RESOURCE_ENERGY, amt = Infinity, srcpos, dstpos } = opts;

	if (amt <= 0)
		this.popState();

	if (this.carryTotal === 0) {
		// Pickup
		const source = Game.getObjectById(src);
		if (source == null)
			return this.popState();
		const wamt = (amt !== Infinity) ? Math.min(amt, this.carryCapacity) : undefined;
		const status = (source instanceof Resource) ? this.pickup(source) : this.withdraw(source, res, wamt);
		if (status === ERR_NOT_IN_RANGE)
			return this.pushState("EvadeMove", { pos: source.pos, range: 1 });
		else if (status === ERR_NOT_ENOUGH_RESOURCES)
			return this.popState();
		else if (status !== OK) {
			Log.warn(`${this.name}/${this.pos}: Failure to withdraw on ${source} status ${status}`, 'Creep');
			this.popState();
		}
	} else {
		const dest = Game.getObjectById(dst);
		const status = this.transfer(dest, res, this.carry[res]);
		if (status === ERR_NOT_IN_RANGE)
			return this.pushState("EvadeMove", { pos: dest.pos, range: 1 });
		else if (status !== OK) {
			Log.warn(`${this.name}/${this.pos}: Failure to transfer ${res} to ${dest} status ${status}`, 'Creep');
			this.popState();
		} else
			opts.amt -= this.carry[res];
	}
};

/**
 * Seek out a spawn and renew ourselves.
 */
const MAX_RENEW_WAIT = 25;
Creep.prototype.runRenewSelf = function (opts) {
	if (this.ttlPct > 0.90 || !this.canRenew())
		return this.popState(true);
	// If we're in a room with spawns, hug one
	const spawn = this.pos.findClosestByRange(FIND_MY_SPAWNS, { filter: s => !s.spawning || s.spawning.remainingTime < MAX_RENEW_WAIT });
	if (spawn)
		return this.moveTo(spawn.pos, { range: 1 });
	// No spawn available? Find one and move to it
	const spawns = _.filter(Game.spawns, s => !s.spawning || s.spawning.remainingTime < MAX_RENEW_WAIT);
	const closestSpawn = this.pos.findClosestByPathFinder(spawns).goal;

	// Pick one at random to distribute
	const alt = _.sample(closestSpawn.room.find(FIND_MY_SPAWNS, { flter: s => !s.spawning || s.spawning.remainingTime < MAX_RENEW_WAIT }));
	if (!alt) {
		Log.error(`${this.name}/${this.pos} Unable to find spawn for renewel`, 'Creep');
		return this.popState(false);
	}
	return this.pushState('EvadeMove', { pos: alt.pos, range: 1 });
};

Creep.prototype.runBreach = function (opts) {
	const roomName = opts.roomName || opts;
	if (this.pos.roomName !== roomName)
		return this.pushState('MoveToRoom', roomName);

};

Creep.prototype.runBreakdown = function (opts) {
	const { terminal } = this.room;
	const { res, src, sink1, sink2, times = 1 } = opts;
	const primary = Game.getObjectById(src);
	const lab1 = Game.getObjectById(sink1);
	const lab2 = Game.getObjectById(sink2);

	if (!res || !primary || !lab1 || !lab2 || !terminal)
		return this.popState();
	const carrying = _.findKey(this.store);
	if (carrying)
		return this.pushState("Transfer", { res: carrying, amt: this.store[carrying], dst: terminal.id });
	if (lab1.mineralType)
		return this.pushState("Transfer", { res: lab1.mineralType, amt: lab1.mineralAmount, src: lab1.id, dst: terminal.id }, false);
	if (lab2.mineralType)
		return this.pushState("Transfer", { res: lab2.mineralType, amt: lab2.mineralAmount, src: lab2.id, dst: terminal.id }, false);
	if (primary.cooldown > LAB_COOLDOWN) {
		return this.popState();
	} else if (primary.cooldown) {
		// We can do stuff while we wait
	} else if (primary.mineralType === res) {
		const status = primary.reverseReaction(lab1, lab2);
		if (status !== OK)
			return;
		opts.times = times - 1;
	}
	if (times <= 0) // Order is important
		return this.popState();
	const amt = CLAMP(LAB_REACTION_AMOUNT, LAB_REACTION_AMOUNT * times, LAB_MINERAL_CAPACITY);
	if (primary.mineralType && primary.mineralType !== res)
		return this.pushState("Transfer", { res: primary.mineralType, amt: primary.mineralAmount, src: primary.id, dst: terminal.id }, false);
	else if (!primary.mineralType || (primary.mineralAmount || 0) < amt)
		return this.pushState("Transfer", { res, amt: amt - primary.mineralAmount, src: terminal.id, dst: primary.id });
};

/**
 * Repair a target untill it's full or we're unable to get energy
 */
Creep.prototype.runRepair = function (opts) {
	const { target, allowMove = false, allowGather = false, allowHarvest = false } = opts;
	const object = Game.getObjectById(target);
	if (!object || object.hits >= object.hitsMax)
		return this.popState();
	if (this.pos.getRangeTo(object) > CREEP_REPAIR_RANGE && !allowMove)
		return this.popState();
	if (this.carry[RESOURCE_ENERGY] <= 0) {
		if (allowGather)
			return this.pushState('AcquireEnergy', { allowMove, allowHarvest }, true);
		else
			return this.popState();
	}
	const status = this.repair(object);
	Log.debug(`${this.name}/${this.pos} repairing ${object} status ${object}`, 'Creep');
}