/**
 * ext.livingentity.js
 * 
 * Thanks to deft-code for this, we now have a unified bridge between Creep and PowerCreep
 * different from just RoomObject
 */
'use strict';

/* global Log, Filter, DEFINE_CACHED_GETTER, DEFINE_GETTER */
/* global LOGISTICS_MATRIX */
/* global CREEP_RANGED_HEAL_RANGE, CREEP_RANGED_ATTACK_RANGE, MINIMUM_SAFE_FLEE_DISTANCE */
/* global Player, PLAYER_HOSTILE, PLAYER_ALLY */
/* global Intel */
/* eslint-disable consistent-return */

const MOVE_STATE_FAILED_ATTEMPTS = 5;

class LivingEntity extends RoomObject {
	defer(ticks) {
		if (typeof ticks !== "number")
			throw new TypeError("Expected number");
		if (ticks >= Game.time)
			Log.error(`${this.name}/${this.pos} deferring for unusually high ticks!`, 'LivingEntity');
		this.memory.defer = Game.time + ticks;
	}

	isDeferred() {
		return (this.memory.defer || 0) > Game.time;
	}

	/**
	 * Escape a room, either from a nuke or invasion
	 * @todo - Flee hostiles as well
	 * @todo - Blocked rooms
	 */
	runFleeRoom({ room, range = 5 }) {
		// Since we can heal and move, try to heal
		if (this.heal)
			this.heal(this);
		const hostiles = _.filter(this.room.hostiles, Filter.unauthorizedCombatHostile);
		const targets = this.pos.findInRange(hostiles, CREEP_RANGED_ATTACK_RANGE);
		if (targets && targets.length && this.hasActiveBodypart && this.hasActiveBodypart(RANGED_ATTACK)) {
			if (targets.length > 1)
				this.rangedMassAttack();
			else
				this.rangedAttack(targets[0]);
		}
		if (this.fatigue > 0)
			return;
		if (this.carry[RESOURCE_ENERGY] && this instanceof Creep)
			this.drop(RESOURCE_ENERGY);
		Log.debug(`${this.name} fleeing room ${room}`, 'LivingEntity');
		const pos = new RoomPosition(25, 25, room);
		const goals = _.map(hostiles, c => ({ pos: c.pos, range: CREEP_RANGED_ATTACK_RANGE * 2 }));
		goals.unshift({ pos, range: 25 + range });
		const { path, incomplete } = PathFinder.search(this.pos, goals, {
			flee: true,
			plainCost: this.plainSpeed,
			swampCost: this.swampSpeed,
			maxOps: 8000,
			roomCallback: (r) => {
				if (r === this.pos.roomName || !Intel.isHostileRoom(r))
					return LOGISTICS_MATRIX.get(r);
				return false;
			}
		});
		if (!path || path.length <= 0 || incomplete) {
			this.popState(false);
		} else {
			this.move(this.pos.getDirectionTo(path[0]));
		}
	}


	/**
	 * Move to a position and a range
	 * @todo - Double check that exit condition
	 * @todo - Route
	 * @todo - Opts
	 */
	runMoveTo(opts) {
		if (this.heal)
			this.heal(this);
		if (this.fatigue)
			return;
		if (opts.range === undefined)
			opts.range = 1;
		if (opts.ignoreRoads === undefined)
			opts.ignoreRoads = this.plainSpeed === this.roadSpeed;
		// opts.ignoreCreeps = (this.memory.stuck || 0) < 3;
		opts.costCallback = (name, cm) => LOGISTICS_MATRIX.get(name);
		const { pos } = opts;
		const roomPos = new RoomPosition(pos.x, pos.y, pos.roomName);
		if (this.pos == null || this.pos.inRangeTo(roomPos, opts.range) || opts.failed >= MOVE_STATE_FAILED_ATTEMPTS)
			return this.popState();
		const status = this.moveTo(roomPos, opts);
		if (status === ERR_NO_PATH) {
			Log.warn(`${this.name}/${this.pos} aborting pathing attempt to ${roomPos} range ${opts.range}, unable to find path  (ttl: ${this.ticksToLive})`, 'LivingEntity');
			opts.failed = (opts.failed + 1) || 1;
		} else if (status !== OK) {
			Log.warn(`${this.name}/${this.pos} failed to move to ${roomPos} range ${opts.range}, status ${status}`, 'LivingEntity');
		}
	}

	moveToRoom(roomName, enter = true) {
		if (this.pos.roomName === roomName && (!enter || !this.pos.isOnRoomBorder()))
			return ERR_NO_PATH;
		return this.moveTo(new RoomPosition(25, 25, roomName), {
			reusePath: 5,
			range: 23,
			ignoreRoads: this.plainSpeed === this.roadSpeed,
			ignoreCreeps: (this.memory.stuck || 0) < 3,
			costCallback: (name, cm) => LOGISTICS_MATRIX.get(name)
		});
	}

	runMoveToRoom(opts) {
		if (this.moveToRoom(opts.room || opts, opts.enter) === ERR_NO_PATH)
			this.popState();
		if (!opts.evade && !opts.attack)
			return;
		if (!this.room.hostiles || !this.room.hostiles.length)
			return;
		if (opts.evade)
			this.flee(MINIMUM_SAFE_FLEE_DISTANCE);
		else if (opts.attack)
			this.pushState('Combat');
	}

	/** Run away and heal */
	runHealSelf(opts) {
		if (this.hits >= this.hitsMax)
			return this.popState();
		if (this.heal)
			this.heal(this);
		if (this.hasActiveBodypart && this.hasActiveBodypart(HEAL) && this.hitPct > 0.50) {
			// @todo if no towers and no creeps we don't need to flee the room.
			if (this.flee(MINIMUM_SAFE_FLEE_DISTANCE) === ERR_NOT_FOUND)
				return;
			if (opts.hits != null) {
				const diff = this.hits - opts.hits;
				opts.hma = MM_AVG(diff, opts.hma || 0, 3);
				if (opts.hma < 0 || (-diff / this.hitsMax) > 0.10) {
					this.pushState('FleeRoom', { room: this.room.name });
					opts.hma = 0;
				}
				this.log(`hit move avg: ${opts.hma}`, Log.LEVEL_INFO);
			}
			opts.hits = this.hits;
			// Flee was here
			return;
		} else if (this.room.controller && !this.room.controller.my && this.room.controller.owner && Player.status(this.room.controller.owner.username) === PLAYER_HOSTILE) {
			Log.debug(`${this.name}#runHealSelf is fleeing hostile owned room ${this.room.name}`, 'LivingEntity');
			return this.pushState('FleeRoom', { room: this.room.name });
		} else if (this.hitPct < 0.60 && this.room.hostiles && this.room.hostiles.length && _.any(this.room.hostiles, Filter.unauthorizedCombatHostile)) {
			Log.debug(`${this.name}#runHealSelf is fleeing hostile creeps in ${this.room.name}`, 'LivingEntity');
			return this.pushState('FleeRoom', { room: this.room.name });
		}
		if (this.fatigue)
			return;
		// Rather than pushing a state, let's actively adjust for changing targets and current health
		const target = this.getTarget(
			() => _.values(Game.creeps).concat(_.values(Game.structures)),
			(c) => Filter.loadedTower(c) || c.getRole && (c.getRole() === 'healer' || c.getRole() === 'guard') && c.hasActiveBodypart(HEAL),
			(candidates) => {
				const answer = this.pos.findClosestByPathFinder(candidates, (x) => ({
					pos: x.pos, range: (x instanceof StructureTower) ? TOWER_OPTIMAL_RANGE : CREEP_RANGED_HEAL_RANGE
				})).goal;
				Log.debug(`${this.name}#runHealSelf is moving to friendly healer ${answer}`, 'LivingEntity');
				return answer;
			}
		);
		if (!target) {
			// We have a problem.
			Log.debug(`${this.name}#runHealSelf has no target for heal`, 'LivingEntity');
			this.flee(MINIMUM_SAFE_FLEE_DISTANCE);
		} else {
			const range = (target instanceof StructureTower) ? TOWER_OPTIMAL_RANGE : CREEP_RANGED_HEAL_RANGE;
			const status = this.moveTo(target, {
				range,
				plainCost: this.plainSpeed,
				swampCost: this.swampSpeed,
				maxOps: 16000,
				costCallback: (r) => LOGISTICS_MATRIX.get(r)
			});
			if (status !== OK)
				Log.debug(`Moving to target ${target} range ${range}, status ${status}`, 'LivingEntity');
		}
	}

	runUsePortal(opts) {
		const roomName = opts.roomName || opts;
		if (this.pos.hasStructure(STRUCTURE_PORTAL))
			return this.scatter();
		if (this.pos.roomName === roomName)
			return this.popState();
		const portal = this.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_PORTAL && s.destination.roomName === roomName });
		if (!portal)
			return this.popState();
		this.moveTo(portal, { range: 0 });
	}

	transferAny(target) {
		const res = _.findKey(this.carry, amt => amt > 0);
		if (!res)
			return ERR_NOT_ENOUGH_RESOURCES;
		else
			return this.transfer(target, res);
	}

	isCarryingNonEnergyResource() {
		return _.any(this.carry, (amt, key) => amt > 0 && key !== RESOURCE_ENERGY);
	}

	updateStuck() {
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
	}

	runAttackMove(opts) {
		this.runMoveTo(opts);
		if (this.room.hostiles)
			this.pushState('Combat');
	}

	runEvadeMove(opts) {
		if (this.flee(MINIMUM_SAFE_FLEE_DISTANCE) !== OK)
			this.runMoveTo(opts);
	}

	/**
	 * Move between a series of goals. Act accordingly.
	 *
	 * @todo Respond to hostiles
	 * @todo Optional onArrival event
	 */
	runPatrol(opts) {
		this.pushState(opts.mode || 'AttackMove', opts.goals[opts.i]);
		opts.i++;
	}


	/** ex: goto, runMethod(claim), recycle */
	runMethod(opts) {
		const { method, args } = opts;
		if (this[method].apply(this, args) === OK)
			this.popState();
	}

	/**
	 *  Tower drain / Border hop
	 * @todo What to do if hostile towers aren't operational
	 */
	runTowerDrain(opts) {
		const { dest } = opts;
		const room = Game.rooms[dest];
		if (room) {
			const towers = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
			if (!towers || !towers.length || _.all(towers, s => s.energy < TOWER_ENERGY_COST || !s.isActive()))
				return this.popState();
		}
		if (this.hasActiveBodypart(HEAL))
			this.heal(this); // Always heal, for overheal effect
		// If hurt, stop and push heal
		if (this.pos.roomName === dest && !this.pos.isOnRoomBorder()) {
			// Only need to run away if we're in the room with towers.
			this.say('Flee!');
			this.pushState('FleeRoom', { room: dest, range: 2 });
		} else if (this.hits >= this.hitsMax && this.pos.roomName !== dest || this.pos.isOnRoomBorder()) {
			this.say('Push!');
			this.moveToRoom(dest, true);
		}
	}

	wander() {
		return this.move(_.random(0, 8));
	}

	/**
	 * Unload one or more resources to a terminal
	 * pushState('Unload', null); // Unload all
	 * pushState('Unload', {res: RESOURCE_OPS});
	 */
	runUnload(opts) {
		const { terminal } = this.room;
		const res = (opts && opts.res) || opts || _.findKey(this.carry);
		if (terminal && this.pos.isNearTo(terminal)) {
			if (!res || this.carry[res] == null || this.carry[res] === 0)
				return this.popState();
			this.transfer(terminal, res);
		} else {
			// Find the closest terminal and move to it
			const { goal } = this.pos.getClosest(Game.structures, { structureType: STRUCTURE_TERMINAL });
			if (goal)
				return this.pushState('MoveTo', { pos: goal.pos, range: 1 });
			else {
				Log.error(`${this.name}/${this.pos} Nowhere to unload ${this.carry[res]} ${res}`, 'LivingCreep');
				return this.popState(false);
			}
		}
	}

	/**
	 * Load a given resource from a terminal or structure
	 */
	runWithdraw(opts) {
		const target = Game.getObjectById(opts.tid);
		const res = opts.res || RESOURCE_ENERGY;
		const amount = opts.amount || Math.min(target.store[res], this.carryCapacityAvailable);
		if (amount <= 0)
			return this.popState(true);
		if (!this.pos.isNearTo(target))
			return this.pushState('MoveTo', { pos: target.pos, range: 1 });
		this.withdraw(target, res, amount);
		this.popState(false);
	}

	runWithdrawAll(opts) {
		const target = Game.getObjectById(opts.target);
		if (!target || this.carryCapacityAvailable <= 0)
			return this.popState(true);
		if (!opts.avoid)
			opts.avoid = [];
		const res = target.mineralType || _.findKey(target.store, (v, k) => v > 0 && !opts.avoid.includes(k)) || (target.power > 0 && RESOURCE_POWER) || RESOURCE_ENERGY;
		const amt = Math.min(this.carryCapacityAvailable, target.mineralAmount || target.power || (target.store && target.store[res]));
		if (amt <= 0)
			return this.popState(true);
		const status = this.withdraw(target, res, amt);
		if (status === ERR_NOT_IN_RANGE)
			return this.pushState('EvadeMove', { pos: target.pos, range: CREEP_WITHDRAW_RANGE });
	}

	/**
	 * General state for finding energy.
	 *
	 * If we're not allowed to move, only look for adjacent providers.
	 */
	runAcquireEnergy(opts = {}) {
		const { allowMove = false, allowHarvest = true } = opts;
		if (this.carryCapacityAvailable <= 0)
			return this.popState();
		if (this.hits < this.hitsMax)
			this.pushState('HealSelf');	// We can let it continue this tick.
		let target, status;
		if (allowMove) {
			target = this.getTarget(
				({ room }) => [...room.structures, ...room.resources, ...room.tombstones],
				(c) => Filter.canProvideEnergy(c) && (!opts.ignoreControllerContainer || c !== c.room.controller.container),
				(c) => this.pos.findClosestByPath(c)
			);
		} else {
			target = this.getTarget(
				({ room }) => {
					const resources = _.map(this.lookForNear(LOOK_RESOURCES), LOOK_RESOURCES);
					const structures = _.map(this.lookForNear(LOOK_STRUCTURES), LOOK_STRUCTURES);
					const tombstones = _.map(this.lookForNear(LOOK_TOMBSTONES), LOOK_TOMBSTONES);
					return [...resources, ...structures, ...tombstones];
				},
				(c) => Filter.canProvideEnergy(c),
				(c) => this.pos.findClosestByPath(c)
			);
		}
		if (!target && allowHarvest && this.hasBodypart && this.hasBodypart(WORK))
			return this.setState('HarvestEnergy', { allowMove });
		else if (target instanceof Resource)
			status = this.pickup(target);
		else
			status = this.withdraw(target, RESOURCE_ENERGY);
		if (status === ERR_NOT_IN_RANGE && allowMove)
			this.moveTo(target, { range: 1, maxRooms: 1, ignoreRoads: this.memory.ignoreRoad || true });
	}

	// Allow terminal, allow multiroom
	runAcquireResource(opts) {
		// May use terminal for purchase
		if (opts.amount == null)
			opts.amount = Infinity;
		if (this.carryCapacityAvailable <= 0 || opts.amount <= 0)
			return this.popState();
		const demand = opts.amount - (this.carry[opts.res] || 0);
		if (demand <= 0)
			return this.popState();
		if (this.hits < this.hitsMax)
			return this.pushState('HealSelf');	// We can let it continue this tick.
		// if (opts.res === RESOURCE_ENERGY)
		//	return this.setState('AcquireEnergy');
		// If it's not energy it's probably in the terminal
		const { terminal } = this.room;
		if (!terminal) {
			// Find a room with the closest terminal and move there
			Log.warn(`${this.name}/${this.pos} unable to find terminal in current room for ${demand} ${opts.res}`, 'LivingEntity');
		}

		if (terminal.store[opts.res] >= demand)
			return this.pushState('Withdraw', { res: opts.res, amount: demand, tid: terminal.id });
		// We're short! Import before buying
		if (terminal.import(opts.res, demand, 'AcquireResource resolution') === OK)
			return true; // Next tick we'll know if we succeeded.
		if (!terminal.cooldown)
			terminal.buyUpTo(opts.res, demand + 1);
		this.moveTo(terminal, { range: 1 });
	}
}

DEFINE_CACHED_GETTER(LivingEntity.prototype, 'age', (c) => Game.time - c.memory.born);
DEFINE_CACHED_GETTER(LivingEntity.prototype, 'carryTotal', (c) => _.sum(c.carry));
DEFINE_CACHED_GETTER(LivingEntity.prototype, 'carryCapacityAvailable', (c) => c.carryCapacity - c.carryTotal);
DEFINE_GETTER(LivingEntity.prototype, 'hitPct', c => c.hits / c.hitsMax); // Not cached as this can change mid-tick
DEFINE_CACHED_GETTER(LivingEntity.prototype, 'ttlPct', (c) => c.ticksToLive / c.ticksToLiveMax);
DEFINE_CACHED_GETTER(LivingEntity.prototype, 'isFriendly', (c) => (c.my === true) || Player.status(c.owner.username) >= PLAYER_TRUSTED);


Creep.prototype.__proto__ = LivingEntity.prototype;
PowerCreep.prototype.__proto__ = LivingEntity.prototype;
global.LivingEntity = LivingEntity;