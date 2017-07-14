/**
 * role-hapgrader
 */
'use strict';
 
module.exports = function(creep) {
	/**
	 * Ten work parts mean harvest every other or we'll overflow.
	 */
	if(!creep.memory.site) {
		creep.memory.site = creep.room.controller.pos.findFirstInRange(FIND_SOURCES, 3).id;
		if(!creep.memory.site) {
			creep.say("NO SITE");
			return;
		}
	}
	
	var source = Game.getObjectById(creep.memory.site);
	if(!creep.pos.isNearTo(source))
		creep.moveTo(source, {reusePath: 5});
	
	if(!(Game.time%2) ) {
		if(creep.harvest(source) === ERR_NOT_IN_RANGE)
			creep.moveTo(source, {reusePath: 5});		
	}
	
	switch(creep.upgradeController(creep.room.controller)) {
		case OK:
			if(!creep.memory.arrival)
				creep.memory.arrival = CREEP_LIFE_TIME - creep.ticksToLive;
			break;
		case ERR_NOT_IN_RANGE:
			creep.moveTo(source, {reusePath: 5});
			break;			
	}
};