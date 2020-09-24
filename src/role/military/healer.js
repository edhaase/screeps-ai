/**
 * role.healer.js
 *
 * @todo stop summoning this during invasions
 */
'use strict';

const DEFAULT_HEALER_FOLLOW_RANGE = 2;
const MAXIMUM_CREEP_IDLE = CREEP_LIFE_TIME / 2;

import { unauthorizedHostile } from '/lib/filter';

export default {
	boosts: ['LO', 'LHO2', 'XLHO2', 'GO', 'GHO2', 'XGHO2'],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		// Flee at 50% hp, or if we're about to lose our only heal part
		this.memory.fleeAtHp = Math.max(this.hitsMax * 0.60, BODYPART_MAX_HITS * 1.50);
		this.memory.acted = Game.time;
	},
	/* eslint-disable consistent-return */
	run: function () {
		var follow = Game.getObjectById(this.memory.follow);
		if (this.hits < this.hitsMax)
			this.heal(this);
		if (this.hits < this.memory.fleeAtHp) {
			this.flee(MINIMUM_SAFE_FLEE_DISTANCE + 3);
			return;
		}
		// target lowest health
		const target = this.getTarget(
			({ room }) => room.find(FIND_CREEPS, { filter: c => !this.memory.gid || this.squad.includes(c) }),
			(c) => c.hits < c.hitsMax && !unauthorizedHostile(c),
			(candidates, { pos }) => pos.findClosestByPath(candidates)
		);
		if (target) {
			if (this.pos.isNearTo(target))
				this.heal(target);
			else
				this.rangedHeal(target);
			this.moveTo(target, { range: 1 });
			this.memory.acted = Game.time;
		} else if (follow && !this.pos.inRangeTo(follow, DEFAULT_HEALER_FOLLOW_RANGE)) {
			this.moveTo(follow, { range: DEFAULT_HEALER_FOLLOW_RANGE, ignoreCreeps: false }); // unless stuck
		} else if (this.squad && this.squad.length) {
			this.moveTo(this.pos.findClosestByRange(this.squad), { range: DEFAULT_HEALER_FOLLOW_RANGE });
		} else if (this.memory.stuck > 5) {
			this.wander();
		} else if (Game.time - this.memory.acted > MAXIMUM_CREEP_IDLE) { // and no target
			this.setRole('recycle');
		}
	}
};