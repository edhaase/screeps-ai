/**
 * Time.js
 */
'use strict';

import { ENV } from '/os/core/macros';
import { Log } from '/os/core/Log';

export const DEFAULT_TICK_LENGTH_ESTIMATE = 4;

export const TIMEZONE = ENV('intl.timezone', 'America/Los_Angeles');
export const LANGUAGE = ENV('intl.lang', 'en-US');

export const DATE_FORMATTER = new Intl.DateTimeFormat(LANGUAGE, { timeZone: TIMEZONE });
export const DATETIME_FORMATTER = new Intl.DateTimeFormat(LANGUAGE, { timeZone: TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });

export function getAvgTickLength() {
	if (!Memory.stats)
		Memory.stats = {};
	if (!Memory.stats.tickLength)
		Memory.stats.tickLength = DEFAULT_TICK_LENGTH_ESTIMATE; // Rough estimate
	return Memory.stats.tickLength;
};

/**
 * Call periodically to update the average tick length in real time.
 * This is used for temporal estimates.
 */
export function updateTickLength(freq = 1000) {
	if (!Memory.stats.tickLength)
		Memory.stats.tickLength = 3.5;
	if (Memory.stats.lastTS) {
		var elapsedInSeconds = ((new Date()).getTime() - Memory.stats.lastTS) / 1000;
		var avg = elapsedInSeconds / freq;
		Log.info(`Updating tick length! ${avg}`, 'Time');
		Memory.stats.tickLength = avg;
	}
	Memory.stats.lastTS = (new Date()).getTime();
};

export function getTime() {

};

export function tickDelay(ticks, tickLength = getAvgTickLength()) {
	return ticks * tickLength;
};

export function secondsToTicks(sec, tickLength = getAvgTickLength()) {
	return Math.ceil(sec / tickLength);
};

export function ticksToSeconds(ticks, tickLength = getAvgTickLength()) {
	return ticks * tickLength;
};

export function estimate(ticks, tickLength = getAvgTickLength()) {
	const seconds = tickDelay(ticks, tickLength);
	return new Date(Date.now() + 1000 * seconds);
};

export function estimateInSeconds(ticks, tickLength = getAvgTickLength()) {
	return tickDelay(ticks, tickLength);
};

export function measure(fn, args = []) {
	var start = Game.cpu.getUsed();
	fn.apply(null, args);
	return _.round(Game.cpu.getUsed() - start, 3);
};

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
export function benchmark(arr, iter = 1) {
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
	Log.info(`Benchmark results, ${iter} loop(s): `);
	_.each(results, (res) => {
		res.avg = _.round(res.time / iter, 3);
		res.time = _.round(res.time, 3);
		Log.info(`Time: ${res.time}, Avg: ${res.avg}, Function: ${res.fn}`);
	});
};

/**
 * Profile and compare multiple functions
 * example: Time.compare([ () => _.trimRight('miner_120', '0123456789'), () => 'miner_120'.splitOnce('_') ])
 */
export function compare(arr, cycles = 1000) {
	var i, j, start, used, val;
	for (i = 0; i < arr.length; i++) {
		start = Game.cpu.getUsed();
		for (j = 0; j < cycles; j++)
			val = arr[i]();
		used = _.round((Game.cpu.getUsed() - start) / cycles, 5);
		Log.info(`Used: ${used}: ${arr[i]}`);
	}
};