/** prog-stats.js */
'use strict';

const Pager = require('os.core.pager');
const Process = require('os.core.process');

const TICK_LENGTH_UPDATE_FREQ = 1000;
const MS_TO_SECONDS = 1000;

class Stats extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_HIGHEST;
		this.default_thread_prio = Process.PRIORITY_HIGHEST;
	}

	*run() {
		const [page] = yield* Pager.read([SEGMENT_STATS]);
		this.stats = _.attempt(JSON.parse, page);
		if (this.stats instanceof Error) {
			this.warn(`Stats segment corrupt, resetting`);
			this.stats = {};
		}
		this.debug(`Next tick length update in ${this.stats['nextTSU'] - Game.time}`);

		while (true) {
			if (!this.stats['nextTSU'] || Game.time >= this.stats['nextTSU']) {
				this.stats['nextTSU'] = Game.time + TICK_LENGTH_UPDATE_FREQ;
				this.updateTickLength(TICK_LENGTH_UPDATE_FREQ);
			}
			this.stats['bucket'] = Game.cpu.bucket;
			this.stats['cpu'] = Game.cpu;
			this.stats['gcl'] = Game.gpl;
			this.stats['cpu']['used'] = _.round(global.kernel.lastRunCpu, CPU_PRECISION);
			this.stats['gcl'] = Game.gcl;
			this.stats['gpl'] = Game.gpl;
			this.stats['credits'] = Game.market.credits;
			if (Game.cpu.getHeapStatistics)
				this.stats['heap'] = Game.cpu.getHeapStatistics();
			this.stats.process = { name: {}, pid: {} };
			for (const [pid, p] of global.kernel.process) {
				const { totalCpu, minCpu, maxCpu, avgUsrCpu, avgSysCpu } = p;
				this.stats.process.pid[pid] = { totalCpu, minCpu, maxCpu, avgUsrCpu, avgSysCpu };

				var { total = 0, min = Infinity, avg = 0, max = 0 } = this.stats.process.name[p.name] || {};
				total += totalCpu;
				min = _.round(Math.min(min, minCpu), 5);
				max = _.round(Math.max(max, maxCpu), 5);
				avg = _.round(MM_AVG(total, avg), 5);
				this.stats.process.name[p.name] = { total, min, avg, max };
			}

			Pager.write(SEGMENT_STATS, JSON.stringify(this.stats)); // Needs serialization
			yield;
		}
	}

	*wait() {
		while (true)
			yield;
	}

	updateTickLength(freq = 1000) {
		this.debug(`Updating tick length tracking`);
		if (this.stats.lastTS) {
			const elapsedInSeconds = ((new Date()).getTime() - this.stats.lastTS) / MS_TO_SECONDS;
			const avg = elapsedInSeconds / freq;
			this.info(`Updating tick length! ${avg}`);
			this.stats.tickLength = avg;
		}
		this.stats.lastTS = (new Date()).getTime();
	}
}

module.exports = Stats;