/**
 * ext.flag.js - Point of interest operations
 *
 * @todo: Squad flags? Doubles as memory and flag goals for most stuff.
 */
'use strict';

/* global DEFINE_CACHE_BACKED_PROPERTY, Log */

/* eslint-disable consistent-return */

const { VisibilityError } = require('os.core.errors');

const RESERVATION_STEAL_MARGIN = 200;	// Give a player time to reclaim their remote

if (!Memory.flags)
	Memory.flags = {};

/**
 * Flag logic
 * 2016-11-02: secondaryColor white is idle for all primary states (at the moment), so let's optimize
 * 2016-12-14: seperated run and runLogic because try/catch doesn't optimize
 */
Flag.prototype.run = function () {
	if (this.secondaryColor === COLOR_WHITE)
		return;

	if (this.isDeferred())
		return;

	if (this.isExpired()) {
		Log.warn(`${this.name} expired!`, "Flag");
		this.remove();
		return;
	}

	this.defer(5); // This is mission critical to keeping cpu handled.

	try {
		this.runLogic();
	} catch (e) {
		Log.error(`Error on ${this.name} at ${this.pos}`, 'Flag');
		Log.error(e, 'Flag');
		Log.error(e.stack, 'Flag');
	}
};

/**
 * If we're going to automate flag placement, we're going to need more than
 * just two colors (10x10=100 combi) to control behavior. So let's create a couple
 * of prototypes to fix this.
 * 
 * example: Game.rooms['W2N7'].createLogicFlagAtXY(38,40,null,COLOR_WHITE,COLOR_WHITE,{expire:'this.room.hostiles.length > 1'})
 */
const { createFlag } = Room.prototype;
Room.prototype.createLogicFlagAtXY = function (x, y, name, color, secondaryColor, memory) {
	if (_.any(this.lookForAt(LOOK_FLAGS, x, y), f => f.color === color && f.secondaryColor === secondaryColor))
		return ERR_FULL;
	const flagName = name || `${this.name}_${y * 50 + x}_${color * 10 + secondaryColor}`;
	const result = createFlag.call(this, x, y, flagName, color, secondaryColor);
	if (typeof result !== 'number')
		Game.flags[result].memory = memory; // Apparently if the call succeeds, we get a flag immediately.	
	return result;
};

Room.prototype.createLogicFlagAtPos = function (pos, name, color, secondaryColor, memory) {
	return this.createLogicFlagAtXY(pos.x, pos.y, name, color, secondaryColor, memory);
};

RoomPosition.prototype.createLogicFlag = function (name, color, secondaryColor, memory) {
	if (!Game.rooms[this.roomName])
		throw new VisibilityError(this.roomName);
	return Game.rooms[this.roomName].createLogicFlagAtPos(this, name, color, secondaryColor, memory);
};

/**
 * Puts a flag to sleep for given number of ticks.
 */
Flag.prototype.defer = function (ticks) {
	if (!_.isNumber(ticks))
		throw new TypeError('Flag.defer expects numbers');
	if (ticks <= 0)
		return 0;
	if (ticks >= Game.time)
		Log.notify(`Flag ${this.name} at ${this.pos} deferring for unusually high ticks`);
	this.memory.defer = Math.ceil(Game.time + ticks);
	return this.memory.defer;
};

/**
 * Check if the flag is set to sleep, and clean up the memory if need be.
 */
Flag.prototype.isDeferred = function () {
	var memory = Memory.flags[this.name];
	if (memory !== undefined && memory.defer !== undefined && Game.time < memory.defer)
		return true;
	else if (memory !== undefined && memory.defer)
		delete Memory.flags[this.name].defer;
	return false;
};

Flag.prototype.setSecondaryColor = function (secondaryColor) {
	return this.setColor(this.color, secondaryColor);
};

/**
 * Allows a flag to expire and remove itself.
 */
Flag.prototype.expire = function (until) {
	if (_.isNumber(until))
		this.memory.expire = Math.floor(Game.time + until);
	else
		this.memory.expire = until;
	return this.memory.expire;
};

/**
 * Check if a flag has expired. Unlike isDeferred, does not clean up the memory.
 */
Flag.prototype.isExpired = function () {
	var { expire } = Memory.flags[this.name] || {};
	if (expire == null)
		return false;
	if (typeof expire === 'number') // if(_.isNumber(expire))
		return Game.time >= expire;
	else if (typeof expire === 'string')
		return eval(expire);
	return false;
};

/**
 * Patch to clean up memory when removed
 */
const { remove } = Flag.prototype;
Flag.prototype.remove = function () {
	const status = remove.call(this);
	if (status === OK) {
		Log.info(`Cleaning up memory for ${this.name}`, "Flag");
		delete Memory.flags[this.name];
	}
	return status;
};

Flag.prototype.assignNearbySpot = function (limit = CREEP_LIFE_TIME) {
	const { path, cost } = PathFinder.search(
		this.pos,
		_.map(Game.spawns, s => ({ pos: s.pos, range: 5 }))
	);
	if (cost > limit) {
		Log.warn('cost exceeds limit, no target set', 'Flag');
		return;
	}
	const goal = _.last(path);
	Log.info(`${this.name} assigning ${goal} to dropoff`, 'Flag');
	this.memory.dropoff = goal;
	this.memory.steps = cost;
};

/**
 * Checks if we have a creep assigned to this flag. Utilizes cache.
 */
Flag.prototype.getAssignedUnit = function (fn) {
	// if(!_.isFunction(fn))
	//	throw new Exception('Expected function')
	const name = this.cache.creep;
	let creep = Game.creeps[name];
	if (creep && fn(creep)) {
		// console.log('[Flag] cache hit on ' + this.name);
		// Log.debug(`Cache hit on ${this.name}`, "Flag");
		return creep;
	} else {
		// Log.debug(`Cache miss on ${this.name}`, "Flag");
		creep = _.find(Game.creeps, fn);
		// console.log('result of find: ' + creep);
		this.cache.creep = (creep) ? creep.name : undefined;
		return creep;
	}
};

Flag.prototype.clearAssignedUnit = function () {
	this.cache['creep'] = undefined;
};

Flag.prototype.hasAssignedUnit = function (fn) {
	return this.getAssignedUnit(fn) != null;
};

Flag.prototype.hasPendingUnit = function (job) {
	const [spawn] = this.getClosestSpawn();
	return spawn.hasJob(job);
};

Flag.prototype.runSelfCleanup = function () {
	if (!this.room)
		return false;
	const { controller } = this.room;
	if (controller && controller.my) {
		Log.warn(`We own the controller in ${this.pos.roomName}, removing self!`, 'Flag');
		this.remove();
		return true;
	} else if (controller && controller.owner) {
		Log.warn(`Controller owned by ${JSON.stringify(controller.owner)} else, removing self`, 'Flag');
		this.remove();
		return true;
	} else if (controller && controller.reservation && Player.status(controller.reservation.username) >= PLAYER_NEUTRAL && controller.reservation.username !== WHOAMI) {
		Log.warn(`Controller reserved by friendly player ${controller.reservation.username}`, 'Flag');
		this.defer(controller.reservation.ticksToEnd + RESERVATION_STEAL_MARGIN);
		return true;
	}
	return false;
};

Flag.prototype.runLogic = function () {
	const Unit = require('Unit');

	if (this.runSelfCleanup())
		return;

	if (this.color === FLAG_MILITARY) {
		if (this.secondaryColor === STRATEGY_DEFEND) {
			if (this.room && this.room.controller && this.room.controller.owner && !this.room.controller.my)
				return this.remove();
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			const unit = this.getAssignedUnit(c => c.getRole() === 'guard' && c.memory.site === this.name && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
			if (unit)
				return this.defer(MAX_CREEP_SPAWN_TIME);
			if (spawn && !spawn.hasJob({ memory: { role: 'guard', site: this.name } }) && !spawn.spawning) {
				Unit.requestGuard(spawn, this.name, this.memory.body, this.pos.roomName);
			}
			this.defer(DEFAULT_SPAWN_JOB_EXPIRE);
			return;
		}

		/* similar to guard flag, but summons guard in response to threats */
		if (this.secondaryColor === STRATEGY_RESPOND) {
			if (this.room == null) // We can't see the room, we can't act. Maybe request observer?
				return;
			if (this.room && this.room.controller && this.room.controller.owner && !this.room.controller.my)
				return this.remove();
			const { hostiles } = this.room;
			if (_.isEmpty(hostiles))
				return this.defer(_.random(25, 50));
			// @todo: 1 or more, guard body based on enemy body and boost.
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			const unit = this.getAssignedUnit(c => c.getRole() === 'guard' && c.memory.site === this.name && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
			if (unit || !spawn)
				return this.defer(MAX_CREEP_SPAWN_TIME);
			// @todo: Find correct guard to respond.
			Log.warn(`Requesting guard to ${this.pos}`, "Flag");
			// Unit.requestGuard(spawn, this.name, [TOUGH, TOUGH, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, MOVE, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, HEAL, MOVE, HEAL]);
			Unit.requestGuard(spawn, this.name, this.memory.body, this.pos.roomName);
			return this.defer(DEFAULT_SPAWN_JOB_EXPIRE);
		}

		if (this.secondaryColor === STRATEGY_RESERVE) {
			const clock = _.get(Memory.rooms, [this.pos.roomName, 'reservation'], Game.time) - Game.time;
			// @todo if clock is above minimum and below max, random chance of sending a reserver anyways.
			if (clock > MINIMUM_RESERVATION)
				return;
			const { minCost } = require('role.reserver');
			const [spawn, cost = 0] = this.getClosestSpawn({ maxCost: CREEP_CLAIM_LIFE_TIME, plainCost: 1, filter: s => s.room.energyCapacityAvailable >= minCost });
			if (!spawn)
				return Log.debug(`No spawn available to spawn reserver for ${this} at ${this.pos}`, 'Flag#Reserve');
			const size = Math.floor((CONTROLLER_RESERVE_MAX - clock) / (CONTROLLER_RESERVE * (CREEP_CLAIM_LIFE_TIME - cost)));
			const reserver = this.getAssignedUnit(c => c.getRole() === 'reserver' && this.pos.isEqualToPlain(c.memory.site) && (c.spawning || (c.ticksToLive > (2 * size * CREEP_SPAWN_TIME) + cost)));
			if (reserver)
				return this.defer(Math.min(reserver.ticksToLive || CREEP_CLAIM_LIFE_TIME, DEFAULT_SPAWN_JOB_EXPIRE));
			Log.info(`${this.name} wants to build reserver of size ${size} for room ${this.pos.roomName} with spawn ${spawn}`, 'Flag#Reserve');
			if (spawn && !spawn.hasJob({ memory: { role: 'reserver', site: this.pos } })) {
				const prio = clock / MINIMUM_RESERVATION;
				const status = require('Unit').requestReserver(spawn, this.pos, prio, size);
				Log.info(`${this.name} status result ${status}`, 'Flag#Reserve');
			}
			this.defer(MAX_CREEP_SPAWN_TIME);
			return;
		}

		/** maintain scout */
		if (this.secondaryColor === STRATEGY_SCOUT) {
			let unit = this.getAssignedUnit(c => c.getRole() === 'scout' && c.memory.flag === this.name);
			if (unit)
				return;
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			if (spawn && spawn.hasJob({ memory: { role: 'scout', flag: this.name } }))
				return;
			Log.info('Requesting new scout');
			return Unit.requestScout(spawn, { flag: this.name });
		}

	}


	/** maintain sk miner */
	if (this.color === FLAG_MINING && this.secondaryColor === SITE_SKMINE) {
		// let miner = _.find(Game.creeps, c => c.memory.role === 'war-miner' && this.pos.isEqualTo(_.create(RoomPosition.prototype, c.memory.pos)) && c.ticksToLive >= 150);
		const miner = this.getAssignedUnit(c => c.getRole() === 'war-miner' && this.pos.isEqualToPlain(c.memory.pos) && (c.spawning || c.ticksToLive >= UNIT_BUILD_TIME(c.body)));
		// let miner = this.getAssignedUnit(c => c.memory.role === 'war-miner' && this.pos.isEqualTo(c.memory.pos) && c.ticksToLive >= 150);
		const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
		if (!miner && spawn && !spawn.hasJob({ memory: { role: 'war-miner', pos: this.pos } })) {
			Log.info('Requesting new war-miner');
			Unit.requestWarMiner(spawn, { role: 'war-miner', pos: this.pos });
			this.defer(DEFAULT_SPAWN_JOB_EXPIRE);
		} else {
			this.defer(CREEP_LIFE_TIME / 2);
		}
		return;
	}

	// Commented out for testing.
	/* if(this.color === FLAG_MINING && this.secondaryColor === SITE_DUAL_MINER) {
		// Check for creep first?
		let {spawntime=0,steps} = this.memory;
		let unit = this.getAssignedUnit(c => c.getRole() === 'dualminer' && c.memory.site === this.pos.roomName && (c.ticksToLive > spawntime || c.spawning));
		if(unit) {
			if(unit.spawning)
				return this.defer(50);
			else if( (unit.ticksToLive - spawntime) > 0 )
				return this.defer(Math.min(unit.ticksToLive - spawntime, 50));
		}
		this.clearAssignedUnit();
		let {room,pos} = this;		
		if(!room || !this.room.canMine) // probably bad
			return Log.warn('Dual-miner ' + this.name + ' unable to request unit at this time', 'Flag:unit');
		// Find all sources
		let sources = room.find(FIND_SOURCES);
		if(_.isEmpty(sources)) {
			Log.error('[Flag] No sources to mine in ' + pos.roomName);
			return this.remove();
		} else if(sources.length == 1) {
			Log.warn('[Flag] Dual miner expects multiple sites');
			return;
		}
		
		let totalCapacity = _.sum(sources, 'energyCapacity');
		let [src1,src2] = sources;
		let goal1 = src1.container || src1;
		let goal2 = src2.container || src2;
		if(!steps) {
			steps = goal1.pos.getStepsTo(goal2.pos) * 2; // expecting two sources
			this.memory.steps = steps;
		}
		if(steps == 0) {
			Log.warn('[Flag] Dual miner steps 0?');
			return;
		}		
		const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
		var r = Unit.requestDualMiner(spawn, this.pos.roomName, totalCapacity, steps);
		if(r !== false)
			this.memory.spawntime = r;
		return this.defer(Time.secondsToTicks(60 * 5));
	} */

	// Replaced by StructureExtractor run behavior. Might want this back for remote minerals.
	/* if(false && this.color == FLAG_MINING && this.secondaryColor == SITE_MINERAL) {				
		if(!Game.rooms[this.pos.roomName])
			return;
		// if(_.get(Game.rooms[this.pos.roomName], 'controller.my')) // if rcl is too low, defer flag.
		var s = this.pos.lookFor(LOOK_STRUCTURES);
		if(!_.any(s, 'structureType', STRUCTURE_EXTRACTOR)) {
			if(this.room)
				this.room.createConstructionSite(this.pos, STRUCTURE_EXTRACTOR);
			return;
		}

		var mineral = Game.getObjectById(this.name.split('_')[1]);
		if(mineral && mineral.mineralAmount == 0) {
			Log.notify("Mineral site " + this.pos + " empty! deffering operations at this site.");			
			this.memory.defer = Game.time + mineral.ticksToRegeneration;
		} 
		
		var miner = _.find(Game.creeps, c => c.memory.role == 'miner' && c.memory.site == this.name);
		if(miner)
			return;
		
		// var spawn = this.pos.findClosestSpawn();
		const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
		Mining.requestMineralMiner(spawn, this.name, 60*5);		
		// Mining.requestRemoteMiner(spawn, this.name, 60*5);
		this.memory.defer = Game.time + Time.secondsToTicks(60 * 5);
			
		return;
	} */


	/**
	 * Remote mining site operations (very similar, but also requires an assigned hauler)
	 * 2016-10-26: carryCapacity gets weird when creeps get damaged
	 */
	const HAULER_MARGIN = 2;
	if (this.color === FLAG_MINING && this.secondaryColor === SITE_PICKUP) {
		if (this.room && !this.room.canMine) {
			Log.warn(`Cannot mine in ${this.pos.roomName}, deferring.`, 'Flag#Hauler');
			return this.defer(5000);
		}
		else if (this.room && this.room.controller && this.room.controller.owner && !this.room.controller.my)
			return this.remove();
		else if (this.room && this.room.my)
			return this.remove();
		if (this.room && this.memory.dropoff != null && this.room.isBuildQueueEmpty())
			this.throttle(300, 'clk', () => {
				// const {roomName} = this.memory.dropoff;
				// if(Game.rooms[roomName] && Game.rooms[roomName].my && Game.rooms[roomName].controller.level >= 4)
				//	require('Planner').planRoad(this.pos, { pos: _.create(RoomPosition.prototype, this.memory.dropoff), range: 1 });
				this.memory.dropoff = undefined; // reset dropoff
			});
		const container = (this.room) ? this.pos.getStructure(STRUCTURE_CONTAINER, 1) : null;
		const miner = this.room && this.pos.getCreep(1, c => c.my && c.memory.role === 'miner');
		if (!container && !miner)
			return Log.warn(`No pickup point for flag ${this.pos}`, 'Flag#Hauler');
		const site = (container && container.pos) || (miner && miner.pos) || this.pos;
		// @todo pick room by route..
		// @todo pick structure in room, including containers.
		if (this.room && (!this.memory.dropoff || (this.memory.step == null || this.memory.step <= 0))) {
			this.memory.steps = undefined;
			const storages = _.filter(Game.structures, s => [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_CONTROLLER].includes(s.structureType));
			const { goal, cost, ops, incomplete } = site.findClosestByPathFinder(storages, s => ({ pos: s.pos, range: 1 }));
			if (goal) {
				this.memory.dropoff = goal.pos;
				this.memory.range = 1;
				if (goal instanceof StructureController) {
					if (goal.container) {
						this.memory.dropoff = goal.container.pos;
						this.memory.range = 1;
					} else {
						this.memory.range = CREEP_UPGRADE_RANGE;
					}
				}
				Log.info(`${this.name} found dropoff goal: ${goal} ${this.memory.dropoff} range ${this.memory.range} (from ${this.pos}) at cost ${cost} ops ${ops} incomplete ${incomplete}`, 'Flag#Hauler');
			} else
				this.assignNearbySpot();
			// this.memory.steps = this.pos.getStepsTo({ pos: this.memory.dropoff, range: 1 });
			this.memory.steps = cost;
		}
		if (!this.memory.dropoff) {
			Log.warn(`No dropoff point for ${this.name}`, 'Flag#Hauler');
			return this.defer(MAX_CREEP_SPAWN_TIME);
		}
		if (this.room) {
			const [source] = this.pos.lookFor(LOOK_SOURCES);
			this.memory.capacity = (source && source.energyCapacity) || SOURCE_ENERGY_CAPACITY;
			Log.debug(`${this.name} setting capacity to ${this.memory.capacity}`, 'Flag#Hauler');
		}
		// @todo comparing to the site is a recipe for disaster.
		const creeps = _.filter(Game.creeps, c => c.memory.role === 'hauler' && site.isEqualToPlain(c.memory.site));
		const assigned = _.sum(creeps, c => c.getBodyParts(CARRY));
		const { steps, capacity = SOURCE_ENERGY_CAPACITY } = this.memory;
		const estCarry = CARRY_PARTS(capacity, steps);
		const reqCarry = HAULER_MARGIN + Math.ceil(estCarry); // flat 1 + 2 extra carry
		const remaining = Math.max(0, reqCarry - assigned);
		Log.info(`${this.pos} assigned: ${assigned} steps ${steps} cap ${capacity} est ${estCarry} remaining: ${remaining}`, 'Flag#Hauler');
		if (!creeps || remaining > HAULER_MARGIN) {
			/** high cpu - run sparingly */
			// move out of if, cache steps, reqCarry - sum of carry parts assigned
			// Log.info(`New hauler: step count ${steps}, estCarry ${estCarry}, reqCarry ${reqCarry}`, "Flag");
			// let spawn = this.pos.findClosestSpawn();
			const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 1 });
			Log.success(`Requesting new hauler to site: ${this.pos} from spawn ${spawn}`, 'Flag#Hauler');
			if (spawn && !spawn.hasJob({ memory: { role: 'hauler', site, dropoff: this.memory.dropoff } })) {
				const priority = (miner) ? assigned / reqCarry : PRIORITY_MIN;
				Unit.requestHauler(spawn, { role: 'hauler', site, dropoff: this.memory.dropoff, steps: this.memory.steps }, this.memory.hasRoad, remaining, priority, this.pos.roomName);
			}
		} else if (reqCarry - assigned < 0) {
			Log.warn(`${this.name}/${this.pos} Reporting excess hauler capacity: ${(reqCarry - assigned)}`, 'Flag#Hauler');
		}
		this.defer(MAX_CREEP_SPAWN_TIME);
		return;
	}

	/**
	 * Normal mining site operation
	 */
	// Move to module?
	if (this.color === FLAG_MINING && this.secondaryColor === SITE_REMOTE) {
		if (this.room) {
			if (this.room.owner) {	// If it's owned by us or another player we aren't using flag based mining.
				return this.remove();
			} else if (!this.room.canMine) {
				return this.defer(500);
			} else {
				const [source] = this.pos.lookFor(LOOK_SOURCES);
				this.memory.work = (source && source.harvestParts) || SOURCE_HARVEST_PARTS;
				Log.debug(`${this.name} setting capacity to ${this.memory.work}`, 'Flag');
			}
		}
		const [spawn, cost = 0] = this.getClosestSpawn({ plainCost: 3 });
		const miner = this.getAssignedUnit(c => c.getRole() === 'miner' && this.pos.isEqualToPlain(c.memory.dest) && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
		if (!miner) {
			if (!spawn) {
				// Log.error(`No spawn for ${this.name}`, 'Flag');
				this.defer(5);
				return;
			}
			const parts = this.memory.work || SOURCE_HARVEST_PARTS;
			require('Unit').requestRemoteMiner(spawn, this.pos, this.memory.work, this.pos.roomName);
		} else {
			this.defer(Math.ceil((miner.ticksToLive || CREEP_LIFE_TIME) / 2));
		}
		this.defer(MAX_CREEP_SPAWN_TIME);
		return;
	}

};