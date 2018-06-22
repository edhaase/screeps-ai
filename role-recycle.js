/**
 *
 */
'use strict';

module.exports = {
	/* eslint-disable consistent-return */
	run: function () {
		if (BUCKET_LIMITER)
			return this.suicide();
		this.memory.home = undefined;
		if ((Game.time & 3) === 0
			&& this.carryTotal <= 0
			&& !this.isBoosted()
			&& this.getRecycleWorth() <= 0) {
			Log.warn(`Creep ${this.name} at ${this.pos} not worth recycling, suiciding`, 'Creep');
			return this.suicide();
		}
		var spawn;
		if (!this.memory.spawn) {
			spawn = this.pos.findClosestSpawn();
			if (!spawn) {
				Log.notify(`Creep ${this.name} unable to find spawn for recycle. Giving up`);
				this.suicide();
			}
			this.memory.spawn = spawn.id;
		} else
			spawn = Game.getObjectById(this.memory.spawn);

		if (this.pos.isNearTo(spawn)) {
			if (this.carry[RESOURCE_ENERGY] && this.transfer(spawn, RESOURCE_ENERGY) === OK)
				return;
			spawn.recycleCreep(this);
		} else {
			this.moveTo(spawn, { reusePath: 10, range: 1 });
			if (this.hits < this.hitsMax)
				this.heal(this);
		}
	}
};