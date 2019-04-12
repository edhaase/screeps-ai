/** os.prog.intel.js */
'use strict';

/* global ENV, ENVC, IS_MMO, Log, THP_SEGMENT_INTEL */

const ForeignSegment = require('os.core.network.foreign');
const Pager = require('os.core.pager.thp');
const Process = require('os.core.process');

const RECON_SEGMENT_MAX = ENVC('intel.recon_segment_max', 99, 0, 99);
const RECON_SEGMENT_MIN = ENVC('intel.recon_segment_min', 0, 0, 99);

class IntelFSRecon extends Process {
	/** Scans foreign segments for interesting stuff */
	*run() {
		const thread = global.kernel.getCurrentThread();
		while (true) {
			const names = _.unique([...this.getfsSegmentReconNames()]);
			if (!names || !names.length)
				this.info(`No segments to scan, going to sleep`);
			for (const user of names) {
				for (var id = RECON_SEGMENT_MAX; id >= RECON_SEGMENT_MIN; id--) {
					thread.desc = `Scanning foreign segment ${user} ${id}`;
					const segment = yield ForeignSegment.fetchAsync([user, id, 0.5, false]);
					if (!segment)
						continue;
					this.warn(`Found segment at ${user} ${id} ${segment}`);
					if (ENV('intel.recon_segment_notify', false))
						Log.notify(`Segment scanner found segment at ${user} ${id} ${segment}`);
					if (!this.memory.segments)
						this.memory.segments = {};
					const key = `${user}_${id}`;
					this.memory.segments[key] = `Found at ${Game.time}`;
				}
			}
			yield this.sleepThread(1000);
		}
	}

	*getfsSegmentReconNames() {
		if (Memory.players)
			yield* Object.keys(Memory.players);
	}
}

module.exports = IntelFSRecon;