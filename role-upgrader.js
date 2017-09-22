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
		if (!creep.pos.inRangeTo(creep.room.controller, CREEP_UPGRADE_RANGE))
			creep.moveTo(controller, { range: CREEP_UPGRADE_RANGE });

		if (creep.carry.energy === 0) // && Math.random() < 0.25)
			creep.say('\u26FD', true);
		else if (controller && !controller.upgradeBlocked)
			creep.upgradeController(creep.room.controller);
		else if (controller && controller.upgradeBlocked > creep.ticksToLive) {
			Log.warn(`Recycling upgrader at ${this.pos}, upgrade block exceeds ttl`, 'Creep');
			creep.setRole('recycle');
			return;
		}

		if (Game.time % 3)
			return;
		var adj = _.map(creep.lookForNear(LOOK_STRUCTURES, true), 'structure');
		var avail = _.filter(adj, s => s.structureType === STRUCTURE_LINK || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_TERMINAL || s.structureType === STRUCTURE_STORAGE);
		var target = _.max(avail, c => _.get(c, 'store.energy', c.energy));
		if (target && target !== Infinity && target !== -Infinity) {
			creep.withdraw(target, RESOURCE_ENERGY);
			if (target.hits < target.hitsMax)
				creep.repair(target);
		} else {
			var provider = this.getTarget(
				() => _.map(controller.lookForNear(LOOK_STRUCTURES, true, 3), LOOK_STRUCTURES),
				(c) => Filter.canProvideEnergy(c)
			);
			if (provider) {
				if (this.pull(provider, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
					this.moveTo(provider, { range: 1 });
			}
		}
	}
};