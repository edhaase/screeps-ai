/**
 * role-thief.js
 *
 * moves to location, steals resources.
 *  needs dest roomName
 *
 * @todo: target lock hostile structures
 * @todo: flee threats?
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

	},
	/* eslint-disable consistent-return */
	run: function () {
		if (this.hits < this.hitsMax && this.canHeal)
			this.heal(this);

		if (Game.flags['HOLD'])
			return this.moveTo(Game.flags['HOLD'], {
				range: 3,
				ignoreCreeps: true
			});

		const { dest, ttype = FIND_HOSTILE_STRUCTURES } = this.memory;	// Room to disrupt
		const goalRoom = Game.rooms[dest];
		this.flee();
		if (this.pos.roomName !== dest)
			return this.moveToRoom(dest);
		this.dropAny();	// Drop any resources we're carrying.

		/**
		 * Generalized target locking rules for thief/disruptor
		 * Looks for all hostile structures.
		 * A target is only valid while it has resource to steal.
		 * Of all candidates, the closest is best.
		 */
		var structure = this.getUniqueTarget(
			() => goalRoom.find(ttype, { filter: s => s.structureType !== STRUCTURE_NUKER }),
			() => _(Game.creeps).filter(c => c.memory.tid).map('memory.tid').value(),
			(s) => (s.energy > 1 || s.storedTotal > 1) && !s.pos.hasRampart(),
			(candidates, { pos }) => pos.findClosestByPath(candidates)
		);
		if (!structure) {
			this.say('No target!');
			return this.defer(3);
		}

		/**
		 * Disrupt!
		 */
		if (this.pos.isNearTo(structure)) {
			this.withdrawAny(structure);
		} else {
			this.moveTo(structure, {
				ignoreRoads: true,
				ignoreCreeps: (this.pos.roomName !== dest),
			});
		}
	}
};

