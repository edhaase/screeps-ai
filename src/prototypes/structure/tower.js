/**
 * ext/structure.tower.js
 * 
 * Expected behavior for towers:
 *
 *   The versatile tower structure can attack, heal, and repair from it's location, but
 * has limited energy and can only perform one action per tick, so it should choose
 * it's behavior carefully.
 *
 * Primary action is attack intruders. If no intruders are present it will use only it's upper
 * margin of energy for repairs anad heal operations.
 *
 * Logic for operating towers/turrets.
 * @todo assign damage during tick, if no valid targets find targets valid to other towers and assist.
 * @todo fudge the numbers a little (noise function?!)
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';
import { PLAYER_STATUS } from '/Player';

/* global DEFINE_MEMORY_BACKED_PROPERTY */
DEFINE_MEMORY_BACKED_PROPERTY(StructureTower.prototype, 'range');

const TOWER_REPAIR_MAX_HITS = 20000;
const TOWER_REPAIR_THRESHOLD = 0.75;

export const TOWER_MINIMUM_RESERVE = 0.75;
// global.TOWER_DAMAGE_EFFECT = [600,600,600,600,600,600,570,540,510,480,450,420,390,360,330,300,270,240,210,180,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150];
// global.TOWER_REPAIR_EFFECT = [800,800,800,800,800,800,760,720,680,640,600,560,520,480,440,400,360,320,280,240,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200];
// global.TOWER_HEAL_EFFECT = [400,400,400,400,400,400,380,360,340,320,300,280,260,240,220,200,180,160,140,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100];

const TOWER_STRATEGY_CHANGE = 100;

const TOWER_STRATEGY_DISTRIBUTE = 0;	// Distribute damage across intruders
const TOWER_STRATEGY_FOCUS = 1;		// Focus fire on the target with the most damage
const TOWER_STRATEGY_RANDOM = 2;		// Random target selection
const TOWER_STRATEGY_FIRST = 3;		// First target in the room
const TOWER_STRATEGY_CLOSEST = 4;		// Closest to tower
const TOWER_STRATEGY_CLOSEST_CTRL = 5;
const TOWER_STRATEGY_WEAKEST = 6;		// Most hurt
const TOWER_STRATEGY_TOUGHEST = 7;		// Most hits
const TOWER_STRATEGY_HEAL = 8;
const MAX_ATTACK_STRATEGY = 8;

StructureTower.prototype.onWake = function () {

};

StructureTower.prototype.onDefer = function () {
	this.clearTarget();
	this.clearTarget('hid');
	this.clearTarget('rid');
};

const { defer } = StructureTower.prototype;
StructureTower.prototype.defer = function (ticks) {
	return defer.call(this, Math.min(50, ticks));
};

StructureTower.prototype.getAttackStrategy = function () {
	if (!this.memory.att) {
		this.memory.att = TOWER_STRATEGY_CHANGE;
		this.memory.ats = _.random(0, MAX_ATTACK_STRATEGY);
		Log.info(`Tower ${this.id} changing attack strategy to ${this.memory.ats}`, 'Tower');
	} else this.memory.att--;
	return this.memory.ats;
};

StructureTower.prototype.minmaxAttack = function (selector = _.min) {
	var target = selector(this.room.intruders, c => c.damage || 0);
	if (target === Infinity || target === -Infinity)
		return ERR_NOT_FOUND;
	return this.attack(target);
};

StructureTower.prototype.runAttack = function () {
	if (!this.room.intruders || !this.room.intruders.length)
		return false;
	switch (this.getAttackStrategy()) {
		case TOWER_STRATEGY_CLOSEST_CTRL:
			return this.attack(this.room.controller.pos.findClosestByRange(this.room.intruders)) === OK;
		case TOWER_STRATEGY_CLOSEST:
			return this.attack(this.pos.findClosestByRange(this.room.intruders)) === OK;
		default:
		case TOWER_STRATEGY_DISTRIBUTE:
			return this.minmaxAttack(_.min) === OK;
		case TOWER_STRATEGY_FIRST:
			return this.attack(_.first(this.room.intruders)) === OK;
		case TOWER_STRATEGY_FOCUS:
			return this.minmaxAttack(_.max) === OK;
		case TOWER_STRATEGY_RANDOM:
			return this.attack(_.sample(this.room.intruders)) === OK;
		case TOWER_STRATEGY_WEAKEST:
			return this.attack(_.min(this.room.intruders, 'hits')) === OK;
		case TOWER_STRATEGY_TOUGHEST:
			return this.attack(_.max(this.room.intruders, 'hits')) === OK;
		case TOWER_STRATEGY_HEAL:
			return this.runHeal() === OK || this.attack(_.max(this.room.intruders, 'hits')) === OK;
	}
};

// 2017-04-05: Target locks repair candidate, if it gets low on energy it 
// 2016-10-25: Tower repairs don't run if the room is low on energy.
// 2016-10-15: Switched back to lower, 'reasonable' limit to fix road decay / spawn choke issue.
// 2016-10-15: Higher limit is applied only if we have the energy to spare.
// @todo hits / hitsMax < pct && hits < TOWER_REPAIR  * CONTROLLER[8][TOWER]
StructureTower.prototype.runRepair = function () {
	if (Game.time < this.getNextRepairTick())
		return false;
	var weak = this.getRepairTarget();
	if (weak)
		return this.repair(weak) === OK;
	else
		this.delayNextRepair();
	return false;
};

/**
 * 
 */
StructureTower.prototype.getNextRepairTick = function () {
	if (!this.memory.repairTick)
		this.memory.repairTick = Game.time;
	return this.memory.repairTick;
};

const MAX_REPAIR_DELAY = 80;
StructureTower.prototype.delayNextRepair = function () {
	if (!this.memory.repairDelay)
		this.memory.repairDelay = 1;
	this.memory.repairTick = Game.time + this.memory.repairDelay;
	this.memory.repairDelay = Math.min(this.memory.repairDelay * 2, MAX_REPAIR_DELAY);
	Log.debug(`Tower ${this.id} delaying for ${this.memory.repairDelay} ticks`, 'Tower');
	return this.memory.repairDelay;
};

// @todo consider caching this for a couple ticks
StructureTower.prototype.getRepairTarget = function () {
	const targets = _.filter(this.room.structures, s => s.hits / s.hitsMax < TOWER_REPAIR_THRESHOLD && s.hits < TOWER_REPAIR_MAX_HITS);
	return _.min(targets, 'hits');
};

StructureTower.prototype.runHeal = function () {
	// var weak = this.pos.findClosestByRange(FIND_CREEPS, {filter: c => c.my && c.hitPct < 1});
	// var weak = _.find(this.room.find(FIND_CREEPS), c => c.hitPct < 1 && (c.my || Player.status(c.owner.username) == PLAYER_STATUS.ALLY));
	// if(weak)
	//	this.heal(weak);
	// let weak = _.first(this.room.hurtCreeps);
	/* let weak = _.min(this.room.hurtCreeps, c => c.hits / c.hitsMax);
	if(weak && weak != Infinity)
		return this.heal(weak) === OK; */

	var target = this.getTarget(
		() => [...this.room.hurtCreeps, ...this.room.hurtPowerCreeps],
		(c) => c.pos.roomName === this.pos.roomName && c.hits < c.hitsMax,
		(candidates) => this.pos.findClosestByRange(candidates),
		'hid'
	);
	if (target)
		return this.heal(target) === OK;
	return false;
};

/**
 * Adjust creep hit points on the same tick for intelligent decision making.
 */
const { heal, attack, repair } = StructureTower.prototype;
StructureTower.prototype.heal = function (target) {
	const status = heal.call(this, target);
	if (status === OK) {
		this.isBusy = true;
		// let hits = target.hits + this.getHealCalc(target);
		const hits = target.hits + TOWER_HEAL_EFFECT[this.pos.getRangeTo(target)];
		const val = Math.min(target.hitsMax, hits);
		Object.defineProperty(target, 'hits', { value: val, configurable: true });
		// console.log('[Tower] Tower ' + this.pos + ' Assigning new value ' + val + ' to creep ' + target + ' hits at tick ' + Game.time);
	}
	return status;
};

StructureTower.prototype.attack = function (target) {
	const status = attack.call(this, target);
	if (status === OK) {
		this.isBusy = true;
		target.damage = (target.damage || 0) + TOWER_DAMAGE_EFFECT[this.pos.getRangeTo(target)];
	}
	return status;
};

StructureTower.prototype.repair = function (target) {
	const status = repair.call(this, target);
	if (status === OK) {
		this.isBusy = true;
		this.memory.repairDelay = 1; // reset backoff
		if (this.memory.lastRepair)
			Log.debug(`Time since last repair: ${(Game.time - this.memory.lastRepair)} ticks for ${this.id}`, 'Tower');
		this.memory.lastRepair = Game.time;
	}
	return status;
};

// Can't do same-tick damage calculations because of ramparts

/**
 * Helpers
 */
StructureTower.prototype.getDamageCalc = function (target) {
	var from = (target.pos ? target.pos : target);
	const range = this.pos.getRangeTo(from);
	if (range > TOWER_FALLOFF_RANGE) {
		return TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF);
	} else if (range <= TOWER_OPTIMAL_RANGE) {
		return TOWER_POWER_ATTACK;
	} else {
		return (25 - range) * 30; // Where do these numbers come from?
	}
	// return Math.max(150, Math.min(TOWER_POWER_ATTACK, (25 - distance) * 30))
};

StructureTower.getDamageValue = function (range) {
	var effect = TOWER_POWER_ATTACK;
	if (range > TOWER_OPTIMAL_RANGE) {
		if (range > TOWER_FALLOFF_RANGE) {
			range = TOWER_FALLOFF_RANGE;
		}
		effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
	}
	return Math.floor(effect);
};

StructureTower.getRepairValue = function (range) {
	var effect = TOWER_POWER_REPAIR;
	if (range > TOWER_OPTIMAL_RANGE) {
		if (range > TOWER_FALLOFF_RANGE) {
			range = TOWER_FALLOFF_RANGE;
		}
		effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
	}
	return Math.floor(effect);
};

// Unsuported let compound assignment
StructureTower.getHealValue = function (range) {
	var effect = TOWER_POWER_HEAL;
	if (range > TOWER_OPTIMAL_RANGE) {
		if (range > TOWER_FALLOFF_RANGE) {
			range = TOWER_FALLOFF_RANGE;
		}
		effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
	}
	return Math.floor(effect);
};

global.TOWER_DAMAGE_EFFECT = [];
global.TOWER_REPAIR_EFFECT = [];
global.TOWER_HEAL_EFFECT = [];
for (var i = 0; i < 50; i++) {
	TOWER_DAMAGE_EFFECT[i] = StructureTower.getDamageValue(i);
	TOWER_REPAIR_EFFECT[i] = StructureTower.getRepairValue(i);
	TOWER_HEAL_EFFECT[i] = StructureTower.getHealValue(i);
}


StructureTower.prototype.getDamageMitigation = function (creep) {
	// HEAL_POWER, BOOSTS[HEAL]
	// RANGED_HEAL_POWER
	// return _.sum(creep.body, p =>  )
	return creep.getActiveBodyparts(HEAL) * HEAL_POWER;
};

StructureTower.prototype.stats = function () {
	var creeps = this.room.find(FIND_CREEPS);
	_.each(creeps, (c) => console.log("Estimated damage to " + c.name + " ==> " + this.getDamageCalc(c) + ' at ' + this.pos.getRangeTo(c)));
};