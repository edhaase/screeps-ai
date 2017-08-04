/**
 * role-healer.js
 *
 */
'use strict'; 
// Game.spawns.Spawn1.createCreep([HEAL,MOVE], null, {role:'healer'})
// Game.spawns.Spawn1.createCreep([TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL], null, {role:'healer'})
module.exports = function(creep) {
	var follow = Game.getObjectById(this.memory.follow);
		
	// target lowest health
	// let target = creep.pos.findClosestByRange(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
	// let target = creep.pos.findClosestByRange(FIND_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });		
	// let targets = creep.room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
	// let target = _.min(targets, 'hitPct');
	var healPower = this.getActiveBodyparts(HEAL) * HEAL_POWER;
	let target = this.getTarget(
		({room}) => room.find(FIND_CREEPS),
		// (c) => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c),
		(c) => c.hitsMax - c.hits > healPower && !Filter.unauthorizedHostile(c),
		(candidates, {pos}) => pos.findClosestByPath(candidates)
	);
	if(target) {
		if(creep.pos.isNearTo(target))
			creep.heal(target);
		else
			creep.rangedHeal(target);
		creep.moveTo(target,{range: 1});
	} else {
		// if(creep.pos.roomName != flag.pos.roomName)
		if(!creep.pos.inRangeTo(follow,2))
			creep.moveTo(follow, {range: 2, ignoreCreeps: false}); // unless stuck
	}
}