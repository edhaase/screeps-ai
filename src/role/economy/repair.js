/**
 * role.repair
 */
'use strict';

/* global CREEP_REPAIR_RANGE */

import { ICON_REPAIR } from '/lib/icons';
import Body from '/ds/Body';
import { Log, LOG_LEVEL } from '/os/core/Log';

const MINIMUM_TTL = 50;
const IMMEDIATE_THRESHOLD = 1000;

/* eslint-disable consistent-return */
export default {
	boosts: ['LH', 'LH2O', 'XLH2O'],
	priority: function () {
		// (Optional)
	},
	body: function ({ body }, opts) {
		const { ept } = opts || {};
		const pattern = [WORK, CARRY, MOVE, MOVE];
		const cost = UNIT_COST(pattern);
		const can = Math.floor(room.energyCapacityAvailable / cost);
		return Body.repeat(pattern, cost * Math.min(ept, can));
	},
	init: function () {
		this.memory.repairPower = this.repairPower;
		this.memory.repairCost = this.memory.repairPower * REPAIR_COST; // Pre-boost
	},
	/* eslint-disable consistent-return */
	run: function () {
		if (this.hits < this.hitsMax)
			this.flee(7);

		if (this.carry[RESOURCE_ENERGY] === 0) {
			if (this.ticksToLive < MINIMUM_TTL)
				this.setRole('recycle');
			else
				this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		} else {
			var target = this.getUniqueTarget(
				({ room }) => room.structures,
				({ room }) => room.find(FIND_MY_CREEPS, { filter: c => c.getRole() === 'repair' && c.memory.tid }).map(c => c.memory.tid),
				(s) => (s.hits + this.memory.repairPower) <= s.hitsMax && CONSTRUCTION_COST[s.structureType],
				(weak) => {
					if (!this.room.controller)
						this.setRole('recycle');
					this.memory.repairPower = this.repairPower;
					this.say('search!');
					const [immediate, normal] = _.partition(weak, s => s.hits < IMMEDIATE_THRESHOLD);
					if (immediate && immediate.length)
						return _.min(immediate, 'hits');
					const [walls, infrastructure] = _.partition(normal, s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART);
					if (infrastructure && infrastructure.length) {
						/* const {visual} = this.room;
						for(const s of infrastructure) {
							const score = _.round(Math.min(this.carry[RESOURCE_ENERGY] / REPAIR_COST, s.hitsMax - s.hits) / this.memory.repairPower / this.pos.getRangeTo(s), 3);
							visual.text(score, s.pos);
						} */
						return _.max(infrastructure, s => Math.min(this.carry[RESOURCE_ENERGY] / REPAIR_COST, s.hitsMax - s.hits) / this.memory.repairPower / this.pos.getRangeTo(s)); // Pick target we can do the most work on?
					}
					const maxHits = RAMPART_HITS_MAX[this.room.controller.level];
					const center = this.room.getPositionAt(25, 25);
					return _.min(walls, w => (w.hitsEffective / Math.min(maxHits, w.hitsMax)) / w.pos.getRangeTo(center));
				}
			);
			if (!target) {
				Log.notify(`${this.name}/${this.pos} No repair target, age: ${(Game.time - this.memory.born)}, ttl: ${this.ticksToLive}`);
				return this.setRole('recycle');
			}

			// Remove road hiding under impassable obstacles, but not tunnels
			if (target && target.structureType === STRUCTURE_ROAD && target.pos.hasObstacle(false))
				return target.destroy();

			const status = this.repair(target);
			switch (status) {
				case OK:
					if (Math.random() < 0.05)
						this.say(ICON_REPAIR, true);
					break;
				case ERR_NOT_IN_RANGE:
					this.moveTo(target, {
						reusePath: 10,
						maxRooms: 1,
						range: CREEP_REPAIR_RANGE,
					});
					break;
			}
		}
	}
};