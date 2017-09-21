/**
 * ext.js
 *
 * General purpose extensions, or prototype extensions that don't fit anywhere else.
 */
"use strict";

ConstructionSite.prototype.draw = function () {
	const { room, pos, structureType } = this;
	if (room)
		this.room.visual.structure(pos.x, pos.y, structureType);
};

const ets = Error.prototype.toString;
Error.prototype.toString = function () {
	return ets.apply(this, arguments) + ` (Tick ${Game.time})`;
};

/**
 *
 */
Math.runningAvg = function (newest, previous, samples) {
	var p = previous;
	if (!previous && previous !== 0)
		p = newest;

	var n = p;
	n -= (p / samples);
	n += (newest / samples);
	return n;
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

// Courtesy of Spyingwind
// Aeyi's utility cheatsheet: https://docs.google.com/spreadsheets/d/1fvmxjqwWEHCkI5LTFA0K_aPLFAfF016E5IHZb9Xi23M/edit#gid=1779388467
global.Maths = class {
	/**
     * Quadratic / Rotated Quadratic
     * @param {number} input
     * @param {number} max - Maximum value of x
     * @param {number} weight - Quadratic weight
     * @param {boolean} rotated - make this a rotated quadratic
     * @returns {number}
     */
	static quadratic(input, max, weight, rotated = false) {
		if (rotated) {
			return 1 - Math.pow(input / max, weight);
		}
		return Math.pow(input / max, weight);
	}

	/**
     * Linear / SquareRoot
     * @param {number} input
     * @param {number} max
     * @param {boolean} square
     * @returns {number}
     */
	static linear(input, max, square = false) {
		if (square) {
			return Math.sqrt(input / max);
		}
		return input / max;
	}

	/**
     * Step
     * @param {number} input
     * @param {number} max
     * @param {number} threshold
     * @returns {number}
     */
	static step(input, max, threshold) {
		return input / max > threshold ? 1 : 0;
	}

	/**
     * Decay
     * @param {number} input
     * @param {number} max
     * @param {number} decay
     * @returns {number}
     */
	static decay(input, max, decay) {
		return Math.pow(decay, input / max);
	}

	/**
     * Sigmoid Curve / Inverse Sigmoid
     * @param {number} input
     * @param {boolean} inverse
     * @returns {number}
     */
	static sigmoidCurve(input, inverse = false) {
		if (inverse) {
			return 1 / (1 + Math.pow(Math.E, -input));
		}
		return 1 / (1 + Math.pow(Math.E, input));
	}
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