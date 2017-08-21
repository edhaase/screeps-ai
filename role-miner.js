/**
 * role-miner.js
 *
 * Economy unit. Drop miner. Moves to worksite and mines until he's dead.
 *
 * Memory:
 * 		site: flag name
 *		
 */
"use strict";
var ignoreCreeps = true;

module.exports = {
	init: function (creep) {
		// Can't memorize container yet, we might not be able to see it.
		// console.log('Creep init: ' + ex(creep));
	},
	run: function (creep) {
		var { container, dest, structs } = creep.memory;
		if (!dest)
			this.setRole('recycle');
		// var flag = Game.flags[site];
		// if(!flag && !dest) {
		//	creep.say("NO SITE");
		//	return;
		// }

		// if(flag)
		//	dest = flag.pos;
		container = Game.getObjectById(container);
		if (container) {
			/* if(!container) {
				delete this.memory.container;
				return;
			} */
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && creep.hasActiveBodypart(CARRY))
			// if(container.hitsMax - container.hits > (REPAIR_POWER * 6) && creep.carry[RESOURCE_ENERGY] > 0)
			// Split resources between repair and container
			if ((Game.time & 2) && container.hitsMax - container.hits > (REPAIR_POWER * 6) && creep.carryTotal >= creep.carryCapacity)
				creep.repair(container);
			if (!creep.pos.isEqualTo(container.pos))
				creep.moveTo(container, { range: 0 });
		} else {
			dest = _.create(RoomPosition.prototype, dest);
			if (!creep.pos.isNearTo(dest)) {
				return creep.moveTo(dest, {
					reusePath: 25,
					range: 1,
					costCallback: (name, cm) => logisticsMatrix[name],
					ignoreCreeps: ((creep.memory.stuck < 3) ? ignoreCreeps : false)
				});
			}
		}

		// Harvest source
		/* if(source)
			source = Game.getObjectById(source);
		else {
			var parts = flag.name.split("_");
			var sourceId = parts[1];	
			source = Game.getObjectById(sourceId); 
			creep.memory.source = source.id;
		} */
		var source = this.getTarget(
			() => this.room.find(FIND_SOURCES),
			() => true,
			(s) => this.pos.findClosestByRange(s)
		);



		if (creep.carry.energy > 25 && structs && structs.length > 0) {
			structs = _.map(structs, lid => Game.getObjectById(lid));
			structs = _.compact(structs);
			if (structs && !_.isEmpty(structs)) {
				let struct = _.find(structs, l => l.energy < l.energyCapacity);
				creep.transfer(struct, RESOURCE_ENERGY);
			}
		}

		switch (creep.harvest(source)) {
		case OK:
			if (!creep.memory.travelTime) {
				// We've just arrived.
				// creep.memory.travelTime = CREEP_LIFE_TIME - creep.ticksToLive;
				// Attempt to prevent excess waiting:
				// creep.memory.travelTime = Math.max(1, CREEP_LIFE_TIME - creep.ticksToLive - 3);
				creep.memory.travelTime = Math.clamp(1, CREEP_LIFE_TIME - creep.ticksToLive, 50);

				// Look for containers.
				if (!creep.memory.container) {
					if (source.container != undefined)
						creep.memory.container = source.container.id;
				}

				// Look for links
				if (!creep.memory.structs) {
					structs = _(creep
						.lookForNear(LOOK_STRUCTURES, true))
						.map(LOOK_STRUCTURES)
						.filter(s => s.energy != undefined)
						.value();
					if (structs && !_.isEmpty(structs)) {
						creep.memory.structs = _.map(structs, 'id');
						// console.log('Miner found structs: ' + structs);
					}
				}

			}
			// update economy production (2*WORK, but source max or refil delay)
			break;
		case ERR_NOT_ENOUGH_RESOURCES:
			if (source.ticksToRegeneration < creep.ticksToLive) {
				Log.info('[Mining] ' + creep.name + ' at ' + creep.pos + ' reporting site empty for ' + source.ticksToRegeneration + ' ticks!');
				creep.defer(source.ticksToRegeneration);
			} else {
				creep.memory.role = 'recycle';
			}
			break;
		}
	}

};