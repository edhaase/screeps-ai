/**
 * ext-math.js
 * 
 * Courtesy of Spyingwind and Aeyi
 */
'use strict';

module.exports = {
	/**
     * Quadratic / Rotated Quadratic
     * @param {number} input
     * @param {number} max - Maximum value of x
     * @param {number} weight - Quadratic weight
     * @param {boolean} rotated - make this a rotated quadratic
     * @returns {number}
     */
	quadratic: function (input, max, weight, rotated = false) {
		if (rotated) {
			return 1 - Math.pow(input / max, weight);
		}
		return Math.pow(input / max, weight);
	},

	/**
     * Linear / SquareRoot
     * @param {number} input
     * @param {number} max
     * @param {boolean} square
     * @returns {number}
     */
	linear: function (input, max, square = false) {
		if (square) {
			return Math.sqrt(input / max);
		}
		return input / max;
	},

	/**
     * Step
     * @param {number} input
     * @param {number} max
     * @param {number} threshold
     * @returns {number}
     */
	step: function (input, max, threshold) {
		return input / max > threshold ? 1 : 0;
	},

	/**
     * Decay
     * @param {number} input
     * @param {number} max
     * @param {number} decay
     * @returns {number}
     */
	decay: function (input, max, decay) {
		return Math.pow(decay, input / max);
	},

	/**
     * Sigmoid Curve / Inverse Sigmoid
     * @param {number} input
     * @param {boolean} inverse
     * @returns {number}
     */
	sigmoidCurve: function (input, inverse = false) {
		if (inverse) {
			return 1 / (1 + Math.pow(Math.E, -input));
		}
		return 1 / (1 + Math.pow(Math.E, input));
	}
};