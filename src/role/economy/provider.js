/**
 * role.provider.js - Just the filling side of energy 
 */
// Game.spawns.Spawn1.submit({body: [MOVE,CARRY,MOVE,CARRY], memory: {role: 'provider'}, priority: 100})
'use strict';

import { canReceiveEnergy, canProvideEnergy } from '/lib/filter';
import { Log, LOG_LEVEL } from '/os/core/Log';

import * as Itr from '/os/core/itr';

export default {
	init: function () {
		// Called on successful create
	},
	run: function () {
		if (this.memory.stuck > 5)
			this.wander();
		const target = this.getUniqueTargetItr(
			function* ({ room }) {
				yield* Itr.filter(room.structuresMy, s => s.structureType !== STRUCTURE_LINK && s.store == null);
				const { container } = room.controller;
				if (container && container.storedPct < 0.5 && room.controller.level < MAX_ROOM_LEVEL)
					yield room.controller.container;
				yield* room.creeps;
			},
			({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'provider' && c.memory.tid }).map(c => c.memory.tid),
			(c, creep) => {
				if (c instanceof Creep && (!['builder', 'repair'].includes(c.getRole()) || c.memory.stuck < 2))
					return false;
				if (c instanceof StructureNuker && (!c.room.storage || c.room.storage.stock < 1.0))
					return false;
				return canReceiveEnergy(c) && c.pos.roomName === creep.pos.roomName;
			},
			(candidates, creep) => Itr.min(candidates, s => (1 + canReceiveEnergy(s)) * s.pos.getRangeTo(creep.pos))
		);

		if (!target) {
			return this.defer(_.random(3, 7)); // Maybe park somewhere out of the way
		}
		if (this.carry[RESOURCE_ENERGY] === 0 || Math.random() > 0.7 + (this.carry[RESOURCE_ENERGY] / this.carryCapacity))
			return this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: false, ignoreControllerContainer: true }); // Return, we want target selection to run again and double check the target.
		const amount = target.energyCapacityAvailable || target.storageCapacityAvailable || target.carryCapacityAvailable;
		const status = this.transfer(target, RESOURCE_ENERGY, Math.min(this.carry[RESOURCE_ENERGY], amount));
		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(target, {
				range: 1,
				ignoreRoads: (this.carryTotal <= (this.carryCapacity / 2)),
				ignoreCreeps: this.memory.stuck < 3,
				maxRooms: 1
		});
		else if (status !== OK)
			Log.error(`${this.name}/${this.pos} Failed to transfer ${amount} energy to ${target} at ${target.pos} status ${status}`, 'Creep');
	}
};