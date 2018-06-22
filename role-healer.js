/**
 * role-healer.js
 *
 */
'use strict';
// Game.spawns.Spawn1.createCreep([HEAL,MOVE], null, {role:'healer'})
// Game.spawns.Spawn1.createCreep([TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL], null, {role:'healer'})

const DEFAULT_HEALER_FOLLOW_RANGE = 2;
const MAXIMUM_CREEP_IDLE = 80;

module.exports = {
	boosts: ['LO','LHO2','XLHO2','GO','GHO2','XGHO2'],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		// Flee at 50% hp, or if we're about to lose our only heal part
		this.memory.fleeAtHp = Math.max(this.hitsMax * 0.60, BODYPART_MAX_HITS * 1.50);
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
		// let target = this.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
		// let target = this.pos.findClosestByRange(FIND_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
		// let targets = this.room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
		// let target = _.min(targets, 'hitPct');
		// var healPower = this.getActiveBodyparts(HEAL) * HEAL_POWER;
		const target = this.getTarget(
			({ room }) => room.find(FIND_CREEPS),
			(c) => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c),
			(candidates, { pos }) => pos.findClosestByPath(candidates)
		);
		if (target) {
			if (this.pos.isNearTo(target))
				this.heal(target);
			else
				this.rangedHeal(target);
			this.moveTo(target, { range: 1 });
		} else if (follow && !this.pos.inRangeTo(follow, DEFAULT_HEALER_FOLLOW_RANGE)) {
			this.moveTo(follow, { range: DEFAULT_HEALER_FOLLOW_RANGE, ignoreCreeps: false }); // unless stuck
		} else if (this.memory.stuck > MAXIMUM_CREEP_IDLE) { // and no target
			this.setRole('recycle');
		}
	}
};