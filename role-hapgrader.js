/**
 * role-hapgrader.js
 */
'use strict';

/* global CREEP_UPGRADE_RANGE */

/* const memory = { role: 'hapgrader', site: site };
return spawn.submit({ body, memory, priority: 10 });
}, */

module.exports = {
	body: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
	init: function () {
		this.memory.site = this.room.controller.pos.findFirstInRange(FIND_SOURCES, CREEP_UPGRADE_RANGE).id;
	},
	run: function () {
		var source = Game.getObjectById(this.memory.site);
		if (!this.pos.isNearTo(source))
			this.moveTo(source, { reusePath: 5, range: 1 });

		if (this.ticksToLive & 1 === 0) {
			this.harvest(source);
		}

		/* eslint-disable indent */
		switch (this.upgradeController(this.room.controller)) {
			case OK:
				if (!this.memory.arrival)
					this.memory.arrival = CREEP_LIFE_TIME - this.ticksToLive;
				break;
			case ERR_NOT_IN_RANGE:
				this.moveTo(source, { reusePath: 5, range: CREEP_UPGRADE_RANGE });
				break;
		}
	}
};