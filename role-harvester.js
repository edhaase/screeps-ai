/**
 * role-harvest.js
 *
 * Economy unit. Harvests minerals.
 *
 * Memory:
 * 		site: mineral id
 *		cid: container id
 */
"use strict";

module.exports = function (creep) {
	const { site, cid } = creep.memory;
	const mineral = Game.getObjectById(site);
	const container = Game.getObjectById(cid);

	// Move to position
	if (container && !creep.pos.isEqualTo(container))
		return creep.moveTo(container, { reusePath: 7, range: 0 });
	else if (!creep.pos.isNearTo(mineral))
		return creep.moveTo(mineral, { reusePath: 7, range: 1 });

	// Harvest by the clock.
	if (Game.time % (EXTRACTOR_COOLDOWN + 1))
		return;

	// Don't overflow the container.
	if (container && container.storedTotal > CONTAINER_CAPACITY - (HARVEST_MINERAL_POWER * creep.getActiveBodyparts(WORK))) {
		creep.say('\u26F5', true);
		return;
	}

	// Harvest!
	switch (creep.harvest(mineral)) {
	case ERR_NOT_ENOUGH_RESOURCES:
		if (mineral.ticksToRegeneration > creep.ticksToLive) {
			creep.memory.role = 'recycle';
		} else {
			this.defer(mineral.ticksToRegeneration);
		}
		break;
	}
};