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
	boosts: ['ZH', 'ZH2O', 'XZH2O'],
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Arr.repeat([WORK, MOVE], room.energyAvailable);
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { avoidRamparts = true } = this.memory;
		const target = this.getTarget(
			({ room }) => room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART }),
			(s) => Filter.unauthorizedHostile(s) && (!avoidRamparts || !s.pos.hasRampart(r => !r.isPublic)),
			(candidates) => this.pos.findClosestByPath(candidates)
		);

		if (!target) {
			if (avoidRamparts) {
				this.memory.avoidRamparts = false;
				return;
			} else {
				this.memory.avoidRamparts = true;
				return this.pushState('Breach', this.pos.roomName);
			}
		}
		const range = this.pos.getRangeTo(target);
		if (range <= CREEP_RANGED_ATTACK_RANGE && this.hasActiveBodypart(RANGED_ATTACK))
			this.rangedMassAttack();
		if (range > 1) {
			this.moveTo(target);
			const wall = this
		} else if (this.hasActiveBodypart(WORK))
			this.dismantle(target);
		else if (this.hasActiveBodypart(ATTACK))
			this.attack(target);
	}
};