/**
 * counter-intelligence
 * 
 * Cheap spy-hunters
 */
import { unauthorizedHostile } from '/lib/filter';

export default {
	minBody: [RANGED_ATTACK, MOVE],
	init: function () {
	},
	/* eslint-disable consistent-return */
	run: function () {
		// Only go after small targets
		const primary = this.pos.findClosestByPath(FIND_HOSTILE_CREEPS, { filter: c => unauthorizedHostile(c) && c.body.length === 1 });
		if (primary) {
			this.memory.lastId = primary.id;
			this.memory.lastPos = primary.pos;
			const status = this.rangedAttack(primary);
			if (status === ERR_NOT_IN_RANGE)
				this.moveTo(primary);
			
		} else {
			// No target current in range. Check exit log or nearest exit
		}
	
};