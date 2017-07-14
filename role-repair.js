/**
 *
 */
'use strict'; 
// Game.spawns.Spawn4.enqueue([WORK,CARRY,MOVE,MOVE], null, {role:'repair'})
// Game.spawns.Spawn4.enqueue([WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE], null, {role:'repair'}, 1, 5, 5)
// Game.spawns.Spawn4.enqueue([MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,CARRY,MOVE,CARRY], null, {role:'repair'}, 1, 5, 5)
module.exports = function(creep) {	
	// refill
	if(this.hits < this.hitsMax)
		this.flee(7);
	
	if(creep.carry.energy === 0) {
		if(creep.ticksToLive < 30)
			return creep.setRole('recycle');
		// terminal, storage, link?
		// delete creep.cache.target;
		delete creep.memory.target;
		this.clearTarget();
		let storage = null;	
		/* if(creep.room.terminal && _.get(creep.room.terminal, 'store.energy', 0) > 50000)
			storage = creep.room.terminal;	
		if(creep.room.storage && _.get(creep.room.storage, 'store.energy', 0) > 50000)
			storage = creep.room.storage;
		*/
		storage = this.getTarget(
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
		
		/* let target = Game.getObjectById(creep.memory.target);
		if(!target) {
			creep.say('search!');
			target = module.exports.findTarget(creep);
			if(!target)
				return this.setRole('recycle');
			creep.memory.target = target.id;
		}
		
		if(!target) {
			console.log('Creep ' + creep.name + ' at ' + creep.pos + ' nothing to repair');
			return;
		} */
		if(!creep.room.controller)
			return this.setRole('recycle');
		let maxHits = RAMPART_HITS_MAX[creep.room.controller.level];
		let center = creep.room.getPositionAt(25,25);
		if(!this.memory.tid)
			creep.say('search!');
		let target = this.getTarget(
			({room,pos}) => room.structures,
			(s) => s.hits < s.hitsMax,
			(weak) => _.min(weak, w => (w.hitsEffective / Math.min(maxHits,w.hitsMax)) / w.pos.getRangeTo(center))
		);	
		if(!target) {
			Log.notify("No repair target at " + this.pos + ' age: ' + (Game.time - this.memory.born) + ' ttl: ' + this.ticksToLive);
			return this.setRole('recycle');
		}
		
		switch( creep.repair(target) ) {
			case OK:
				// console.log('actually repaired something');
				break;
			case ERR_NOT_IN_RANGE:
				// console.log('moving to weakest: ' + weakest);
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

// 2016-10-24: Now caps max hits to rampart size (still like 30 mil)
// 2016-11-30: Removed 10 million hp limit (why did I set that?)
module.exports.findTarget = function(creep) {
	// hitPct / distanceFromCenter?
	let maxHits = RAMPART_HITS_MAX[creep.room.controller.level];
	// var weak = _.filter(creep.room.structures, s => s.hits / s.hitsMax < 0.95 && s.hits < 10000000);
	var weak = _.filter(creep.room.structures, s => s.hits / Math.min(maxHits,s.hitsMax) < 0.95); // && s.hits < 10000000);
	var center = creep.room.getPositionAt(25,25);
	// var target = _.max(weak, w => w.pos.getRangeTo(center));
	var target = _.min(weak, w => (w.hits / Math.min(maxHits,w.hitsMax)) / w.pos.getRangeTo(center));
	if(Math.abs(target) == Infinity)
		return null;
	return target;
}