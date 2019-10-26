/**
 * role.bulldozer.js - Removes hostile structures from room.
 *
 * example: {role: 'bulldozer', site: 'W9N1'}
 */
'use strict';

/* global Arr, Filter, Log, CREEP_RANGED_ATTACK_RANGE */

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
		const { site, avoidRamparts = true } = this.memory;
		if (site && this.pos.roomName !== site) {
			this.moveToRoom(site);
			return;
		}
		const target = this.getTarget(
			({ room }) => room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART && CONSTRUCTION_COST[s.structureType] }),
			(s) => Filter.unauthorizedHostile(s) && (!avoidRamparts || !s.pos.hasRampart(r => !r.isPublic)),
			(candidates) => this.pos.findClosestByPath(candidates)
		);

		if (!target) {
			if (avoidRamparts) {
				this.memory.avoidRamparts = false;
				return;
			} else {
				Log.warn('Bulldozer: No target');
				this.setRole('recycle');
				return;
			}
		}
		const range = this.pos.getRangeTo(target);
		if (range <= CREEP_RANGED_ATTACK_RANGE && this.hasActiveBodypart(RANGED_ATTACK))
			this.rangedAttack(target);
		if (range > 1) {
			this.moveTo(target);
		} else if (this.hasActiveBodypart(WORK))
			this.dismantle(target);

	}
};