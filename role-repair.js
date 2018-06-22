/**
 * role-repair
 */
'use strict';

/* global CREEP_REPAIR_RANGE */

const MINIMUM_TTL = 50;

/* eslint-disable consistent-return */
module.exports = {
	boosts: ['LH','LH2O','XLH2O'],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
	},
	/* eslint-disable consistent-return */
	run: function () {
		if (this.hits < this.hitsMax)
			this.flee(7);

		if (this.carry[RESOURCE_ENERGY] === 0) {
			if (this.ticksToLive < MINIMUM_TTL)
				this.setRole('recycle');
			else
				this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		} else {
			var target = this.getTarget(
				({ room }) => room.structures,
				(s) => s.hits < s.hitsMax,
				(weak) => {
					if (!this.room.controller)
						this.setRole('recycle');
					this.say('search!');
					const maxHits = RAMPART_HITS_MAX[this.room.controller.level];
					const center = this.room.getPositionAt(25, 25);
					return _.min(weak, w => (w.hitsEffective / Math.min(maxHits, w.hitsMax)) / w.pos.getRangeTo(center));
				}
			);
			if (!target) {
				Log.notify(`No repair target at ${this.pos}, age: ${(Game.time - this.memory.born)}, ttl: ${this.ticksToLive}`);
				return this.setRole('recycle');
			}

			switch (this.repair(target)) {
			case OK:
				break;
			case ERR_NOT_IN_RANGE:
				this.moveTo(target, {
					reusePath: 10,
					maxRooms: 1,
					range: CREEP_REPAIR_RANGE,
					ignoreRoads: this.memory.ignoreRoad || true
				});
				break;
			}
		}
	}
};