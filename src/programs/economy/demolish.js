/**
 * Program to bulldoze a room
 * 
 * @todo Asset finding should be cross-shard
 * @todo Should support cross-shard spawning
 */
'use strict';

import ITO from '/os/core/ito';
import Process from '/os/core/process';

import { bulldozer_rejector_filter, bulldozer_candidate_filter } from '/role/economy/bulldozer';
import { runCensus } from '/lib/util';

// ({ room }) => room.find(FIND_STRUCTURES, { filter: s => bulldozer_rejector_filter(s) }),
//	(s) => bulldozer_candidate_filter(s, avoidRamparts),

const DESIRED_BULLDOZERS = 3;

export default class DemolishProc extends Process {
	constructor(opts) {
		super(opts);
		this.title = `Demolish ${this.room}`;
		this.assets = [];
		this.targets = 0;
	}

	shutdown() {
		/** Cleanup assets */
		/* this.assets.forEach(c => {
			const creep = Game.getObjectById(c);
			if (creep) creep.setRole('recycle');
		}); */
		super.shutdown();
	}

	onReload() {
		super.onReload();
		this.startThread(this.assetTracking, null, Process.PRIORITY_IDLE, `Asset tracking`);
	}

	*run() {
		if (!this.room)
			return this.error(`Unable to demolish: No room specified`);
		while (true) {
			yield this.sleepThread(5);
			/**
			 * If we haven't seen the room we don't know how much work there is, if any.
			 * So let's periodically update our snapshot of the room
			 */
			if (this.memory.count == null || Game.time - this.memory.lastUpdate > 15) {
				yield* this.updateRoom();
			}
		}
	}

	/**
	 * 
	 */
	*assetTracking() {
		while (true) {
			yield this.sleepThread(60);
			try {
				const count = this.memory.count || 0;
				if (count <= 0) {
					this.setThreadTitle('Asset Tracking - No bulldozers needed');
					continue;
				}
				runCensus();
				const bulldozers = Game.census[`${this.room}_bulldozer`] || [];
				this.assets = _.map(bulldozers, c => c.id);
				if (this.assets.length >= DESIRED_BULLDOZERS) {
					this.setThreadTitle('Asset Tracking - At limit');
					this.debug(`At limit for bulldozers`);
					continue;
				}
				this.setThreadTitle('Asset Tracking - Pending spawn');
				this.info(`Requesting new bulldozer to ${this.room} on tick ${Game.time}`);

				// Allow fetching a facade for a remote process call
				const [spawn] = kernel.getProcessByName('spawn');

				// Call the spawning process. This may be a cross process facade. We may get back a Future
				// we can yield, if want to wait for confirmation.
				spawn.submit({ memory: { role: 'bulldozer', home: this.room }, priority: PRIORITY_LOW });
			} catch (err) {
				this.error(err);
				this.error(err.stack);
			}
		}
	}

	*updateRoom() {
		try {
			this.memory.lastUpdate = Game.time;
			const [recon] = kernel.getProcessByName('recon');
			const room = yield recon.request(this.room);
			const targets = room.find(FIND_STRUCTURES, { filter: s => bulldozer_rejector_filter(s) && bulldozer_candidate_filter(s) });
			this.memory.count = targets.length;
			if (this.memory.count <= 0)
				this.shutdown();
			else
				this.title = `Demolishing ${this.room} (${this.memory.count} target(s))`;
		} catch (e) {
			this.error(e);
			this.error(e.stack);
		}
	}

	updateAssets() {
		_.remove(this.assets, cid => !Game.getObjectById(cid));
		return this.assets.length >= DESIRED_BULLDOZERS;
	}

	getTargetCount(room) {

	}
}