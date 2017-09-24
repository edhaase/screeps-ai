/**
 * role-hapgrader
 */
"use strict";

module.exports = {
	init: function(creep) {
		creep.memory.site = creep.room.controller.pos.findFirstInRange(FIND_SOURCES, CREEP_UPGRADE_RANGE).id;
	},
	run: function (creep) {
		var source = Game.getObjectById(creep.memory.site);
		if (!creep.pos.isNearTo(source))
			creep.moveTo(source, { reusePath: 5, range: 1 });

		if (Game.time % 2 === 0) {
			creep.harvest(source);
		}

		switch (creep.upgradeController(creep.room.controller)) {
		case OK:
			if (!creep.memory.arrival)
				creep.memory.arrival = CREEP_LIFE_TIME - creep.ticksToLive;
			break;
		case ERR_NOT_IN_RANGE:
			creep.moveTo(source, { reusePath: 5, range: CREEP_UPGRADE_RANGE });
			break;
		}
	}
};