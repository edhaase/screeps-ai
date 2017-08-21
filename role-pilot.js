/**
 * role-pilot.js
 *
 * 2017-02-23: Can be spawned from a room other than there dest.
 */
'use strict';
 
// Game.creeps['scav784'].memory = {role:'pilot', source:'579faa780700be0674d31080', spawn: 'Spawn11'}
// Game.spawns.Spawn11.createCreep([WORK,CARRY,MOVE], null, {role: 'pilot', source: '579faa780700be0674d31082'})
module.exports = {
	run: function(creep) {
		let {room, source, state} = creep.memory;
		if(room && creep.pos.roomName != room)
			return creep.moveToRoom(room);
		
		if(!state)
			creep.memory.state = 'gather';
		else if(creep.carry.energy === 0 && creep.memory.state !== 'harvest' && creep.memory.state !== 'gather')
			creep.memory.state = 'gather';
		else if(creep.carry.energy === creep.carryCapacity)
			creep.memory.state = 'unload';
		
		switch(creep.memory.state) {
			case 'gather':
				if(this.gatherEnergy() === ERR_INVALID_TARGET)
					creep.memory.state = 'harvest';
				break;
			case 'harvest':
				let source = this.getTarget(
					({room}) => room.find(FIND_SOURCES_ACTIVE),
					(source) => (source instanceof Source) && (source.energy > 0 || source.ticksToRegeneration < this.pos.getRangeTo(source)),
					(sources) => this.pos.findClosestByPath(sources)
				);
				creep.harvestOrMove(source);
				break;
			case 'unload':
				let controller = creep.room.controller;
				if(controller.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || controller.isEmergencyModeActive()) {
					if(creep.upgradeLocalController() === ERR_NOT_IN_RANGE)
						creep.moveTo(creep.room.controller, {range: CREEP_UPGRADE_RANGE});
				} else {
					let goal = this.getTarget(
							({room}) => room.find(FIND_MY_STRUCTURES),
							function(structure) {
								if ( structure.structureType === STRUCTURE_SPAWN && structure.energyPct < 0.95 ) return true;
								if ( structure.structureType === STRUCTURE_EXTENSION && structure.energy < structure.energyCapacity ) return true;		
								if ( structure.structureType === STRUCTURE_TOWER && structure.energy < TOWER_ENERGY_COST ) return true;
								return false;
							},
							(candidates) => this.pos.findClosestByPath(candidates)
						);
					if(!goal)
						goal = controller;
					creep.transferOrMove(goal, RESOURCE_ENERGY);
				}
				break;
		}	
	}
}