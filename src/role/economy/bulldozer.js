/**
 * role.bulldozer.js - Removes structures from room.
 *
 * Will remove our structures if the room is unowned
 * 
 * example: {role: 'bulldozer', site: 'W9N1'}
 */
'use strict';

import Body from '/ds/Body';

import { unauthorizedHostile } from '/lib/filter';
/* global Arr, Filter, Log, CREEP_RANGED_ATTACK_RANGE */

/** Never consider these as candidates */
export function bulldozer_rejector_filter(s) {
	if (!s || !CONSTRUCTION_COST[s.structureType])
		return false;
	if (s.structureType === STRUCTURE_CONTROLLER) // || s.structureType === STRUCTURE_RAMPART)
		return false;
	if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER)
		return false;
	return true;
}

/** These can be potential candiddates but we want to validate them */
export function bulldozer_candidate_filter(s, avoidRamparts) {
	if (s.structureType === STRUCTURE_TERMINAL && _.findKey(s.store, (v, k) => k !== RESOURCE_ENERGY))
		return false;
	if (s.structureType === STRUCTURE_STORAGE && _.findKey(s.store, (v, k) => k !== RESOURCE_ENERGY))
		return false;		
	if (s.owner && !unauthorizedHostile(s) && !(s.my && !s.room.my))
		return false;
	return !avoidRamparts || !s.pos.hasRampart(r => !r.isPublic);
}

/** What to pick when picking new targets */
function bulldozer_candidate_selection(candidates) {
	const [high, low] = _.partition(candidates, s => s.owner);
	var target;
	if (high && high.length)
		target = this.pos.findClosestByPath(high);
	if (!target && low && low.length)
		target = this.pos.findClosestByPath(low);
	if (target && target.my)
		target.notifyWhenAttacked(false);
	return target;
}

export default {
	boosts: ['ZH', 'ZH2O', 'XZH2O'],
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Body.repeat([WORK, MOVE], room.energyCapacityAvailable);
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { home, avoidRamparts = true } = this.memory;
		const target = this.getTarget(
			({ room }) => room.find(FIND_STRUCTURES, { filter: s => bulldozer_rejector_filter(s) }),
			(s) => bulldozer_candidate_filter(s, avoidRamparts),
			(candidates) => bulldozer_candidate_selection.call(this, candidates)
		);

		if (!target) {
			if (avoidRamparts) {
				this.memory.avoidRamparts = false;
				return;
			} else {
				if (this.memory.sites && this.memory.sites.length) {
					this.say('NEXT!');
					return this.memory.home = this.memory.sites.shift();
				}
				Log.warn(`${this.name}/${this.pos.roomName} bulldozer found no target`, 'Creep');
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