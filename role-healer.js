/**
 * role-healer.js
 *
 */
"use strict";
// Game.spawns.Spawn1.createCreep([HEAL,MOVE], null, {role:'healer'})
// Game.spawns.Spawn1.createCreep([TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL], null, {role:'healer'})

const DEFAULT_HEALER_FOLLOW_RANGE = 2;
const MAXIMUM_CREEP_IDLE = 80;

module.exports = {
	init: function (creep) {
		// Flee at 50% hp, or if we're about to lose our only heal part
		creep.memory.fleeAtHp = Math.max(creep.hitsMax * 0.60, BODYPART_MAX_HITS * 1.50);
	},
	run: function (creep) {
		var follow = Game.getObjectById(this.memory.follow);
		if (this.hits < this.hitsMax)
			this.heal(this);
		if (this.hits < this.memory.fleeAtHp) {
			this.flee(MINIMUM_SAFE_FLEE_DISTANCE + 3);
			return;
		}
		// target lowest health
		// let target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
		// let target = creep.pos.findClosestByRange(FIND_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
		// let targets = creep.room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
		// let target = _.min(targets, 'hitPct');
		// var healPower = this.getActiveBodyparts(HEAL) * HEAL_POWER;
		const target = this.getTarget(
			({ room }) => room.find(FIND_CREEPS),
			(c) => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c),
			(candidates, { pos }) => pos.findClosestByPath(candidates)
		);
		if (target) {
			if (creep.pos.isNearTo(target))
				creep.heal(target);
			else
				creep.rangedHeal(target);
			creep.moveTo(target, { range: 1 });
		} else if (follow && !creep.pos.inRangeTo(follow, DEFAULT_HEALER_FOLLOW_RANGE)) {
			creep.moveTo(follow, { range: DEFAULT_HEALER_FOLLOW_RANGE, ignoreCreeps: false }); // unless stuck
		} else if (creep.memory.stuck > MAXIMUM_CREEP_IDLE) { // and no target
			creep.setRole('recycle');
		}
	}
};