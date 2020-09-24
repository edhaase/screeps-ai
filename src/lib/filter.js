/**
 * Filter.js
 *
 * Global store of predefined filters.
 */
'use strict';

import { TERMINAL_MINIMUM_ENERGY } from '/prototypes/structure/terminal';
import { FACTORY_MIN_ENERGY, FACTORY_MAX_ENERGY } from '/prototypes/structure/factory';
import { PLAYER_STATUS } from '/Player';

export function isObstacle(thing) {
	return OBSTACLE_OBJECT_TYPES.includes(thing.structureType)
		|| (thing instanceof StructureRampart && !thing.my && !thing.isPublic);
};

/**
 * Unauthorized hostiles (Structures or creep)
 */
export function unauthorizedHostile(thing) {
	return (Player.status(thing.owner.username) <= PLAYER_STATUS.NEUTRAL) && !thing.my;
};

export function unauthorizedCombatHostile(creep) {
	return (Player.status(creep.owner.username) <= PLAYER_STATUS.NEUTRAL) && !creep.my && creep.canFight;
};

/**
 * Used in room-level update find dropped resources to limit what we go after.
 */
export function droppedResources(res) {
	if (!res)
		return false;
	return ((res.resourceType === RESOURCE_ENERGY)
		|| res.room.terminal !== undefined)
		&& res.amount > 10
		&& !res.pos.isOnRoomBorder()
		;
};

export function loadedTower(s) {
	return s.structureType === STRUCTURE_TOWER && s.energy > TOWER_ENERGY_COST && s.isActive();
};

/**
 * Filter for room objects that can provide energy
 */
export function canProvideEnergy(thing) {
	if (thing instanceof Structure && thing.pos.hasWithdrawAccess()) {
		if (thing.structureType === STRUCTURE_FACTORY && thing.store[RESOURCE_ENERGY] > FACTORY_MAX_ENERGY) return true;
		if (thing.structureType === STRUCTURE_LINK && thing.energy > 0) return true;
		if (thing.structureType === STRUCTURE_CONTAINER && thing.store[RESOURCE_ENERGY] > 25) return true;
		if (thing.structureType === STRUCTURE_STORAGE && thing.store[RESOURCE_ENERGY] > 0) return true;
		if (thing.structureType === STRUCTURE_TERMINAL && thing.store[RESOURCE_ENERGY] > TERMINAL_MINIMUM_ENERGY) return true;
		if (thing.structureType === STRUCTURE_SPAWN && thing.energyPct > 0.10 && _.inRange(thing.room.energyAvailable, SPAWN_ENERGY_START - CARRY_CAPACITY, SPAWN_ENERGY_START + CARRY_CAPACITY - 5) && thing.isIdle()) return true;
	} else if (thing instanceof Resource
		&& thing.resourceType === RESOURCE_ENERGY
		&& droppedResources(thing)) {
		return true;
	} else if (thing instanceof Tombstone || thing instanceof Ruin) {
		return thing.store[RESOURCE_ENERGY] > 0;
	}
	return false;
};

/**
 * Returns pct of energy missing
 */
export function canReceiveEnergy(thing) {
	// console.log(`can receive energy: ${thing} ${thing.store && thing.store.getUsedPct(RESOURCE_ENERGY)}`);
	if (thing.my === false)
		return 0.0;
	if (thing instanceof Creep && thing.carryTotal === 0) // Only target creeps if they're entirely empty (or we'll never break target)
		return 1.0;
	else if (thing instanceof StructureFactory)
		return Math.max(0, 1.0 - thing.store[RESOURCE_ENERGY] / FACTORY_MAX_ENERGY);
	// else if (thing.energy != null)
	// return (1.0 - thing.energyPct);
	else if (thing.stock != null)
		return Math.max(0, 1.0 - thing.stock);
	else if (thing.store != null)
		return (1.0 - thing.store.getUsedPct(RESOURCE_ENERGY));
	else
		return 0.0;
};

/**
 *
 */
export function lowEnergyStructures(structure) {
	// if ( structure.structureType === STRUCTURE_SPAWN && structure.energy < structure.energyCapacity ) return true;
	if (structure.structureType === STRUCTURE_SPAWN && structure.energyPct < 0.95) return true;
	if (structure.structureType === STRUCTURE_EXTENSION && structure.energy < structure.energyCapacity) return true;
	if (structure.structureType === STRUCTURE_LINK && structure.energy / structure.energyCapacity < 0.25) return true;
	if (structure.structureType === STRUCTURE_TOWER && structure.energyPct < 0.90) return true;
	if (structure.structureType === STRUCTURE_TERMINAL && structure.store.energy < 40000) return true;
	if (structure.structureType === STRUCTURE_CONTROLLER && structure.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD) return true;
	if (structure.structureType === STRUCTURE_LAB && structure.energyPct < 1) return true;
	if (structure.structureType === STRUCTURE_NUKER && structure.energyPct < 1 && structure.room.energyPct > 0.85 && _.get(structure.room, 'storage.energy', 0) > 25000) return true;
	if (structure.structureType === STRUCTURE_POWER_SPAWN && structure.energyPct < 1) return true;
	return false;
};

export function ignoreController(s) {
	return !s || s.structureType !== STRUCTURE_CONTROLLER;
}