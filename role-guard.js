/*
 * ROLE-GUARD
 * Multi-purpose role. Primarily designed to protect remote mines.
 *  If equipped with rangedAttack, will fight from a distance and attempt to kite.
 *  If equipped with melee, will attack directly. (Or if he cannot kite)
 *  If equipped with a heal, will heal himself during combat.
 *  If equipped with a heal, will heal allies once threats are removed. 
 */
"use strict";

module.exports = {
	init: function(creep) {

	},
	run: function (creep) {
		var {site} = creep.memory;
		if (!site) return;

		var flag = Game.flags[site];
		var threat = creep.pos.findClosestByRange(creep.room.hostiles);
		var noRoomHealer = !_.any(creep.room.find(FIND_MY_CREEPS), c => (c.pos.roomName === creep.pos.roomName && c.hasActiveBodypart(HEAL)));
		const IDLE_DISTANCE = 3;

		// Perform combat logic.
		if (creep.hits < creep.hitsMax && creep.canHeal && !creep.canFight) {
			// We're wounded, we can heal but not attack. Just heal, and kite if possible.
			creep.heal(creep);
			if (creep.canMove && threat)
				creep.flee(10);
		} else if (threat && creep.canFight) {
			if (creep.canRanged && creep.pos.inRangeTo(threat, 3)) {
				// We're ranged and in range, shoot them in the face.
				creep.rangedAttack(threat);
				// @todo: or massAttack?
				creep.flee(CREEP_RANGED_ATTACK_RANGE);
				if (creep.hits < creep.hitsMax)
					creep.heal(creep);
			} else if (creep.canAttack && creep.pos.isNearTo(threat)) {
				// We're melee and adjacent, smack them in their stupid face.
				creep.attack(threat);
				// if ( canHeal && creep.hits < creep.hitsMax ) creep.heal(creep);
			} else {
				// We're able to fight but out of any form of range. DRIVE ME CLOSER SO I CAN HIT THEM WITH MY SWORD.
				if (creep.canFight) {
					if (!creep.canRanged) // Math.random() < 0.75)
						creep.intercept(threat);
					else
						creep.moveTo(threat, {
							ignoreDestructibleStructures: false,
							ignoreRoads: true,
							range: (creep.canRanged) ? CREEP_RANGED_ATTACK_RANGE : 1
						});
				}
				if (creep.canHeal && creep.hits < creep.hitsMax)
					creep.heal(creep);
			}
		} else if (creep.canHeal && creep.hits < creep.hitsMax) {
			// No threats (or we can't fight), but we're wounded so patch ourselves up first.
			creep.heal(creep);
		} else if (creep.canHeal) {
			// Patch up an allies if we can.
			// @todo target lock patient
			var patient = creep.pos.findClosestByRange(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax });
			// var patient = creep.pos.findClosestByRange(FIND_CREEPS, { filter: c => c.hits < c.hitsMax && !Filter.unauthorizedHostile(c) });
			if (!patient) {
				if (flag && !creep.pos.inRangeTo(flag.pos,IDLE_DISTANCE))
					creep.moveTo(flag, {range: IDLE_DISTANCE});
			} else if (creep.pos.isNearTo(patient)) {
				creep.heal(patient);
			} else {
				if (creep.pos.inRangeTo(patient, CREEP_RANGED_HEAL_RANGE))
					creep.rangedHeal(patient);
				creep.moveTo(patient);
			}
		} else if (noRoomHealer && (creep.hits < creep.hitsMax) && !creep.memory.noflee) {
			// No threats (or can't fight) and wounded. Limp home for tower repairs.
			var homeRoom = Game.rooms[creep.memory.home];
			if (!homeRoom) return;
			var homeSpawn = homeRoom.find(FIND_MY_SPAWNS);
			if (!homeSpawn || homeSpawn.length <= 0) return;

			if (creep.pos.roomName !== creep.memory.home || creep.pos.isOnRoomBorder()) {
				creep.moveTo(homeSpawn[0], {range: 1});
			}
		} else if (flag && !creep.pos.inRangeTo(flag.pos,IDLE_DISTANCE)) {
			creep.moveTo(flag, {range: IDLE_DISTANCE});
		}
	}
};