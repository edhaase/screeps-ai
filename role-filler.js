/**
 * role-filler.js
 */
'use strict'; 
// Game.creeps['Camden'].moveTo(new RoomPosition(13,29,'E57S47'))
// Game.creeps['Camden'].memory = {role: 'filler', src: '57aad057b08730970b0403d3', dest: '57b7ea150b84d0a524e761b5', res: 'H'}
// Game.spawns.Spawn2.enqueue(Util.RLD([5,CARRY,3,MOVE]), null, {role: 'filler', src: '57aad057b08730970b0403d3', dest: '57b7ea150b84d0a524e761b5', res: 'H'})
// Game.spawns.Spawn1.enqueue(Util.RLD([10,CARRY,10,MOVE]), null, {role: 'filler', src: '57ac9d174556ddcc49344c2c', dest: '57e245562e53b7a556c7834a', res: 'G'})
// Game.spawns.Spawn7.enqueue(Util.RLD([10,CARRY,10,MOVE]), null, {role: 'filler', src: '57f3f810904e9c5270ba754a', dest: '57f70ee71a31cd4a2c958489', res: 'XGH2O'})
// Game.spawns.Spawn7.enqueue(Util.RLD([10,CARRY,10,MOVE]), null, {role: 'filler', src: '57f3f810904e9c5270ba754a', dest: '57f70ee71a31cd4a2c958489', res: 'XGH2O'})
// Game.spawns['E54S47_1'].enqueue(Util.RLD([20,CARRY,20,MOVE]), null, {role: 'filler', src: '57de882f41d19c4f6c53ac82', dest: '57eab06952f0f0a77a7c7496', res: 'L'})
// Game.spawns.Spawn4.enqueue(Util.RLD([10,CARRY,10,MOVE]), null, {role: 'filler', src: '57cfad464d6dda234de240ae', dest: '57e8f24c506a520970b4ce67', res: 'G'})
// (POWER_SPAWN_POWER_CAPACITY / CARRY_CAPACITY) = 2
// Game.spawns.Spawn1.enqueue(Util.RLD([2,CARRY,2,MOVE]), null, {role: 'filler', src: '57ac9d174556ddcc49344c2c', dest: '580bdd72df50743513ae4d38', res: RESOURCE_POWER})
//  Game.spawns.Spawn18.enqueue(Util.RLD([4,CARRY,4,MOVE]), null, {role: 'filler', src: '5813a80cff16e99a52a2d887', dest: '583f6f19c0a664a74d8685ff', res: 'G'})
// Game.spawns.Spawn4.enqueue(Util.RLD([4,CARRY,4,MOVE]), null, {role: 'filler', src: '57c73fa7f1334a26787ba171', dest: '57cfad464d6dda234de240ae', res: RESOURCE_ENERGY, amt: 500000})
// Game.spawns.Spawn7.enqueue(Util.RLD([1,CARRY,1,MOVE]), null, {role: 'filler', src: '57f3f810904e9c5270ba754a', dest: '581e2ff080328b1e26e1ae3c', res: RESOURCE_POWER})
module.exports = function(creep) {
	let {src, dest, res=RESOURCE_ENERGY, amt=Infinity} = creep.memory;	
	
	src = Game.getObjectById(src);
	dest = Game.getObjectById(dest);
	
	if(amt <= 0)
		return creep.setRole('recycle');
	
	if(creep.ticksToLive <= 3)
		return creep.transfer(src, res);
	
	if(creep.carryTotal === 0) {
		let limit = (amt === Infinity)?amt:undefined;
		let wamt = (amt!=Infinity)?Math.min(amt, this.carryCapacity):undefined;
		let status = creep.withdraw(src, res, wamt);
		if( status === ERR_NOT_IN_RANGE )
			creep.moveTo(src);	
	} else {
		switch( creep.transfer(dest, res, this.carry[res]) ) {
			case ERR_FULL:
				creep.defer(3);
				break;
			case ERR_NOT_IN_RANGE:
				creep.moveTo(dest);	
				break;
			case OK:
				amt -= creep.carry[res];
				break;
		}
	}
		
	creep.memory.amt = (amt!=Infinity)?amt:undefined;
}
