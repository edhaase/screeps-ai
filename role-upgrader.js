/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role-upgrader');
 * mod.thing == 'a thing'; // true
 */
"use strict";

/* module.exports = function run(creep) {
    if(!creep.memory.state)
        creep.memory.state = 'gather';
    
    if(creep.carry.energy >= creep.carryCapacity) {
        creep.memory.state = 'unload';
		this.clearTarget();
	}
    if(creep.carry.energy == 0)
        creep.memory.state = 'gather';
        
	var {controller} = creep.room;
	if(controller.memory.rclAvgTick)
		creep.say(_.round(controller.memory.rclAvgTick,2));
		
    if(creep.memory.state == 'gather') { // || creep.carry.energy < creep.carryCapacity) {
		creep.gatherEnergy();       
    } else {
		var status = creep.upgradeController(creep.room.controller);
		switch( status ) {
			case ERR_NOT_IN_RANGE:
				creep.moveTo(creep.room.controller, { reusePath: 5, ignoreCreeps: (creep.memory.stuck < 3), range: CREEP_UPGRADE_RANGE, maxRooms: 1});
				break;
			case ERR_NOT_ENOUGH_RESOURCES:
				creep.memory.state = 'gather';
				break;			
		}
    }		
}; */

module.exports = {
	init: function (creep) {

	},
	run: function (creep) {
		const { controller } = creep.room;
		if (creep.carry[RESOURCE_ENERGY] === 0)
			creep.say('\u26FD', true);
		else if (controller && !controller.upgradeBlocked) {
			if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE)
				creep.moveTo(controller, { range: CREEP_UPGRADE_RANGE });
		} else if (controller && controller.upgradeBlocked > creep.ticksToLive) {
			Log.warn(`${this.pos.roomName}: Upgrade block exeeds creep ttl, recycling ${this.name}`, 'Creep');
			creep.setRole('recycle');
			return;
		}

		if (Game.time % 3 || creep.carry[RESOURCE_ENERGY] / creep.carryCapacity > 0.75)
			return;
		const provider = this.getTarget(
			() => _.map(controller.lookForNear(LOOK_STRUCTURES, true, CREEP_UPGRADE_RANGE), LOOK_STRUCTURES),
			(c) => Filter.canProvideEnergy(c)
		);
		if (!provider)
			return;
		if (this.pull(provider, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
			this.moveTo(provider, { range: 1 });
	}
};