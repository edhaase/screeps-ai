/**
 * role.defender.js
 *
 * Local room guard
 *
 * @todo: support ranged attack for crippling enemies
 * @todo: request fire support from towers?
 * @todo: intercept
 * @todo: mass attack
 * @todo: heal friendlies
 * @todo: kite?
 */
'use strict';

/* global CREEP_RANGED_ATTACK_RANGE, SAFE_MODE_IGNORE_TIMER */
/* global Filter */

module.exports = {
	boosts: [],
	want: function (census) {
		if ((census.room.controller.safeMode || 0) > SAFE_MODE_IGNORE_TIMER)
			return 0;
		const towers = _.size(census.room.find(FIND_MY_STRUCTURES, { filter: Filter.loadedTower }));
		if (towers > 0 && census.room.hostiles.length < towers)
			return 0;
		return CLAMP(1, census.room.hostiles.length * 2, 8);
	},
	body: function () {
		// pick ranged or melee at random?
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		var threat = this.pos.findClosestByRange(this.room.hostiles);
		// var threat = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
		if (threat == null) {
			if (this.ticksToLive & 63 === 0)
				this.wander();
			return;
		}
		const range = this.pos.getRangeTo(threat);
		if (this.hasActiveBodypart(RANGED_ATTACK)) {
			const status = this.rangedAttack(threat);
			if (status === ERR_NOT_IN_RANGE) {
				this.moveTo(threat, {
					reusePath: 5, ignoreRoads: true, range: CREEP_RANGED_ATTACK_RANGE
				}); // If the position changes this rebuilds anyways.				
			} else if (status === OK) {
				this.flee();
				this.rangedMassAttack();
			} else {
				this.say(`RA ${status}`);
			}
		} else if (range > CREEP_RANGED_ATTACK_RANGE || (range > 1 && !this.pos.hasRampart())) {
			this.moveTo(threat, {
				reusePath: 5, ignoreRoads: true
			}); // If the position changes this rebuilds anyways.	
		}
		if (this.canAttack && this.attack(threat) === ERR_NOT_IN_RANGE) {
			if (this.hits < this.hitsMax && this.hasActiveBodypart(HEAL))
				this.heal(this);				
		}
	}
};