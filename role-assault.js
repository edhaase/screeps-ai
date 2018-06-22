/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role-attack');
 * mod.thing == 'a thing'; // true
 */
'use strict';
module.exports.run = function (creep) {
	// var target = creep.memory.target;
	var flag = Game.flags["Kill"].pos;
	if (!creep.pos.isNearTo(flag)) {
		creep.moveTo(flag, { ignoreDestructibleStructures: true, reusePath: 3 });
	}
	// Use lookAdjacent for hostiles to attack while moving.

	var threat = null;
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
	if (!threat) threat = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS, { filter: ignoreController });
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
	if (!threat) threat = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: ignoreController });
	creep.attack(threat);
    
};