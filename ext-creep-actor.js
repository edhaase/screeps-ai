/**
 * extension-creep-actor.js
 *
 * Creep extensions for intelligent actors (My AI, My creeps)
 */
'use strict';

global.BIT_CREEP_DISABLE_RENEW = (1 << 0);	// Don't renew this creep.
global.BIT_CREEP_IGNORE_ROAD = (1 << 1);	// Ignore roads when pathfinding.

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
	if(this.spawning)
		return;
	
	// Off because SK miners
	// this.updateHits();
	var memory = this.memory;
	if(this.isDeferred()) {
		this.say(memory.defer - Game.time);
		return;
	}	
	
	try {
		if(memory.home !== undefined && (this.pos.roomName !== memory.home || !this.pos.isValid())) {
			if(this.flee(4))
				return;
			return this.moveToRoom(memory.home);
		}
	
		this.runRTSactions();
		
		/* if(memory._move !== undefined && Game.time > memory._move.time + 100) {
			// Log.warn('[Creep] Cleaning up old moveTo data on ' + this.name);
			delete this.memory._move;
		} */
		
		// Single-pass extension of types
		if(memory.type) {			
			Object.setPrototypeOf(this, require('type-' + memory.type).prototype);
			// var dt = Time.measure( () => Object.setPrototypeOf(this, require('type-' + memory.type).prototype) );
		}
		
		this.updateStuck();		
		this.runRole();	
	} catch(e) {		
		// console.log('Exception on creep ' + this.name + ' at ' + this.pos);
		// console.log(e);
		Log.error(`Exception on creep ${this.name} at ${this.pos}: ${e}`, 'Creep');
		Log.error(e.stack, 'Creep');
		// console.log(e.stack);
		this.say("HELP");
		this.defer(3);
		// this.memory.error = { msg: e.toString(), tick: Game.time, stack: e.stack };
	}
}

/**
 * Put a creep to sleep for a given number of ticks, shutting off their logic.
 */
Creep.prototype.defer = function(ticks) {	
	if(typeof ticks !== 'number')
		throw new Error('Creep.defer expects numbers');
	if(ticks >= Game.time)
		Log.notify('Creep ' + this.name + ' at ' + this.pos + ' deferring for unusually high ticks!', LOG_TAG_CREEP);
	this.memory.defer = Game.time + ticks;
}

/**
 * Check if a creep is asleep.
 */
Creep.prototype.isDeferred = function() {
	var memory = Memory.creeps[this.name];
	if(memory !== undefined && memory.defer !== undefined && Game.time < memory.defer)
		return true;	
	else if(memory !== undefined && memory.defer)
		 Memory.creeps[this.name].defer = undefined;
	return false;	
}

/**
 * Can we renew this creep?
 * @todo: (Optional) (Cpu) Remove body part check and just mark roles with claim parts.
 */
var unRenewableRoles = ['recycle', 'filler', 'pilot'];
Creep.prototype.canRenew = function() {
	if(!this.my)
		return false;
	let {eca,home} = this.memory;
	if(eca && home && Game.rooms[home].energyCapacityAvailable > eca)
		return false;		
	return this.spawning === false
		&& this.ticksToLive < CREEP_LIFE_TIME - Math.floor(600/this.body.length) // Don't waste our time
		&& this.ticksToLive > this.body.length * CREEP_SPAWN_TIME	// Prevent issues with pre-spawning
		&& !unRenewableRoles.includes(this.getRole())				// More time wasting
		&& !this.checkBit(BIT_CREEP_DISABLE_RENEW)					// The mark of death
		&& !this.isBoosted()										// Don't break our boosts
		&& !this.hasBodypart(CLAIM)									// Can't renew claimers
		;
}

// Stats for checking invader attacks. 
let harvest = Creep.prototype.harvest;
Creep.prototype.harvest = function(target) {
	const result = harvest.apply(this, arguments);
	if(result === OK && target instanceof Source) {
		var {memory} = this.room;
		if(!memory.mined)
			memory.mined = 0;
		var mined = HARVEST_POWER * this.getActiveBodyparts(WORK);
		memory.mined += mined;
		memory.minedAvg = Math.cmAvg(mined, memory.minedAvg, ENERGY_REGEN_TIME);
	}
	return result;
}

Creep.prototype.harvestOrMove = function(target) {
	if(typeof target === 'string')
		target = Game.getObjectById(target);
	let status = this.harvest(target);
	if(status === ERR_NOT_IN_RANGE)
		this.moveTo(target, {
			maxRooms: (this.pos.roomName == target.pos.roomName)?1:16
		});
	return status;
}

Creep.prototype.transferOrMove = function(target, res, amt) {
	let status = this.transfer.apply(this,arguments);
	if(status === ERR_NOT_IN_RANGE)
		this.moveTo(target, {
			range: (target instanceof StructureController)?3:1
		});
	return status;
}

Creep.prototype.upgradeLocalController = function() {
	return this.upgradeController(this.room.controller);
}

/**
 *
 */
Creep.prototype.updateHits = function() {
	if(this.cache.hits) {
		if(this.hits < (this.cache.hits - RAMPART_DECAY_AMOUNT))
			this.onLostHits(this.cache.hits - this.hits);
		if(this.hits > this.cache.hits)
			this.onGainedHits(this.hits - this.cache.hits);
	} 
	this.cache.hits = this.hits;
}

Creep.prototype.onGainedHits = function(diff) {
	this.say('<3');
}

Creep.prototype.onLostHits = function(diff) {
	Log.warn('Creep taking hits at ' + this.pos + '! Lost ' + diff, LOG_TAG_CREEP);
}

Creep.prototype.updateStuck = function() {
	var {x,y} = this.pos;
	var code = x | y << 6;
	var {lpos,stuck=0} = this.memory;
	if(lpos) {
		this.isStuck = this.memory.lpos === code;
		if(this.isStuck)
			stuck++;
		else
			stuck = 0;
	}
	this.memory.stuck = stuck;
	this.memory.lpos = code;
}

/**
 * Move creep in random direction
 * 
 * @todo Ensure random direction isn't an exit tile..
 */
Creep.prototype.wander = function() {
	return this.move(_.random(0,8));
}

Creep.prototype.runRole = function() {
	var start = Game.cpu.getUsed();
	var roleName = this.getRole();
	if(!roleName)
		return;
	// try {
		var role = require('role-' + roleName);
		// var role = ROLE_MODULES[roleName] || require('role-' + roleName);
	/*  } catch(e) {
		Log.error('No such role: ' + roleName);
		Log.error(e.stack);
		return;
	} */
	// var role = require('role-' + this.memory.role);
	if(role.tick) {
		/// Time.measure( () => role.tick(this), undefined, (this.memory.role + ', ' + this.name) );
		role.tick(this);
	} else if(role.run) {
		role.run.call(this,this);
	} else {
		role.call(this, this);
		// Time.measure( () => role.call(this,this), null, (this.memory.role + ', ' + this.name) );
	}
	var used = Game.cpu.getUsed() - start;
	this.memory.cpu = Math.mmAvg(used, this.memory.cpu, 100);
	Volatile['role-' + roleName] = _.round((Volatile['role-' + roleName] || 0) + used, 3);
	// console.log(this.name + ' used ' + used + ' cpu');
}

/**
 * @return string
 */
Creep.prototype.getRole = function() {
	// Role in memory is now considered an override. In case of memory problems, role is inherited by name.
	if(Memory.creeps[this.name] && Memory.creeps[this.name].role)
		return Memory.creeps[this.name].role;
	var roleName = _.trimRight(this.name, '0123456789');
	var result = _.attempt(() => require('role-' + roleName));
	if(result instanceof Error) {
		Log.warn(`Rolename ${roleName} not valid for creep ${this.name} at ${this.pos}: ${result}`, 'Creep');
		return null;
	}
	Memory.creeps[this.name].role = roleName;
	return roleName;
}

/**
 * @param string
 */
Creep.prototype.setRole = function(role) {
	if(typeof role !== 'string')
		throw new Error('setRole expects string');
	this.memory.role = role;
	this.say(role + '!');
}

/**
 * General purpose energy gathering for all roles?
 */
Creep.prototype.gatherEnergy = function() {
	if(this.carryTotal >= this.carryCapacity)
		return ERR_FULL;
	let goal = this.getTarget(
			({room,pos}) => [...room.structures, ...room.resources],
			(candidate) => Filter.canProvideEnergy(candidate),
			(candidates, {pos}) => pos.findClosestByPath(candidates)
		);
	if(!goal)
		return ERR_INVALID_TARGET;
	let status = this.pull(goal, RESOURCE_ENERGY);
	if(status === ERR_NOT_IN_RANGE)
		this.moveTo(goal, {ignoreCreeps: (this.memory.stuck < 3), maxRooms: 1});
	return status;
}

Creep.prototype.getRepairTarget = function() {
	return this.getTarget(
		({room,pos}) => room.find(FIND_STRUCTURES),
		(structure) => structure.hits < structure.hitsMax,
		(candidates) => _.min(candidates, 'hits')
	);
}

Creep.prototype.getLoadedContainerTarget = function() {
	return this.getTarget(
		({room,pos}) => room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER}),
		(container) => _.sum(container.store) > 0,
		(containers) => _.max(containers, c => _.sum(container.store))
	)
}

Creep.prototype.pull = function(target, resource = RESOURCE_ENERGY){
	var creep = this;
	var result;
	if(target instanceof Structure){
		result = creep.withdraw(target, resource);
	}else if(target instanceof Creep){
		result = target.transfer(creep, resource);
	}else if(target instanceof Resource){
		result = creep.pickup(target);
	}else if(target instanceof Source){
		result = creep.harvest(target);
	}
	if(result === ERR_INVALID_TARGET){
		Log.warn("command", 3, creep.name + " pull failed. Target: " + target.id + "  Resource: " + resource);
	}
	return result;
};

let withdraw = Creep.prototype.withdraw;
Creep.prototype.withdraw = function(target,resource,amount) {
	if(resource === RESOURCE_ENERGY && target instanceof StructureTerminal) {
		if(target.store[RESOURCE_ENERGY] <= TERMINAL_MIN_ENERGY)
			return ERR_NOT_ENOUGH_RESOURCES;
	}
	var status = withdraw.apply(this, arguments);
	return status;
}

Creep.prototype.withdrawAny = function(target)
{
	if(target.store)
		return this.withdraw(target, _.findKey(target.store));
	else
		return this.withdraw(target, RESOURCE_ENERGY);
};

Creep.prototype.dropAny = function() {
	var res = _.findKey(this.carry);
	if(res)
		this.drop(res);
	return ERR_NOT_ENOUGH_RESOURCES;
};

Creep.prototype.pipe = function(res, src, dst) {
	this.withdraw(src, res);
	this.transfer(dst, res);
};

/**
 * Traveller
 */
Creep.prototype.isAvoidingRoom = function(roomName) {
	return false;
}

Creep.prototype.prefersRoom = function(roomName) {
	return false;
}

Creep.prototype.routeCallback = function(roomName, fromRoomName) {
	return 1.0;
}

// @return PathFinder.CostMatrix|false
Creep.prototype.getCostMatrix = function(roomName) {
	Log.warn('Requesting cost matrix for ' + roomName);
	return false;
}

/**
 * _Slightly_ cleaner moveTo.
 */
Creep.prototype.moveToPos = function(goal,opts) {
	if(this.fatigue > 0)
		return ERR_TIRED;
	if(goal.pos)
		goal = goal.pos;
	if(this.pos.isEqualTo(goal))
		return OK;
	opts = _.defaults(opts, {
		reusePath: 5,
		serializeMemory: true,
	});
	if(opts.visualizePathStyle)
		_.defaults(opts.visualizePathStyle, {fill: 'transparent', stroke: '#fff', lineStyle: 'dashed', strokeWidth: .15, opacity: .1});
	
	if(opts.reusePath && this.memory && this.memory._move) {
		
	}
}

/**
 * Creep specific findPath - Does not handle caching here.
 */
Creep.prototype.findPath = function(goals, opts) {
	var {range=1} = opts || {};	
	var {pos,body} = this;	
	return PathFinder.search(this.pos, goals, {
		plainCost: 1,
		swampCost: 5,
		
	});
}


/**
 * Does the actual pathfinding work. travelTo must find out
 * if we need to call this again.
 *
 * @todo Needs cost matrix cache and generator
 *
 * @param RoomPosition goal - Must be a room position to move to.
 * @param number range - (Optional) Range to move to
 * @param function:bool route - (Optional) whether to use findRoute (can take a routeCallback function)
 */
/* Creep.prototype.findTravelPath = function(dest, opts) {
	let origin = this.pos;
	
	// If we're in the same room, findRoute won't help us.
	if(origin.roomName === dest.roomName)
		route = false;
	else if(route && Game.map.getRoomLinearDistance(origin.roomName, dest.roomName) > 1) {
		// let routeCallback = (roomName, fromRoomName) => this.routeCallback
		if(route === true)
			routeCallback
		route = Game.map.findRoute(origin.roomName, dest.roomName, {routeCallback: this.routeCallback});
	}
	// Fix defaults:
	if(!opts.plainCost)
		opts.plainCost = this.plainSpeed;
	if(!opts.swampCost)
		opts.swampCost = this.swampSpeed;
	if(!opts.roomCallback)
		opts.roomCallback = (roomName) => ((opts.avoid || []).includes(roomName))?false:this.getCostMatrix(roomName)
	opts.maxCost = this.ticksToLive;
	// Actual path search
	let goal = {pos: dest, range: opts.range || 1};
	let {path, ops, cost, incomplete} = PathFinder.search(origin, goal,  opts);
} */

/**
 * General function for smarter pathfinding.
 * @param RoomPosition pos - destination
 *
 * @param Object opts - combned findRoute and pathfinder search options
 * @param Number range - default range to target
 * @param mixed route - whether to use findRoute scoring for this path
 *  Can't have both: Either 'stuck' indicator needs to account for fatigue, or travel path needs to store own movement.
 */
Creep.prototype.travelTo = function( goal, {
	range=1
	// costMatrix: (room) => logisticsMatrix[room.name],
	// cMCache
}) {
	var {x,y,roomName} = this.pos;
	// sanity checks.
	if(this.fatigue > 0)
		return ERR_TIRED;	
	if(pos.pos)
		pos = pos.pos;
	if(!(pos instanceof RoomPosition))
		throw new TypeError('travelTo expects RoomPosition');
	if(this.pos.inRangeTo(pos, range)) {
		delete this.memory['_walk'];
		return ERR_NO_PATH;
	}
	let params = this.memory['_walk'];
	
	// first move or changing direction.
	// if(!params || !_.matches(params.dest)(pos) ) {
	if(!params || _.get(this.memory, 'stuck', 0) > 3 || pos.x != params.dest.x || pos.y != params.dest.y || pos.roomName != params.dest.roomName) {
		_.defaults(opts, {
			routeCallback: r => Game.map.getRoomLinearDistance(r, pos.roomName) * 2,
		})
		
		// create route			
		let route = Route.findRoute(this.pos.roomName, pos.roomName);
		if(route == ERR_NO_PATH)
			return ERR_NO_PATH;		
		route.push(this.pos.roomName);
		
		// create path
		_.defaults(opts, {
			roomCallback: r => _.contains(route, r)?(logisticsMatrix[r]):false,
			plainCost: Math.max(1, this.plainSpeed),
			swampCost: Math.max(1, this.swampSpeed),
			maxOps: 2500 * (route.length+1)
		});
		const search = PathFinder.search(this.pos, {pos: pos, range: range}, opts);
		let {path, ops} = search;
		if(!path || path.length <= 0)
			return ERR_NO_PATH;
		path.unshift(this.pos);
		
		let metric = Math.round(ops / path.length,3);
		
		// stuff
		function compact(arr) {
			// Keep first room position		
			let list = [];
			let i = 1;
			for(i=1; i<arr.length; i++) {
				let a = arr[i-1];
				let b = arr[i];			
				let dir = a.getDirectionTo(b);			
				if(a.roomName == b.roomName) // no path on borders
					list.push(dir);			
			}
			return list.join("");
		}	
		if(metric > 300)
			this.memory.defer = Game.time + 2;
		params = { dest: pos, ops: ops, metric: metric, path: compact(path), stuck: 0 };
		// params = { dest: pos, ops: ops, metric: metric, path: compact(path) };
		// this.memory.stuck = 0;
		this.isStuck = false;
		// Log.info('test: ' + JSON.stringify(params));
	}
		
	/* let {dest, path, i=0, stuck=0, lastPos} = params;
	dest = _.create(RoomPosition.prototype, dest);
	if((i >= path.length) || this.pos.inRangeTo(dest, range || 1)) {
		console.log('arrived');
		delete this.memory['_walk'];
		return;
	} 
	let isStuck = _.matches(this.pos)(lastPos);	
	*/
	let {path, i=0, stuck=0} = params;
	
	if(this.isStuck) { 
		i--;
		stuck++;
	}	
	
	let dir = path.charAt(i);			
	if(this.move(dir) == OK)
		i++;	
	
	params.i = i;
	params.stuck = stuck;
	_.set(this.memory, '_walk', params);
}

// Check if we should flee based on body part
// Need cM to avoid obstacles
// Fleeing all creeps might not be such a bad idea.
Creep.prototype.fleeFrom = function(stuff) {
	let {path, ops} = PathFinder.search(this.pos, stuff, {flee: true, plainCost: this.plainSpeed, swampCost: this.swampSpeed});
	let dir = this.pos.getDirectionTo(path[0]); 
	this.move(dir);
}

/**
 * 2016-12-11: Only flee from creeps that are actually a threat to us.
 * 2016-11-02: Reintroduced the arena matrix in a way that makes sense. 
 */
global.ARENA_MATRIX = new CostMatrix.ArenaMatrix; 
Creep.prototype.flee = function(min=4, all=false, cm) {
	if(!min || typeof min !== 'number') // !_.isNumber(min))
		min = 4;
	// let hostiles = this.pos.findInRange(FIND_HOSTILE_CREEPS, min, {filter: Filter.unauthorizedHostile});
	var hostiles;
	if(all)
		hostiles = this.pos.findInRange(FIND_CREEPS, min);
	else
		hostiles = this.pos.findInRange(this.room.hostiles, min, {filter: Filter.unauthorizedCombatHostile});
	
	// if(!hostiles || hostiles.length <=0)
	if(_.isEmpty(hostiles))
		return false;
	
	let b = _.map(hostiles, c => ({pos: c.pos, range: min}));
	let opts = {
		flee: true,
		plainCost: this.plainSpeed,
		swampCost: this.swampSpeed,
		maxOps: 500, // this might determine where we flee to.
		maxRooms: 1
	};
	
	// let cM = (cm)?cm:(new CostMatrix.ArenaMatrix(this.room.name));
	// opts.roomCallback = (r) => cm;
	// opts.roomCallback = (r) => logisticsMatrix[this.room.name];
	opts.roomCallback = (r) => Game.rooms[r]?Game.rooms[r].fleeMatrix:ARENA_MATRIX;
	let {path, ops} = PathFinder.search(this.pos, b, opts);
	if(!path || path.length <= 0) {
		// Log.error(this.name + " unable to flee!");
		this.say('EEK!');
		return false;
	} 
	let dir = this.pos.getDirectionTo(path[0]); 
	this.move(dir);
	if(this.carry[RESOURCE_ENERGY])
		this.drop(RESOURCE_ENERGY)
	return true;
}

/**
 * Used for fleeing and for intercepting.
 */
Creep.prototype.getFleePosition = function(targets, range=3) {
	if(_.isEmpty(targets))
		return ERR_NO_PATH;
	let {path, ops} = PathFinder.search( this.pos,
		_.map(targets, c => ({pos: c.pos, range: range})),
		{
			flee: true,
			maxOps: 500,
			maxRooms: 1
		});
	return (path !== undefined && path.length > 0)?path[0]:ERR_NO_PATH;
}

Creep.prototype.shunt = function() {
	let {path} = PathFinder.search(this.pos, {pos: this.pos, range: 1}, {
		flee: true
	});
	return this.move(this.pos.getDirectionTo(path[0]));
}

/**
 * Predictive intercept 
 */
Creep.prototype.intercept = function(target, range=3) {
	// Log.warn('Intercept in action at ' + this.pos);
	let goals = target.pos.findInRange(FIND_CREEPS, range, {filter: c => c.owner.username !== target.owner.username});
	let pos = target.getFleePosition(goals, range);
	if(pos === ERR_NO_PATH)
		return this.moveTo(target, {reusePath: 3});
	else
		return this.moveTo(pos, {reusePath: 0});
}

/**
 * Random direction or flee?
 */
Creep.prototype.scatter = function() {
	this.flee(4,true);
}

Creep.prototype.moveToRoom = function(roomName) {
	return this.moveTo( new RoomPosition(25,25,roomName), {
		reusePath: 5,
		range: 20,
		ignoreRoads: this.plainSpeed == this.roadSpeed,
		ignoreCreeps: (this.memory.stuck || 0) < 3,
		costCallback: (name, cm) => logisticsMatrix[name]
	});
};

Creep.prototype.buildNearbyCheapStructure = function() {
	if(this.carry[RESOURCE_ENERGY] < 5)
		return ERR_NOT_ENOUGH_RESOURCES;
	var sites = _.map(this.lookForNear(LOOK_CONSTRUCTION_SITES, true, 3), LOOK_CONSTRUCTION_SITES);
	// var target = _.find(sites, s => CONSTRUCTION_COST[s.structureType] <= 1);
	var target = _.find(sites, s => s.progressTotal - s.progress <= 1);
	if(target)
		this.build(target);
}

// var distanceRate = {1: 1, 2: 0.4, 3: 0.1};
const distanceRate = [1.0, 1.0, 0.4, 0.1];
Creep.prototype.getRangedMassAttackPotentialToTarget = function(target, power=RANGED_ATTACK_POWER) {
	if(!target.hits || target.my)
		return 0;
	var range = this.pos.getRangeTo(target);	
	if(range > 3)
		return 0;
	if( !(target instanceof StructureRampart) && target.pos.hasRampart() )
		return 0;
	return power * distanceRate[range]; // || 0);
};

// Doesn't account for boosts.
// look calls might be faster.
Creep.prototype.getRangedMassAttackPotential = function() {	
	var dmg = 0;
	/* var creeps = this.lookForNear(LOOK_CREEPS,true,3);
	var structures = this.lookForNear(LOOK_STRUCTURES,true,3);
	dmg += _.sum(creeps, ({creep}) => this.getRangedMassAttackPotentialToTarget(creep));
	dmg += _.sum(structures, ({structure}) => this.getRangedMassAttackPotentialToTarget(structure)); */	
	var power = RANGED_ATTACK_POWER * this.getActiveBodyparts(RANGED_ATTACK);
	dmg += _.sum( this.pos.findInRange(FIND_HOSTILE_CREEPS,3), c => this.getRangedMassAttackPotentialToTarget(c,power) );
	dmg += _.sum( this.pos.findInRange(FIND_HOSTILE_STRUCTURES,3), s => this.getRangedMassAttackPotentialToTarget(s,power) );
	return dmg;
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
let dismantle = Creep.prototype.dismantle;
Creep.prototype.dismantle = function(target) {
	// Friendly structures don't get attacked.
	if( target instanceof OwnedStructure 
	&& !target.my
	&& Player.status(target.owner.username) != PLAYER_HOSTILE ) {
		console.log("[WARNING] Won't dismantle friendly structure!");
		this.say("NOPE");
		return ERR_INVALID_TARGET;
	}
			
	if(target.structureType === STRUCTURE_SPAWN && target.my) {
		console.log("[WARNING] Won't dismantle our spawn!");
		Game.notify("Monkey patch saved our ass! Spawn safe.");
		this.say("HELL NO");
		return ERR_INVALID_TARGET;
	}
			
	return dismantle.call(this, target)
}

/**
 * Attack restrictions
 */
let attack = Creep.prototype.attack;
Creep.prototype.attack = function(target) {
	// Friendlies are safe.			
	if( target == undefined || target.my 
	|| (target.owner && Player.status(target.owner.username) != PLAYER_HOSTILE)) {
		return ERR_INVALID_TARGET;
	}
	return attack.call(this, target);
}
	
let rangedAttack = Creep.prototype.rangedAttack;
Creep.prototype.rangedAttack = function(target) {		
	if( target.my 
	|| (target.owner && Player.status(target.owner.username) != PLAYER_HOSTILE)) {
		return ERR_INVALID_TARGET;
	}
	return rangedAttack.call(this, target);
}
		
/**
 * Build restrictions
 *
 * Uses 5 energy per work per tick (5 pe/t)
 */
let build = Creep.prototype.build;
Creep.prototype.build = function(target) {		
	if(!target
	|| !(target instanceof ConstructionSite)
	|| !target.my && Player.status(target.owner.username) != PLAYER_ALLY)
		return ERR_INVALID_TARGET;
	return build.call(this, target);
}
	
/**
 * Heal restrictions
 */
let heal = Creep.prototype.heal;
Creep.prototype.heal = function(target) {
	if(target.hits >= target.hitsMax)
		return ERR_FULL;	
	if(!target.my && Player.status(target.owner.username) != PLAYER_ALLY)
		return ERR_INVALID_TARGET;
	let status = heal.call(this, target);
	if(status === OK)
		Object.defineProperty(target, 'hits', {
			value: target.hits + (HEAL_POWER * this.getActiveBodyparts(HEAL)),
			configurable: true
		})
	return status;
}
	
let rangedHeal = Creep.prototype.rangedHeal;
Creep.prototype.rangedHeal = function(target) {
	if(!target.my && Player.status(target.owner.username) != PLAYER_ALLY)
		return ERR_INVALID_TARGET;
	return rangedHeal.call(this, target);
}
	
/**
 * Repair restrictions
 */
let repair = Creep.prototype.repair;
Creep.prototype.repair = function(target) {
	if(target.hits >= target.hitsMax)
		return ERR_FULL;
	if(!target || target.owner && !target.my && Player.status(target.owner.username) != PLAYER_ALLY) {
		console.log("WARNING: Target " + target + " at " + ((!target)?'null':target.pos) + " invalid ownership, no repair");
		return ERR_INVALID_TARGET;
	}
	return repair.call(this, target);
}
;
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
