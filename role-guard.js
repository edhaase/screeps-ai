/*
 * ROLE-GUARD
 * Multi-purpose role. Primarily designed to protect remote mines.
 *  If equipped with rangedAttack, will fight from a distance and attempt to kite.
 *  If equipped with melee, will attack directly. (Or if he cannot kite)
 *  If equipped with a heal, will heal himself during combat.
 *  If equipped with a heal, will heal allies once threats are removed. 
 * Unit.requestGuard(Game.spawns.Spawn1, Game.flags['Poke'])
 */ 
'use strict';
 
module.exports = function(creep) {
	var site = creep.memory.site;
	if ( !site ) return;
	
	var flag = Game.flags[site];
	
	// Priority is on reaching our goal.
	// if ( flag && creep.room.name != flag.pos.roomName ) return creep.moveTo(flag);
	
	// var canMove = creep.hasActiveBodypart(MOVE);
	/* var canHeal = creep.hasActiveBodypart(HEAL);
	var canRanged = creep.hasActiveBodypart(RANGED_ATTACK);
	var canMassAttack = canRanged;
	var canAttack = creep.hasActiveBodypart(ATTACK);
	
	var canFight = ( canRanged || canAttack ); */
	
	var threat = null;
	/* if ( !flag || creep.room.name === flag.pos.roomName ) {
		threat = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: Filter.unauthorizedHostile});
		// Is this a good idea?
		// var targets = creep.room.find(FIND_HOSTILE_CREEPS, {filter: Filter.unauthorizedHostile});
		// var threat = _.max(targets, c => c.threat / creep.pos.getRangeTo(c));
	} */
	threat = creep.pos.findClosestByRange(creep.room.hostiles);
	/* var noRoomHealer = true;
	_.each(Game.creeps, function(c) { 
		if ( c.pos.roomName === creep.pos.roomName && c.getActiveBodyparts(HEAL) > 0 ) noRoomHealer = false;
	}); */
	var noRoomHealer = !_.any(Game.creeps, c => ( c.pos.roomName === creep.pos.roomName && c.hasActiveBodypart(HEAL) ));
	
	
	// Perform combat logic.	
	if ( creep.hits < creep.hitsMax && creep.canHeal && !creep.canFight ) {
		// We're wounded, we can heal but not attack. Just heal, and kite if possible.
		creep.heal(creep);
		if ( creep.canMove && threat ) creep.flee(threat, 10);
	} else if ( threat && creep.canFight ) {
		// We have a threat, and we're capable of combat.
		// creep.say("\u2694", true);
		
		if ( creep.canRanged && creep.pos.inRangeTo(threat, 3) ) {
			// We're ranged and in range, shoot them in the face.
			creep.rangedAttack(threat);
			// @todo: or massAttack?
			creep.flee(threat);
			if( creep.hits < creep.hitsMax )
				creep.heal(creep);
		} else if ( creep.canAttack && creep.pos.isNearTo(threat) ) {
			// We're melee and adjacent, smack them in their stupid face.
			creep.attack(threat);
			// if ( canHeal && creep.hits < creep.hitsMax ) creep.heal(creep);
		} else {
			// We're able to fight but out of any form of range. DRIVE ME CLOSER SO I CAN HIT THEM WITH MY SWORD.
			if(creep.canFight) {
				if(!creep.canRanged) // Math.random() < 0.75)
					creep.intercept(threat);
				else
					creep.moveTo(threat, {
						ignoreDestructibleStructures:false,
						ignoreRoads: true,
						range: (creep.canRanged)?CREEP_RANGED_ATTACK_RANGE:1
					});
			}
			if ( creep.canHeal && creep.hits < creep.hitsMax )				
				creep.heal(creep);
		}		
	} else if ( creep.canHeal && creep.hits < creep.hitsMax ) {
		// No threats (or we can't fight), but we're wounded so patch ourselves up first.
		creep.heal(creep);
	} else if ( creep.canHeal ) {
		// Patch up an allies if we can.
		var patient = creep.pos.findClosestByRange(FIND_MY_CREEPS, { filter: function(c) { return ( c.hits < c.hitsMax ); }});		
		// var patient = creep.pos.findClosestByRange(FIND_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });		
		if ( !patient ) {
			// if ( flag && !creep.pos.isEqualTo(flag.pos) ) creep.travelTo(flag);
			// if ( flag && !creep.pos.isEqualTo(flag.pos) ) creep.moveTo(flag, {costCallback: r => logisticsMatrix[r]});	
			if ( flag && !creep.pos.isEqualTo(flag.pos) )
				creep.moveTo(flag);	
		} else if ( creep.pos.isNearTo(patient) ) {
			creep.heal(patient);
		} else {
			if ( creep.pos.inRangeTo(patient, 3) )
				creep.rangedHeal(patient);
			creep.moveTo(patient);
		}
	} else if ( noRoomHealer && ( creep.hits < creep.hitsMax ) && !creep.memory.noflee ) {
		// No threats (or can't fight) and wounded. Limp home for tower repairs.
		var homeRoom = Game.rooms[creep.memory.home];
		if ( !homeRoom ) return;
		var homeSpawn = homeRoom.find(FIND_MY_SPAWNS);
		if ( !homeSpawn || homeSpawn.length <= 0 ) return;
		
		if ( creep.pos.roomName != creep.memory.home || creep.pos.isOnRoomBorder() ) {
			// creep.say("Ow.", true);
			creep.moveTo( homeSpawn[0] );		
		}
	} else if ( flag ) {
		if ( !creep.pos.isEqualTo(flag.pos) ) creep.moveTo(flag);
		/* if ( !creep.pos.isEqualTo(flag.pos) ) creep.moveTo(flag, {
			maxOps: 16000,
			// need generic cM lookup that goes for logistics, memory obstacle, or returns empty.
			costCallback: (rN, cM) => logisticsMatrix[rN]?logisticsMatrix[rN]:( PathFinder.CostMatrix.deserialize(_.get(Memory.rooms, rN + '.cm.obstacle', cM)))
		}); */
	}
}