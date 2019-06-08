/** prog-legacy.js */
'use strict';

const { ActorHasCeased } = require('os.core.errors');

const Co = require('os.core.co');
const ITO = require('os.core.ito');
const Process = require('os.core.process');

const DEFAULT_FREQUENCY = 1;

class Legacy extends Process {

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
			//if (itm instanceof Structure && !itm.isActive())
			//	continue;
			const thread = this.startThread(this.invoker, [itm[iden], col, method], undefined, itm.toString());
			thread.key = itm[iden];
			this.table.set(thread.key, thread);
			yield true;
		}
	}

	*invoker(id, collection = undefined, method = 'run') {
		const ito = ITO.make(id, collection);
		this.debug(`New legacy invoker for ${ito} on tick ${Game.time}`);
		try {
			while (true) {
				ito[method]();
				yield;
			}
		} catch (e) {
			if (!(e instanceof ActorHasCeased))
				throw e;
			this.debug(`Actor ${id} has ceased, exiting`);
		}
	}
}

module.exports = Legacy;