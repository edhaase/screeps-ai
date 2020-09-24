/**
 *
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

export default {
	/* eslint-disable consistent-return */
	run: function () {
		this.memory.home = undefined;
		if (this.memory.attemptedUnboost == null) {
			this.memory.attemptedUnboost = true;
			if (this.isBoosted())
				return this.pushState("UnboostSelf");
		}

		const res = _.findKey(this.carry, (v, k) => v > 0 && k !== RESOURCE_ENERGY);
		if (res)
			return this.pushState('Unload', null);

		if ((Game.time & 3) === 0
			&& this.carryTotal <= 0
			&& !this.isBoosted()
			&& this.getRecycleWorth() <= 0) {
			Log.warn(`${this.name}/${this.pos} not worth recycling -- suiciding`, 'Creep');
			return this.suicide();
		}
		var spawn;
		if (!this.memory.spawn) {
			spawn = this.pos.findClosestSpawn();
			if (!spawn) {
				Log.notify(`${this.name}/${this.pos} unable to find spawn for recycle. Giving up`);
				this.suicide();
			}
			this.memory.spawn = spawn.id;
		} else
			spawn = Game.getObjectById(this.memory.spawn);

		const energy = this.carry[RESOURCE_ENERGY] || 0;
		if (energy > 0 && !this.memory.attemptedUnload) {
			const { storage, terminal } = this.room;
			if (storage || terminal) {
				this.say('Unload!');
				this.memory.attemptedUnload = true;
				return this.pushState('Transfer', { res: RESOURCE_ENERGY, amt: this.carry[RESOURCE_ENERGY], dest: (storage && storage.id) || (terminal && terminal.id) });
			}
		}

		if (this.pos.isNearTo(spawn)) {
			if (energy && this.transfer(spawn, RESOURCE_ENERGY) === OK)
				return;
			spawn.recycleCreep(this);
		} else {
			this.moveTo(spawn, { reusePath: 10, range: 1, allowIncomplete: true });
			if (this.hits < this.hitsMax)
				this.heal(this);
		}
	}
};