/**
 * role.attacker.js
 *
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.attack');
 * mod.thing == 'a thing'; // true
 */
'use strict';

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// Depends..
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		var flag = Game.flags["Kill"];
		if (!flag)
			return;
		flag = flag.pos;

		if (this.pos.isNearTo(flag)) {
			var ignoreController = function (structure) {
				if (structure.structureType === STRUCTURE_CONTROLLER) return false;
				// if ( structure.structureType === STRUCTURE_WALL ) return false;
				// if ( structure.hits > 100000 ) return false;
				// if ( this.memory.ignorelist[structure.id] ) return false;
				return true;
			};

			var threat = null;
			// if ( !threat ) threat = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
			if (!threat) threat = this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS, { filter: ignoreController });
			// if ( !threat ) threat = this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
			// if ( !threat ) threat = this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
			if (!threat) threat = this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: ignoreController });
			if (threat)
				this.attack(threat);
		} else {
			this.moveTo(flag, {
				ignoreDestructibleStructures: false,
				ignoreCreeps: false,
				ignoreRoads: (this.plainSpeed === this.roadSpeed),
			}); // unless stuck
			// this.moveTo(flag);
		}
	}
};