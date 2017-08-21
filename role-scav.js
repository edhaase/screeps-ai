/**
 * role-scav.js
 *
 * Economy unit. Seeks resources in rooms and takes them somewhere else
 * On pickup: Find dropped, structures, and nearby creeps. Prioritize dropped and distance. Maybe math out a score?
 * On dropoff: Prioritize tower, spawn, extensions. Attempt to solve all idle scavengers at once with hungarian algo.	
 */
"use strict";
var ignoreCreeps = true;

module.exports = function(creep) {
    if(!this.memory.state)
		this.memory.state = 'gather';
	
	if(creep.carry.energy)
		creep.repairNearbyRoad();
	
	if(!creep.room.controller) {
		if(!creep.memory.spawn)
			creep.memory.spawn = creep.pos.findClosestSpawn().id;
		let spawn = Game.getObjectById(creep.memory.spawn);	
		return creep.moveTo(spawn, {reusePath: 10});
	}
	/* if(_.get(creep.room, 'controller.level', 0)  >= 3) {
		var adj = _.map(creep.lookForNear(LOOK_CREEPS, true), 'creep');
		// var nearby = _.find(adj, c => c.id != creep.id && c.memory.role != 'scav');
		// var sub = _.find(adj, c => c.id != creep.id && c.my && c.memory.role != 'scav' && c.carry.energy < c.carryCapacityAvailable )
		// var sub = _.find(adj, c => c.id != creep.id && c.my && (c.memory.role != 'scav' || (creep.memory.state == 'unload' && c.memory.state == 'gather')) && c.carry.energy < c.carryCapacityAvailable )
		var sub = _.find(adj, c => c.id != creep.id && c.my && c.memory.role != 'scav' && c.memory.role != 'hauler' && c.carry.energy < c.carryCapacityAvailable )
		if(sub) {
			creep.say("I'm helping!");
			// console.log('Creep ' + creep.name + ' is assisting ' + sub.name + ' at ' + creep.pos);
			creep.transfer(sub, RESOURCE_ENERGY);
		}
	} */
	
	var adjst = _.map(creep.lookForNear(LOOK_STRUCTURES, true), 'structure');
	/* works, but not sure on the resource usage. - extra 1 ept per scav?
	if(creep.room.energyAvailable / creep.room.energyCapacityAvailable > 0.95) {
		var r;
		if(r = _.find(adjst, s => s.hits / s.hitsMax < 0.95))
				creep.repair(r);
	} */
	// var s = _.find(adjst, s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK);
	// if(s)
	//	creep.withdraw(RESOURCE_ENERGY); // <-- really? missing target?
	/* else { // not viable, they just get stuck trading. maybe if distance is closer to goal?
		if(creep.memory.state == 'unload')
		var bsub = _.find(adj, c => c.id != creep.id && c.my && c.memory.role == 'scav' && c.memory.state == 'gather' && c.carryCapacityAvailable )	
			creep.transfer(bsub, RESOURCE_ENERGY);
	} */
	
	// var adjstb = _.map(creep.lookForNear(LOOK_STRUCTURES, true), 'structure');
	var s = _.find(adjst, s => s.my && (s.energy!=undefined) && s.energy < s.energyCapacity && s.structureType !== STRUCTURE_STORAGE );
	if(s)
		creep.transfer(s, RESOURCE_ENERGY);
	// 2016-10-17: Safety for switch from builder to scav when booting new rooms.
	if(module.exports[this.memory.state] === undefined)
		this.memory.state = 'gather';
	return module.exports[this.memory.state](creep);		
	// Time.measure( () => module.exports[this.memory.state](creep) );
}

/**
 * Role change: _.each(_.filter(Game.creeps, 'memory.role', 'scav'), c => c.memory.role = 'scav2')
 */
module.exports.afindPickup = function(creep) {	
	return creep
		.pos
		.findClosestByRange( creep.room._resources, {
			filter: function(res) {
				let claimed = _.get(res, 'amountClaimed', 0);
				let amount = 0;
				if(res instanceof Resource)
					amount = res.amount;
				else {
					// like links!
					if(!res.store) {
						console.log('no store property on ' + res);
						amount = res.energy;
					} else
						amount = res.store.energy; //  _.sum(res.store);
				}
				
				return  (amount > 50) && (claimed < amount);
			}
			/* filter: function(res) {				
				if(res instanceof Resource) {
					return (!res.amountClaimed || res.amountClaimed < res.amount);
				} else
					return (!res.amountClaimed || res.amountClaimed < ((res.store)?(_.sum( res.store )):res.energy))				
			} */
	});
}

module.exports.findPickup = function(creep) {
	function getAmt(res) {
		var amount = 0;
		if(res instanceof Resource)
			amount = res.amount;
		else {
			// like links!
			if(!res.store) {
				console.log('no store property on ' + res);
				amount = res.energy;
			// } else if(res.mineralAmount && res.memory.unload == true) {
			//	amount = res.mineralAmount;
			} else
				// Why did we shut this off? because it counts minerals towards amt stored
				// amount = res.store.energy; //  _.sum(res.store);
				amount = _.sum(res.store);
		}
		return amount;
	}
	var res = creep.room.resources.concat(creep.room.stored);
	// var targets = _.filter(creep.room._resources, function(res) {
	var targets = _.filter(res, function(res) {
			var claimed = _.get(res, 'amountClaimed', 0);
			var amount = getAmt(res);
			return  (amount > 50) && (claimed < amount);
	});

	// works, but always prefers storage/terminal
	// var m = _.max(targets, t => getAmt(t) / creep.pos.getRangeTo(t.pos) );
	// test: we only care about largest pile up to our carry capacity.
	var m = _.max(targets, t => Math.min(getAmt(t), creep.carryCapacity) / creep.pos.getRangeTo(t.pos) ); // doesn't make a lot of sense
	// var m = _.max(targets, t => getAmt(t)); // automatically prefers storage
	// console.log('best deal: ' + m + ' at ' + (5*getAmt(m)) / creep.pos.getRangeTo(m.pos));
	if(m && m != -Infinity && m != Infinity)
		return m;
	else
		return creep.pos.findClosestByRange(targets);
}

/**
 *
 */
module.exports.findDropoff = function(creep) {
	// if(!creep.carry.energy || creep.carry.energy <= 0)
	//	return creep.room.storage;

	if(creep.carry.energy > 0 && creep.room.controller.isEmergencyModeActive())
		return creep.room.controller;

	if(!_(creep.carry).omit('energy').isEmpty()) {
		// creep.say('default');
		return creep.room.terminal || creep.room.storage;
	}
	

	// creep.room._lowcharge
	
	// let avail = _.filter(creep.room._lowcharge, function(structure) {	
	// let start = Game.cpu.getUsed();
	let low = creep.room.getLowChargeStructures();
	// let used = Game.cpu.getUsed();
	let avail = _.filter(low, function(structure) {
			let sum = (structure.storeCapacity)?structure.storedTotal:structure.energy;
			let cap = (structure.storeCapacity)?structure.storeCapacity:structure.energyCapacity;
			let avail = cap - sum - structure.assigned;
			if(avail <= 0) 
				return false;		
			return true;
		} 
	);
	// console.log('avail filter: ' + (Game.cpu.getUsed() - used));
	/* (let avail = creep.room.find(FIND_MY_STRUCTURES, {
		filter: function(structure) {			
			if(!Filter.lowEnergyStructures(structure))
				return false;		
			
			// class Matrix - uintArray?
			// hungarian algo?
			
			// This isn't doing nice things to my cpu.
			// We need to switch to a state-machine here, and reassign jobs less.
			// Also, stored jobs would allow hand-offs, and possible hungarian algo to calculate cost of assigning new units.
			// let sum = ((structure.store)?(_.sum( structure.store )):structure.energy);
			let sum = (structure.storeCapacity)?structure.storedTotal:structure.energy;
			let cap = (structure.storeCapacity)?structure.storeCapacity:structure.energyCapacity;
			let avail = cap - sum - structure.assigned;
			if(avail <= 0) 
				return false;
			// Log.warn('dropoff: ' + structure.energyCapacity + ' - ' + structure.assigned  );
			// (energyCapacity - energy) - assigned > 0
			// if(structure.assigned && structure.energyCapacity && structure.assigned >= structure.energyCapacity  )
			//	return false;						
		
			return true;
		} 
	}); */

	if(!avail || avail.length <= 0) {
		var avCreep = creep.room.find(FIND_MY_CREEPS, {filter: function(c) {
			if(_.get(c, 'assigned', 0) > 0)
				return false;			
			if( c.memory.role == 'upgrader' ) {
				if(c.room.controller.level >= 4 && _.get(creep, 'room.storage.store.energy',0) < 100000)
					return false;
				return (c.carry.energy / c.carryCapacity < 0.25);
			}
			// if(c.memory.role == 'upgrader' && (c.carry.energy / c.carryCapacity < 0.15) && (c.room.controller.ticksToDowngrade < 4000)) return true;
			return false;
		}});
		if(!_.isEmpty(avCreep)) {
			// console.log('destination upgrader: ' + creep.name + ' at ' + creep.pos);
			avail = avCreep;
		} else
			return creep.room.storage;
	}
	
	// 2017-1-11
	if(_.isEmpty(avail))
		return creep.room.terminal || creep.room.storage;
	let goal = _.min(avail, s => s.energyPct * s.pos.getRangeTo(creep));
	if(goal == Infinity)
		return _.first(avail);
	return goal;
	// -----------------------------
	
	// prefer closer, prefer tower or extension, 
	if(avail && avail.length >= 2) {
		// amount / range	(if we can get a consistent amount!)
		// avail = _.sortBy(avail, (a,b) => a. )
		// avail = avail.sort(function(a,b) { return a.pos.getRangeTo(creep) - b.pos.getRangeTo(creep); });
		avail = _.sortBy(avail, (a) => a.pos.getRangeTo(creep));		
		/* console.log("Sort order: " + creep.pos);
		console.log(avail[0].pos.getRangeTo(creep));
		console.log(avail[1].pos.getRangeTo(creep)); */
	}
	var target;
		
	if(creep.room.energyAvailable / creep.room.energyCapacityAvailable > 0.25) {
		if( (target = _.find(avail, {structureType: STRUCTURE_TOWER}) ) )
			return target;

		if( (target = _.find(avail, {structureType: STRUCTURE_EXTENSION})) )
			return target;
	} else {
		if( (target = _.find(avail, {structureType: STRUCTURE_EXTENSION})) )
			return target;
		
		if( (target = _.find(avail, {structureType: STRUCTURE_TOWER}) ) )
			return target;
		
	}	
	
	if( (target = _.find(avail, {structureType: STRUCTURE_SPAWN}) ) )
		return target;
		
	// creep.pos.findClosestByRange(avail, {filter: s => !s.assigned ||  })
	// return creep.pos.findClosestByRange(avail);
	// let thing = _.first(avail);	
	let thing = avail[0];
	// let used = Game.cpu.getUsed() - start;
	// console.log('Found thing ' + thing + ' in ' + used + ' with lodash');
	return thing;
}
 
 
/**
 *
 */
module.exports['gather'] = function(creep) {		
	// If we're empty, switch
	if(!creep || !(creep instanceof Creep))
		throw new Error('Not a creep!');
	if(creep.carryCapacityAvailable <= 0) {
		creep.memory.state = 'unload';
		creep.memory.stuck = 0;
		return module.exports['unload'](creep);
	}
	
	var pickup = module.exports.findPickup(creep);	
	
	// If we don't have a pickup, take from storage.
	if(!pickup) {
		// creep.say("DEF STORE");
		pickup = creep.room.storage;
	}
	// console.log('pickup: ' + pickup);
	if(!pickup)
		return;
		
	// Set our claim
	if(!pickup.amountClaimed)
		pickup.amountClaimed = 0;
	pickup.amountClaimed += creep.carryCapacityAvailable;
	
	if(!pickup.claimers)
		pickup.claimers = {};
	pickup.claimers[creep.name] = pickup.amountClaimed;
	// console.log(creep.name + ' claiming ' + pickup.amountClaimed + ' at tick ' + Game.time)
	
	// Calculate remaining
	if(pickup instanceof Resource)
		pickup.amountRemaining = pickup.amount - pickup.amountClaimed;
	else
		pickup.amountRemaining = ((pickup.store)?(_.sum(pickup.store)):pickup.energy) - pickup.amountClaimed;
	
		
	// If dropoff is closer than next pickup, switch to unload and run.
	if(creep.carryCapacityAvailable < 45) {
		var dropoff = module.exports.findDropoff(creep);
		var op = creep.pos.findClosestByRange([pickup, dropoff]);		
		// console.log(op);
		// if(creep.pos.findClosestByRange([pickup, dropoff]) == dropoff) {
		if(op == dropoff) {
			creep.memory.state = 'unload';
			// creep.say("MEEP!");
			// console.log("[SCAV] Making smart decision and unloading payload early!");
			return module.exports['unload'](creep);
		}
	}
	
	// Move to pickup location.
	if(!creep.pos.isNearTo(pickup))
		creep.moveTo(pickup, {
			reusePath: 5,
			ignoreCreeps: ((creep.memory.stuck < 3)?ignoreCreeps:false), 
			// ignoreRoads: (creep.plainSpeed == creep.roadSpeed), // not yet
			maxRooms: 1});
	
	// Attempt to gather
	if(pickup instanceof Resource)
		creep.pickup(pickup);
	else {
		if(pickup.structureType === STRUCTURE_STORAGE || pickup.structureType === STRUCTURE_LINK || pickup.structureType === STRUCTURE_TERMINAL)
			creep.withdraw(pickup, RESOURCE_ENERGY);
		else { 
			_(pickup.store).keys().each( r => creep.withdraw(pickup, r) ).commit();
		}			
	}
							
}

module.exports['store'] = function(creep) {
	if(creep.carryTotal <= 0) {
		creep.memory.state = 'gather';
		return module.exports['gather'](creep);
	}
	let fallback = creep.room.terminal || creep.room.storage;
	
	if(!creep.pos.isNearTo(fallback))
		return creep.moveTo(fallback, {reusePath: 5, 
		ignoreCreeps: ((creep.memory.stuck < 3)?ignoreCreeps:false),
		maxRooms: 1});
	else	
		_.each(creep.carry, (amt,type) => creep.transfer(fallback, type));
}

module.exports['unload'] = function(creep) {		
	// If we're empty, switch back to gathering.
	if(creep.carryTotal <= 0) {
		creep.memory.state = 'gather';
		return module.exports['gather'](creep);
	}
	
	if(creep.memory.stuck > 14 && (creep.room.storage || creep.room.terminal)) {
		// creep.say("store!'");
		creep.memory.state = 'store';
		creep.memory.stuck = 0;
		return module.exports['store'](creep);
	}		
	
	var dropoff = module.exports.findDropoff(creep);
	if(!dropoff) {
		let {storage, terminal} = creep.room;
		if(storage && storage.total / storage.storeCapacity < 0.55)
			dropoff = storage;
		else if(terminal && terminal.total < terminal.storeCapacity)
			dropoff = terminal;
		else
			dropoff = creep.room.controller;
		//	dropoff = creep.room.storage || creep.room.terminal || creep.room.controller;		
	}
	// creep.say(dropoff.structureType)
	
	// If dropoff is closer than next pickup, switch to unload and run.
	/* if(creep.carryCapacityAvailable > 100) {
		var pickup = module.exports.findPickup(creep);	
		if(creep.pos.findClosestByRange([pickup, dropoff]) == pickup) {
			creep.memory.state = 'gather';
			creep.say("ZEEP!");
			// console.log("[SCAV] Making smart decision and grabbing nearby resource!");
			return module.exports['gather'](creep);
		}
	} */
	
		
	if(!dropoff.assigned)
		dropoff.assigned = 0;
	
	dropoff.assigned += creep.carryTotal;
	// if(dropoff instanceof Creep)
		// console.log(creep.name + ' assigned to ' + dropoff.name);
	// console.log("Dropoff: " + dropoff);
	// if energy storage is low, don't build upgraders.
	// if nowhere to take energy OR ticksToDowngrade low, take to controlelr.
	if(dropoff == creep.room.controller && creep.pos.inRangeToPos(dropoff.pos, 3)) {
		creep.upgradeController(dropoff);
	}
	
	if(!creep.pos.isNearTo(dropoff))
		return creep.moveTo(dropoff, {
			reusePath: 5, 
			ignoreCreeps: ((creep.memory.stuck < 3)?ignoreCreeps:false),
			// ignoreRoads: (creep.plainSpeed == creep.roadSpeed), // not yet
			maxRooms: 1
		});
	else {
		// if(dropoff.structureType == STRUCTURE_STORAGE || dropoff.structureType == STRUCTURE_STORAGE)
		if(dropoff.store != undefined)
			creep.transferAny(dropoff);
			// _.each(creep.carry, (amt,type) => creep.transfer(dropoff, type));
			// _(creep.carry).keys().each( r => creep.transfer(dropoff, r) ).commit();
		else {
			creep.transfer(dropoff, RESOURCE_ENERGY);
		}
	}		
}