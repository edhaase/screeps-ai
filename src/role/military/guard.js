/**
 * role.guard.js
 * 
 * Multi-purpose role. Primarily designed to protect remote mines.
 *  If equipped with rangedAttack, will fight from a distance and attempt to kite.
 *  If equipped with melee, will attack directly. (Or if he cannot kite)
 *  If equipped with a heal, will heal himself during combat.
 *  If equipped with a heal, will heal allies once threats are removed. 
 */
'use strict';

import { CLAMP } from '/os/core/math';
import { Log } from '/os/core/Log';
import { RLD } from '/lib/util';
import Body from '/ds/Body';

/* global CREEP_RANGED_ATTACK_RANGE, CREEP_RANGED_HEAL_RANGE */

const IDLE_DISTANCE = 3;

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function (spawn, job) {
		// 
		// const body = Body.ratio([0.40, RANGED_ATTACK, 0.40, HEAL, 0.20, MOVE], [0.40, 0.10, 0.5])

		const energyCapacityAvailable = spawn.room.energyCapacityAvailable;
		Log.debug(`Total: ${energyCapacityAvailable}`, 'Creep');
		const avail = Math.floor(energyCapacityAvailable * 0.98);
		const [c, h, m] = [0.40 * avail, 0.40 * avail, 0.20 * avail];
		const [lc, lh, lm] = [0.40 * MAX_CREEP_SIZE, 0.10 * MAX_CREEP_SIZE, 0.5 * MAX_CREEP_SIZE];
		Log.debug(`${c} ${h} ${m}`, 'Creep');
		Log.debug(`${lc} ${lh} ${lm}`, 'Creep');
		const pc = CLAMP(1, Math.floor(c / BODYPART_COST[RANGED_ATTACK]), lc);
		const ph = CLAMP(1, Math.floor(h / BODYPART_COST[HEAL]), lh);
		const pm = CLAMP(1, Math.floor(m / BODYPART_COST[MOVE]), lm);
		Log.debug(`${pc} ${ph} ${pm}`, 'Creep');
		const rc = c - pc * BODYPART_COST[RANGED_ATTACK];
		const rm = m - pm * BODYPART_COST[MOVE];
		const rh = h - ph * BODYPART_COST[HEAL];
		const rem = rc + rm + rh;
		const pcw = CLAMP(1, Math.floor((c + rem) / BODYPART_COST[RANGED_ATTACK]), lc);
		const am = CLAMP(1, pm, Math.ceil((pcw + ph) / 2));
		Log.debug(`rc ${rc} rm ${rm} rh ${rh} rem ${rem} pcw ${pcw}`, 'Creep');
		const body = RLD([pcw, RANGED_ATTACK, pm, MOVE, ph, HEAL]);
		// const cost = UNIT_COST(body);
		return body;
	},
	init: function () {
		// this.pushState('MoveTo', {pos: Game.flags[this.memory.site].pos, range: 3});
		this.pushState('MoveToRoom', Game.flags[this.memory.site].pos.roomName);
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		var { site } = this.memory;
		if (!site) return;

		var flag = Game.flags[site];
		var threats = this.pos.findInRange(this.room.hostiles, CREEP_RANGED_ATTACK_RANGE);
		var threat = this.pos.findClosestByRange(this.room.hostiles) || this.room.findOne(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } });
		var noRoomHealer = !_.any(this.room.find(FIND_MY_CREEPS), c => (c.pos.roomName === this.pos.roomName && c.hasActiveBodypart(HEAL)));

		// Perform combat logic.
		if (this.hits < this.hitsMax && this.canHeal && !this.canFight) {
			// We're wounded, we can heal but not attack. Just heal, and kite if possible.
			this.heal(this);
			if (this.canMove && threat)
				this.flee(10);
		} else if (threat && this.canFight) {
			if (this.canAttack && this.pos.isNearTo(threat)) {
				// We're melee and adjacent, smack them in their stupid face.
				this.attack(threat);
				if (this.canRanged && threat.canAttack)
					this.flee(CREEP_RANGED_ATTACK_RANGE);
			} else if (this.canRanged && this.pos.inRangeTo(threat, CREEP_RANGED_ATTACK_RANGE)) {
				// We're ranged and in range, shoot them in the face.
				if (threats && threats.length > 1)
					this.rangedMassAttack();
				else
					this.rangedAttack(threat);
				// @todo or massAttack?
				if (this.canAttack && !threat.canAttack)
					this.moveTo(threat, { range: 1 });
				else if (threat.canAttack)
					this.flee(CREEP_RANGED_ATTACK_RANGE);
				// if (this.hits < this.hitsMax) // Allow overheal
				this.heal(this, true);
			} else {
				// We're able to fight but out of any form of range. DRIVE ME CLOSER SO I CAN HIT THEM WITH MY SWORD.
				if (this.canFight) {
					if (!this.canRanged && Math.random() < 0.90)
						this.intercept(threat);
					else
						this.moveTo(threat, {
							ignoreDestructibleStructures: false,
							ignoreRoads: true,
							range: (this.canRanged) ? CREEP_RANGED_ATTACK_RANGE : 1
						});
				}
				if (this.canHeal && this.hits < this.hitsMax)
					this.heal(this);
			}
		} else if (this.canHeal && this.hits < this.hitsMax) {
			// No threats (or we can't fight), but we're wounded so patch ourselves up first.
			this.heal(this);
		} else if (this.canHeal) {
			// Patch up an allies if we can.
			// @todo target lock patient
			var patient = this.pos.findClosestByRange(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax });
			if (!patient) {
				if (flag && this.pos.roomName !== flag.pos.roomName) {
					this.moveToRoom(flag.pos.roomName);
				}
			} else if (this.pos.isNearTo(patient)) {
				this.heal(patient);
			} else {
				if (this.pos.inRangeTo(patient, CREEP_RANGED_HEAL_RANGE))
					this.rangedHeal(patient);
				this.moveTo(patient);
			}
		} else if (noRoomHealer && (this.hits < this.hitsMax) && !this.memory.noflee) {
			// No threats (or can't fight) and wounded. Limp home for tower repairs.
			if (this.memory.origin && (this.pos.roomName !== this.memory.origin || this.pos.isOnRoomBorder()))
				this.moveToRoom(this.memory.origin);
		} else if (flag && this.pos.roomName !== flag.pos.roomName) {
			this.moveToRoom(flag.pos.roomName);
		}
	}
};