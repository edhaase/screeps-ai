/**
 * role-antecedent.js - Shows up before the claimer to push the controller to level 2
 * 
 * Noun: A thing or event that existed before or logically precedes another.
 * 
 * @todo Pay attention to controller.upgradeBlocked
 */
'use strict';

/* global UNIT_COST */
/* global CREEP_UPGRADE_RANGE */

const DESIRED_CARRY = CONTROLLER_LEVELS[1] / CARRY_CAPACITY;
const BASE_TEMPLATE = [WORK, CARRY, MOVE, MOVE];
const DESIRED_TEMPLATE = Util.RLD([DESIRED_CARRY, CARRY, DESIRED_CARRY, MOVE, DESIRED_CARRY, WORK]);
const BASE_COST = UNIT_COST(BASE_TEMPLATE);
const DESIRED_COST = UNIT_COST(DESIRED_TEMPLATE);
const WAIT_TIME = 3;

/* eslint-disable consistent-return */
module.exports = {
	// @todo upgrade, carry or move boosts
	boosts: ['GH', 'GH2O', 'XGH2O'],
	minBody: BASE_TEMPLATE,
	body: function () {
		return DESIRED_TEMPLATE;
	},
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
		this.pushState("MoveToRoom", this.memory.dest);
		this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: false });
	},
	run: function () {
		const { controller } = this.room;
		if (!controller || !controller.my)
			return this.defer(WAIT_TIME);
		if (controller.level >= 2)
			return this.setRole('builder');
		if (this.carry[RESOURCE_ENERGY] === 0)
			return this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		const status = this.upgradeController(controller);
		if (status === ERR_NOT_IN_RANGE)
			return this.pushState("EvadeMove", { pos: controller.pos, range: CREEP_UPGRADE_RANGE });
	}
};