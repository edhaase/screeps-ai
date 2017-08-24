/**
 * role-dualminer.js
 * Handles multiple Sources
 */
"use strict";

module.exports = {
	init: function (creep) {
		creep.memory.repairPower = creep.getActiveBodyparts(WORK) * REPAIR_POWER;
	},
	/**
	 *
	 */
	run: function (creep) {
		let { site } = creep.memory;

		if (!site || typeof site !== 'string') {
			creep.memory.site = creep.pos.roomName;
			site = creep.pos.roomName;
		}

		// If we're not in the room, move to the room.
		if (creep.pos.roomName !== site)
			return creep.moveToRoom(site);

		// Otherwise find ourselves a target.
		let target = creep.getTarget(
			({ room }) => room.find(FIND_SOURCES),
			(source) => source instanceof Source && source.energy > 0,
			(candidates) => creep.pos.findClosestByRange(candidates)
		);
		if (!target) {
			target = creep.getTarget(
				({ room }) => room.find(FIND_SOURCES),
				(source) => source instanceof Source,
				(candidates) => _.min(candidates, 'ticksToRegeneration')
			);
		}
		if (!target)
			return this.defer(5);

		const goal = target.container || target;
		const range = (goal instanceof StructureContainer) ? 0 : 1;
		if (!creep.pos.inRangeTo(goal, range))
			creep.moveTo(goal, {
				ignoreCreeps: (creep.memory.stuck || 0) < 3,
				reusePath: 20,
				range: range
			});
		else if (target.energy <= 0 && target.ticksToRegeneration > 1) {
			// if(target && creep.pos.isNearTo(target.pos) && target.energy <= 0 && target.ticksToRegeneration > 1)
			return creep.defer(target.ticksToRegeneration);
		}
		// Harvest the target.
		const status = creep.harvest(target);
		switch (status) {
		case ERR_NOT_ENOUGH_RESOURCES: // On return trip
		case ERR_NOT_IN_RANGE:
			creep.moveTo(goal, {
				ignoreCreeps: (creep.memory.stuck || 0) < 3,
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
			creep.say(status);
		}

		// Find stuff in range to fill up
		// if(creep.carry[RESOURCE_ENERGY] > 25 && ((Game.time & 7) === 0)) {
		if (Game.time & 1 || creep.carryCapacityAvailable > 0)
			return;

		if (!this.memory.repairPower)
			module.exports.init(this);
		if ((goal instanceof StructureContainer) && ((goal.hitsMax - goal.hits) > this.memory.repairPower))
			return creep.repair(goal);

		const transferTarget = creep.getTarget(
			() => _.map(creep.lookForNear(LOOK_STRUCTURES, true, 1), 'structure'),
			({ energy, energyCapacity }) => energyCapacity - energy >= 25,
			(candidates) => _.min(candidates, 'energy'),
			'ttid'
		);
		if (transferTarget)
			creep.transfer(transferTarget, RESOURCE_ENERGY);
	}
};