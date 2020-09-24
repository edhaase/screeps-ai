/**
 * role.gather.js - Just the gather side of energy, brings back to storage or terminal
 * 
 * A temporary role untl we get universal logistics running
 * 
 * @todo gather minerals
 */
// Game.spawns.Spawn1.submit({body: RLD([3,MOVE,3,CARRY]), memory: {role: 'gather'}, priority: 100})
'use strict';

import { TERMINAL_MINIMUM_ENERGY } from '/prototypes/structure/terminal';
import { canReceiveEnergy, canProvideEnergy } from '/lib/filter';
import { CLAMP } from '/os/core/math';
import { Log } from '/os/core/Log';
import * as Itr from '/os/core/itr';
import Body from '/ds/Body';

// export const PROVIDER_IGNORES_STRUCTURE_TYPES = [STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TERMINAL];
export const GATHER_MINIMUM_PICKUP = 25;
export const GATHER_MAX_COST = 2000;
export const GATHER_MINIMUM_UNLOAD = 50;

function getAmt(thing, resource = RESOURCE_ENERGY) {
	if (typeof thing === 'string')
		thing = Game.getObjectById(thing);
	// return thing.storedTotal || thing.amount || thing.energy;
	return thing.amount || (thing.store && thing.store[resource]) || 0;
}

export default {
	// @todo size on energy income of room? 
	body: function (spawn) {
		const { room } = spawn;
		const avail = CLAMP(0, room.energyCapacityAvailable, GATHER_MAX_COST);
		/* const weAssumeWeHaveRoads = (room.controller && room.controller.level > 3);
		if (weAssumeWeHaveRoads)
			return Body.repeat([CARRY, CARRY, MOVE], avail)
		else */
		return Body.repeat([CARRY, MOVE], avail)
	},
	init: function () {
		// Called on successful create
		this.memory.eca = this.room.energyCapacityAvailable;
	},
	run: function () {
		const { storage, terminal } = this.room;

		if (!terminal && !storage) {
			Log.error(`${this.name}/${this.pos} No storage or terminal -- nowhere to take resources`, 'Creep');
			return this.setRole('recycle');
		}

		/**
		 * If we're full, unload
		 */
		if (this.store.hasNonEnergyResource()) {
			return this.pushState('Unload');
		} else if (this.carryCapacityAvailable <= 0) { // @todo weighted random
			if (storage && storage.stock < 1.0)
				return this.pushState('Transfer', { res: RESOURCE_ENERGY, amt: this.carry[RESOURCE_ENERGY], dest: storage.id });
			else if (terminal)
				return this.pushState('Transfer', { res: RESOURCE_ENERGY, amt: this.carry[RESOURCE_ENERGY], dest: terminal.id });
			return this.defer(3);
		}

		/**
		 * Find targets to pickup
		 */
		const target = this.getUniqueTarget(
			({ room }) => [...room.containers, ...room.resources, ...room.tombstones, ...room.ruins, room.terminal],
			({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'gather' && c.memory.tid }).map(c => c.memory.tid),
			(s, creep) => {
				if (!s)
					return false;
				if (s.locked && s.locked !== this.name)
					return false;
				if (s.id === this.transferred)
					return false;
				if (s instanceof StructureTerminal && (s.store[RESOURCE_ENERGY] <= TERMINAL_MINIMUM_ENERGY || !storage || storage.stock >= 0.5))
					return false;
				// This check is only good if we stop filling the container as well, and we might want energy in it in
				// case the link throughput fails, so let's just not take from it.
				// return canProvideEnergy(s) && (!s.isControllerContainer || s.room.controller.level >= MAX_ROOM_LEVEL);
				return canProvideEnergy(s) && !s.isControllerContainer;
			},
			(candidates, creep) => _.max(candidates, t => Math.min(getAmt(t), creep.carryCapacityAvailable) / creep.pos.getRangeTo(t.pos))
		);

		if (!target) {
			/**
			 * If we don't have a target but we have some energy, go unload anyways
 			*/
			if (this.carry[RESOURCE_ENERGY] >= GATHER_MINIMUM_UNLOAD) { // @todo weighted random
				if (storage && storage.stock < 1.0)
					return this.pushState('Transfer', { res: RESOURCE_ENERGY, amt: this.carry[RESOURCE_ENERGY], dest: storage.id });
				else if (terminal)
					return this.pushState('Transfer', { res: RESOURCE_ENERGY, amt: this.carry[RESOURCE_ENERGY], dest: terminal.id });
				return this.defer(3);
			}
			/**
			 * If we don't have a target, consider hauling for mineral pickup
			 */
			if (terminal && this.carryCapacityAvailable > 100) {
				const container = _.find(this.room.containers, c => _.findKey(c.store, (v, k) => k !== RESOURCE_ENERGY) && c.store.getUsedPct() > 0.5);
				if (container)
					return this.pushState('WithdrawAll', { target: container.id, avoid: [RESOURCE_ENERGY] });
			}
			/**
 			* If we don't have a target, hang out near a source
 			*/
			const source = this.pos.findClosestByRange(FIND_SOURCES);
			if (this.memory.stuck >= 3)
				return this.scatter();
			if (this.pos.inRangeTo(source, 3))
				return this.defer(3);
			return this.moveTo(source, { range: 3, allowIncomplete: true });
		} else {
			target.locked = this.name;
		}

		/**
		 * If we're not in range, move closer. This happens before the transfer call,
		 * in case we're currently moving closer to our next target early.
		 */
		if (!this.pos.isNearTo(target)) {
			return this.moveTo(target, {
				range: 1,
				maxRooms: 1,
				allowIncomplete: true
			});
		}

		if (this.transferred)
			return; // We have a good target, we may even have moved, but we already moved resources this tick

		/**
		 * Attempt to fill the target
		 */
		const available = this.carryCapacityAvailable;
		const has = getAmt(target);
		const amount = Math.min(available, has);
		const status = this.take(target, RESOURCE_ENERGY);
		if (status !== OK) {
			/** Something else went wrong */
			Log.error(`${this.name}/${this.pos} Failed to pickup ${amount} energy from ${target} at ${target.pos} status ${status}`, 'Creep');
		} else {
			/** We succeeded. Let's see if can pick a new target early */
			this.transferred = target.id;
			// const has = target.store[RESOURCE_ENERGY] || 0;
			this.carry[RESOURCE_ENERGY] = Math.min(this.carryCapacity, amount);
			this.runRole(); // Try to pick and move to a new target early
		}
	}
};