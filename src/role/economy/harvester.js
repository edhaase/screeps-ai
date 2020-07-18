/**
 * role.harvest.js
 *
 * Economy unit. Harvests minerals.
 *
 * Memory:
 * 		site: mineral id
 *		cid: container id
 */
'use strict';

import { ICON_SHIP } from '/lib/icons';

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		this.memory.w = this.getActiveBodyparts(WORK);
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { site, cid } = this.memory;
		const mineral = Game.getObjectById(site);
		const container = Game.getObjectById(cid);

		// Harvest by the clock.
		if (Game.time % (EXTRACTOR_COOLDOWN + 1))
			return;

		// Don't overflow the container.
		if (container && container.storedTotal > CONTAINER_CAPACITY - (HARVEST_MINERAL_POWER * this.memory.w)) {
			this.say(ICON_SHIP, true);
			return;
		}

		// Don't overflow us
		if (this.carryCapacityAvailable < (HARVEST_MINERAL_POWER * this.memory.w * 2)) {
			const res = _.findKey(this.carry);
			this.pushState('Transfer', { res, amt: this.carry[res], dest: container.id });
		}

		// Harvest!
		switch (this.harvest(mineral)) {
			case ERR_NOT_ENOUGH_RESOURCES:
				if (mineral.ticksToRegeneration > this.ticksToLive) {
					this.setRole('recycle');
				} else {
					this.defer(mineral.ticksToRegeneration);
				}
				break;
			case ERR_NOT_IN_RANGE:
				this.pushState('MoveTo', { pos: mineral.pos, range: 1 });
				break;
		}
	}
};