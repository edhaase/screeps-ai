/**
 * ext-structure-tower.js
 * 
 * Expected behavior for towers:
 *
 *   The versatile tower structure can attack, heal, and repair from it's location, but
 * has limited energy and can only perform one action per tick, so it should choose
 * it's behavior carefully.
 *
 * Primary action is attack hostiles. If no hostiles are present it will use only it's upper
 * margin of energy for repairs anad heal operations.
 *
 * Logic for operating towers/turrets.
 * @todo assign damage during tick, if no valid targets find targets valid to other towers and assist.
 * @todo: fudge the numbers a little (noise function?!)
 */
'use strict';
 
// global.TOWER_DAMAGE_EFFECT = [600,600,600,600,600,600,570,540,510,480,450,420,390,360,330,300,270,240,210,180,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150,150];
// global.TOWER_REPAIR_EFFECT = [800,800,800,800,800,800,760,720,680,640,600,560,520,480,440,400,360,320,280,240,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200];
// global.TOWER_HEAL_EFFECT = [400,400,400,400,400,400,380,360,340,320,300,280,260,240,220,200,180,160,140,120,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100];

StructureTower.prototype.onWake = function() {
	
} 

StructureTower.prototype.onDefer = function() {
	this.clearTarget();
	this.clearTarget('hid');
	this.clearTarget('rid');
}
 
/**
 * Structure run method
 */
StructureTower.prototype.run = function () {
	if(this.energy < TOWER_ENERGY_COST || this.isDeferred() || this.isBusy)
		return;
	if(this.runAttack())
		return;
	if(this.energyPct > 0.75) {
		// if(this.runHeal() || this.runRepair())
		if(this.runHeal())
			return;
		this.runRepair();
	}
	// if(this.energyPct > 0.75 && this.runHeal())
	//	return;			
	// if(!CPU_LIMITER && this.energyPct > 0.85)
	// if(this.energyPct > 0.85 && !CPU_LIMITER
	//)// && this.room.storage && this.room.storage.store.energy > 50000) // Otherwise we'll starve extensions.
	//	this.runRepair();
	// If we didn't attack or heal, but ran repairs, defer for a random period.
	// this.defer(_.random(2,7));
	
	// Longer repair runs mean longer naps
	this.defer(_.random(7,16));
}

let defer = StructureTower.prototype.defer;
StructureTower.prototype.defer = function(ticks) {
	return defer.call(this, Math.min(50, ticks));
}

StructureTower.prototype.distributedAttack = function() {	
	var target = _.min(this.room.hostiles, c => c.damage || 0);	
	if(target === Infinity)
		return ERR_NOT_FOUND;
	let status = this.attack(target);
	if(status === OK) {
		var range = this.pos.getRangeTo(target);
		target.damage = (target.damage || 0) + TOWER_DAMAGE_EFFECT[range];
		this.room.visual.line(this.pos, target.pos);
	}
	return status;
}

StructureTower.prototype.runAttack = function() {	
	// Exploitable still	
	/* var target = this.getTarget(
		() => this.room.hostiles,
		(c) => c.pos.roomName === this.pos.roomName && (c.owner.username == 'Invader' || c.hasActiveNonMovePart()) && this.getDamageMitigation(c) < TOWER_DAMAGE_EFFECT[this.pos.getRangeTo(c)],
		(candidates) => this.pos.findClosestByRange(candidates)
	); */
	return this.distributedAttack() === OK;
	/* if(_.isEmpty(this.room.hostiles))
		return false;
	var target = _.max(this.room.hostiles, c => c.threat / this.pos.getRangeTo(c));	
	if(target) {
		return this.attack(target) === OK;
	} else
		return false; */
	/* var threats = this.room.hostiles;
	if(threats == undefined || threats.length <= 0)
		return false;

	var targets = _.filter(threats, c => this.getDamageMitigation(c) < this.getDamageCalc(c));
	var threat = null;
	if(_.isEmpty(targets)) {
		// Log.warn('[Tower] ' + this.pos + ', no hostiles valid for attack');
		// return false;			
		threat = this.pos.findClosestByRange(threats);
	} else {
		threat = _.max(targets, c => c.threat / this.pos.getRangeTo(c));
	}
	
	if(!threat)
		return false;
	
	let status = this.attack(threat);
	if( status !== OK ) {
		Log.notify("WARNING: Tower at " + this.pos + " failed to attack target " + threat + " with status " + status);
		switch(status) {
			case ERR_NOT_ENOUGH_ENERGY:
			case ERR_INVALID_ARGS:
				break;
			case ERR_RCL_NOT_ENOUGH:
			default:
				this.defer(3);
				break;
		}			
	} */
	return true;	
}

// 2017-04-05: Target locks repair candidate, if it gets low on energy it 
// 2016-10-25: Tower repairs don't run if the room is low on energy.
// 2016-10-15: Switched back to lower, 'reasonable' limit to fix road decay / spawn choke issue.
// 2016-10-15: Higher limit is applied only if we have the energy to spare.
// @todo: hits / hitsMax < pct && hits < TOWER_REPAIR  * CONTROLLER[8][TOWER]
StructureTower.prototype.runRepair = function() {
	if(Game.time < this.getNextRepairTick())
		return false;	
	var weak = this.getRepairTarget();		
	if(weak)
		return this.repair(weak) === OK;
	else
		this.delayNextRepair();	
	return false;
}

/**
 * 
 */
StructureTower.prototype.getNextRepairTick = function() {
	if(!this.memory.repairTick)
		this.memory.repairTick = Game.time;
	return this.memory.repairTick;
}

const MAX_REPAIR_DELAY = 80;
StructureTower.prototype.delayNextRepair = function() {
	if(!this.memory.repairDelay)
		this.memory.repairDelay = 1;	
	this.memory.repairTick = Game.time + this.memory.repairDelay;
	this.memory.repairDelay = Math.min(this.memory.repairDelay*2, MAX_REPAIR_DELAY);	
	Log.debug(`Tower ${this.id} delaying for ${this.memory.repairDelay} ticks`, 'Tower');
	return this.memory.repairDelay;
}

StructureTower.prototype.getRepairTarget = function() {
	if(this.room.storage && this.room.storage.store.energy > 200000)
		return this.room.findWeakestStructure(REPAIR_LIMIT[this.room.controller.level]);
	else
		return this.room.findWeakestStructure(20000 * this.room.controller.level);		
}

StructureTower.prototype.runHeal = function() {
	// var weak = this.pos.findClosestByRange(FIND_CREEPS, {filter: c => c.my && c.hitPct < 1});
	// var weak = _.find(this.room.find(FIND_CREEPS), c => c.hitPct < 1 && (c.my || Player.status(c.owner.username) == PLAYER_ALLY));
	// if(weak)
	//	this.heal(weak);
	// let weak = _.first(this.room.hurtCreeps);
	/* let weak = _.min(this.room.hurtCreeps, c => c.hits / c.hitsMax);
	if(weak && weak != Infinity)
		return this.heal(weak) === OK; */
	
	var target = this.getTarget(
		() => this.room.hurtCreeps,
		(c) => c.pos.roomName === this.pos.roomName && c.hits < c.hitsMax,
		(candidates) => this.pos.findClosestByRange(candidates),
		'hid'
	);
	if(target)
		return this.heal(target) === OK;
	return false;
}

/**
 * Adjust creep hit points on the same tick for intelligent decision making.
 */
let heal = StructureTower.prototype.heal;
StructureTower.prototype.heal = function(target) {
	let status = heal.call(this,target);
	if(status === OK) {
		this.isBusy = true;
		// let hits = target.hits + this.getHealCalc(target);
		let hits = target.hits + TOWER_HEAL_EFFECT[this.pos.getRangeTo(target)];
		let val = Math.min(target.hitsMax, hits);
		Object.defineProperty(target, 'hits', {value: val, configurable: true});
		// console.log('[Tower] Tower ' + this.pos + ' Assigning new value ' + val + ' to creep ' + target + ' hits at tick ' + Game.time);
	}
	return status;
}

let attack = StructureTower.prototype.attack;
StructureTower.prototype.attack = function(target) {
	let status = attack.call(this,target);
	if(status === OK)
		this.isBusy = true;
	return status;
}

let repair = StructureTower.prototype.repair;
StructureTower.prototype.repair = function(target) {
	let status = repair.call(this,target);
	if(status === OK) {
		this.isBusy = true;
		this.memory.repairDelay = 1; // reset backoff
		if(this.memory.lastRepair)
			Log.debug(`Time since last repair: ${(Game.time-this.memory.lastRepair)} ticks for ${this.id}`, 'Tower');
		this.memory.lastRepair = Game.time;
	}
	return status;
}

// Can't do same-tick damage calculations because of ramparts

/**
 * Helpers
 */
StructureTower.prototype.getDamageCalc = function(target) {
	var from = ( target.pos ? target.pos : target );
	const range = this.pos.getRangeTo(from);	
	if (range > TOWER_FALLOFF_RANGE) {
		return TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF);
	} else if (range <= TOWER_OPTIMAL_RANGE) {
		return TOWER_POWER_ATTACK;
	} else {
		return (25 - range) * 30; // Where do these numbers come from?
	}
	// return Math.max(150, Math.min(TOWER_POWER_ATTACK, (25 - distance) * 30))
}

StructureTower.getDamageValue = function(range) {
	let effect = TOWER_POWER_ATTACK;
    if(range > TOWER_OPTIMAL_RANGE) {
        if(range > TOWER_FALLOFF_RANGE) {
            range = TOWER_FALLOFF_RANGE;
        }
        effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
    }
    return Math.floor(effect);
}

StructureTower.getRepairValue = function(range) {	
	let effect = TOWER_POWER_REPAIR;
    if(range > TOWER_OPTIMAL_RANGE) {
        if(range > TOWER_FALLOFF_RANGE) {
            range = TOWER_FALLOFF_RANGE;
        }
        effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
    }
    return Math.floor(effect);
}

StructureTower.getHealValue = function(range) {
	let effect = TOWER_POWER_HEAL;
    if(range > TOWER_OPTIMAL_RANGE) {
        if(range > TOWER_FALLOFF_RANGE) {
            range = TOWER_FALLOFF_RANGE;
        }
        effect -= effect * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
    }
    return Math.floor(effect);
}

global.TOWER_DAMAGE_EFFECT = [];
global.TOWER_REPAIR_EFFECT = [];
global.TOWER_HEAL_EFFECT = [];
for(var i=0; i<50; i++) {
	TOWER_DAMAGE_EFFECT[i] = StructureTower.getDamageValue(i);
	TOWER_REPAIR_EFFECT[i] = StructureTower.getRepairValue(i);
	TOWER_HEAL_EFFECT[i] = StructureTower.getHealValue(i);
}


StructureTower.prototype.getDamageMitigation = function(creep) {
	// HEAL_POWER, BOOSTS[HEAL]
	// RANGED_HEAL_POWER
	// return _.sum(creep.body, p =>  )
	return creep.getActiveBodyparts(HEAL) * HEAL_POWER;
}

StructureTower.prototype.stats = function() {
	var creeps = this.room.find(FIND_CREEPS);
	_.each(creeps, (c) => console.log("Estimated damage to " + c.name + " ==> " + this.getDamageCalc(c) + ' at ' + this.pos.getRangeTo(c)));
}