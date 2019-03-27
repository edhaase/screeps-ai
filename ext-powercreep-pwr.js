/**
 * ext-powercreep-pwr.js - Some of the actual powers
 */
'use strict';

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

const MAX_OPERATE_EXT_FILL = 0.90;
PowerCreep.prototype[`runPwr${PWR_OPERATE_EXTENSION}`] = function (opts) {
	const { level, cooldown } = this.powers[PWR_OPERATE_EXTENSION];
	const { room } = this;
	const roomLevel = this.room.controller.level;
	if ((room.energyAvailable / (room.energyCapacityAvailable - SPAWN_ENERGY_CAPACITY * CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][roomLevel])) > MAX_OPERATE_EXT_FILL)
		return this.popState();
	if (cooldown)
		return this.doIdle();
	const { effect } = POWER_INFO[PWR_OPERATE_EXTENSION]; // Percent we can fill
	const capacity = EXTENSION_ENERGY_CAPACITY[roomLevel];					// Extension size
	const numExt = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][roomLevel];	// Number of extensions
	const maxExtToFill = numExt * effect[level];							// Max we can actually fill
	const maxEnergyFillable = maxExtToFill * capacity;						// Max energy we can refil with this power
	const maxFillAvailable = Math.min(room.energyCapacityAvailable - room.energyAvailable, maxEnergyFillable);

	Log.debug(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION Wants to fill up to ${maxFillAvailable} (capable of ${maxEnergyFillable})`, 'PowerCreep');

	const { storage, terminal } = room;
	if (!storage && !terminal) {
		Log.warn(`${this.name}/${this.pos}#PWR_OPERATE_EXTENSION No container to use`, 'PowerCreep');
		return this.popState();
	}
	const target = _.max([storage, terminal], t => t && (Math.min(t.store[RESOURCE_ENERGY], maxFillAvailable) / this.pos.getRangeTo(t)));
	const status = this.usePowerSmart(PWR_OPERATE_EXTENSION, target); // Handles movement and ops acquisition
	if (status === OK && opts.once)
		this.popState(false);
};

PowerCreep.prototype[`runPwr${PWR_OPERATE_SPAWN}`] = function (opts) {

};

const MAX_ALERT = 100;
PowerCreep.prototype[`runPwr${PWR_OPERATE_TOWER}`] = function (opts) {
	// Because of the large cooldown we can keep doing this
	if (this.hasPower(PWR_GENERATE_OPS) && !this.powers[PWR_GENERATE_OPS].cooldown)
		return this.usePower(PWR_GENERATE_OPS);
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
	const target = this.pos.findClosestByPath(this.room.structuresByType[STRUCTURE_TOWER], { filter: s => _.isEmpty(s.effects) });
	if (!target)
		return;
	this.usePowerSmart(PWR_OPERATE_TOWER, target);
	target.clearDefer();
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