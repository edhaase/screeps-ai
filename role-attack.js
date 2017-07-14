/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role-attack');
 * mod.thing == 'a thing'; // true
 */
'use strict'; 
// Game.flags['Kill'].setPosition(new RoomPosition())
/// @todo: doesn't see walls under flag, and ignoreDestructibleStructures can target wrong wall
// @todo: healer's need to stay near attackers always
module.exports = function(creep) {
	let flag = Game.flags['Kill'];
	if(!flag)
		return;
	let pos = flag.pos;

	// move into position
	if(!creep.pos.isNearTo(pos))
		creep.moveTo(pos, {
			ignoreDestructibleStructures: false,
			ignoreCreeps: false,
			ignoreRoads: (creep.plainSpeed === creep.roadSpeed),
		});
		
	let nearby = creep.lookNear(true, 3);
	// find friendlies and heal, find enemies and ranged, find nearby and attack or dismantle
	let threats = creep.room.hostiles;
	let structures = creep.pos.firstInRange(FIND_HOSTILE_STRUCTURES, 1, {filter: t => Player.status(t.owner.username) === PLAYER_HOSTILE});
	
	let canRanged = creep.hasActiveBodyPart(RANGED_ATTACK);
	if(canRanged) {
		threats = creep.pos.findInRange(FIND_HOSTILE_CREEPS)
		structures = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 3,  {filter: t => Player.status(t.owner.username) === PLAYER_HOSTILE})
	}
	
	let canAttack = creep.hasActiveBodyPart(ATTACK);
	let canDismantle = creep.hasActiveBodyPart(DISMANTLE);
	let canHeal = creep.hasActiveBodyPart(HEAL);
	
}

module.exports = function(creep)
{
    // var target = creep.memory.target;
    var flag = Game.flags["Kill"];
	if(!flag)
		return;
	flag = flag.pos;    
	
	if(creep.pos.isNearTo(flag)) {
           var ignoreController = function(structure) {
                if ( structure.structureType === STRUCTURE_CONTROLLER ) return false;
                // if ( structure.structureType === STRUCTURE_WALL ) return false;
                // if ( structure.hits > 100000 ) return false;
                // if ( creep.memory.ignorelist[structure.id] ) return false;
                return true;
            };         
            
        var threat = null;
        // if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS, { filter: ignoreController } );
        // if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
        // if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
        if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: ignoreController } );
        if(threat)
			creep.attack(threat);
    } else {
        creep.moveTo(flag, {
			ignoreDestructibleStructures: false,
			ignoreCreeps: false,
			ignoreRoads: (creep.plainSpeed === creep.roadSpeed),
		}); // unless stuck
        // creep.moveTo(flag);
    }
    
}



/* module.exports = function(creep) {
	let flag = Game.flags['Kill'];
	if(!creep.pos.isNearTo(flag))
		return creep.moveTo()
} */