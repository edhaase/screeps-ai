/**
 * extension-creep.js
 * 
 * Prototype extensions for creeps
 */
'use strict';

/* global DEFINE_CACHED_GETTER, DEFINE_GETTER, CREEP_RANGED_ATTACK_RANGE, UNIT_COST */
/* global Player, PLAYER_TRUSTED, */
/* global FATIGUE_BASE, FATIGUE_SWAMP, FATIGUE_ROAD */


DEFINE_CACHED_GETTER(Creep.prototype, 'ticksToLiveMax', (c) => c.hasBodypart(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME);
DEFINE_CACHED_GETTER(Creep.prototype, 'ttlPct', (c) => c.ticksToLive / c.ticksToLiveMax);
DEFINE_CACHED_GETTER(Creep.prototype, 'carryTotal', (c) => _.sum(c.carry));
DEFINE_CACHED_GETTER(Creep.prototype, 'carryCapacityAvailable', (c) => c.carryCapacity - c.carryTotal);
DEFINE_CACHED_GETTER(Creep.prototype, 'cost', ({ body }) => UNIT_COST(body));

const COST_PER_TICK_PRECISION = 3;
DEFINE_CACHED_GETTER(Creep.prototype, 'cpt', (c) => _.round(c.cost / c.ticksToLiveMax, COST_PER_TICK_PRECISION));

DEFINE_GETTER(Creep.prototype, 'hitPct', c => c.hits / c.hitsMax); // Not cached as this can change mid-tick

DEFINE_CACHED_GETTER(Creep.prototype, 'canMove', (c) => c.fatigue === 0);
DEFINE_CACHED_GETTER(Creep.prototype, 'canAttack', (c) => c.hasActiveBodypart(ATTACK));
DEFINE_CACHED_GETTER(Creep.prototype, 'canRanged', (c) => c.hasActiveBodypart(RANGED_ATTACK));
DEFINE_CACHED_GETTER(Creep.prototype, 'canHeal', (c) => c.hasActiveBodypart(HEAL));
DEFINE_CACHED_GETTER(Creep.prototype, 'canFight', (c) => c.canAttack || c.canRanged);

/** Scores */
DEFINE_CACHED_GETTER(Creep.prototype, 'harvestPower', (c) => c.calcEffective(HARVEST_POWER, WORK, 'harvest'));
DEFINE_CACHED_GETTER(Creep.prototype, 'repairPower', (c) => c.calcEffective(REPAIR_POWER, WORK, 'repair'));
DEFINE_CACHED_GETTER(Creep.prototype, 'dismantlePower', (c) => c.calcEffective(DISMANTLE_POWER, WORK, 'dismantle'));
DEFINE_CACHED_GETTER(Creep.prototype, 'buildPower', (c) => c.calcEffective(BUILD_POWER, WORK, 'build'));
DEFINE_CACHED_GETTER(Creep.prototype, 'attackPower', (c) => c.calcEffective(ATTACK_POWER, ATTACK, 'attack'));
DEFINE_CACHED_GETTER(Creep.prototype, 'upgradePower', (c) => c.calcEffective(UPGRADE_CONTROLLER_POWER, WORK, 'upgradeController'));
DEFINE_CACHED_GETTER(Creep.prototype, 'rangedAttackPower', (c) => c.calcEffective(RANGED_ATTACK_POWER, RANGED_ATTACK, 'rangedAttack'));
DEFINE_CACHED_GETTER(Creep.prototype, 'rangedMassAttackPower', (c) => c.calcEffective(RANGED_ATTACK_POWER, RANGED_ATTACK, 'rangedMassAttack'));
DEFINE_CACHED_GETTER(Creep.prototype, 'healPower', (c) => c.calcEffective(HEAL_POWER, HEAL, 'heal'));
DEFINE_CACHED_GETTER(Creep.prototype, 'rangedHealPower', (c) => c.calcEffective(RANGED_HEAL_POWER, HEAL, 'rangedHeal'));


/**
 *
 */
Creep.prototype.isBoosted = function () {
	return _.any(this.body, p => p.boost != null);
};

/**
 *
 */
Creep.prototype.isFriendly = function () {
	return (this.my === true) || Player.status(this.owner.username) >= PLAYER_TRUSTED;
};


/**
 * Like _.countBy for active bodyparts, best used with destructuring:
 * let {work, move, carry} = creep.getAllActiveBodyparts();
 */
Creep.prototype.getAllActiveBodyparts = function () {
	var rtn = {};
	for (var i = this.body.length - 1; i >= 0; i--) {
		if (this.body[i].hits <= 0)
			break;
		rtn[this.body[i].type] = (rtn[this.body[i].type] || 0) + 1;
	}
	return rtn;
};

/**
 * Replaces the built-in getActiveBodyparts, which uses _.filter
 * with a faster version.
 */
Creep.prototype.getActiveBodyparts = function (type) {
	var count = 0;
	var i;
	for (i = this.body.length - 1; i >= 0; i--) {
		if (this.body[i].hits <= 0)
			break;
		if (this.body[i].type === type)
			count++;
	}
	return count;
};

// Similar to active bodyparts but doesn't care if it's damaged.
Creep.prototype.getBodyParts = function (p) {
	return _.sum(this.body, ({ type }) => (type === p));
};

/**
 * Slightly faster if we just want to know if we're capable of something.
 */
Creep.prototype.hasActiveBodypart = function (type) {
	var i;
	for (i = this.body.length - 1; i >= 0; i--) {
		if (this.body[i].hits <= 0)
			break;
		if (this.body[i].type === type)
			return true;
	}
	return false;
};

/**
 * Good for determining if something is a threat.
 */
Creep.prototype.hasActiveNonMovePart = function () {
	var i, { body } = this;
	for (i = body.length - 1; i >= 0; i--) {
		if (body[i].hits <= 0)
			break;
		if (body[i].type !== MOVE)
			return true;
	}
	return false;
};

/**
 * Loop over active body parts and do.. something.
 */
Creep.prototype.forActiveBodyparts = function (fn, filter = null) {
	var i, part, { body } = this;
	for (i = body.length - 1; i >= 0; i--) {
		part = body[i];
		if (part.hits <= 0)
			break;
		if (filter && filter !== part.type)
			continue;
		fn.call(this, part);
	}
};

Creep.prototype.getUsedCarryParts = function () {
	var i, cap, { body } = this;
	var amount = _.sum(this.carry);
	var count = 0;
	for (i = body.length - 1; i >= 0; i--) {
		var { hits, boost, type } = body[i];
		if (hits <= 0 || amount <= 0)
			break;
		if (type !== CARRY)
			continue;
		if (!boost)
			cap = CARRY_CAPACITY;
		else
			cap = CARRY_CAPACITY * BOOSTS[CARRY][boost];
		amount -= cap;
		count++;
	}
	return count;
};

const distanceRate = [1.0, 1.0, 0.4, 0.1];
Creep.prototype.getRangedMassAttackPotentialToTarget = function (target, power = RANGED_ATTACK_POWER) {
	if (!target.hits || target.my)
		return 0;
	var range = this.pos.getRangeTo(target);
	if (range > CREEP_RANGED_ATTACK_RANGE)
		return 0;
	if (!(target instanceof StructureRampart) && target.pos.hasRampart())
		return 0;
	return power * distanceRate[range]; // || 0);
};

// Doesn't account for boosts.
// look calls might be faster.
Creep.prototype.getRangedMassAttackPotential = function () {
	var dmg = 0;
	var power = this.calcEffective(RANGED_ATTACK_POWER, RANGED_ATTACK, 'rangedMassAttack');
	dmg += _.sum(this.pos.findInRange(FIND_HOSTILE_CREEPS, CREEP_RANGED_ATTACK_RANGE), c => this.getRangedMassAttackPotentialToTarget(c, power));
	dmg += _.sum(this.pos.findInRange(FIND_HOSTILE_STRUCTURES, CREEP_RANGED_ATTACK_RANGE), s => this.getRangedMassAttackPotentialToTarget(s, power));
	return dmg;
};

/**
 * Calculate a creep's effectiveness at a given task, including boosts.
 *
 * @param {Number} base - Base power for action (HEAL_POWER)
 * @param {String} type - Part type (HEAL)
 * @param {String} method - Intended method (heal, rangedHeal)
 */
Creep.prototype.calcEffective = function (base, type, method) {
	return this.sumActiveBodyparts(({ boost }) => base * _.get(BOOSTS[type], [boost, method], 1), type);
};

/**
 * Iterate over active body parts, scoring them and summing a result
 */
Creep.prototype.sumActiveBodyparts = function (fn = () => 1, filter = null) {
	var i, part, { body } = this;
	var total = 0;
	for (i = body.length - 1; i >= 0; i--) {
		part = body[i];
		if (part.hits <= 0)
			break;
		if (filter && filter !== part.type)
			continue;
		total += fn.call(this, part);
	}
	return total;
};

Creep.prototype.hasBodypart = function (type) {
	return _.any(this.body, 'type', type);
};

/**
 * Modifer is optional, pass cost of moving to a spawn for recycle
 * Should be clamped to 0 <= x <= this.cost
 */
Creep.prototype.getRecycleWorth = function (modifier = 0) {
	return Math.floor(Math.min(this.cost, this.body.length * CREEP_PART_MAX_ENERGY) * 1 * Math.max(0, this.ticksToLive - modifier) / this.ticksToLiveMax);
};

Creep.prototype.getSuicideWorth = function () {
	return Math.floor(this.cost * CREEP_CORPSE_RATE * this.ticksToLive / this.ticksToLiveMax);
};

/**
 * Math heavy formula for whether a trip to recycle is worth the trouble.
 *
 * Formula states that ttl must be greater than the latter portion to return
 * the minimum amount of energy after the given number of steps.
 * 
 * https://www.symbolab.com/solver/solve-for-equation-calculator/solve%20for%20t%2C%20c%5Ccdot%5Cleft(%5Cfrac%7Bt-d%7D%7Bm%7D%5Cright)%5Cge%20x
 */
const DEFAULT_MINIMUM_RECYCLE_RETURN = 10;
Creep.prototype.isWorthRecycling = function (minReturn = DEFAULT_MINIMUM_RECYCLE_RETURN, steps = 0) {
	const maxReturn = Math.min(this.cost, this.body.length * CREEP_PART_MAX_ENERGY);
	return this.ticksToLive >= ((minReturn * this.ticksToLiveMax) + (steps * maxReturn)) / maxReturn;
};

DEFINE_CACHED_GETTER(Creep.prototype, 'weight', function (creep) {
	return _.sum(creep.body, p => (p.type !== MOVE && p.type !== CARRY)) + Math.ceil(this.carryTotal / CARRY_CAPACITY);
});

DEFINE_CACHED_GETTER(Creep.prototype, 'totalMove', (c) => c.getActiveBodyparts(MOVE));
/**
 * Speed across various terrains
 */
DEFINE_CACHED_GETTER(Creep.prototype, 'plainSpeed', (creep) => Math.ceil(FATIGUE_BASE * creep.weight / creep.totalMove));
DEFINE_CACHED_GETTER(Creep.prototype, 'swampSpeed', (creep) => Math.ceil(FATIGUE_SWAMP * creep.weight / creep.totalMove));
DEFINE_CACHED_GETTER(Creep.prototype, 'roadSpeed', (creep) => Math.ceil(FATIGUE_ROAD * creep.weight / creep.totalMove));

Creep.prototype.findCarry = function () {
	return _.findKey(this.carry, (amt) => amt > 0);
};

/**
 * @todo: _.findLastKey?
 */
Creep.prototype.transferAny = function (target) {
	var res = _.findKey(this.carry, amt => amt > 0);
	if (!res)
		return ERR_NOT_ENOUGH_RESOURCES;
	else
		return this.transfer(target, res);
};

Creep.prototype.isCarryingNonEnergyResource = function () {
	return _.any(this.carry, (amt, key) => amt > 0 && key !== RESOURCE_ENERGY);
};

DEFINE_CACHED_GETTER(Creep.prototype, 'threat', function () {
	if (this.my) // don't attack friendlies.
		return 0;
	if (Player.status(this.owner.username) >= PLAYER_TRUSTED)
		return 0;
	// @todo: account for boosts
	// @todo: damaged parts lower threat (extra fatigue?) - 0.5 or 1.0
	return _.sum(this.body, p => (p.hits <= 0) ? 0 : (BODYPART_THREAT[p.type] || 1));
});