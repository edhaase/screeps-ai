/**
 * ext.js
 *
 * General purpose extensions, or prototype extensions that don't fit anywhere else.
 */
'use strict';

/* global DEFINE_CACHED_GETTER */

DEFINE_CACHED_GETTER(ConstructionSite.prototype, 'progressPct', c => c.progress / c.progressTotal);

ConstructionSite.prototype.draw = function () {
	const { room, pos, structureType } = this;
	if (room)
		this.room.visual.structure(pos.x, pos.y, structureType);
};

const ets = Error.prototype.toString;
Error.prototype.toString = function () {
	return ets.apply(this, arguments) + ` (Tick ${Game.time})`;
};

// Cumulative moving average
Math.mAvg = function (n, p = n, s = 100, w = 1) {
	// return p + (n/s) - (p/s);
	// return p + (n-p)/s; // BEST!
	// console.log(`${p}+(${n}-${p})/${s} = ${p + ((n-p)/s)}`);
	// console.log(`${p}+(${w}*${n}-${p})/${s} = ${p + ((w*n-p)/s)}`);
	// console.log(`${p}+${w}*(${n}-${p})/${s} = ${p + w*(n-p)/s}`);
	// return p + (n-p)/(s/w);
	return p + (n / s / w) - (p / s);
};

Math.cmAvg = (n, p = n, s = 100) => p + (n - p) / s; // Cumulutive moving average.
Math.mmAvg = (n, p = n, s = 100) => ((s - 1) * p + n) / s; // Modified moving average.

Math.clamp = function (low, value, high) {
	return Math.max(low, Math.min(value, high));
};

StructurePowerBank.prototype.getAttackPartsGoal = function () {
	return Math.ceil(this.hits / ATTACK_POWER / this.ticksToDecay);
};

StructurePowerBank.prototype.getRangedAttackPartsGoal = function () {
	return Math.ceil(this.hits / RANGED_ATTACK_POWER / this.ticksToDecay);
};

StructurePowerBank.prototype.getCarryPartsGoal = function () {
	return Math.ceil(this.power / CARRY_CAPACITY);
};