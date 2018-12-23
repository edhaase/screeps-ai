/**
 * role-miner.js
 *
 * Economy unit. Drop miner. Moves to worksite and mines until he's dead.
 *
 * Memory:
 * 		site: flag name
 *		
 */
'use strict';

/* global CREEP_HARVEST_RANGE, Log */

var ignoreCreeps = true;

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		if (this.hasBodypart(CARRY))
			this.pushState("EnsureStructure", { pos: this.memory.dest, structureType: STRUCTURE_CONTAINER, range: CREEP_HARVEST_RANGE, allowBuild: true, allowMove: false });
		this.pushState("EvadeMove", { pos: this.memory.dest, range: CREEP_HARVEST_RANGE });
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		var { container, dest, structs } = this.memory;
		if (!dest)
			this.setRole('recycle');
		container = Game.getObjectById(container);
		if (container) {
			/* if(!container) {
				delete this.memory.container;
				return;
			} */
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && this.hasActiveBodypart(CARRY))
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && this.carry[RESOURCE_ENERGY] > 0)
			// Split resources between repair and container
			if ((this.ticksToLive & 2) && container.hitsMax - container.hits >= (REPAIR_POWER * 6) && this.carryTotal >= this.carryCapacity)
				this.repair(container);
			if (!this.pos.isEqualTo(container.pos) && !container.pos.hasCreep())
				this.moveTo(container, { range: 0 });
		} else {
			dest = _.create(RoomPosition.prototype, dest);
			if (!this.pos.isNearTo(dest)) {
				return this.moveTo(dest, {
					reusePath: 25,
					range: CREEP_HARVEST_RANGE,
					maxRooms: (dest.roomName === this.pos.roomName) ? 1 : undefined,
					costCallback: (name, cm) => LOGISTICS_MATRIX.get(name),
					ignoreCreeps: ((this.memory.stuck < 3) ? ignoreCreeps : false)
				});
			}
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
				const struct = _.find(structs, l => l.energy < l.energyCapacity);
				this.transfer(struct, RESOURCE_ENERGY);
			}
		}

		/* eslint-disable indent */
		const status = this.harvest(source);
		switch (status) {
			case OK:
				if (!this.memory.travelTime) {
					// We've just arrived.
					// this.memory.travelTime = CREEP_LIFE_TIME - this.ticksToLive;
					// Attempt to prevent excess waiting:
					// this.memory.travelTime = Math.max(1, CREEP_LIFE_TIME - this.ticksToLive - 3);
					this.memory.travelTime = CREEP_LIFE_TIME - this.ticksToLive;

					// Look for containers.
					if (!this.memory.container) {
						if (source.container != null)
							this.memory.container = source.container.id;
					}

					// Look for links
					if (!this.memory.structs) {
						structs = _(this
							.lookForNear(LOOK_STRUCTURES, true))
							.map(LOOK_STRUCTURES)
							.filter(s => s.energy != null)
							.value();
						if (structs && !_.isEmpty(structs)) {
							this.memory.structs = _.map(structs, 'id');
							// console.log('Miner found structs: ' + structs);
						}
					}

				}
				// update economy production (2*WORK, but source max or refil delay)
				break;
			case ERR_NOT_ENOUGH_RESOURCES:
				if (source.ticksToRegeneration < this.ticksToLive) {
					Log.info(`[Mining] ${this.name} at ${this.pos} reporting site empty for ${source.ticksToRegeneration} ticks!`);
					this.defer(source.ticksToRegeneration);
				} else {
					this.setRole('recycle');
				}
				break;
			case ERR_NOT_IN_RANGE:
				this.moveTo(source, { range: 1 });
				break;
			default:
				this.say(status);
		}
	}

};