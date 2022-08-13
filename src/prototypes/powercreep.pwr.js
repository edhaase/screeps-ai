/**
 * ext/powercreep-pwr.js - Some of the actual powers
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

import { TERMINAL_RESOURCE_LIMIT } from '/prototypes/structure/terminal';
import { ICON_MAP } from '/lib/icons';

/* global PowerCreep, DEFINE_CACHED_GETTER, DEFINE_GETTER, POWER_INFO */
/* global PWR_GENERATE_OPS, POWER_CREEP_LIFE_TIME */

/* eslint-disable consistent-return */

/**
 * Stack state for creating ops - Used for stockpiling or problem solving
 */
PowerCreep.prototype[`runPwr${PWR_GENERATE_OPS}`] = function (opts) {
	this.flee();
	// Generate a specific amount of opts
	// Possibly unload or overflow
	// Only actually generates once every 50 ticks so we might want to do other stuff
	const { level, cooldown } = this.powers[PWR_GENERATE_OPS];
	const { effect } = POWER_INFO[PWR_GENERATE_OPS];

	if (cooldown || (this.carry[RESOURCE_OPS] + (this.room.terminal && this.room.terminal.store[RESOURCE_OPS]) >= TERMINAL_RESOURCE_LIMIT)) {
		// We have a wait period, so.. let's do something else.
		if (this.carryCapacityAvailable < effect[level])
			return this.pushState('Unload', { res: RESOURCE_OPS });
		return this.doIdle();
	}
	const status = this.usePower(PWR_GENERATE_OPS);
	if (status === OK) {
		if (opts.amount == null)
			return;
		opts.amount -= effect[level]; // Why null?			
		if (opts.amount <= 0)
			this.popState(false);
	} else if (status === ERR_INVALID_ARGS) { // PWR not enabled
		// Controller must exist and hostile safe mode or not power enabled
		const { controller } = this.room;
		if (!this.isPowerDisabled(this.room.name) && controller.canEnablePower(this.pos.getRangeTo(controller)))
			return this.pushState('EnableRoom', this.room.controller.pos);
		else
			return this.pushState('FleeRoom', { room: this.room.name });
		// @todo go to highway or nearest power enabled neutral room

	}
};

// const EXT_FILL_TYPES = [STRUCTURE_STORAGE, STRUCTURE_TERMINAL];
const EXT_FILL_TYPES = [STRUCTURE_STORAGE];
PowerCreep.prototype[`runPwr${PWR_OPERATE_EXTENSION}`] = function (opts) {
	const { level, cooldown } = this.powers[PWR_OPERATE_EXTENSION];
	const { room } = this;
	const effect = POWER_INFO[PWR_OPERATE_EXTENSION].effect[level - 1];		// Percent we can fill per level
	const roomLevel = room.controller.level;
	const capacity = EXTENSION_ENERGY_CAPACITY[roomLevel];					// Extension size	

	/**
	 * Check if we can fill extensions. We want a minimum effect so as to not waste the
	 * ops and cooldown.
	 */
	const extensions = this.room.structuresByType[STRUCTURE_EXTENSION] || [];
	const empty = _.sum(extensions, e => e.store[RESOURCE_ENERGY] <= 0);
	const availableToFill = empty / extensions.length;
	if (availableToFill / effect < 0.85 && !opts.force) { // 85% of intended effect
		Log.warn(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION not enough extensions to fill, don't want to waste the energy`, 'PowerCreep');
		return this.popState(false);
	} if (cooldown)
		return this.doIdle();
	const limit = capacity * extensions.length * Math.min(availableToFill, effect);

	/**
	 * Awesome, we can fill the extensions. Now find a candidate that hopefully as enough energy.
	 * Must be a storage, terminal, factory, or container
	 */
	const target = this.getTarget(
		() => room.structures,
		(candidate) => candidate.store && candidate.store[RESOURCE_ENERGY] >= limit && EXT_FILL_TYPES.includes(candidate.structureType) && !candidate.hasEffect(PWR_DISRUPT_TERMINAL),
		(candidates) => this.pos.findClosestByPath(candidates)
	);
	if (!target) {
		Log.warn(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION No target with ${limit} energy available`, 'PowerCreep');
		return this.popState(false);
	}
	Log.info(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION Wants to fill up to ${limit} with ${target} with ${target.store[RESOURCE_ENERGY]} energy available`, 'PowerCreep');
	const status = this.usePowerSmart(PWR_OPERATE_EXTENSION, target); // Handles movement and ops acquisition
	if (status === OK)
		this.popState(false);
	else
		Log.warn(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION failed with status ${status}`, 'PowerCreep');
};

const MAX_ALERT = 25;
PowerCreep.prototype[`runPwr${PWR_OPERATE_TOWER}`] = function (opts) {
	if (!this.isSpawned())
		return this.popState(true);
	// Because of the large cooldown we can keep doing this
	if (this.hasPower(PWR_GENERATE_OPS) && !this.powers[PWR_GENERATE_OPS].cooldown)
		return this.usePowerSmart(PWR_GENERATE_OPS);
	if (opts.alert == null)
		opts.alert = MAX_ALERT;
	if (opts.alert <= 0)
		return this.popState();
	const { hostiles } = this.room;
	if (!hostiles || !hostiles.length) {
		opts.alert--;
		return this.doIdle();
	}
	opts.alert = MAX_ALERT;

	// We have hostiles. Boost the towers!
	const { cooldown } = this.powers[PWR_OPERATE_TOWER];
	if (cooldown)
		return; // Cooldown is short, no idle time
	const { duration, range, ops } = POWER_INFO[PWR_OPERATE_TOWER];
	const target = this.pos.findClosestByPath(this.room.structuresByType[STRUCTURE_TOWER], { filter: s => !s.hasEffect(PWR_OPERATE_TOWER) && s.energy >= TOWER_ENERGY_COST && s.isActive() });
	if (!target)
		return;
	this.usePowerSmart(PWR_OPERATE_TOWER, target);
	target.clearDefer();
};

PowerCreep.prototype[`runPwr${PWR_OPERATE_OBSERVER}`] = function (opts) {
	const { range } = POWER_INFO[PWR_OPERATE_OBSERVER];
	if (!this.isSpawned())
		return this.popState(true);
	const observer = this.pos.findClosestStructureType(STRUCTURE_OBSERVER, range, s => !s.hasEffect(PWR_OPERATE_OBSERVER) && s.isActive());
	if (!observer)
		return this.popState(false);
	const status = this.usePowerSmart(PWR_OPERATE_OBSERVER, observer);
	if (status === OK) {
		this.say(ICON_MAP, true);
		return this.popState(true);
	}
};

PowerCreep.prototype[`runPwr${PWR_OPERATE_SPAWN}`] = function (opts) {
	const spawn = this.pos.findClosestByRange(FIND_MY_SPAWNS, { filter: s => !s.hasEffect(PWR_OPERATE_SPAWN) });
	if (!spawn)
		return this.popState(false);
	const status = this.usePowerSmart(PWR_OPERATE_SPAWN, spawn);
	if (status === OK)
		return this.popState(true);
};

/**
 * This one is actually pretty much free.
 */
PowerCreep.prototype[`runPwr${PWR_REGEN_SOURCE}`] = function (opts) {
	// @todo start moving before power has fully recharged
	const source = this.pos.findClosestByRange(FIND_SOURCES, { filter: s => !s.hasEffect(PWR_REGEN_SOURCE, e => e.ticksRemaining > 30) });
	if (!source)
		return this.popState(false);
	const status = this.usePowerSmart(PWR_REGEN_SOURCE, source);
	if (status === OK)
		return this.popState(false);
};

/**
 * Autowire safety checks
 */
for (const pwr in POWER_INFO) {
	const orig = PowerCreep.prototype[`runPwr${pwr}`];
	PowerCreep.prototype[`runPwr${pwr}`] = function () {
		if (!this.isSpawned()) {
			Log.error(`${this.name} Unable to use power ${pwr}, not currently spawned`, 'PowerCreep');
			return this.popState(false);
		}

		if (!this.hasPower(pwr)) {
			Log.error(`${this.name}/${this.pos} Incorrectly attempting to use power ${pwr} but does not have it`, 'PowerCreep');
			return this.popState(false);
		}
		return orig.apply(this, arguments);
	};
}