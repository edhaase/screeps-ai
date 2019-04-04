/** prog-legacy.js */
'use strict';

const { ActorHasCeased } = require('os.core.errors');

const ITO = require('os.core.ito');
const Process = require('os.core.process');

class Legacy extends Process {

	constructor(opts) {
		super(opts);
		this.table = new Map();
	}

	*run() {
		// This thread exists to create other threads
		this.startThread(this.runRooms, null, undefined, 'Legacy room runner');
		while (true) {
			yield* this.coSpawnMissingThreads(Game.creeps, 'id', null);
			yield* this.coSpawnMissingThreads(Game.structures, 'id', 'structures');
			yield* this.coSpawnMissingThreads(Game.flags, 'name', 'flags');
			yield* this.coSpawnMissingThreads(Game.powerCreeps);
			yield;
		}
	}

	*runRooms() {
		while (true)
			yield _.invoke(Game.rooms, 'run');
	}

	spawnMissingThreads(collection, iden = 'id', col = null, method = 'run') {
		const missed = _.filter(collection, c => !this.table.has(c[iden]) && c.run);
		for (const itm of missed) {
			/* const thread = this.invoker(itm.id, method);
			thread.desc = itm.toString();
			global.kernel.attachThread(thread); */
			const thread = this.startThread(this.invoker, [itm[iden], method], undefined, itm.toString());
			this.table.set(itm.id, thread);
		}
	}

	*coSpawnMissingThreads(collection, iden = 'id', col = null, method = 'run') {
		const { each } = require('os.core.async');
		const missed = _.filter(collection, c => !this.table.has(c[iden]) && c.run);
		if (!missed || !missed.length)
			return;
		yield* each(missed, function* (itm) {
			while (Game.cpu.getUsed() > Game.cpu.limit)
				yield;
			// const ito = ITO.make(itm[iden], col);
			const thread = this.startThread(this.invoker, [itm[iden], col, method], undefined, itm.toString());
			/* const thread = this.invoker(itm.id, method);			
			thread.desc = itm.toString();
			global.kernel.attachThread(thread); */
			this.table.set(itm.id, thread);
		}, this);
	}


	*invoker(id, collection = undefined, method = 'run') {
		const ito = ITO.make(id, collection);
		this.debug(`New legacy invoker for ${ito}`);
		try {
			while (true) {
				yield (ito[method] && ito[method]());
			}
		} catch (e) {
			if (!(e instanceof ActorHasCeased))
				throw e;
			this.debug(`Actor ${id} has ceased, exiting`);
		}
	}
}

module.exports = Legacy;