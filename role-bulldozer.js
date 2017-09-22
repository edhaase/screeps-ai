/**
 * role-bulldozer.js
 *
 * Removes old hostile structures from room.
 */
"use strict";
// Game.spawns['Spawn6'].enqueue(Util.RLD([20,ATTACK,20,MOVE]), null, {role: 'bulldozer', site: });
// Game.spawns['Spawn6'].enqueue(Util.RLD([2,RANGED_ATTACK,2,ATTACK,4,MOVE]), null, {role: 'bulldozer', site: 'E58S40'});
module.exports = function (creep) {
	const { site, avoidRamparts = true } = creep.memory;
	if (site && creep.pos.roomName !== site)
		return creep.moveToRoom(site);
	/* let target = null;
	if(!creep.cache.target || !(target=Game.getObjectById(creep.cache.target))) {
		let thing = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.structureType !== STRUCTURE_CONTROLLER});		
		if(!thing)
			return Log.warn("bulldozer: no target. recycle.");
		creep.cache.target = thing.id;
		target = thing;
	} */
	let target = null;
	if (avoidRamparts) {
		target = this.getTarget(
			({ room }) => room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART }),
			(s) => Filter.unauthorizedHostile(s) && !s.pos.hasRampart(),
			(candidates) => this.pos.findClosestByPath(candidates)
		);
	} else {
		target = this.getTarget(
			({ room }) => room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART }),
			(s) => Filter.unauthorizedHostile(s),
			(candidates) => this.pos.findClosestByPath(candidates)
		);
	}

	if (!target) {
		if (avoidRamparts) {
			this.memory.avoidRamparts = false;
			return;
		} else {
			Log.warn('Bulldozer: No target');
			return this.setRole('recycle');
		}
	}
	const range = creep.pos.getRangeTo(target);
	if (range <= CREEP_RANGED_ATTACK_RANGE && creep.hasActiveBodypart(RANGED_ATTACK))
		creep.rangedAttack(target);
	if (range > 1)
		creep.moveTo(target);
	else if (creep.hasActiveBodypart(WORK))
		creep.dismantle(target);
	else if (creep.hasActiveBodypart(ATTACK))
		creep.attack(target);
};