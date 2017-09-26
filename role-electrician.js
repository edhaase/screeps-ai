/**
 * role-electrician.js
 *
 * Moves _only energy_
 */
"use strict";

// max size: LINK_CAPACITY / CARRY_CAPACITY
// Game.spawns.Spawn1.enqueue([MOVE,CARRY,CARRY], null, {role: 'electrician', lid: '57ad30b099a2ec8577b18b1c'})
// Game.spawns.Spawn21.enqueue([MOVE,CARRY,CARRY], null, {role: 'electrician', lid: '5839236525b866d4453dbc48'})
// Game.spawns.E54S47.enqueue([MOVE,CARRY,CARRY], null, {role: 'electrician', lid: '57e162d1e751964565ff8107'})
// Game.spawns.Spawn6.enqueue([MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY], null, {role: 'electrician', lid: '580828ea841405265e8c7f13'})
// Game.spawns.Spawn4.enqueue([MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY], null, {role: 'electrician', lid: '57cb277f5b95d89569ff9d42'})
module.exports = function (creep) {
	// About to die, bail cargo
	if (creep.ticksToLive === 1)
		creep.transfer(creep.room.storage, RESOURCE_ENERGY);
	if (creep.ticksToLive % 3 !== 0)
		return creep.say('HOLD');

	const { lid } = creep.memory;
	const link = Game.getObjectById(lid);
	const {room} = creep;
	const energyNetPct = room.energyInNetwork / room.energyCapacityInNetwork;
	const container = room.storage || room.terminal;

	creep.say(_.round(energyNetPct, 2), true);

	// Too high and the network will stay full (we kind of already have this issue normally)
	// Too low, and upgraders starve (as well as probably other stuff)
	if (energyNetPct > 0.75 && link.energy >= CARRY_CAPACITY) {
		// pull energy out of link, put in storage (or terminal)
		if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
			creep.moveTo(link, { ignoreRoads: true });
		creep.transferOrMove(container, RESOURCE_ENERGY);
	} else if (energyNetPct < 0.50) {
		// pull from storage and put in link		
		creep.transferOrMove(link, RESOURCE_ENERGY);
		if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
			creep.moveTo(container, { ignoreRoads: true });
	} else {
		this.defer(3);
	}
};

