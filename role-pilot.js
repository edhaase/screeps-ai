/**
 * role-pilot.js
 *
 * 2017-02-23: Can be spawned from a room other than there dest.
 */
"use strict";

const STATE_GATHER = 'g';
const STATE_UNLOAD = 'u';
const STATE_HARVEST = 'h';
const STATE_DEFAULT = STATE_GATHER;

// Game.creeps['scav784'].memory = {role:'pilot', source:'579faa780700be0674d31080', spawn: 'Spawn11'}
// Game.spawns.Spawn11.createCreep([WORK,CARRY,MOVE], null, {role: 'pilot', source: '579faa780700be0674d31082'})
module.exports = {
	run: function (creep) {
		const { room } = creep.memory;
		if (room && creep.pos.roomName !== room)
			return creep.moveToRoom(room);

		var state = creep.getState(STATE_DEFAULT);
		if (creep.carry[RESOURCE_ENERGY] === 0 && state !== STATE_HARVEST && state !== STATE_GATHER)
			creep.setState(STATE_GATHER);
		else if (creep.carry[RESOURCE_ENERGY] === creep.carryCapacity)
			creep.setState(STATE_UNLOAD);
		state = creep.getState(STATE_DEFAULT);
		switch (state) {
		case STATE_GATHER:
			if (this.gatherEnergy() === ERR_INVALID_TARGET)
				creep.setState(STATE_HARVEST);
			break;
		case STATE_HARVEST: {
			const source = this.getTarget(
				({ room }) => room.find(FIND_SOURCES_ACTIVE),
				(s) => (s instanceof Source) && (s.energy > 0 || s.ticksToRegeneration < this.pos.getRangeTo(s)),
				(sources) => this.pos.findClosestByPath(sources)
			);
			creep.harvestOrMove(source);
		} break;
		case STATE_UNLOAD: {
			const {controller} = creep.room;
			if ((controller.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || controller.isEmergencyModeActive()) && !controller.upgradedBlocked) {
				if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE)
					creep.moveTo(creep.room.controller, { range: CREEP_UPGRADE_RANGE });
			} else {
				const goal = this.getTarget(
					({ room }) => room.find(FIND_MY_STRUCTURES),
					function (structure) {
						if (structure.structureType === STRUCTURE_SPAWN && structure.energyPct < 0.95) return true;
						if (structure.structureType === STRUCTURE_EXTENSION && structure.energy < structure.energyCapacity) return true;
						if (structure.structureType === STRUCTURE_TOWER && structure.energy < TOWER_ENERGY_COST) return true;
						return false;
					},
					(candidates) => this.pos.findClosestByPath(candidates)
				) || controller;
				creep.transferOrMove(goal, RESOURCE_ENERGY);
			}
		} break;
		}
	}
};