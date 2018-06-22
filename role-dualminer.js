/**
 * role-dualminer.js
 *
 * Handles multiple Sources
 */
'use strict';

const MINIMUM_SOURCES_FOR_DUALMINER = 2;

module.exports = {
	want: function (census) {
		return (census.room.sources.length === MINIMUM_SOURCES_FOR_DUALMINER && census.controller.level >= 6) ? 1 : 0;
	},
	body: function ({ totalCapacity, steps }) {
		const size = Math.ceil(totalCapacity / HARVEST_POWER / (ENERGY_REGEN_TIME - steps)) + 1; // +2 margin of error
		Log.info(`Dual mining op has ${totalCapacity} total capacity`, 'Controller');
		Log.info(`Dual mining op wants ${size} harvest parts`, 'Controller');

		const body = Util.RLD([size, WORK, 1, CARRY, Math.ceil((1 + size) / 2), MOVE]);
		if (body.length > MAX_CREEP_SIZE) {
			Log.warn('Body of this would be too big to build', 'Controller');
			return null;
		}
		// Expense checks are part of spawn job submission
		return body;
	},
	init: function () {
		this.memory.repairPower = this.getActiveBodyparts(WORK) * REPAIR_POWER;
	},
	/* eslint-disable consistent-return */
	run: function () {
		let { site } = this.memory;

		if (!site || typeof site !== 'string') {
			this.memory.site = this.pos.roomName;
			site = this.pos.roomName;
		}

		if (this.hitPct < 0.75)
			return this.pushState('HealSelf');

		// If we're not in the room, move to the room.
		if (this.pos.roomName !== site)
			return this.moveToRoom(site);

		// Otherwise find ourselves a target.
		let target = this.getTarget(
			({ room }) => room.find(FIND_SOURCES),
			(source) => source instanceof Source && source.energy > 0,
			(candidates) => this.pos.findClosestByRange(candidates)
		);
		if (!target) {
			target = this.getTarget(
				({ room }) => room.find(FIND_SOURCES),
				(source) => source instanceof Source,
				(candidates) => _.min(candidates, 'ticksToRegeneration')
			);
		}
		if (!target)
			return this.defer(5);

		const goal = target.container || target;
		const range = (goal instanceof StructureContainer) ? 0 : 1;
		if (!this.pos.inRangeTo(goal, range))
			this.moveTo(goal, {
				ignoreCreeps: (this.memory.stuck || 0) < 3,
				reusePath: 20,
				range: range
			});
		else if (target.energy <= 0 && target.ticksToRegeneration > 1) {
			// if(target && this.pos.isNearTo(target.pos) && target.energy <= 0 && target.ticksToRegeneration > 1)
			return this.defer(target.ticksToRegeneration);
		}
		// Harvest the target.
		const status = this.harvest(target);
		switch (status) {
			case ERR_NOT_ENOUGH_RESOURCES: // On return trip
			case ERR_NOT_IN_RANGE:
				this.moveTo(goal, {
					ignoreCreeps: (this.memory.stuck || 0) < 3,
					reusePath: 20,
					range: range
				});
				break;
			case OK:
				break;
			case ERR_INVALID_TARGET:
				console.log('Dual-miner, Invalid target: ' + ex(target));
				this.defer(5);
				break;
			default:
				this.say(status);
		}

		// Find stuff in range to fill up
		if (this.ticksToLive & 1 || this.carryCapacityAvailable > 0)
			return;

		if (!this.memory.repairPower)
			module.exports.init(this);
		if ((goal instanceof StructureContainer) && ((goal.hitsMax - goal.hits) > this.memory.repairPower))
			return this.repair(goal);

		const transferTarget = this.getTarget(
			() => _.map(this.lookForNear(LOOK_STRUCTURES, true, 1), 'structure'),
			({ energy, energyCapacity }) => energyCapacity - energy >= 25,
			(candidates) => _.min(candidates, 'energy'),
			'ttid'
		);
		if (transferTarget)
			this.transfer(transferTarget, RESOURCE_ENERGY);
	}
};