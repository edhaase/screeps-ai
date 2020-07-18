/** /os/core/timer.js - Like cron but transient */
'use strict';

import PriorityQueue from '/ds/PriorityQueue';

/* const timers = new PriorityQueue([], j => j.next);

function* TimerThread() {
	while (true) {
		const [timer] = timers;
		yield;
	}
} */

export class Timer {
	constructor(co, freq, start = Game.time, thisArg) {
		this.freq = freq;
		this.next = start;
		this.thisArg = thisArg;
	}

	/* invoke() {
		if (Game.time < this.next)
			return;
		if (this.freq == null)
			timers.remove(this);
		this.next = this.freq;
	} */
}

module.exports = Timer;
