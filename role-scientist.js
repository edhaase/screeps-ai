/*
 * role-scientist
 * Transfers resources to and from labs
 */ 
'use strict';
 
module.exports = function(creep) {
	let {site, lab1, lab2, r1, r2, lab3} = creep.memory;
	let terminal = creep.room.terminal;
	lab1 = Game.getObjectById(lab1);
	lab2 = Game.getObjectById(lab2);
	lab3 = Game.getObjectById(lab3); // destination lab
	let limit = Math.floor(creep.carryCapacity / 3);
	let threshold = 250;
	let r3 = REACTIONS[r1][r2];
	
	// Clear all the labs
	if(creep.memory.state === 'reset') {
		creep.withdraw(lab3, lab3.mineralType, Math.min(limit, lab3.mineralAmount));
		creep.withdraw(lab2, lab2.mineralType, Math.min(limit, lab2.mineralAmount));
		creep.withdraw(lab1, lab1.mineralType, Math.min(limit, lab1.mineralAmount));
		let res = _.findKey(creep.carry, (v,key) => v > 0);
		creep.transfer(terminal, res);
		if(lab1.mineralAmount === 0 && lab2.mineralAmount === 0 && lab3.mineralAmount === 0) {
			creep.memory.state = 'load';
			creep.say('Loading!');
			Log.info('[SCIENTIST] Switching to load at ' + creep.pos);
		}
		return;
	}
	
	if(creep.ticksToLive < 3) {
		// stop working?
	}
	
	var flag = Game.flags[site];
	if(!creep.pos.isEqualTo(flag.pos))
		creep.moveTo(flag);
	
	// Destination lab
	// if(_.get(creep.carry, r3, 0) > 0)
	//	creep.transfer(terminal, r3);
	let carry = _.keys(_.omit(creep.carry, ['energy',r2,r1]));
	if(carry && carry.length)
		creep.transfer(terminal, carry[0]);
	if(_.get(creep.carry, RESOURCE_ENERGY, 0) > 0)
		creep.transfer(terminal, RESOURCE_ENERGY);	
	if(lab3.mineralAmount > 0)
		creep.withdraw(lab3, lab3.mineralType, limit);
	
	// fill it up a ways so it'll keep cracking after we're dead.
	if(_.get(creep.carry, r1, 0) === 0 && lab1.mineralAmount < threshold)
		creep.withdraw(terminal, r1, limit);
	else
		creep.transfer(lab1, r1);	
	
	if(_.get(creep.carry, r2, 0) === 0  && lab2.mineralAmount < threshold)
		creep.withdraw(terminal, r2, limit);
	else
		creep.transfer(lab2, r2);	
	// {role: 'scientist', site: 'Flag30', lab1: '57b9408859a1e18b580876ba', lab2: '57b930b3d2e24cac5e6945ac', lab3: '57b9e98c7df220956c1a6b8a', r1: 'U', r2: 'O'}
	// Game.spawns.Spawn1.createCreep([CARRY,MOVE], null, {role: 'scientist', site: 'Flag30', lab1: '57b9408859a1e18b580876ba', lab2: '57b930b3d2e24cac5e6945ac', lab3: '57b9e98c7df220956c1a6b8a', r1: 'U', r2: 'O'})
	// Game.creeps['Isabelle'].transfer(Game.getObjectById("57ac9d174556ddcc49344c2c"), 'O')
}

module.exports.unloadInventory = function(creep) {
	
}