/**
 * extension-creep-actor.js
 *
 * Creep extensions for intelligent actors (My AI, My creeps)
 */
"use strict";

global.BIT_CREEP_DISABLE_RENEW = (1 << 0);	// Don't renew this creep.
global.BIT_CREEP_IGNORE_ROAD = (1 << 1);	// Ignore roads when pathfinding.

const ON_ERROR_SLEEP_DELAY = 3;

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
// Action stack as array with destructuring:
// let [action,...args] = ;
// this[action].apply(this,args);
// 
// _.map(Game.creeps, 'memory.cpu')
// _.map(Game.creeps, c => _.round(c.memory.cpu,3))
// _.filter(Game.creeps, c => _.round(c.memory.cpu,3) > 0.8)
Creep.prototype.run = function run() {
	// if(this.spawning === true)
	if (this.spawning)
		return;

	// Off because SK miners
	// this.updateHits();
	var memory = this.memory;
	if (this.isDeferred()) {
		this.say(memory.defer - Game.time);
		return;
	}

	try {
		if (memory.home !== undefined && (this.pos.roomName !== memory.home || this.pos.isOnRoomBorder())) {
			if (this.flee(MINIMUM_SAFE_FLEE_DISTANCE))
				return;
			this.moveToRoom(memory.home);
			return;
		}

		this.runRTSactions();

		/* if(memory._move !== undefined && Game.time > memory._move.time + 100) {
			// Log.warn('[Creep] Cleaning up old moveTo data on ' + this.name);
			delete this.memory._move;
		} */

		// Single-pass extension of types
		if (memory.type) {
			Object.setPrototypeOf(this, require(`type-${memory.type}`).prototype);
			// var dt = Time.measure( () => Object.setPrototypeOf(this, require('type-' + memory.type).prototype) );
		}

		this.updateStuck();
		this.runRole();
	} catch (e) {
		// console.log('Exception on creep ' + this.name + ' at ' + this.pos);
		// console.log(e);
		Log.error(`Exception on creep ${this.name} at ${this.pos}: ${e}`, "Creep");
		Log.error(e.stack, "Creep");
		// console.log(e.stack);
		this.say("HELP");
		this.defer(ON_ERROR_SLEEP_DELAY);
		// this.memory.error = { msg: e.toString(), tick: Game.time, stack: e.stack };
	}
};

/**
 * Put a creep to sleep for a given number of ticks, shutting off their logic.
 */
Creep.prototype.defer = function (ticks) {
	if (typeof ticks !== "number")
		throw new TypeError("Creep.defer expects numbers");
	if (ticks >= Game.time)
		Log.notify(`Creep ${this.name} at ${this.pos} deferring for unusually high ticks!`, LOG_TAG_CREEP);
	this.memory.defer = Game.time + ticks;
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
 * @todo: (Optional) (Cpu) Remove body part check and just mark roles with claim parts.
 */
var unRenewableRoles = ['recycle', 'filler', 'pilot', 'defender'];
Creep.prototype.canRenew = function () {
	if (!this.my)
		return false;
	const { eca, home } = this.memory;
	if (eca && home && Game.rooms[home].energyCapacityAvailable > eca)
		return false;
	return this.spawning === false
		&& this.ticksToLive < CREEP_LIFE_TIME - Math.floor(600 / this.body.length) // Don't waste our time
		&& this.ticksToLive > this.body.length * CREEP_SPAWN_TIME	// Prevent issues with pre-spawning
		&& !unRenewableRoles.includes(this.getRole())				// More time wasting
		&& !this.checkBit(BIT_CREEP_DISABLE_RENEW)					// The mark of death
		&& !this.isBoosted()										// Don't break our boosts
		&& !this.hasBodypart(CLAIM)									// Can't renew claimers
		;
};

// Stats for checking invader attacks. 
/* const {harvest} = Creep.prototype;
Creep.prototype.harvest = function (target) {
	const result = harvest.apply(this, arguments);
	if (result === OK && target instanceof Source) {
		var { memory } = this.room;
		if (!memory.mined)
			memory.mined = 0;
		var mined = HARVEST_POWER * this.getActiveBodyparts(WORK);
		memory.mined += mined;
		memory.minedAvg = Math.cmAvg(mined, memory.minedAvg, ENERGY_REGEN_TIME);
	}
	return result;
}; */

Creep.prototype.harvestOrMove = function (target) {
	const status = this.harvest(target);
	if (status === ERR_NOT_IN_RANGE)
		this.moveTo(target, {
			maxRooms: (this.pos.roomName === target.pos.roomName) ? 1 : 16
		});
	return status;
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

/**
 *
 */
Creep.prototype.updateHits = function () {
	if (this.cache.hits) {
		if (this.hits < (this.cache.hits - RAMPART_DECAY_AMOUNT))
			this.onLostHits(this.cache.hits - this.hits);
		if (this.hits > this.cache.hits)
			this.onGainedHits(this.hits - this.cache.hits);
	}
	this.cache.hits = this.hits;
};

Creep.prototype.onGainedHits = function (diff) {
	this.say("<3");
};

Creep.prototype.onLostHits = function (diff) {
	Log.warn(`Creep taking hits at ${this.pos}! Lost ${diff}`, LOG_TAG_CREEP);
};

Creep.prototype.updateStuck = function () {
	var { x, y } = this.pos;
	var code = x | y << 6;
	var { lpos, stuck = 0 } = this.memory;
	if (lpos) {
		this.isStuck = this.memory.lpos === code;
		if (this.isStuck)
			stuck++;
		else
			stuck = 0;
	}
	this.memory.stuck = stuck;
	this.memory.lpos = code;
};

/**
 * Move creep in random direction
 * 
 * @todo Ensure random direction isn't an exit tile..
 */
Creep.prototype.wander = function () {
	return this.move(_.random(0, 8));
};

Creep.prototype.runRole = function () {
	var start = Game.cpu.getUsed();
	var roleName = this.getRole();
	if (!roleName)
		return;
	// try {
	var role = require(`role-${roleName}`);
	// var role = ROLE_MODULES[roleName] || require('role-' + roleName);
	/*  } catch(e) {
		Log.error('No such role: ' + roleName);
		Log.error(e.stack);
		return;
	} */
	// var role = require('role-' + this.memory.role);
	if (role.tick) {
		/// Time.measure( () => role.tick(this), undefined, (this.memory.role + ', ' + this.name) );
		role.tick(this);
	} else if (role.run) {
		role.run.call(this, this);
	} else {
		role.call(this, this);
		// Time.measure( () => role.call(this,this), null, (this.memory.role + ', ' + this.name) );
	}
	var used = Game.cpu.getUsed() - start;
	this.memory.cpu = Math.mmAvg(used, this.memory.cpu, 100);
	Volatile["role-" + roleName] = _.round((Volatile["role-" + roleName] || 0) + used, 3);
	// console.log(this.name + ' used ' + used + ' cpu');
};

/**
 * @return string
 */
Creep.prototype.getRole = function () {
	// Role in memory is now considered an override. In case of memory problems, role is inherited by name.
	if (Memory.creeps[this.name] && Memory.creeps[this.name].role)
		return Memory.creeps[this.name].role;
	var roleName = _.trimRight(this.name, '0123456789');
	var result = _.attempt(() => require(`role-${roleName}`));
	if (result instanceof Error) {
		Log.warn(`Rolename ${roleName} not valid for creep ${this.name} at ${this.pos}: ${result}`, 'Creep');
		return null;
	}
	Memory.creeps[this.name].role = roleName;
	return roleName;
};

/**
 * @param string
 */
Creep.prototype.setRole = function (role) {
	if (typeof role !== 'string')
		throw new Error('setRole expects string');
	this.memory.role = role;
	this.say(`${role}!`);
};

/**
 * General purpose energy gathering for all roles?
 */
Creep.prototype.gatherEnergy = function () {
	if (this.carryTotal >= this.carryCapacity)
		return ERR_FULL;
	const goal = this.getTarget(
		({ room }) => [...room.structures, ...room.resources],
		(candidate) => Filter.canProvideEnergy(candidate),
		(candidates, { pos }) => pos.findClosestByPath(candidates)
	);
	if (!goal)
		return ERR_INVALID_TARGET;
	const status = this.pull(goal, RESOURCE_ENERGY);
	if (status === ERR_NOT_IN_RANGE)
		this.moveTo(goal, { ignoreCreeps: (this.memory.stuck < 3), maxRooms: 1 });
	return status;
};

Creep.prototype.getRepairTarget = function () {
	return this.getTarget(
		({ room }) => room.find(FIND_STRUCTURES),
		(structure) => structure.hits < structure.hitsMax,
		(candidates) => _.min(candidates, "hits")
	);
};

Creep.prototype.pull = function (target, resource = RESOURCE_ENERGY) {
	var creep = this;
	var result;
	if (target instanceof Structure) {
		result = creep.withdraw(target, resource);
	} else if (target instanceof Creep) {
		result = target.transfer(creep, resource);
	} else if (target instanceof Resource) {
		result = creep.pickup(target);
	} else if (target instanceof Source) {
		result = creep.harvest(target);
	}
	if (result === ERR_INVALID_TARGET) {
		Log.warn(`${creep.name} pull failed. Target: ${target.id} Resource: ${resource}`, 'Creep');
	}
	return result;
};

const { withdraw } = Creep.prototype;
Creep.prototype.withdraw = function (target, resource, amount) {
	if (resource === RESOURCE_ENERGY && target instanceof StructureTerminal) {
		if (target.store[RESOURCE_ENERGY] <= TERMINAL_MIN_ENERGY)
			return ERR_NOT_ENOUGH_RESOURCES;
	}
	var status = withdraw.apply(this, arguments);
	return status;
};

Creep.prototype.withdrawAny = function (target) {
	if (target.store)
		return this.withdraw(target, _.findKey(target.store));
	else
		return this.withdraw(target, RESOURCE_ENERGY);
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
global.ARENA_MATRIX = new CostMatrix.ArenaMatrix;
Creep.prototype.flee = function (min = MINIMUM_SAFE_FLEE_DISTANCE, all = false, cm) {
	if (!min || typeof min !== "number") // !_.isNumber(min))
		throw new Error(`Unacceptable minimum distance: ${min}`);
	// let hostiles = this.pos.findInRange(FIND_HOSTILE_CREEPS, min, {filter: Filter.unauthorizedHostile});
	var hostiles;
	if (all)
		hostiles = this.pos.findInRange(FIND_CREEPS, min);
	else
		hostiles = this.pos.findInRange(this.room.hostiles, min, { filter: Filter.unauthorizedCombatHostile });

	// if(!hostiles || hostiles.length <=0)
	if (_.isEmpty(hostiles))
		return false;

	const b = _.map(hostiles, c => ({ pos: c.pos, range: min }));
	let plainCost = this.plainSpeed;
	let swampCost = this.swampSpeed;
	if(swampCost <= plainCost)
		plainCost = swampCost*2;	// If we can move equally across both, prefer swamps
	const opts = {
		flee: true,
		plainCost,
		swampCost,
		maxOps: 500, // this might determine where we flee to.
		maxRooms: 1
	};

	opts.roomCallback = (r) => Game.rooms[r] ? Game.rooms[r].fleeMatrix : ARENA_MATRIX;
	const { path } = PathFinder.search(this.pos, b, opts);
	if (!path || path.length <= 0) {
		// Log.error(this.name + " unable to flee!");
		this.say("EEK!");
		return false;
	}
	const dir = this.pos.getDirectionTo(path[0]);
	this.move(dir);
	if (this.carry[RESOURCE_ENERGY])
		this.drop(RESOURCE_ENERGY);
	return true;
};

/**
 * Used for fleeing and for intercepting.
 */
Creep.prototype.getFleePosition = function (targets, range = 3) {
	if (_.isEmpty(targets))
		return ERR_NO_PATH;
	const { path } = PathFinder.search(this.pos,
		_.map(targets, c => ({ pos: c.pos, range: range })),
		{
			flee: true,
			maxOps: 500,
			maxRooms: 1
		});
	return (path !== undefined && path.length > 0) ? path[0] : ERR_NO_PATH;
};

/**
 * Predictive intercept 
 */
Creep.prototype.intercept = function (target, range = 3) {
	// Log.warn('Intercept in action at ' + this.pos);
	const goals = target.pos.findInRange(FIND_CREEPS, range, { filter: c => c.owner.username !== target.owner.username });
	const pos = target.getFleePosition(goals, range);
	if (pos === ERR_NO_PATH)
		return this.moveTo(target, { reusePath: 3 });
	else
		return this.moveTo(pos, { reusePath: 0 });
};

/**
 * Random direction or flee?
 */
Creep.prototype.scatter = function () {
	this.flee(4, true);
};

Creep.prototype.moveToRoom = function (roomName) {
	return this.moveTo(new RoomPosition(25, 25, roomName), {
		reusePath: 5,
		range: 23,
		ignoreRoads: this.plainSpeed === this.roadSpeed,
		ignoreCreeps: (this.memory.stuck || 0) < 3,
		costCallback: (name, cm) => LOGISTICS_MATRIX[name]
	});
};

Creep.prototype.buildNearbyCheapStructure = function () {
	if (this.carry[RESOURCE_ENERGY] < 5)
		return ERR_NOT_ENOUGH_RESOURCES;
	var sites = _.map(this.lookForNear(LOOK_CONSTRUCTION_SITES, true, 3), LOOK_CONSTRUCTION_SITES);
	// var target = _.find(sites, s => CONSTRUCTION_COST[s.structureType] <= 1);
	var target = _.find(sites, s => s.progressTotal - s.progress <= 1);
	return this.build(target);
};

/**
 * Monkey patch move to set isMoving with direction;
 */
/*
Commented out, not in use.
let move = Creep.prototype.move;
Creep.prototype.move = function(dir) {
	this.isMoving = dir;
	return move.call(this, dir)
}  */

/**
 * Monkey patch dismantle to limit risks
 */
const { dismantle } = Creep.prototype;
Creep.prototype.dismantle = function (target) {
	// Friendly structures don't get attacked.
	if (target instanceof OwnedStructure
		&& !target.my
		&& Player.status(target.owner.username) !== PLAYER_HOSTILE) {
		Log.warn("[WARNING] Won't dismantle friendly structure!", "Creep");
		this.say("NOPE");
		return ERR_INVALID_TARGET;
	}

	if (target.structureType === STRUCTURE_SPAWN && target.my) {
		Log.notify("Money patch prevent spawn disamantle");
		this.say("HELL NO");
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
	if (target == null || target.my
		|| (target.owner && Player.status(target.owner.username) !== PLAYER_HOSTILE)) {
		return ERR_INVALID_TARGET;
	}
	return attack.call(this, target);
};

const { rangedAttack } = Creep.prototype;
Creep.prototype.rangedAttack = function (target) {
	if (target.my
		|| (target.owner && Player.status(target.owner.username) !== PLAYER_HOSTILE)) {
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
	if (!target
		|| !(target instanceof ConstructionSite)
		|| !target.my && Player.status(target.owner.username) !== PLAYER_ALLY)
		return ERR_INVALID_TARGET;
	return build.call(this, target);
};

/**
 * Heal restrictions
 */
const { heal } = Creep.prototype;
Creep.prototype.heal = function (target) {
	if (target.hits >= target.hitsMax)
		return ERR_FULL;
	if (!target.my && Player.status(target.owner.username) !== PLAYER_ALLY)
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
	if (!target.my && Player.status(target.owner.username) !== PLAYER_ALLY)
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
	if (!target || target.owner && !target.my && Player.status(target.owner.username) !== PLAYER_ALLY) {
		Log.warn(`Target ${target} at ${((!target) ? 'null' : target.pos)} invalid ownership, unable to repair`, "Creep");
		return ERR_INVALID_TARGET;
	}
	return repair.call(this, target);
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
