/**
 * Dedicated haulers
 *  memory: {role: 'hauler', site, dropoff}
 */
'use strict';

import { ICON_LINK } from "/lib/icons";
import { Log, LOG_LEVEL } from '/os/core/Log';

const HAULER_MINIMUM_TTL_TO_PULL = 60;
const MINIMUM_TTL_TO_HAUL = 60;

export default {
	body: function () {

	},
	init: function () {
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		// if(this.carryCapacityAvailable <= 0) {
		const state = this.getState('U');
		if (state === 'U') {
			if (this.ticksToLive < MINIMUM_TTL_TO_HAUL)
				return this.setRole('recycle');
			this.setState('G');
			this.pushState("MoveTo", { pos: this.memory.site, range: 1, repathPerRoom: false }, false);
			// Find pull candidates?
			const candidate = this.pos.findClosestByRange(this.room.creepsByRole['miner'] || [], { filter: c => c.plainSpeed > 1 && c.memory.dest.roomName === this.memory.site.roomName && c.getState() !== 'Pullee' && c.pos.getRangeToPlain(c.memory.dest) !== 1 });
			if (candidate && this.ticksToLive > HAULER_MINIMUM_TTL_TO_PULL) {
				const range = this.pos.getRangeTo(candidate);
				Log.warn(`${this.name}/${this.pos} wants to pull ${candidate}/${candidate.pos} currently at range ${range}`, 'Creep');
				this.say(ICON_LINK, true);
				this.pushState('Puller', { dest: candidate.memory.dest, range: 1, cargo: candidate.name }, true);
				candidate.pushState('Pullee', { dest: candidate.memory.dest, range: 1, engine: this.name }, false);
			}
			if (!this.memory.dropoff)
				this.setRole('recycle');
			const rp = new RoomPosition(this.memory.dropoff.x, this.memory.dropoff.y, this.memory.dropoff.roomName);
			const container = _.find(rp.lookFor(LOOK_STRUCTURES), s => s.store !== undefined);
			if (container && (_.sum(container.store) < container.storeCapacity - 50) && this.transferAny(container) === OK)
				return;
			// otherwise look for stuff nearby
			var adj = _.map(this.lookForNear(LOOK_STRUCTURES, true), LOOK_STRUCTURES);
			const link = _.find(adj, s => s.structureType === STRUCTURE_LINK); // || s.structureType === STRUCTURE_CONTAINER);
			if (link && this.carry[RESOURCE_ENERGY] && this.transfer(link, RESOURCE_ENERGY) === OK) {
				const diff = Math.min(this.carry[RESOURCE_ENERGY], link.energyCapacityAvailable);
				// this.carry[RESOURCE_ENERGY] -= link.energyCapacityAvailable;
				Object.defineProperty(this.carry, RESOURCE_ENERGY, {
					value: this.carry[RESOURCE_ENERGY] - link.energyCapacityAvailable,
					configurable: true
				});
				Object.defineProperty(link, 'energy', { value: link.energy + diff, configurable: true });
			}
			_.each(this.carry, (amt, type) => amt > 0 && this.drop(type, amt));
		} else if (state === 'G') {
			const { site } = this.memory;
			const pickup = new RoomPosition(site.x, site.y, site.roomName);
			if (pickup.roomName === this.pos.roomName) {
				const dropped = pickup.findInRange(FIND_DROPPED_RESOURCES, 2, { filter: r => r.amount > 100 });
				const structures = _.map(this.lookForNear(LOOK_STRUCTURES, true, 2), LOOK_STRUCTURES);
				const container = _.find(structures, s => s.store != null);
				var pile;
				var limit = this.carryCapacityAvailable;
				if (dropped && dropped.length) {
					const d = _.max(dropped, 'amount');
					if (this.pos.getRangeTo(d) > 1)
						return this.moveTo(d.pos, { range: 1, maxRooms: 1 });
					pile = _.find(dropped, r => this.pickup(r) === OK);
					if (pile)
						limit -= pile.amount;

				}
				if (container && limit >= 0) {
					this.withdrawAny(container, limit);
				}
			}
			this.setState('U');
			this.pushState("MoveTo", { pos: this.memory.dropoff, range: this.memory.range || 1, repathPerRoom: false, allowIncomplete: true });
		}
	}
};
