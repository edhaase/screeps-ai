/**
 * role-thief.js
 *
 * moves to location, steals resources.
 *  needs dest roomName
 *
 * @todo: target lock hostile structures
 * @todo: flee threats?
 */
"use strict";
// _.each(Game.spawns,spawn => spawn.enqueue([MOVE,MOVE,CARRY,CARRY], null, {role:'thief'}))
// let STRUCTURE_CONSTANT = FIND_HOSTILE_STRUCTURES;
// _.each(Game.spawns,spawn => spawn.enqueue(Util.RLD([5,MOVE,5,CARRY]), null, {role:'thief', ttype: FIND_STRUCTURES, dest: 'sim'}))
// _.each(Game.spawns,spawn => spawn.enqueue(Util.RLD([5,MOVE,5,CARRY]), null, {role:'thief', dest: 'E62S41'}))
// _.each(Game.spawns,spawn => Game.spawns['Spawn4'].enqueue(Util.RLD([2,MOVE,2,CARRY]), null, {role:'thief', dest: 'E61S42'}))
module.exports = function (creep) {
	if (creep.hits < creep.hitsMax && creep.canHeal)
		creep.heal(creep);

	if (Game.flags['HOLD'])
		return creep.moveTo(Game.flags['HOLD'], {
			range: 3,
			ignoreCreeps: true
		});

	const { dest, ttype = FIND_HOSTILE_STRUCTURES } = creep.memory;	// Room to disrupt
	const goalRoom = Game.rooms[dest];
	creep.flee();
	if (this.pos.roomName !== dest)
		return this.moveToRoom(dest);
	creep.dropAny();	// Drop any resources we're carrying.

	/**
	 * Generalized target locking rules for thief/disruptor
	 * Looks for all hostile structures.
	 * A target is only valid while it has resource to steal.
	 * Of all candidates, the closest is best.
	 */
	var structure = this.getUniqueTarget(
		() => goalRoom.find(ttype, { filter: s => s.structureType !== STRUCTURE_NUKER }),
		() => _(Game.creeps).filter(c => c.memory.tid).map('memory.tid').value(),
		(s) => (s.energy > 1 || s.storedTotal > 1) && !s.pos.hasRampart(),
		(candidates, { pos }) => pos.findClosestByPath(candidates)
	);
	if (!structure) {
		creep.say('No target!');
		return creep.defer(3);
	}

	/**
	 * Disrupt!
	 */
	if (creep.pos.isNearTo(structure)) {
		creep.withdrawAny(structure);
	} else {
		creep.moveTo(structure, {
			ignoreRoads: true,
			ignoreCreeps: (this.pos.roomName !== dest),
		});
	}
};

