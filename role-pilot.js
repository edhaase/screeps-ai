/**
 * role-pilot.js
 *
 * 2017-02-23: Can be spawned from a room other than there dest.
 */
'use strict';

/* eslint-disable consistent-return */
module.exports = {
	init: function () {

	},
	run: function () {
		if (this.carry[RESOURCE_ENERGY] <= 0)
			return this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		const { controller } = this.room;
		if ((controller.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || controller.isEmergencyModeActive()) && !controller.upgradedBlocked) {
			if (this.upgradeController(controller) === ERR_NOT_IN_RANGE)
				this.moveTo(controller, { range: CREEP_UPGRADE_RANGE });
		} else {
			const goal = this.getTarget(
				({ room }) => room.find(FIND_MY_STRUCTURES),
				function (structure) {
					if (structure.structureType === STRUCTURE_SPAWN && structure.energyPct < 0.95) return true;
					if (structure.structureType === STRUCTURE_EXTENSION && structure.energy < structure.energyCapacity) return true;
					if (structure.structureType === STRUCTURE_TOWER && structure.energy < TOWER_ENERGY_COST) return true;
					return false;
				},
				(candidates) => this.pos.findClosestByPath(candidates)
			) || controller;
			this.transferOrMove(goal, RESOURCE_ENERGY);
		}
	}
};