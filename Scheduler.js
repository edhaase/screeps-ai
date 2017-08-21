/**
 * Scheduler.js
 */
"use strict";

module.exports = {
	/**
	 * Schedules a function to be called every nTh tick.
	 */
	reoccurring: function (fn, args, thisArg, freq = 5, offset = 0) {
		if ((Game.time % freq) === offset)
			return fn.apply(thisArg, args);
	},

	/**
	 * Calls each function in succession on a different turn
	 */
	spread: function (fns, thisArg, args) {
		var pos = Game.time % fns.length;
		fns[pos].apply(thisArg, args);
	},

	/**
	 * Cycles through an array, 1 item per tick, passing to function
	 */
	stagger: function (arr, fn, thisArg) {
		if (!arr || arr.length <= 0)
			return;
		var pos = Game.time % arr.length;
		fn.call(thisArg, arr[pos]);
	},

	/**
	 * Slowly iterate through object keys
	 */
	staggerKeys: function (obj, fn, thisArg) {
		if (obj == undefined)
			return;
		return this.stagger(Object.keys(obj), k => fn(obj[k]), thisArg);
	}

};