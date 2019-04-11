/** ext.structure.powerbank.js - Mostly useless junk */
'use strict';

StructurePowerBank.prototype.getAttackPartsGoal = function () {
	return Math.ceil(this.hits / ATTACK_POWER / this.ticksToDecay);
};

StructurePowerBank.prototype.getRangedAttackPartsGoal = function () {
	return Math.ceil(this.hits / RANGED_ATTACK_POWER / this.ticksToDecay);
};

StructurePowerBank.prototype.getCarryPartsGoal = function () {
	return Math.ceil(this.power / CARRY_CAPACITY);
};