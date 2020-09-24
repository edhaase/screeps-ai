/**
 * role.dualminer.js
 *
 * Handles multiple Sources
 */
'use strict';

const DUALMINER_MINIMUM_SOURCES = 2;
const DUALMINER_MINIMUM_TRANSFER_AMOUNT = 25;

import { RLD } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';

export default {
	want: function (census) {
		return (census.room.sources.length === DUALMINER_MINIMUM_SOURCES && census.controller.level >= 6) ? 1 : 0;
	},
	body: function ({ totalCapacity, steps }) {
		const workParts = Math.ceil(totalCapacity / HARVEST_POWER / (ENERGY_REGEN_TIME - steps)) + 1; // +2 margin of error
		Log.info(`Dual mining op has ${totalCapacity} effective capacity`, 'Creep');
		Log.info(`Dual mining op wants ${workParts} harvest parts`, 'Creep');
		const moveParts = Math.ceil((1 + workParts) / 2);
		const size = workParts + 1 + moveParts;
		if (size > MAX_CREEP_SIZE) {
			Log.warn('Body of dualminer would exceed creep size limit', 'Controller');
			return null;
		}
		return RLD([workParts, WORK, 1, CARRY, moveParts, MOVE]);
	},
	init: function () {
		this.memory.repairPower = this.getActiveBodyparts(WORK) * REPAIR_POWER;
	},
	/* eslint-disable consistent-return */
	run: function () {
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
		if (!this.pos.inRangeTo(goal, range)) {
			// Get off my container
			if (range === 0) {
				const obstacle = goal.pos.getCreep();
				if (obstacle) obstacle.scatter();
			}
			this.moveTo(goal, {
				ignoreCreeps: (this.memory.stuck || 0) < 3,
				reusePath: 20,
				range: range
			});
		} else if (target.energy <= 0 && target.ticksToRegeneration > 1) {
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
					range: range,
					allowIncomplete: true
				});
				break;
			case OK:
				break;
			default:
				this.say(status);
		}

		// Find stuff in range to fill up
		if (this.ticksToLive & 1 || this.carryCapacityAvailable > 0)
			return;

		if (!this.memory.repairPower)
			this.memory.repairPower = this.getActiveBodyparts(WORK) * REPAIR_POWER;
		if ((goal instanceof StructureContainer) && ((goal.hitsMax - goal.hits) > this.memory.repairPower))
			return this.repair(goal);

		const transferTarget = this.getTarget(
			() => _.map(this.lookForNear(LOOK_STRUCTURES, true, 1), 'structure'),
			(t) => t.energyCapacity - t.energy >= DUALMINER_MINIMUM_TRANSFER_AMOUNT && this.pos.isNearTo(t),
			(candidates) => _.min(candidates, 'energy'),
			'ttid'
		);
		if (transferTarget)
			this.transfer(transferTarget, RESOURCE_ENERGY);
	}
};