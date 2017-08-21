/**
 * extension-creep.js
 * 
 * Prototype extensions for creeps
 */
"use strict";

defineCachedGetter(Creep.prototype, 'ticksToLiveMax', (c) => c.hasBodypart(CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME);
defineCachedGetter(Creep.prototype, 'carryTotal', (c) => _.sum(c.carry));
defineCachedGetter(Creep.prototype, 'carryCapacityAvailable', (c) => c.carryCapacity - c.carryTotal);
defineCachedGetter(Creep.prototype, 'cost', (c) => _.sum(c.body, p => BODYPART_COST[p.type]));
defineCachedGetter(Creep.prototype, 'cpt', (c) => _.round(c.cost / c.ticksToLiveMax, 3));


// Not cached as this can change mid-tick
defineGetter(Creep.prototype, 'hitPct', c => c.hits / c.hitsMax);

defineCachedGetter(Creep.prototype, 'canMove',  (c) => c.fatigue === 0);
defineCachedGetter(Creep.prototype, 'canAttack',  (c) => c.hasActiveBodypart(ATTACK));
defineCachedGetter(Creep.prototype, 'canRanged',  (c) => c.hasActiveBodypart(RANGED_ATTACK));
defineCachedGetter(Creep.prototype, 'canHeal',  (c) => c.hasActiveBodypart(HEAL));
defineCachedGetter(Creep.prototype, 'canFight',  (c) => c.canAttack || c.canRanged);
 

/**
 *
 */
Creep.prototype.isBoosted = function() {
	return _.any(this.body, p => p.boost != undefined);
};

/**
 *
 */
Creep.prototype.isFriendly = function() {
	return (this.my === true) || Player.status(this.owner.username) >= PLAYER_TRUSTED;
};


/**
 * Like _.countBy for active bodyparts, best used with destructuring:
 * let {work, move, carry} = creep.getAllActiveBodyparts();
 */
Creep.prototype.getAllActiveBodyparts = function() {
	var rtn = {};
	for(var i = this.body.length-1; i>=0; i--) {
		if (this.body[i].hits <= 0)
			break;
		rtn[this.body[i].type] = (rtn[this.body[i].type] || 0) + 1;
	}
	return rtn;
};
 
/**
 * Replaces the built-in getActiveBodyparts, which uses _.filter
 * with a faster version.
 * 2017-02-06: Broken by code update.
 */
Creep.prototype.getActiveBodyparts = function (type) {      
	var count = 0;
	var i;
	for(i = this.body.length-1; i>=0; i--) {
		if (this.body[i].hits <= 0)
			break;
		if (this.body[i].type === type)
			count++;		
	}
	return count;
};

// Similar to active bodyparts but doesn't care if it's damaged.
Creep.prototype.getBodyParts = function (p) {
	return _.sum(this.body, ({type}) => (type === p));
};

/**
 * Slightly faster if we just want to know if we're capable of something.
 */
Creep.prototype.hasActiveBodypart = function(type) {
	var i;
	for(i = this.body.length-1; i>=0; i--) {
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
Creep.prototype.hasActiveNonMovePart = function() {
	var i, body = this.body;;
	for(i = body.length-1; i>=0; i--) {
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
Creep.prototype.forActiveBodyparts = function(fn ,filter=null) {
	var i, part, body = this.body;
	for(i = body.length-1; i>=0; i--) {
		part = body[i];
		if (part.hits <= 0)
			break;
		if(filter && filter!==part.type)
			continue;
		fn.call(this, part);
	}
};

Creep.prototype.getUsedCarryParts = function() {
	var i, cap, part, body = this.body;
	var amount = _.sum(this.carry);
	var count=0;
	for(i = body.length-1; i>=0; i--) {
		var {hits,boost,type} = body[i];
		if(hits <= 0 || amount <= 0)
			break;
		if(type !== CARRY)
			continue;
		if(!boost)
			cap = CARRY_CAPACITY;
		else
			cap = CARRY_CAPACITY * BOOSTS[CARRY][boost];
		amount -= cap;
		count++;
	}
	return count;
};

/**
 * The damage this creep can do if we attack.
 */
Creep.prototype.getAttackPower = function() {
	return this.sumActiveBodyparts(({boost}) => ATTACK_POWER * (!boost)?1:(BOOSTS[ATTACK][boost]['attack'] || 1),ATTACK);	
};

Creep.prototype.getRangedAttackPower = function() {
	return this.sumActiveBodyparts(
		({boost}) => RANGED_ATTACK_POWER * _.get(BOOSTS, [RANGED_ATTACK, boost, 'rangedAttack'], 1),
		RANGED_ATTACK );
};

Creep.prototype.getRangedHealPower = function() {
	
};

Creep.prototype.calcEffective = function(base, type, method) {
	return this.sumActiveBodyparts(({boost}) => base * _.get(BOOSTS[type],[boost, method],1), type)
};

Creep.prototype.sumActiveBodyparts = function(fn=()=>1,filter=null) {
	var i, part, body = this.body;
	var total = 0;
	for(i = body.length-1; i>=0; i--) {		
		part = body[i];
		if (part.hits <= 0)
			break;
		if(filter && filter!==part.type)
			continue;
		total += fn.call(this, part);
	}
	return total;
};

Creep.prototype.hasBodypart = function(type) {
	return _.any(this.body, ({t}) => t === type);
};

/**
 * Modifer is optional, pass cost of moving to a spawn for recycle
 * Should be clamped to 0 <= x <= this.cost
 */
Creep.prototype.getRecycleWorth = function(modifier=0) {
	return Math.floor(this.cost * 1 * Math.max(0,this.ticksToLive-modifier) / this.ticksToLiveMax);
};
 
Creep.prototype.getSuicideWorth = function() {
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
Creep.prototype.isWorthRecycling = function(minReturn=10, steps=0) {
	return this.ticksToLive >= ((minReturn*this.ticksToLiveMax) + (steps*this.cost)) / this.cost;
};
	
Creep.prototype.getHealing = function() {
	var heal = 0;
	for(var i = this.body.length-1; i>=0; i--) {
		let part = this.body[i];
		if(part.hits <= 0) break;
		if(part.type !== HEAL) continue;			
		heal = heal + HEAL_POWER * (part.boost?BOOSTS[HEAL][part.boost][HEAL]:1);
	}
	return heal;
};	

Creep.prototype.getRangedHealing = function() {
	var heal = 0;
	for(var i = this.body.length-1; i>=0; i--) {
		let part = this.body[i];
		if(part.hits <= 0) break;
		if(part.type !== HEAL) continue;			
		heal += RANGED_HEAL_POWER * (part.boost?BOOSTS[HEAL][part.boost]['rangedHeal']:1);
	}
	return heal;
};

defineCachedGetter(Creep.prototype, 'weight', function(creep) {
	return _.sum(creep.body, p => (p.type !== MOVE && p.type !== CARRY) ) + Math.ceil(this.carryTotal / CARRY_CAPACITY);;
});

defineCachedGetter(Creep.prototype, 'totalMove', (c) => c.getActiveBodyparts(MOVE)); 
/**
 * Speed across various terrains
 */
defineCachedGetter(Creep.prototype, 'plainSpeed', (creep) =>  Math.ceil(1 * creep.weight / creep.totalMove) );
defineCachedGetter(Creep.prototype, 'swampSpeed', (creep) => Math.ceil(5 * creep.weight / creep.totalMove) );
defineCachedGetter(Creep.prototype, 'roadSpeed', (creep) => Math.ceil(0.5 * creep.weight / creep.totalMove) );

Creep.prototype.findCarry = function() {
	return _.findKey(this.carry, (amt,key) => amt > 0);
};

/**
 * @todo: _.findLastKey?
 */
Creep.prototype.transferAny = function(target) {
	var res = _.findKey(this.carry, (amt,key) => amt > 0);
	if(!res)
		return ERR_NOT_ENOUGH_RESOURCES;
	else
		return this.transfer(target, res);
};

Creep.prototype.isCarryingNonEnergyResource = function() {
	// return !_(this.carry).omit('energy').isEmpty();
	return _.any(this.carry, (amt,key) => amt > 0 && key != RESOURCE_ENERGY);
};

defineCachedGetter(Creep.prototype, 'threat', function (creep) {
	if (this.my) // don't attack friendlies.
		return 0;
	if (Player.status(this.owner.username) >= PLAYER_TRUSTED)
		return 0;
	// @todo: account for boosts
	// @todo: damaged parts lower threat (extra fatigue?) - 0.5 or 1.0
	return _.sum(this.body, p => (p.hits <= 0) ? 0 : (BODYPART_THREAT[p.type] || 1));
});