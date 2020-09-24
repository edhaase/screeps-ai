/**
 * role.provider.js - Just the filling side of energy 
 */
// Game.spawns.Spawn1.submit({body: RLD([5,MOVE,5,CARRY], memory: {role: 'provider'}, priority: 100})
'use strict';

import { canReceiveEnergy, canProvideEnergy } from '/lib/filter';
import { CLAMP } from '/os/core/math';
import { Log } from '/os/core/Log';
import * as Itr from '/os/core/itr';
import Body from '/ds/Body';

export const PROVIDER_REFILLS_ROLES = ['upgrader', 'repair', 'builder'];
export const MINIMUM_STOCK_FOR_NUKER_REFILL = 0.25;
export const PROVIDER_IGNORES_STRUCTURE_TYPES = [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TERMINAL];
export const PROVIDER_MINIMUM_PICKUP = 25;
export const PROVIDER_MAX_COST = 1250;
export const PROVIDER_MINIMUM_CREEP_FILL = 25;

export default {
	body: function (spawn) {
		const { room } = spawn;
		const avail = CLAMP(0, room.energyCapacityAvailable, PROVIDER_MAX_COST);
		const weAssumeWeHaveRoads = (room.controller && room.controller.level > 3);
		if (weAssumeWeHaveRoads)
			return Body.repeat([CARRY, CARRY, MOVE], avail)
		else
			return Body.repeat([CARRY, MOVE], avail)
	},
	init: function () {
		// Called on successful create
		this.memory.eca = this.room.energyCapacityAvailable;
	},
	run: function () {
		/**
		 * Always keep energy on hand, so we can start refilling earlier
		 * @todo this currently needs them to be full before they'll go back to work, this may be a problem
		 * @todo could cause issues when pullig from links
		 * @todo deprioritize terminal
		 */
		if (this.carry[RESOURCE_ENERGY] <= 0)
			return this.pushState('AcquireEnergy', {
				allowMove: true, allowHarvest: false, ignoreControllerContainer: true,
				minimum: PROVIDER_MINIMUM_PICKUP,
				allowTerminal: !this.room.storage || this.room.storage.stock < 0.5
			});

		/**
		 * Find targets to fill
		 */
		const target = this.getUniqueTargetItr(
			function* ({ room }) {
				yield* Itr.filter(room.structuresMy, s => !PROVIDER_IGNORES_STRUCTURE_TYPES.includes(s.structureType) && s.store !== null);
				const { container } = room.controller;
				if (container && container.storedPct < 0.5 && room.controller.level < MAX_ROOM_LEVEL)
					yield container;
				yield* room.creeps;
			},
			({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'provider' && c.memory.tid }).map(c => c.memory.tid),
			(sel, creep) => {
				if (sel.locked && sel.locked !== this.name)
					return false;
				if (sel instanceof Creep) {
					if (!PROVIDER_REFILLS_ROLES.includes(sel.getRole()) || sel.memory.stuck < 2)
						return false;
					const avail = Math.min(this.store[RESOURCE_ENERGY] || 0, sel.store.getFreeCapacity(RESOURCE_ENERGY));
					if (avail < PROVIDER_MINIMUM_CREEP_FILL)
						return false;
				}
				if (sel instanceof StructureNuker && (!sel.room.storage || sel.room.storage.stock < MINIMUM_STOCK_FOR_NUKER_REFILL))
					return false;
				if (sel.id === this.transferred)
					return false; // Only set if we acted previously.
				return canReceiveEnergy(sel) && sel.pos.roomName === creep.pos.roomName;
			},
			(candidates, creep) => Itr.min(candidates, s => (1 + canReceiveEnergy(s)) * s.pos.getRangeTo(creep.pos))
		);

		/**
		 * If we don't have a target, hang out near a spawn for quicker refill start,
		 * and opportunistic renewels.
		 */
		if (!target) {
			if (this.memory.stuck >= 3)
				return this.scatter();
			const spawn = this.pos.findClosestByRange(FIND_MY_SPAWNS);			
			if (!spawn) {
				return this.moveTo(this.room.controller, { range: 5 });
			} else if (this.pos.isNearTo(spawn))
				return this.defer(3);
			else return this.moveTo(spawn, { range: 1 });
		} else {
			target.locked = this.name;
		}

		/**
		 * If we're not in range, move closer. This happens before the transfer call,
		 * in case we're currently moving closer to our next target early.
		 */
		if (!this.pos.isNearTo(target)) {
			const status = this.moveTo(target, {
				range: 1,
				maxRooms: 1
			});
			if (status === ERR_NO_PATH)
				return this.clearTarget();
			return status;
		}

		if (this.transferred)
			return; // We have a good target, we may even have moved, but we already moved resources this tick

		/**
		 * Attempt to fill the target
		 */
		const available = this.carry[RESOURCE_ENERGY] || 0;
		const needs = target.store.getFreeCapacity(RESOURCE_ENERGY) || 0;
		const amount = Math.min(available, needs);
		const status = this.transfer(target, RESOURCE_ENERGY, amount);
		if (status !== OK) {
			/** Something else went wrong */
			Log.error(`${this.name}/${this.pos} Failed to transfer ${amount} energy to ${target} at ${target.pos} status ${status}`, 'Creep');
		} else {
			/** We succeeded. Let's see if can pick a new target early */
			this.transferred = target.id;
			const has = target.store[RESOURCE_ENERGY] || 0;
			this.carry[RESOURCE_ENERGY] = Math.max(0, this.carry[RESOURCE_ENERGY] - amount);
			this.runRole(); // Try to pick and move to a new target early
		}
	}
};