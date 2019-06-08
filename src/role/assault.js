/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.attack');
 * mod.thing == 'a thing'; // true
 */
'use strict';
module.exports.run = function (creep) {
	// var target = creep.memory.target;
	var flag = Game.flags["Kill"].pos;
	if (!this.pos.isNearTo(flag)) {
		return this.moveTo(flag, { ignoreDestructibleStructures: true, reusePath: 3 });
	}
	// Use lookAdjacent for hostiles to attack while moving.

	const [target] = flag.lookFor(LOOK_STRUCTURES);
	if (target) {
		if (this.hasActiveBodypart(WORK))
			return this.dismantle(target);
		else if (this.hasActiveBodypart(ATTACK))
			return this.attack(target);
		// Log.warn(`${this.name}/${this.pos} attacking ${target} status ${status}`, 'Creep');
	}

	var threat = null;
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
	if (!threat) threat = this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS, { filter: Filter.ignoreController });
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
	// if ( !threat ) threat = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
	if (!threat) threat = this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: Filter.ignoreController });
	if (this.hasActiveBodypart(WORK))
		this.dismantle(threat);
	else if (this.hasActiveBodypart(ATTACK))
		this.attack(threat);
    
};