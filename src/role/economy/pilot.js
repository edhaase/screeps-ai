/**
 * role.pilot.js
 *
 * 2017-02-23: Can be spawned from a room other than their dest.
 */
'use strict';

import Body from '/ds/Body';
import { CLAMP } from '/os/core/math';

/* eslint-disable consistent-return */
export default {
	boosts: [], // If we got boosts available, maybe?
	priority: function () {
		// (Optional)
	},
	body: function ({room}) {
		const MAX_PILOT_ENERGY = 750;
		const amt = CLAMP(SPAWN_ENERGY_START, room.energyAvailable, MAX_PILOT_ENERGY);
		return Body.repeat([WORK, CARRY, MOVE, MOVE], amt);
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
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
					if (structure.structureType === STRUCTURE_SPAWN && structure.energyPct < 1.0 /* 0.95 */) return true;
					if (structure.structureType === STRUCTURE_EXTENSION && structure.energy < structure.energyCapacity) return true;
					if (structure.structureType === STRUCTURE_TOWER && structure.energy < TOWER_ENERGY_COST && structure.room.energyPct >= 1.0) return true;
					return false;
				},
				(candidates) => this.pos.findClosestByPath(candidates)
			) || controller;
			this.transferOrMove(goal, RESOURCE_ENERGY);
		}
	}
};