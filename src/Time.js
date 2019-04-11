/**
 * Time.js
 */
'use strict';

const CURRENT_TIMEZONE = -7;
const DEFAULT_TICK_LENGTH_ESTIMATE = 4;

module.exports = {
	Timezone: CURRENT_TIMEZONE,
	formatter: new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles" }),
	// avgTick: 3.5,

	getAvgTickLength: function () {
		if (!Memory.stats)
			Memory.stats = {};
		if (!Memory.stats.tickLength)
			Memory.stats.tickLength = DEFAULT_TICK_LENGTH_ESTIMATE; // Rough estimate
		return Memory.stats.tickLength;
	},

	/**
	 * Call periodically to update the average tick length in real time.
	 * This is used for temporal estimates.
	 */
	updateTickLength: function (freq = 1000) {
		if (!Memory.stats.tickLength)
			Memory.stats.tickLength = 3.5;
		if (Memory.stats.lastTS) {
			var elapsedInSeconds = ((new Date()).getTime() - Memory.stats.lastTS) / 1000;
			var avg = elapsedInSeconds / freq;
			console.log(`Updating tick length! ${avg}`);
			Memory.stats.tickLength = avg;
		}
		Memory.stats.lastTS = (new Date()).getTime();
	},

	getTime: function () {

	},

	tickDelay: function (ticks, tickLength = this.getAvgTickLength()) {
		return ticks * tickLength;
	},

	secondsToTicks: function (sec, tickLength = this.getAvgTickLength()) {
		return Math.ceil(sec / tickLength);
	},

	ticksToSeconds: function (ticks, tickLength = this.getAvgTickLength()) {
		return ticks * tickLength;
	},

	estimate: function (ticks, tickLength) {
		var seconds = this.tickDelay(ticks, tickLength);
		return new Date(
			Date.now() + 1000 * ((this.Timezone * 3600) + seconds)
		);
	},

	estimateInSeconds: function(ticks, tickLength = this.getAvgTickLength()) {
		return this.tickDelay(ticks, tickLength);
	},

	measure: function (fn, args = []) {
		var start = Game.cpu.getUsed();
		fn.apply(null, args);
		return _.round(Game.cpu.getUsed() - start, 3);
	},

	/**
	 * Simple benchmark test with sanity check
	 *
	 * Usage: benchmark([
	 *		() => doThing(),
	 *		() => doThingAnotherWay(),
	 * ]);
	 *
	 * Output:
	 *
	 * Benchmark results, 1 loop(s):
	 * Time: 1.345, Avg: 1.345, Function: () => doThing()
	 * Time: 1.118, Avg: 1.118, Function: () => doThingAnotherWay()
	 */
	benchmark(arr, iter = 1) {
		var i, j, len = arr.length;
		var start, used;
		var results = _.map(arr, (fn) => ({ fn: fn.toString(), time: 0, avg: 0 }));
		for (j = 0; j < iter; j++) {
			for (i = 0; i < len; i++) {
				start = Game.cpu.getUsed();
				results[i].rtn = arr[i]();
				used = Game.cpu.getUsed() - start;
				if (i > 0 && results[i].rtn !== results[0].rtn)
					throw new Error('Results are not the same!');
				results[i].time += used;
			}
		}
		console.log(`Benchmark results, ${iter} loop(s): `);
		_.each(results, (res) => {
			res.avg = _.round(res.time / iter, 3);
			res.time = _.round(res.time, 3);
			console.log(`Time: ${res.time}, Avg: ${res.avg}, Function: ${res.fn}`);
		});
	},

	/**
	 * Profile and compare multiple functions
	 * example: Time.compare([ () => _.trimRight('miner_120', '0123456789'), () => 'miner_120'.splitOnce('_') ])
	 */
	compare(arr, cycles = 1000) {
		var i, j, start, used, val;
		for (i = 0; i < arr.length; i++) {
			start = Game.cpu.getUsed();
			for (j = 0; j < cycles; j++)
				val = arr[i]();
			used = _.round((Game.cpu.getUsed() - start) / cycles, 5);
			console.log(`Used: ${used}: ${arr[i]}`);
		}
	}
};