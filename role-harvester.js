/**
 * role-harvest.js
 *
 * Economy unit. Harvests minerals.
 *
 * Memory:
 * 		site: mineral id
 *		cid: container id
 */
'use strict';

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function() {
		this.memory.w = this.getActiveBodyparts(WORK);
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { site, cid } = this.memory;
		const mineral = Game.getObjectById(site);
		const container = Game.getObjectById(cid);

		// Move to position
		if (container && !this.pos.isEqualTo(container))
			return this.moveTo(container, { reusePath: 7, range: 0 });
		else if (!this.pos.isNearTo(mineral))
			return this.moveTo(mineral, { reusePath: 7, range: 1 });

		// Harvest by the clock.
		if (Game.time % (EXTRACTOR_COOLDOWN + 1))
			return;

		// Don't overflow the container.
		if (container && container.storedTotal > CONTAINER_CAPACITY - (HARVEST_MINERAL_POWER * this.memory.w)) {
			this.say('\u26F5', true);
			return;
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
		}
	}
};