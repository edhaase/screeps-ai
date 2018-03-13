/**
 * Rampart overrides
 * 2016-11-30: Now sets max hits based on purpose
 * 2017-01-08: Raised period of time between updates, since repair operations are a slow business.
 */
"use strict";

StructureRampart.prototype.decay = RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME;

/**
 * Fix for a missing rampart is public check.
 */
const { setPublic } = StructureRampart.prototype;
StructureRampart.prototype.setPublic = function (status) {
	if (status !== this.isPublic)
		return setPublic.call(this, status);
	return OK;
};

// Insane cpu sink below. Works but doesn't really accomplish anything.

/* StructureRampart.prototype.run = function() {
	// this.updateHits();
	// @todo: every 10000 ticks, cache structure we're protecting.	
	if(this.hits <= RAMPART_DECAY_AMOUNT && this.ticksToDecay < 60) {
		var tower = this.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_TOWER && !this.isBusy});
		var status = tower.repair(this);		
	}
	
	if(BUCKET_LIMITER || CPU_LIMITER)
		return;
	if(this.isDeferred())
		return;
	this.defer(_.random(4000,12000));
		
	if(!this.pos.isEnclosed()) {
		if(this.memory.mhp !== undefined)
			delete this.memory.mhp;
	} else {
		var ps = this.getProtectedStructure();
		if(ps && ps.structureType !== STRUCTURE_CONTAINER &&  ps.structureType !== STRUCTURE_ROAD)
			delete this.memory.mhp;
		else
			this.memory.mhp = REDUCED_RAMPART_GOAL;
	}
	
	if(_.isEmpty(Memory.structures[this.id]))
		delete Memory.structures[this.id];
}

defineCachedGetter(StructureRampart.prototype, 'hitsMax', function(s) {
	return (s.my === true && s.memory.mhp)?s.memory.mhp:RAMPART_HITS_MAX[s.room.controller.level];
});

// Return non-rampart structure at this position, but cache it.
StructureRampart.prototype.getProtectedStructure = function() {
	if(!this.cache.lastUpdate || Game.time - this.cache.lastUpdate > 1000) {
		var s = _.find(this.pos.lookFor(LOOK_STRUCTURES), s => s.structureType !== STRUCTURE_RAMPART);		
		this.cache.sid = (s)?s.id:null;
		this.cache.lastUpdate = Game.time;
	}
	return (this.cache.sid)?Game.getObjectById(this.cache.sid):null;
}

// Cache hit points and fire an event when they change.
StructureRampart.prototype.updateHits = function() {
	// May not trigger if doing less than 300 hits per tick.
	// if(this.hits < this.cache.hits && this.ticksToDecay < RAMPART_DECAY_TIME)
	// ^ lag beind may break this
	var cachedHits = this.cache.hits;
	if(cachedHits) {
		if(this.hits < (cachedHits - RAMPART_DECAY_AMOUNT))
			this.onLostHits(cachedHits - this.hits);
		if(this.hits > cachedHits)
			this.onGainedHits(this.hits - cachedHits);			
	}
	this.cache.hits = this.hits;
}

StructureRampart.prototype.onGainedHits = function(diff) {
	// Log.warn('Rampart received ' + diff + ' hits!');
}

StructureRampart.prototype.onLostHits = function(diff) {
	Log.warn('Rampart taking hits at ' + this.pos + '! (' + diff + ')');
} */