/**
 * ext.powercreep.js - About damn time
 * 
 * Prefer fleeing through swamps
 * Renew if neccesary before long-running operations
 * Maybe park somewhere out of the way
 */
'use strict';

/* global PowerCreep, DEFINE_CACHED_GETTER, DEFINE_GETTER, POWER_INFO */
/* global PWR_GENERATE_OPS, POWER_CREEP_LIFE_TIME */

/* eslint-disable consistent-return */

const ON_ERROR_SLEEP_DELAY = 3;

PowerCreep.prototype.plainSpeed = 1;
PowerCreep.prototype.swampSpeed = 1; // Allows us to swamp travel automatically
PowerCreep.prototype.roadSpeed = 1;
PowerCreep.prototype.ticksToLiveMax = POWER_CREEP_LIFE_TIME;

/**
 * You know the drill by now.
 */
PowerCreep.prototype.run = function () {
	try {
		if (this.isDeferred())
			return;
		if (this.pos)
			this.updateStuck();
		if (this.invokeState() === true)
			return;
		if (!this.isSpawned()) // Should we spawn? Sure, why not.
			return this.pushState('SpawnSelf');
		if (this.shard && this.shard.name !== Game.shard.name)
			return;
		return this.doIdle();
		// Check if power is enabled in room before gen-ops
		// If idle renew somewhat frequently
		// If idle and has power gen ops, then gen ops
	} catch (e) {
		Log.error(`Exception on PowerCreep ${this.name} at ${this.pos}: ${e}`, "PowerCreep");
		Log.error(e.stack, "PowerCreep");
		this.say("HELP");
		this.defer(ON_ERROR_SLEEP_DELAY); // Needs moved to RoomObject
	}
};

/**
 * Called when a power creep is idle, might still be in the middle of a state.
 */
const PC_MIN_RENEW_PCT = 0.60;
const PC_GEN_OPS_CHANCE = 0.05;
PowerCreep.prototype.doIdle = function () {
	this.flee();

	// @todo Check if we need healing and aren't healing.
	if (Math.random() > this.ticksToLive / (POWER_CREEP_LIFE_TIME * PC_MIN_RENEW_PCT)) {
		return this.pushState('RenewSelf');
	}

	if (this.hasPower(PWR_OPERATE_TOWER) && this.room.hostiles && this.room.hostiles.length)
		return this.pushStateOnce(`Pwr${PWR_OPERATE_TOWER}`);

	if (this.hasPower(PWR_GENERATE_OPS) && Math.random() < PC_GEN_OPS_CHANCE)
		return this.pushStateOnce(`Pwr${PWR_GENERATE_OPS}`, { amount: 1 });

	// if (Math.random() > this.hitPct) // Heal
};

PowerCreep.prototype.isSpawned = function () {
	return !!(this.ticksToLive !== undefined && !isNaN(this.ticksToLive));
};

/**
 * Spawn at random power spawn
 */
PowerCreep.prototype.spawnRandom = function () {
	const powerSpawns = _.filter(Game.structures, 'structureType', STRUCTURE_POWER_SPAWN);
	const powerSpawn = _.sample(powerSpawns);
	if (!powerSpawn)
		return ERR_NOT_FOUND;
	const [blocker] = powerSpawn.pos.lookFor(LOOK_POWER_CREEPS, true) || [];
	if (blocker)
		blocker.move(_.random(TOP, TOP_LEFT)); // All directionss. Don't ask.
	const status = this.spawn(powerSpawn);
	if (status === ERR_BUSY || status === ERR_INVALID_TARGET)
		Log.error(`${this.name}#spawn failed with status ${status}`, 'PowerCreep');
	if (status === OK)
		this.memory.born = Game.time;
	return status;
};

/**
 * Bring yourself into world somewhere 
 */
PowerCreep.prototype.runSpawnSelf = function (opts) {
	if (!this.spawnCooldownTime && this.spawnRandom() === OK)
		return this.popState(false);
};

PowerCreep.prototype.isPowerDisabled = function (room) {
	if (!Memory.empire.disablePower)
		return false;
	return Memory.empire.disablePower.includes(room);
};

/**
 * Get the ops we need to use our abilities
 */
PowerCreep.prototype.runAcquireOps = function (opts) {
	// {opts allowPurchase, allowTerminal, allowGen}
	// Find store of ops or possibly push generate ops
	// Optionally use terminal to request or purchase
	// if (this.hasPower(PWR_GENERATE_OPS) - required to push gen ops
	const need = Math.max(0, opts.amount - (this.carry[RESOURCE_OPS] || 0));
	if (need <= 0)
		return this.popState(true);
	console.log(`need: ${need} ${opts.amount} ${this.carry[RESOURCE_OPS]}`);
	if (opts.allowTerm) {
		const terminal = this.room.terminal || this.pos.getClosest(Game.structures, { structureType: STRUCTURE_TERMINAL }).goal;
		if (terminal && terminal.store[RESOURCE_OPS] > 0) {
			const amount = Math.min(terminal.store[RESOURCE_OPS] || 0, need);
			return this.pushState('Withdraw', { tid: terminal.id, res: RESOURCE_OPS, amount });
		}
		if (opts.allowRequest && terminal.import(RESOURCE_OPS, Math.max(TERMINAL_MIN_SEND, need)) === ERR_BUSY)
			return; // Busy so we wait and try again later
	}
	if (opts.allowGen && this.hasPower(PWR_GENERATE_OPS)) {
		return this.pushState('GenOps', { amount: need });
	}
	Log.error(`${this.name}/${this.pos}#AcquireOps (${this.carry[RESOURCE_OPS] || 0} / ${opts.amount}) Unable to meet goal within parameters (needs ${need})`, 'PowerCreep');
	this.popState(false);
};

/**
 * Seek out a powerspawn to renew ourself
 */
PowerCreep.prototype.runRenewSelf = function (opts) {
	// Find powerspawn or powerbank and renew, pop

	// todo: FCBP if we're already in range stop early?
	// todo: check for target or assign local position

	let target = this.pos.getStructure(STRUCTURE_POWER_SPAWN, 0);
	if (!target) {
		target = this.getTarget(
			() => Game.structures,
			(s) => s instanceof StructurePowerSpawn || s instanceof StructurePowerBank,
			candidates => this.pos.findClosestByPathFinder(candidates, ({ pos }) => ({ pos, range: 1 })).goal
		);
	}

	const status = this.renew(target);
	if (status === OK)
		return this.popState(false); // Don't run next state
	else if (status === ERR_NOT_IN_RANGE)
		return this.moveTo(target, { range: 1 }); // Don't push state, we want to know if target changes
};

/**
 * Enable power on a room
 */
PowerCreep.prototype.runEnableRoom = function (opts) {
	if (this.isPowerDisabled(opts.roomName)) {
		Log.error(`${this.name}/${this.pos} Power is explictly disabled for ${opts.roomName}`, 'PowerCreep');
		return this.popState(false);
	}
	const pos = new RoomPosition(opts.x, opts.y, opts.roomName);
	if (!this.pos.isNearTo(pos))
		return this.moveTo(pos, { range: 1 });
	// return this.pushState('MoveTo', {})
	this.enableRoom(this.room.controller);
	this.popState(false);
};

/**
 * Find a nighboring room to use
 */
PowerCreep.prototype.runLeaveRoom = function (opts) {
	const exits = Game.map.describeExits(this.room.name);
	const candidates = _.reject(exits, r => Intel.isHostileRoom(r));
	if (candidates && candidates.length)
		return this.setState('MoveToRoom', _.sample(candidates));
	if (opts.urgent)
		return this.setState('MoveToRoom', _.sample(exits));
	Log.error(`${this.name}/${this.pos} Unable to leave room, nowhere safe to go`, 'PowerCreep');
	this.popState();
};

/**
 * 
 */
PowerCreep.prototype.hasPower = function (power) {
	return !!(this.powers[power]);
};

/**
 * Use a power, but automatically solve problems that might occur
 */
PowerCreep.prototype.usePowerSmart = function (power, target) {
	const status = this.usePower.apply(this, arguments);
	if (status === OK)
		return status;
	const { ops, range } = POWER_INFO[power];
	if (status === ERR_NOT_ENOUGH_RESOURCES) {
		Log.warn(`${this.name}/${this.pos}#usePowerSmart Missing resource, acquiring`, 'PowerCreep');
		if (ops)
			return this.pushState('AcquireOps', { amount: ops, allowGen: this.hasPower(PWR_GENERATE_OPS), allowTerm: true, allowRequest: true });
	} else if (status === ERR_NOT_IN_RANGE) {
		return this.pushState('MoveTo', { pos: target.pos || target, range });
	}
	return status;
};

/**
 * Flee from stuff
 */
const DEFAULT_FLEE_PLAN_AHEAD = 5;
const DEFAULT_FLEE_OPTS = { maxRooms: 3, maxOps: 2500, flee: true, planAhead: DEFAULT_FLEE_PLAN_AHEAD, heuristicWeight: 0.8 };
PowerCreep.prototype.flee = function (min = MINIMUM_SAFE_FLEE_DISTANCE, opts = {}) {
	if (!min || typeof min !== "number" || min <= 1)
		throw new TypeError(`Unacceptable minimum distance: ${min}, must be postive integer greater than 1`);

	const hostiles = this.pos.findInRange(this.room.hostiles, min - 1, { filter: Filter.unauthorizedCombatHostile });
	if (hostiles == null || hostiles.length <= 0)
		return ERR_NOT_FOUND;

	_.defaults(opts, DEFAULT_FLEE_OPTS);
	const goals = _.map(hostiles, c => ({ pos: c.pos, range: min + opts.planAhead }));
	if (opts.swampCost == null || opts.plainCost == null) {
		opts.plainCost = 10;
		opts.swampCost = 1;
	}
	if (opts.roomCallback == null)
		opts.roomCallback = (r) => {
			if (Intel.isHostileRoom(r))
				return false;
			return LOGISTICS_MATRIX.get(r);
		};
	const { path, ops, cost, incomplete } = PathFinder.search(this.pos, goals, opts);
	if (!path || path.length <= 0) {
		this.say("EEK!");
		return ERR_NO_PATH;
	}
	this.room.visual.poly(path);
	return this.move(this.pos.getDirectionTo(path[0]));
};

['rename', 'renew', 'suicide', 'transfer', 'usePower', 'upgrade', 'withdraw'].forEach(function (method) {
	const original = PowerCreep.prototype[method];
	PowerCreep.prototype[method] = function () {
		const status = original.apply(this, arguments);
		if (typeof status === 'number' && status < 0 && status !== ERR_NOT_IN_RANGE) {
			Log.error(`${this.name}/${this.pos}#${method} failed with status ${status} (args ${JSON.stringify(arguments)})`, 'PowerCreep');
		}
		return status;
	};
});

