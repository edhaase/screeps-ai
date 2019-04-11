/**
 * Arr.js
 * 
 * Because extending the built in Array.prototype is a dangerous proposition
 */
'use strict';

module.exports = {
	/**
     * 
     */
	cycle: function (orig, n) {
		var arr = [];
		for (var i = 0; i < n; i++)
			arr.push(orig[i % orig.length]);
		return arr;
	},
	/**
     * 
     */
	repeat: function (arr, maxCost, maxSize = MAX_CREEP_SIZE) {
		var n = Math.min(maxSize / arr.length, maxCost / UNIT_COST(arr));
		n = Math.floor(n);
		return this.cycle(arr, arr.length * n);
	}
};