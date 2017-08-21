/**
 * @todo: support ranged attack for crippling enemies
 * @todo: request fire support from towers?
 * @todo: intercept
 * @todo: mass attack
 * @todo: heal friendlies
 * @todo: kite?
 */
"use strict";

module.exports = function (creep) {
	var threat = creep.pos.findClosestByRange(creep.room.hostiles);
	// var threat = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
	if (threat == null) {
		if ((Game.time & 63) === 0)
			creep.setRole('recycle');
		return;
	}

	if (this.hasActiveBodypart(RANGED_ATTACK)) {
		if (creep.rangedAttack(threat) === OK) {
			this.flee();
			creep.rangedMassAttack();
		} else {
			creep.moveTo(threat, {
				reusePath: 5, ignoreRoads: true, range: CREEP_RANGED_ATTACK_RANGE
			}); // If the position changes this rebuilds anyways.	
		}
	} else {
		creep.moveTo(threat, {
			reusePath: 5, ignoreRoads: true
		}); // If the position changes this rebuilds anyways.	
	}
	if (creep.canAttack && creep.attack(threat) === ERR_NOT_IN_RANGE) {
		if (creep.hits < creep.hitsMax && creep.hasActiveBodypart(HEAL))
			creep.heal(creep);
	}
};