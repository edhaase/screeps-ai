/** os.ext.spawn.js - StructureSpawn coro extensions */
'use strict';

const ITO = require('os.core.ito');

/**
 * Spawn creep coroutine, waits until creep has started spawning
 */
StructureSpawn.prototype.coSpawnCreep = function* (body, name, opts = {}) {
	const result = this.spawnCreep(this, body, name, opts);
	if (result !== OK)
		return result;
	yield; // pause until next tick
	const creep = Game.creeps[name];
	if (!creep || !creep.id)
		return ERR_BUSY;
	return ITO.make(creep.id);
};

/** No exports needed for prototype extensions */