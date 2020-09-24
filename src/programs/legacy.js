/** prog-legacy.js */
'use strict';

import { ActorHasCeasedError } from '/os/core/errors';

import * as Co from '/os/core/co';
import ITO from '/os/core/ito';
import Process from '/os/core/process';

const DEFAULT_FREQUENCY = 1;

export default class Legacy extends Process {

	constructor(opts) {
		super(opts);
		this.table = new Map();
		if (!this.frequency)
			this.frequency = DEFAULT_FREQUENCY;
	}

	*run() {
		while (true) {
			yield* this.coSpawnMissingThreads(Game[this.collection], this.identifier, this.collection, this.method || 'run');
			yield this.sleepThread(this.frequency);
		}
	}

	onThreadExit(tid, thread) {
		this.debug(`Thread ${tid} exited`);
		this.table.delete(thread.key);
	}

	*coSpawnMissingThreads(collection, iden = 'id', col = null, method = 'run') {
		const missed = _.filter(collection, c => !this.table.has(c[iden]) && c[method]);
		if (!missed || !missed.length)
			return;
		for (const itm of missed) {
			try {
				//if (itm instanceof Structure && !itm.isActive())
				//	continue;
				if (itm.ticksToLive && itm.ticksToLive <= 1)
					continue;
				const thread = this.startThread(this.invoker, [itm[iden], col, method], undefined, itm.toString());
				thread.key = itm[iden];
				this.table.set(thread.key, thread);
			} catch (err) {
				this.error(err);
				this.error(err.stack);
			}
			yield true;

		}
	}

	*invoker(id, collection = undefined, method = 'run') {
		const ito = ITO.make(id, collection);
		this.debug(`New legacy invoker for ${ito} on tick ${Game.time}`);
		try {
			while (true) {
				ito[method]();
				yield false;
			}
		} catch (e) {
			if (!(e instanceof ActorHasCeasedError))
				throw e;
			this.debug(`Actor ${id} has ceased, exiting`);
		}
	}
}