/**
 *
 */
"use strict";

module.exports = function (creep) {
	if (BUCKET_LIMITER)
		return creep.suicide();
	delete this.memory.home;
	if ((Game.time & 3) === 0
		&& creep.carryTotal <= 0
		&& !creep.isBoosted()
		&& creep.getRecycleWorth() <= 0) {
		Log.warn(`Creep ${this.name} at ${this.pos} not worth recycling, suiciding`, 'Creep');
		return creep.suicide();
	}
	var spawn;
	if (!creep.memory.spawn) {
		spawn = creep.pos.findClosestSpawn();
		if (!spawn) {
			Log.notify('Creep ' + creep.name + ' unable to find spawn for recycle. Giving up');
			creep.suicide();
		}
		creep.memory.spawn = spawn.id;
	} else
		spawn = Game.getObjectById(creep.memory.spawn);

	if (creep.pos.isNearTo(spawn)) {
		if (creep.carry[RESOURCE_ENERGY] && creep.transfer(spawn, RESOURCE_ENERGY) === OK)
			return;
		spawn.recycleCreep(creep);
	} else {
		creep.moveTo(spawn, { reusePath: 10 });
		if (creep.hits < creep.hitsMax)
			creep.heal(creep);
	}
};