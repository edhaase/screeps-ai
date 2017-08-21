/**
 * Filter.js
 *
 * Global store of predefined filters.
 */
"use strict";

module.exports = {

	isObstacle(thing) {
		return OBSTACLE_OBJECT_TYPES.includes(thing.structureType)
			|| (thing instanceof StructureRampart && !thing.my && !thing.isPublic);
	},

	/**
	 * Unauthorized hostiles (Structures or creep)
	 */
	unauthorizedHostile: function (thing) {
		return (Player.status(thing.owner.username) === PLAYER_HOSTILE) && !thing.my;
	},

	unauthorizedCombatHostile: function (creep) {
		// return (Player.status(creep.owner.username) === PLAYER_HOSTILE) && !creep.my && (creep.hasActiveBodypart(ATTACK) || creep.hasActiveBodypart(RANGED_ATTACK));
		return (Player.status(creep.owner.username) === PLAYER_HOSTILE) && !creep.my && creep.canFight;
	},

	/**
	 * Used in room-level update find dropped resources to limit what we go after.
	 */
	droppedResources: function (res) {
		return ((res.resourceType === RESOURCE_ENERGY)
			|| res.room.terminal !== undefined)
			&& res.amount > 10
			&& !res.pos.isOnRoomBorder()
		;
	},

	storedResources: function (s) {
		return ((s.structureType === STRUCTURE_CONTAINER && _.sum(s.store) > 0)
			// Don't take from links, leave that to others? We're wasting energy triggering exces balances
			// || ((s.structureType == STRUCTURE_LINK) && s.energy > 50)
			// || ((s.structureType == STRUCTURE_TERMINAL) && s.store.energy > 10000)
			|| ((s.structureType === STRUCTURE_STORAGE) && _.sum(s.store) > 0 && ((s.room.energyAvailable / s.room.energyCapacityAvailable) < 0.5))
		);
	},

	loadedTower: s => s.structureType === STRUCTURE_TOWER && s.energy > TOWER_ENERGY_COST,

	/**
	 * Filter for room objects that can provide energy
	 */
	canProvideEnergy: function (thing, min = 40000) {
		if (thing instanceof Resource
			&& thing.resourceType === RESOURCE_ENERGY
			&& this.droppedResources(thing))
			return true;
		else if (thing instanceof Structure) {
			if (thing.structureType === STRUCTURE_LINK && thing.energy > 0) return true;
			if (thing.structureType === STRUCTURE_CONTAINER && thing.store[RESOURCE_ENERGY] > 10) return true;
			if (thing.structureType === STRUCTURE_STORAGE && (thing.store[RESOURCE_ENERGY] > 0)) return true;
			if (thing.structureType === STRUCTURE_TERMINAL && thing.store[RESOURCE_ENERGY] > min) return true;
			if (thing.structureType === STRUCTURE_SPAWN && _.inRange(thing.room.energyAvailable, SPAWN_ENERGY_START - CARRY_CAPACITY, SPAWN_ENERGY_START + CARRY_CAPACITY - 5) && thing.isIdle()) return true;
		}
		return false;
	},

	/**
	 * Returns pct of energy missing
	 */
	canReceiveEnergy: function (thing) {
		if (!thing.my)
			return 0;
		if (thing instanceof Creep) {
			return 1.0 - (thing.carryTotal / thing.carryCapacity);
		} else {
			if (thing.energy != undefined)
				return (1.0 - thing.energyPct);
			else if (thing.store != undefined)
				return (1.0 - (thing.storedTotal / thing.storeCapacity));
			else
				return 0.0;
		}
	},

	/**
	 *
	 */
	lowEnergyStructures: function (structure) {
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
	}

};

Object.freeze(module.exports);