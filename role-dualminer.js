/**
 * role-dualminer.js
 * Handles multiple Sources
 */
'use strict';

// Roughly 1900 for 12 parts if 1:1 move, requires RCL 6
// _(Game.flags).filter(f => f.pos.roomName == 'E59S41' && f.secondaryColor == COLOR_GREY)
// _(Game.flags).filter(f => f.pos.roomName == 'E58S43' && f.secondaryColor == COLOR_GREY)
module.exports = function(creep) {
	let {site} = creep.memory;
	// if(creep.flee())
	//	return;
	
	// if(!site || !_.isString(site)) {
	if(!site || typeof site !== 'string') {
		creep.memory.site = creep.pos.roomName;
		site = creep.pos.roomName;
	}
	
	// If we're not in the room, move to the room.
	if(creep.pos.roomName != site)
		return creep.moveToRoom(site);
	
	// Otherwise find ourselves a target.
	let target = creep.getTarget(
		({room,pos}) => room.find(FIND_SOURCES),
		(source) => source instanceof Source && source.energy > 0,
		(candidates) => creep.pos.findClosestByRange(candidates)	
	);
	if(!target) {
		target = creep.getTarget(
			({room,pos}) => room.find(FIND_SOURCES),
			(source) => source instanceof Source,
			(candidates) => _.min(candidates, 'ticksToRegeneration')
		);			
	}
	if(!target)
		return this.defer(5);
	
	let goal = target.container || target;
	let range = (goal instanceof StructureContainer)?0:1;
	if(!creep.pos.inRangeTo(goal, range))
		creep.moveTo(goal, {
				ignoreCreeps: (creep.memory.stuck || 0) < 3,
				reusePath: 20,
				range: range
			});
	else if(target.energy <= 0 && target.ticksToRegeneration > 1) {
		// if(target && creep.pos.isNearTo(target.pos) && target.energy <= 0 && target.ticksToRegeneration > 1)
		return creep.defer(target.ticksToRegeneration);
	}
	// Harvest the target.
	let status = creep.harvest(target);
	switch(status) {		
		case ERR_NOT_ENOUGH_RESOURCES: // On return trip
		case ERR_NOT_IN_RANGE:	
			creep.moveTo(goal, {
				ignoreCreeps: (creep.memory.stuck || 0) < 3,
				reusePath: 20,
				range: range
			});
			break;					
		case OK:
			break;
		case ERR_INVALID_TARGET:
			console.log('Dual-miner, Invalid target: ' + ex(target));
			this.defer(5);
		default:
			creep.say(status);
	}
	
	// Find stuff in range to fill up
	// if(creep.carry[RESOURCE_ENERGY] > 25 && ((Game.time & 7) === 0)) {
	if(creep.carryCapacityAvailable <= 0) {
		/* let containerTarget = creep.getTarget(
			({room}) => room.structuresByType[STRUCTURE_CONTAINER],
			(container) => container.pos.inRangeTo(creep,1) && container.hits < container.hitsMax,
			_.first,
			'cid'
		) */
		if((goal instanceof StructureContainer) && ((goal.hitsMax - goal.hits) > (this.getActiveBodyparts(WORK) * REPAIR_POWER)))
			return creep.repair(goal);
		
		let transferTarget = creep.getTarget(
			({room}) => room.find(FIND_MY_STRUCTURES),
			(s) => s.pos.inRangeTo(creep, 1) && (s.energyCapacity - s.energy >= 25),
			(structs) => _.min(structs, 'energy'),
			'ttid'
		)
		if(transferTarget)
			creep.transfer(transferTarget, RESOURCE_ENERGY);
	}
}