/**
 * ext/structure.powerspawn.js - Energy sink
 *
 * Throttled to once every 4th tick to prevent overloading the economy.
 * works out to like 5k power and 250k energy a day versus 20k/1m.
 * should also save a little cpu.
 * 
 * Bucket limiter check disabled, no real logic to run in it's test, the intent cpu isn't my biggest problem.
 */
'use strict';

import { RLD } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';

/* global DEFAULT_SPAWN_JOB_PRIORITY */

StructurePowerSpawn.prototype.run = function () {
	if (!this.room.my)
		return;
	if (Game.time % (CREEP_LIFE_TIME + 200) === 0 && !this.power)
		this.runReload();
	// Not needed, this meets the special case of `checkStructureAgainstController`.
	if ((Game.time & 3) === 0)
		this.processPower();
};

// @todo Size to power spawn available capacity.
// @todo Put in transfer request instead of spawning creep.
const MINIMUM_STOCK_FOR_POWER_PROCCESSING = 0.50;
StructurePowerSpawn.prototype.runReload = function () {
	const { terminal, storage } = this.room;
	const energyStock = _.get(this.room, ['storage', 'stock'], 0);
	const storedPower = _.get(this.room, ['terminal', 'store', RESOURCE_POWER], 0);
	if (!terminal || energyStock < MINIMUM_STOCK_FOR_POWER_PROCCESSING || storedPower <= 0)
		return;
	const [spawn] = this.getClosestSpawn();
	const amt = Math.min(storedPower, this.powerCapacity - this.power);
	const carry = Math.ceil(amt / CARRY_CAPACITY);
	const move = carry / 2;
	const body = RLD([carry, CARRY, move, MOVE]);
	const memory = { role: 'filler', src: terminal.id, dest: this.id, res: RESOURCE_POWER, amt: amt };
	spawn.submit({ body, memory, priority: PRIORITY_MIN });
	Log.info(`Power spawn requesting filler with ${carry} carry and ${move} move at ${this.pos.roomName}`, 'PowerSpawn');
};

/**
 * Track amount of power processed per powerspawn.
 */
const { processPower } = StructurePowerSpawn.prototype;
StructurePowerSpawn.prototype.processPower = function () {
	const status = processPower.apply(this, arguments);
	if (status === OK) {
		if (this.memory.power == null)
			this.memory.power = 0;
		this.memory.power += 1;
	}
	return status;
};