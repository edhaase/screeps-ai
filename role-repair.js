/**
 *
 */
'use strict'; 
// Game.spawns.Spawn4.enqueue([WORK,CARRY,MOVE,MOVE], null, {role:'repair'})
// Game.spawns.Spawn4.enqueue([WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE], null, {role:'repair'}, 1, 5, 5)
// Game.spawns.Spawn4.enqueue([MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,CARRY,MOVE,CARRY], null, {role:'repair'}, 1, 5, 5)
module.exports = function(creep) {	
	if(this.hits < this.hitsMax)
		this.flee(7);
	
	if(creep.carry.energy === 0) {
		if(creep.ticksToLive < 30)
			return creep.setRole('recycle');
		// terminal, storage, link?
		// delete creep.cache.target;
		delete creep.memory.target;
		this.clearTarget();
		let storage = this.getTarget(
			({room,pos}) => [...room.links, room.storage, room.terminal,...room.resources],
			(provider) => Filter.canProvideEnergy(provider),
			(candidates) => creep.pos.findClosestByPath(candidates),
			'pid'
		);
		if(!storage)
			return this.defer(5);
		else
			creep.moveTo(storage, {
				reusePath: 10,
				maxRooms: 1,
				range: 1,
				ignoreRoads: (creep.plainSpeed === creep.roadSpeed)
				});
		if(creep.pos.isNearTo(storage))
			creep.pull(storage, RESOURCE_ENERGY);
			// creep.withdraw(storage, RESOURCE_ENERGY);	
		
	} else {
		this.clearTarget('pid');
		if(!creep.room.controller)
			return this.setRole('recycle');
		if(!this.memory.tid)
			creep.say('search!');
		let target = this.getTarget(
			({room,pos}) => room.structures,
			(s) => s.hits < s.hitsMax,
			(weak) => {
				let maxHits = RAMPART_HITS_MAX[creep.room.controller.level];
				let center = creep.room.getPositionAt(25,25);
				return _.min(weak, w => (w.hitsEffective / Math.min(maxHits,w.hitsMax)) / w.pos.getRangeTo(center))
			}
		);	
		if(!target) {
			Log.notify("No repair target at " + this.pos + ' age: ' + (Game.time - this.memory.born) + ' ttl: ' + this.ticksToLive);
			return this.setRole('recycle');
		}
		
		switch( creep.repair(target) ) {
			case OK:
				break;
			case ERR_NOT_IN_RANGE:
				creep.moveTo(target, {
					reusePath: 10,
					maxRooms: 1,
					range: CREEP_REPAIR_RANGE,
					// ignoreRoads: (creep.plainSpeed === creep.roadSpeed)
				});
				break;
		}
	}
}