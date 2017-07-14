/**
 * ext.js
 *
 * General purpose extensions, or prototype extensions that don't fit anywhere else.
 */
'use strict';

Array.prototype.cycle = function(n) {
	var arr = [];
	for(var i=0; i<n; i++)
		arr.push(this[i % this.length]);
	return arr;
}
 
Array.prototype.sortedInsert = function(item, fn) {
	var indx = _.sortedIndex(this, item, fn);
	this.splice(indx, 0, item);
	return this;
}

Array.prototype.sortedLastInsert = function(item, fn) {
	var indx = _.sortedLastIndex(this, item, fn);
	this.splice(indx, 0, item);
	return this;
}
 
ConstructionSite.prototype.draw = function() {
	let {room,pos,structureType} = this;
	if(room)
		this.room.visual.structure(pos.x, pos.y, structureType);
}

let ets = Error.prototype.toString;
Error.prototype.toString = function() {
	return ets.apply(this,arguments) + ` (Tick ${Game.time})`;
}
 
/**
 *
 */
Math.runningAvg = function(newest,previous,samples) {
	var p = previous;
	if ( !previous && previous !== 0 )
		p = newest;
	
	var n = p;
	n -= ( p / samples );
	n += ( newest / samples );
	return n;
}

// Cumulative moving average
Math.mAvg = function(n,p=n,s=100,w=1) {
	// return p + (n/s) - (p/s);
	// return p + (n-p)/s; // BEST!
	// console.log(`${p}+(${n}-${p})/${s} = ${p + ((n-p)/s)}`);
	// console.log(`${p}+(${w}*${n}-${p})/${s} = ${p + ((w*n-p)/s)}`);
	// console.log(`${p}+${w}*(${n}-${p})/${s} = ${p + w*(n-p)/s}`);
	// return p + (n-p)/(s/w);
	return p + (n/s/w) - (p/s);
}

Math.cmAvg = (n,p=n,s=100) => p+(n-p)/s; // Cumulutive moving average.
Math.mmAvg = (n,p=n,s=100) => ((s-1)*p+n)/s; // Modified moving average.

global.testMath = function() {
	var i,p,q,n=1.0,s = 5;	
	var a=[], b=[], c=[];	
	for(p=0,q=p,i=0; i<20; i++) {
		// p = Math.runningAvg(n,p,s);
		p = Math.mmAvg(p,n,s);
		a.push(_.round(p,2));
		q = Math.cmAvg(n,q,s);
		b.push(_.round(q,2));
	}
	
	console.log('a: ' + a.join());
	console.log('b: ' + b.join());
	
	var w = 10;
	for(p=0,i=0; i<20; i++) {
		p = Math.cmAvg(n,p,s,w);
		c.push(_.round(p,2));
	}
	console.log('c: ' + c.join());
}

Math.clamp = function(low, value, high) {
	return Math.max(low, Math.min(value, high));
}

// Courtesy of Spyingwind
// Aeyi's utility cheatsheet: https://docs.google.com/spreadsheets/d/1fvmxjqwWEHCkI5LTFA0K_aPLFAfF016E5IHZb9Xi23M/edit#gid=1779388467
global.Maths = class {
    /**
     * Quadratic / Rotated Quadratic
     * @param {number} input
     * @param {number} max - Maximum value of x
     * @param {number} weight - Quadratic weight
     * @param {boolean} rotated - make this a rotated quadratic
     * @returns {number}
     */
    static quadratic(input, max, weight, rotated = false) {
        if (rotated) {
            return 1 - Math.pow(input / max, weight);
        }
        return Math.pow(input / max, weight);
    }
    
    /**
     * Linear / SquareRoot
     * @param {number} input
     * @param {number} max
     * @param {boolean} square
     * @returns {number}
     */
    static linear(input, max, square = false) {
        if (square) {
            return Math.sqrt(input / max);
        }
        return input / max;
    }
    
    /**
     * Step
     * @param {number} input
     * @param {number} max
     * @param {number} threshold
     * @returns {number}
     */
    static step(input, max, threshold) {
        return input / max > threshold ? 1 : 0;
    }
    
    /**
     * Decay
     * @param {number} input
     * @param {number} max
     * @param {number} decay
     * @returns {number}
     */
    static decay(input, max, decay) {
        return Math.pow(decay, input / max);
    }
    
    /**
     * Sigmoid Curve / Inverse Sigmoid
     * @param {number} input
     * @param {boolean} inverse
     * @returns {number}
     */
    static sigmoidCurve(input, inverse = false) {
        if (inverse) {
            return 1 / (1 + Math.pow(Math.E, -input));
        }
        return 1 / (1 + Math.pow(Math.E, input));
    }
};


// ~44.44
global.POWER_BANK_SINGLE_SPAWN = Math.ceil(POWER_BANK_HITS / ATTACK_POWER / CREEP_LIFE_TIME);

// ATTACK_POWER: 30
// RANGED_ATTACK_POWER: 10
StructurePowerBank.prototype.getAttackPartsGoal = function() {
	return Math.ceil(this.hits / ATTACK_POWER / this.ticksToDecay);
}

StructurePowerBank.prototype.getRangedAttackPartsGoal = function() {
	return Math.ceil(this.hits / RANGED_ATTACK_POWER / this.ticksToDecay);
}

StructurePowerBank.prototype.getCarryPartsGoal = function() {
	return Math.ceil(this.power / CARRY_CAPACITY);
}

/**
 * _.sortBy(Game.constructionSites,  )
 */
/* Object.defineProperty(ConstructionSite.prototype, "priority", {
    get: function () {
        return STRUCTURE_BUILD_PRIORITY[this.structureType] || 1;
    },	
	configurable: true,
	enumerable: true
}); */

// defineCachedGetter(ConstructionSite.prototype, 'walkable', c => OBSTACLE_OBJECT_TYPES )

/**
 *
 */
Structure.prototype.getResourceCapacity = function(resourceType) {
    switch (this.structureType) {
        case STRUCTURE_CONTAINER:
        case STRUCTURE_STORAGE:
        case STRUCTURE_TERMINAL:    
            return this.storeCapacity;
        case STRUCTURE_SPAWN:
        case STRUCTURE_EXTENSION:
        case STRUCTURE_LINK:
        case STRUCTURE_TOWER:
            if (RESOURCE_ENERGY == resourceType) {
                return(this.energyCapacity);
            } else {
                return(-1);
            }
        case STRUCTURE_LAB:
            if (RESOURCE_ENERGY == resourceType) {
                return(this.energyCapacity);
            } else {
                return(this.mineralCapacity);
            }
        default: 
            return(-1);
    }
}

/**
 * StructureStorage
 */
/* StructureStorage.prototype.isActive = function() {
	return (!this.room.controller || this.room.controller.level >= 4);
}

StructureStorage.prototype.run = function() {
	if(Game.time % 5 !== 0 || this.isDeferred())
		return;
	if(this.store[RESOURCE_ENERGY] < 25000)
		Log.warn('[Storage] Storage ' + this.pos.roomName + ' low on energy!');
	
	// @todo: If RCL 6 and working terminal and we have other minerals, spawn a filler.
	this.defer(CREEP_LIFE_TIME * 2);
	let {terminal} = this.room;
	if(!terminal)
		return;
	let resource = _.findKey(this.store, (amt,key) => amt > 0 && key != RESOURCE_ENERGY);
	if(!resource)
		return;
	let amount = this.store[resource];
	Log.notify('[Storage] Storage ' + this.pos.roomName + ' excess ' + resource + ', ' + amount);
	
	let spawn = this.getClosestSpawn();
	// @todo: Check if we have one first.
	if(spawn)
		spawn.enqueue(Util.RLD([4,CARRY,4,MOVE]), null, {role: 'filler', src: this.id, dest: terminal.id, res: resource, amt: amount})	
}

*/
