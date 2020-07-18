/**
 * role.miner.js
 *
 * Economy unit. Drop miner. Moves to worksite and mines until he's dead.
 *
 * Memory:
 * 		site: flag name
 *		
 */
'use strict';

import Body from '/ds/Body';
import { RLD } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';

const MINING_BODIES = [
	// [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE],
	[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE], // 5 work, 1 carry, 3 move
	[WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE],
	[WORK, WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, WORK, MOVE],
	[WORK, WORK, WORK, MOVE],
	[WORK, WORK, MOVE]
];

const { period = 1 } = POWER_INFO[PWR_REGEN_SOURCE];

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function (spawn, job) {
		const { harvestParts } = job;
		// First try the optimal body
		const workParts = Math.ceil(harvestParts) + 1;
		const moveParts = (workParts + 1) / 2;
		const ideal = Body.rld([1, CARRY, workParts, WORK, moveParts, MOVE]);
		const cost = ideal.cost();
		const eca = spawn.room.energyCapacityAvailable;
		Log.debug(`Miner body wants ${[1, CARRY, workParts, WORK, moveParts, MOVE]} at ${cost} / ${eca}`);
		if (cost <= eca)
			return ideal;
		// Otherwise, find one that fits
		return _.find(MINING_BODIES, b => UNIT_COST(b) <= spawn.room.energyCapacityAvailable);
	},
	init: function () {
		if (this.hasBodypart(CARRY))
			this.pushState("EnsureStructure", { pos: this.memory.dest, structureType: STRUCTURE_CONTAINER, range: CREEP_HARVEST_RANGE, allowBuild: true, allowMove: false, minLevel: 2 });
		this.pushState("EvadeMove", { pos: this.memory.dest, range: CREEP_HARVEST_RANGE });
		this.pushState("EvadeMove", { pos: this.memory.dest, range: CREEP_HARVEST_RANGE + 2, allowIncomplete: true });
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		var { container, dest, structs } = this.memory;
		if (!dest)
			this.setRole('recycle');
		container = Game.getObjectById(container);
		if (container) {
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && this.hasActiveBodypart(CARRY))
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && this.carry[RESOURCE_ENERGY] > 0)
			// Split resources between repair and container
			if ((this.ticksToLive & 2) && container.hitsMax - container.hits >= (REPAIR_POWER * 6) && this.carryTotal >= this.carryCapacity)
				this.repair(container);
			if (!this.pos.isEqualTo(container.pos) && !container.pos.hasCreep())
				return this.pushState("EvadeMove", { pos: container.pos, range: 0 });
		} else {
			dest = new RoomPosition(dest.x, dest.y, dest.roomName);
			if (!this.pos.inRangeTo(dest, CREEP_HARVEST_RANGE))
				return this.pushState("EvadeMove", { pos: dest, range: CREEP_HARVEST_RANGE });
		}

		var source = this.getTarget(
			() => this.room.find(FIND_SOURCES),
			(s) => s.pos.roomName === this.pos.roomName,
			(s) => this.pos.findClosestByRange(s)
		);

		if (this.carry[RESOURCE_ENERGY] > 25 && structs && structs.length > 0) {
			structs = _.map(structs, lid => Game.getObjectById(lid));
			structs = _.compact(structs);
			if (structs && !_.isEmpty(structs)) {
				const struct = _.find(structs, l => l.energy < l.energyCapacity && l.my);
				this.transfer(struct, RESOURCE_ENERGY);
			}
		}

		/* eslint-disable indent */
		const status = this.harvest(source);
		switch (status) {
			case OK:
				if (!this.memory.travelTime) {
					this.memory.travelTime = CREEP_LIFE_TIME - this.ticksToLive;

					// Look for containers.
					if (!this.memory.container && source.container != null)
						this.memory.container = source.container.id;

					// Look for links
					if (!this.memory.structs) {
						structs = _(this
							.lookForNear(LOOK_STRUCTURES, true))
							.map(LOOK_STRUCTURES)
							.filter(s => s.energy != null && s.my)
							.value();
						if (structs && !_.isEmpty(structs)) {
							this.memory.structs = _.map(structs, 'id');
						}
					}

				}
				break;
			case ERR_NOT_ENOUGH_RESOURCES:
				if (source.ticksToRegeneration >= this.ticksToLive)
					return this.setRole('recycle');
				if (source.hasEffect(PWR_REGEN_SOURCE))
					return this.defer(5);
				// Log.info(`${this.name}/${this.pos} reporting site empty for ${source.ticksToRegeneration} ticks!`, 'Mining');
				// this.defer(source.ticksToRegeneration);
				this.defer(period);
				break;
			case ERR_NOT_IN_RANGE:
				this.moveTo(source, { range: CREEP_HARVEST_RANGE });
				break;
			default:
				this.say(status);
		}
	}

};