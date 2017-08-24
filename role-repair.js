/**
 *
 */
"use strict";
// Game.spawns.Spawn4.enqueue([WORK,CARRY,MOVE,MOVE], null, {role:'repair'})
// Game.spawns.Spawn4.enqueue([WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE], null, {role:'repair'}, 1, 5, 5)
// Game.spawns.Spawn4.enqueue([MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,CARRY,MOVE,CARRY], null, {role:'repair'}, 1, 5, 5)
module.exports = {
	init: function (creep) {
		creep.memory.ignoreRoad = (creep.plainSpeed === creep.roadSpeed);
	},
	run: function (creep) {
		if (this.hits < this.hitsMax)
			this.flee(7);

		if (creep.carry.energy === 0) {
			var storage = this.getTarget(
				({ room }) => [...room.links, room.storage, room.terminal, ...room.resources],
				(provider) => Filter.canProvideEnergy(provider),
				(candidates) => {
					if (creep.ticksToLive < 30)
						return creep.setRole('recycle');
					this.clearTarget();
					return creep.pos.findClosestByPath(candidates);
				},
				'pid'
			);
			if (!storage)
				return this.defer(5);
			else
				creep.moveTo(storage, {
					reusePath: 10,
					maxRooms: 1,
					range: 1,
					ignoreRoads: this.memory.ignoreRoad || true
				});
			if (creep.pos.isNearTo(storage))
				creep.pull(storage, RESOURCE_ENERGY);

		} else {
			this.clearTarget('pid');
			var target = this.getTarget(
				({ room }) => room.structures,
				(s) => s.hits < s.hitsMax,
				(weak) => {
					if (!creep.room.controller)
						this.setRole('recycle');
					creep.say('search!');
					const maxHits = RAMPART_HITS_MAX[creep.room.controller.level];
					const center = creep.room.getPositionAt(25, 25);
					return _.min(weak, w => (w.hitsEffective / Math.min(maxHits, w.hitsMax)) / w.pos.getRangeTo(center));
				}
			);
			if (!target) {
				Log.notify(`No repair target at ${this.pos}, age: ${(Game.time - this.memory.born)}, ttl: ${this.ticksToLive}`);
				return this.setRole('recycle');
			}

			switch (creep.repair(target)) {
			case OK:
				break;
			case ERR_NOT_IN_RANGE:
				creep.moveTo(target, {
					reusePath: 10,
					maxRooms: 1,
					range: CREEP_REPAIR_RANGE,
					ignoreRoads: this.memory.ignoreRoad || true
				});
				break;
			}
		}
	}
};